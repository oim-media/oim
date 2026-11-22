/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import android.content.Context
import android.net.Uri
import media.oim.sdk.cache.OimCacheManager
import media.oim.sdk.cache.OimCachePriority
import media.oim.sdk.cache.OimCacheSource
import media.oim.sdk.cache.OimCacheStats
import media.oim.sdk.cache.OimSdkConfig
import media.oim.sdk.model.OimError
import media.oim.sdk.model.OimLoadedAsset
import media.oim.sdk.network.OimLibraryClient
import media.oim.sdk.network.OimLibraryLoadState
import media.oim.sdk.network.OimLoadError
import media.oim.sdk.network.OimLoadStage
import media.oim.sdk.network.OimLoadState
import media.oim.sdk.network.OimNetworkResponse
import media.oim.sdk.network.OimRequest
import media.oim.sdk.network.OimServiceClient
import media.oim.sdk.parser.OimBinaryCodec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * Primary public entry point for `:oim-sdk` (Native Android OIM Framework).
 *
 * Orchestrates:
 * 1. Official showcase library (`https://library.oim.media/v1/showcase`) & public JWKs (`https://api.oim.media/v1/media/keys`)
 * 2. Two-tier L1 RAM + L2 Disk priority-weighted LRU cache (`OimCacheManager`)
 * 3. Resilient OkHttp fetching with exponential backoff + HTTP 304 ETag revalidation (`OimServiceClient`)
 * 4. Zero-copy NDK/DirectBuffer PNG chunk parsing, `sha256-idat` verification & ECDSA P-256 verification (`OimBinaryCodec`)
 * 5. Convenience helpers: `loadFromUrl`, `loadFromBytes`, `loadFromUri`, `fetchPublicLibrary`, `syncPublicKeys`
 */
