/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

sealed interface OimNetworkResponse {
    data class Fresh(
        val bytes: ByteArray,
        val eTag: String?,
        val lastModified: String?,
        val attemptsUsed: Int
    ) : OimNetworkResponse

    data class NotModified304(
        val eTag: String?,
        val lastModified: String?,
        val attemptsUsed: Int
    ) : OimNetworkResponse

    data class Failed(
        val error: OimLoadError,
        val attemptsUsed: Int
    ) : OimNetworkResponse
}

/**
 * Resilient OkHttp transport client for `:oim-sdk`.
 */
class OimServiceClient(
    private val context: Context? = null,
    private val maxPayloadBytes: Long = 25L * 1024L * 1024L,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()
) {
    fun isNetworkConnected(): Boolean {
        val ctx = context ?: return true
        return try {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            true
        }
    }

    suspend fun fetchWithResilience(
        url: String,
        eTag: String? = null,
        lastModified: String? = null,
        retryPolicy: OimRetryPolicy = OimRetryPolicy(),
        onRetryAttempt: (attempt: Int, maxAttempts: Int, delayMs: Long, reason: String) -> Unit = { _, _, _, _ -> }
    ): OimNetworkResponse = withContext(Dispatchers.IO) {
        val trimmed = url.trim()
        if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
            return@withContext OimNetworkResponse.Failed(
                OimLoadError.Unexpected("The URL must start with https:// or http://"),
                attemptsUsed = 1
            )
        }

        if (!isNetworkConnected()) {
            return@withContext OimNetworkResponse.Failed(
                OimLoadError.NetworkUnavailable("The device has no active network connection."),
                attemptsUsed = 1
            )
        }

        val maxAttempts = retryPolicy.maxAttempts.coerceAtLeast(1)
        var lastError: OimLoadError = OimLoadError.Unexpected("Unknown network error.")

        for (attempt in 1..maxAttempts) {
            val attemptResult = executeSingleAttempt(trimmed, eTag, lastModified, attempt)
            when (attemptResult) {
                is OimNetworkResponse.Fresh,
                is OimNetworkResponse.NotModified304 -> return@withContext attemptResult
                is OimNetworkResponse.Failed -> {
                    lastError = attemptResult.error
                    if (!attemptResult.error.isRetryable || attempt >= maxAttempts) {
                        return@withContext OimNetworkResponse.Failed(lastError, attemptsUsed = attempt)
                    }
                    val backoffMs = retryPolicy.computeDelayMs(attempt - 1)
                    onRetryAttempt(attempt + 1, maxAttempts, backoffMs, attemptResult.error.userTitle)
                    delay(backoffMs)
                }
            }
        }

        OimNetworkResponse.Failed(lastError, attemptsUsed = maxAttempts)
    }

    private fun executeSingleAttempt(
        url: String,
        eTag: String?,
        lastModified: String?,
        attempt: Int
    ): OimNetworkResponse {
        val reqBuilder = Request.Builder()
            .url(url)
            .header("Accept", "image/png, application/octet-stream, */*")
            .header("User-Agent", "OIM-Android-SDK/1.2")
        if (!eTag.isNullOrBlank()) reqBuilder.header("If-None-Match", eTag)
        if (!lastModified.isNullOrBlank()) reqBuilder.header("If-Modified-Since", lastModified)

        return try {
            httpClient.newCall(reqBuilder.build()).execute().use { response ->
                val respETag = response.header("ETag") ?: eTag
                val respLastMod = response.header("Last-Modified") ?: lastModified

                if (response.code == 304) {
                    return OimNetworkResponse.NotModified304(
                        eTag = respETag,
                        lastModified = respLastMod,
                        attemptsUsed = attempt
                    )
                }

                if (!response.isSuccessful) {
                    val retryable = response.code == 408 || response.code == 429 || response.code in 500..599
                    return OimNetworkResponse.Failed(
                        OimLoadError.HttpFailure(
                            statusCode = response.code,
                            detail = "Server answered HTTP ${response.code} ${response.message} for $url",
                            canRetry = retryable
                        ),
                        attemptsUsed = attempt
                    )
                }

                val body = response.body ?: return OimNetworkResponse.Failed(
                    OimLoadError.IncompleteStream(
                        expectedBytes = null,
                        receivedBytes = 0L,
                        detail = "The server returned an empty HTTP body."
                    ),
                    attemptsUsed = attempt
                )

                val declaredLength = body.contentLength()
                if (declaredLength > maxPayloadBytes) {
                    return OimNetworkResponse.Failed(
                        OimLoadError.PayloadTooLarge(maxPayloadBytes, declaredLength),
                        attemptsUsed = attempt
                    )
                }

                val buffer = ByteArray(16 * 1024)
                val out = ByteArrayOutputStream(
                    if (declaredLength in 1..maxPayloadBytes) declaredLength.toInt() else 64 * 1024
                )
                var totalRead = 0L
                body.byteStream().use { input ->
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        totalRead += read
                        if (totalRead > maxPayloadBytes) {
                            return OimNetworkResponse.Failed(
                                OimLoadError.PayloadTooLarge(maxPayloadBytes, totalRead),
                                attemptsUsed = attempt
                            )
                        }
                        out.write(buffer, 0, read)
                    }
                }

                val bytes = out.toByteArray()
                if (declaredLength > 0 && bytes.size.toLong() != declaredLength) {
                    return OimNetworkResponse.Failed(
                        OimLoadError.IncompleteStream(
                            expectedBytes = declaredLength,
                            receivedBytes = bytes.size.toLong(),
                            detail = "Transferencia truncada: esperados $declaredLength B, recibidos ${bytes.size} B."
                        ),
                        attemptsUsed = attempt
                    )
                }

                if (!hasCompletePngTrailer(bytes)) {
                    return OimNetworkResponse.Failed(
                        OimLoadError.IncompleteStream(
                            expectedBytes = if (declaredLength > 0) declaredLength else null,
                            receivedBytes = bytes.size.toLong(),
                            detail = "Incomplete PNG stream: no final IEND chunk."
                        ),
                        attemptsUsed = attempt
                    )
                }

                OimNetworkResponse.Fresh(
                    bytes = bytes,
                    eTag = respETag,
                    lastModified = respLastMod,
                    attemptsUsed = attempt
                )
            }
        } catch (e: SocketTimeoutException) {
            OimNetworkResponse.Failed(
                OimLoadError.Timeout(attempt, e.localizedMessage ?: "Timeout leyendo paquete OIM."),
                attemptsUsed = attempt
            )
        } catch (e: UnknownHostException) {
            OimNetworkResponse.Failed(
                OimLoadError.NetworkUnavailable("Could not resolve the host: ${e.localizedMessage}"),
                attemptsUsed = attempt
            )
        } catch (e: IOException) {
            OimNetworkResponse.Failed(
                OimLoadError.IncompleteStream(
                    expectedBytes = null,
                    receivedBytes = 0L,
                    detail = "Connection dropped while reading: ${e.localizedMessage}"
                ),
                attemptsUsed = attempt
            )
        } catch (e: Exception) {
            OimNetworkResponse.Failed(
                OimLoadError.Unexpected(e.localizedMessage ?: "Unexpected HTTP transport error."),
                attemptsUsed = attempt
            )
        }
    }

    fun hasCompletePngTrailer(bytes: ByteArray): Boolean {
        if (bytes.size < 33) return false
        val scanStart = (bytes.size - 64).coerceAtLeast(8)
        for (i in scanStart..(bytes.size - 8)) {
            if (bytes[i] == 'I'.code.toByte() &&
                bytes[i + 1] == 'E'.code.toByte() &&
                bytes[i + 2] == 'N'.code.toByte() &&
                bytes[i + 3] == 'D'.code.toByte()
            ) {
                return true
            }
        }
        return false
    }
}