class OimSdk(
    val config: OimSdkConfig,
    val cacheManager: OimCacheManager,
    val serviceClient: OimServiceClient,
    val libraryClient: OimLibraryClient = OimLibraryClient()
) {
    companion object {
        @Volatile
        private var sharedInstance: OimSdk? = null

        fun init(
            context: Context,
            config: OimSdkConfig = OimSdkConfig()
        ): OimSdk = getInstance(context, config)

        fun getInstance(
            context: Context,
            config: OimSdkConfig = OimSdkConfig()
        ): OimSdk {
            return sharedInstance ?: synchronized(this) {
                val appCtx = context.applicationContext
                sharedInstance ?: OimSdk(
                    config = config,
                    cacheManager = OimCacheManager(appCtx, config),
                    serviceClient = OimServiceClient(
                        context = appCtx,
                        maxPayloadBytes = config.maxRemotePayloadBytes
                    ),
                    libraryClient = OimLibraryClient(context = appCtx)
                ).also { sharedInstance = it }
            }
        }
    }

    suspend fun syncPublicKeys(apiBaseUrl: String = OimLibraryClient.DEFAULT_API_BASE_URL): Int {
        return libraryClient.syncPublicKeys(apiBaseUrl)
    }

    suspend fun fetchPublicLibrary(
        apiBaseUrl: String = OimLibraryClient.DEFAULT_API_BASE_URL,
        customCatalogUrl: String? = null,
        limit: Int = OimLibraryClient.DEFAULT_LIMIT,
        category: String? = null,
        query: String? = null,
        cursor: String? = null
    ): OimLibraryLoadState {
        return libraryClient.fetchPublicLibrary(
            apiBaseUrl = apiBaseUrl,
            customCatalogUrl = customCatalogUrl,
            limit = limit,
            category = category,
            query = query,
            cursor = cursor
        )
    }

    fun loadFromUrl(
        url: String,
        label: String = url.substringAfterLast('/').ifBlank { "remote.oim.png" },
        priority: OimCachePriority = OimCachePriority.NORMAL,
        forceRefresh: Boolean = false
    ): Flow<OimLoadState> = load(
        OimRequest(
            key = url.trim(),
            label = label,
            remoteUrl = url.trim(),
            priority = priority,
            forceRefresh = forceRefresh
        )
    )

    fun loadFromBytes(
        bytes: ByteArray,
        label: String = "memory.oim.png",
        cacheKey: String = "bytes:${bytes.size}:${bytes.contentHashCode()}",
        priority: OimCachePriority = OimCachePriority.NORMAL
    ): Flow<OimLoadState> = load(
        OimRequest(
            key = cacheKey,
            label = label,
            rawBytesProvider = { bytes },
            priority = priority,
            forceRefresh = true
        )
    )

    fun loadFromUri(
        context: Context,
        uri: Uri,
        label: String = uri.lastPathSegment ?: "local.oim.png",
        priority: OimCachePriority = OimCachePriority.HIGH
    ): Flow<OimLoadState> {
        val resolver = context.applicationContext.contentResolver
        return load(
            OimRequest(
                key = "local:$uri",
                label = label,
                rawBytesProvider = {
                    withContext(Dispatchers.IO) {
                        resolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("Could not open the local URI: $uri")
                    }
                },
                priority = priority,
                forceRefresh = true
            )
        )
    }

    fun load(request: OimRequest): Flow<OimLoadState> = flow {
        emit(OimLoadState.Loading(OimLoadStage.CHECKING_CACHE))

        if (!request.forceRefresh) {
            val l1Hit = cacheManager.getFromMemory(request.key, allowStale = false)
            if (l1Hit != null) {
                emit(OimLoadState.Success(l1Hit.asset, OimCacheSource.MEMORY_L1))
                return@flow
            }

            val l2Hit = cacheManager.getFromDisk(request.key, allowStale = false)
            if (l2Hit != null) {
                emit(OimLoadState.Loading(OimLoadStage.DECODING_AND_VERIFYING))
                when (val decoded = decodeSafe(l2Hit.bytes, l2Hit.label, request.key)) {
                    is DecodeOutcome.Ok -> {
                        cacheManager.put(
                            key = request.key,
                            asset = decoded.asset,
                            priority = l2Hit.priority,
                            eTag = l2Hit.eTag,
                            lastModified = l2Hit.lastModified,
                            writeToDisk = false
                        )
                        emit(OimLoadState.Success(decoded.asset, OimCacheSource.DISK_L2))
                        return@flow
                    }
                    is DecodeOutcome.Err -> {
                        cacheManager.invalidate(request.key)
                    }
                }
            }
        }

        cacheManager.recordCacheMiss()

        if (request.rawBytesProvider != null) {
            emit(OimLoadState.Loading(OimLoadStage.DECODING_AND_VERIFYING))
            val bytes = try {
                request.rawBytesProvider.invoke()
            } catch (e: Exception) {
                emit(
                    OimLoadState.Failure(
                        OimLoadError.Unexpected(e.localizedMessage ?: "Could not read the local bytes.")
                    )
                )
                return@flow
            }

            if (!serviceClient.hasCompletePngTrailer(bytes)) {
                emit(
                    OimLoadState.Failure(
                        OimLoadError.IncompleteStream(
                            expectedBytes = null,
                            receivedBytes = bytes.size.toLong(),
                            detail = "Truncated PNG/OIM file: the IEND chunk is missing."
                        )
                    )
                )
                return@flow
            }

            when (val decoded = decodeSafe(bytes, request.label, request.key)) {
                is DecodeOutcome.Ok -> {
                    cacheManager.put(
                        key = request.key,
                        asset = decoded.asset,
                        priority = request.priority,
                        ttlMs = request.ttlMs,
                        writeToDisk = !decoded.asset.verification.isRefused
                    )
                    emit(OimLoadState.Success(decoded.asset, OimCacheSource.LOCAL_STREAM))
                }
                is DecodeOutcome.Err -> {
                    emit(OimLoadState.Failure(decoded.error))
                }
            }
            return@flow
        }

        val url = request.remoteUrl
        if (url.isNullOrBlank()) {
            emit(
                OimLoadState.Failure(
                    OimLoadError.Unexpected("OimRequest requiere remoteUrl o rawBytesProvider.")
                )
            )
            return@flow
        }

        val (savedETag, savedLastMod) = cacheManager.getValidationHeaders(request.key)
        emit(
            OimLoadState.Loading(
                stage = OimLoadStage.FETCHING_NETWORK,
                attempt = 1,
                maxAttempts = request.retryPolicy.maxAttempts
            )
        )

        val networkResult = serviceClient.fetchWithResilience(
            url = url,
            eTag = if (request.forceRefresh) null else savedETag,
            lastModified = if (request.forceRefresh) null else savedLastMod,
            retryPolicy = request.retryPolicy
        )

        when (networkResult) {
            is OimNetworkResponse.NotModified304 -> {
                cacheManager.touchRevalidated304(request.key, request.ttlMs)
                val cached = resolveStaleFallbackAsset(request.key)
                if (cached != null) {
                    emit(
                        OimLoadState.Success(
                            asset = cached.first,
                            cacheSource = OimCacheSource.NETWORK_REVALIDATED_304,
                            attemptsUsed = networkResult.attemptsUsed
                        )
                    )
                    return@flow
                }
                emit(
                    OimLoadState.Failure(
                        OimLoadError.Unexpected("The server answered 304 but the file is no longer cached.")
                    )
                )
            }

            is OimNetworkResponse.Fresh -> {
                emit(OimLoadState.Loading(OimLoadStage.DECODING_AND_VERIFYING, networkResult.attemptsUsed.coerceAtLeast(1)))
                when (val decoded = decodeSafe(networkResult.bytes, request.label, request.key)) {
                    is DecodeOutcome.Ok -> {
                        val asset = decoded.asset
                        cacheManager.invalidateIfHashChanged(request.key, asset.verification.computedImageHash)
                        cacheManager.put(
                            key = request.key,
                            asset = asset,
                            priority = request.priority,
                            eTag = networkResult.eTag,
                            lastModified = networkResult.lastModified,
                            ttlMs = request.ttlMs,
                            writeToDisk = !asset.verification.isRefused
                        )
                        emit(
                            OimLoadState.Success(
                                asset = asset,
                                cacheSource = OimCacheSource.NETWORK_FRESH,
                                attemptsUsed = networkResult.attemptsUsed
                            )
                        )
                    }
                    is DecodeOutcome.Err -> {
                        emit(OimLoadState.Failure(decoded.error, attemptsUsed = networkResult.attemptsUsed))
                    }
                }
            }

            is OimNetworkResponse.Failed -> {
                if (config.allowStaleCacheOnNetworkError) {
                    val staleFallback = resolveStaleFallbackAsset(request.key)
                    if (staleFallback != null) {
                        emit(
                            OimLoadState.DegradedFromCache(
                                asset = staleFallback.first,
                                cacheSource = staleFallback.second,
                                networkError = networkResult.error
                            )
                        )
                        return@flow
                    }
                }
                emit(OimLoadState.Failure(networkResult.error, attemptsUsed = networkResult.attemptsUsed))
            }
        }
    }.flowOn(Dispatchers.Default)

    suspend fun prefetch(requests: List<OimRequest>): Int = coroutineScope {
        requests.map { req ->
            async(Dispatchers.IO) {
                var cachedOk = false
                load(req).collect { state ->
                    if (state is OimLoadState.Success) cachedOk = true
                }
                if (cachedOk) 1 else 0
            }
        }.awaitAll().sum()
    }

    fun pinAsCritical(key: String): Boolean = cacheManager.setPriority(key, OimCachePriority.CRITICAL)

    fun setPriority(key: String, priority: OimCachePriority): Boolean = cacheManager.setPriority(key, priority)

    fun invalidate(key: String) = cacheManager.invalidate(key)

    fun purgeExpired(): Int = cacheManager.purgeExpired()

    fun trimMemory(level: Int) = cacheManager.onTrimMemory(level)

    fun clearAllCaches() = cacheManager.clearAll()

    fun getCacheStats(): OimCacheStats = cacheManager.getStats()

    private suspend fun resolveStaleFallbackAsset(key: String): Pair<OimLoadedAsset, OimCacheSource>? {
        cacheManager.getFromMemory(key, allowStale = true)?.let {
            return it.asset to OimCacheSource.MEMORY_L1
        }
        cacheManager.getFromDisk(key, allowStale = true)?.let { diskRecord ->
            val decoded = decodeSafe(diskRecord.bytes, diskRecord.label, key)
            if (decoded is DecodeOutcome.Ok && !decoded.asset.verification.isRefused) {
                return decoded.asset to OimCacheSource.DISK_L2
            }
        }
        return null
    }

    private sealed interface DecodeOutcome {
        data class Ok(val asset: OimLoadedAsset) : DecodeOutcome
        data class Err(val error: OimLoadError) : DecodeOutcome
    }

    private suspend fun decodeSafe(
        bytes: ByteArray,
        label: String,
        cacheKey: String
    ): DecodeOutcome = withContext(Dispatchers.Default) {
        try {
            val loaded = OimBinaryCodec.decodeAndVerify(bytes, label)
            if (loaded.verification.isRefused) {
                cacheManager.invalidate(cacheKey)
            }
            DecodeOutcome.Ok(loaded)
        } catch (e: OimError.InvalidPngSignature) {
            DecodeOutcome.Err(OimLoadError.CorruptedPayload("PNG signature", e.message ?: "Invalid PNG header."))
        } catch (e: OimError.TruncatedChunk) {
            DecodeOutcome.Err(OimLoadError.IncompleteStream(null, bytes.size.toLong(), e.message ?: "Truncated chunk."))
        } catch (e: OimError.MissingOimPayload) {
            DecodeOutcome.Err(OimLoadError.CorruptedPayload("Chunk OIM", e.message ?: "Falta chunk OIM_Data."))
        } catch (e: OimError.DecompressionFailed) {
            DecodeOutcome.Err(OimLoadError.CorruptedPayload("DEFLATE", e.message ?: "Error al descomprimir DEFLATE."))
        } catch (e: OimError.MalformedJson) {
            DecodeOutcome.Err(OimLoadError.CorruptedPayload("OIM JSON", e.message ?: "Invalid JSON."))
        } catch (e: Exception) {
            DecodeOutcome.Err(OimLoadError.Unexpected(e.localizedMessage ?: "Unexpected failure decoding the OIM file."))
        }
    }
}
