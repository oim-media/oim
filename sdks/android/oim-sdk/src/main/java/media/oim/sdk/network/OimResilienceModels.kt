/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.network

import media.oim.sdk.cache.OimCachePriority
import media.oim.sdk.cache.OimCacheSource
import media.oim.sdk.model.OimLoadedAsset
import media.oim.sdk.model.OimVerificationReport

/**
 * Exponential backoff + jitter retry configuration for resilient OIM remote fetches.
 */
data class OimRetryPolicy(
    val maxAttempts: Int = 3,
    val initialBackoffMs: Long = 350L,
    val maxBackoffMs: Long = 4_000L,
    val backoffMultiplier: Double = 2.0,
    val jitterRatio: Double = 0.20
) {
    fun computeDelayMs(attemptIndex: Int, randomFraction: Double = Math.random()): Long {
        val exp = initialBackoffMs * Math.pow(backoffMultiplier, attemptIndex.coerceAtLeast(0).toDouble())
        val clamped = exp.coerceAtMost(maxBackoffMs.toDouble())
        val jitter = clamped * jitterRatio * (randomFraction * 2.0 - 1.0)
        return (clamped + jitter).toLong().coerceAtLeast(50L)
    }
}

enum class OimLoadStage(val label: String) {
    CHECKING_CACHE("Checking L1/L2 cache…"),
    FETCHING_NETWORK("Descargando paquete .oim.png…"),
    RETRYING_NETWORK("Retrying download with backoff…"),
    DECODING_AND_VERIFYING("Scanning PNG chunks and ECDSA signature…")
}

sealed class OimLoadError(
    val userTitle: String,
    val technicalDetail: String,
    val isRetryable: Boolean
) {
    data class NetworkUnavailable(val detail: String) : OimLoadError(
        userTitle = "No network connection",
        technicalDetail = detail,
        isRetryable = true
    )

    data class Timeout(val attempts: Int, val detail: String) : OimLoadError(
        userTitle = "Timed out ($attempts attempts)",
        technicalDetail = detail,
        isRetryable = true
    )

    data class HttpFailure(val statusCode: Int, val detail: String, val canRetry: Boolean) : OimLoadError(
        userTitle = "Error HTTP $statusCode",
        technicalDetail = detail,
        isRetryable = canRetry
    )

    data class IncompleteStream(val expectedBytes: Long?, val receivedBytes: Long, val detail: String) : OimLoadError(
        userTitle = "Incomplete or truncated download",
        technicalDetail = detail,
        isRetryable = true
    )

    data class CorruptedPayload(val stage: String, val detail: String) : OimLoadError(
        userTitle = "Datos OIM corruptos ($stage)",
        technicalDetail = detail,
        isRetryable = false
    )

    data class SecurityRefused(val report: OimVerificationReport) : OimLoadError(
        userTitle = "Bloqueado por seguridad OIM (is_refused)",
        technicalDetail = report.reason,
        isRetryable = false
    )

    data class PayloadTooLarge(val maxBytes: Long, val actualBytes: Long) : OimLoadError(
        userTitle = "OIM file exceeds the limit (${maxBytes / (1024 * 1024)} MB)",
        technicalDetail = "Recibidos ${actualBytes / (1024 * 1024)} MB.",
        isRetryable = false
    )

    data class Unexpected(val detail: String) : OimLoadError(
        userTitle = "Unexpected OIM SDK error",
        technicalDetail = detail,
        isRetryable = true
    )
}

data class OimRequest(
    val key: String,
    val label: String,
    val remoteUrl: String? = null,
    val rawBytesProvider: (suspend () -> ByteArray)? = null,
    val priority: OimCachePriority = OimCachePriority.NORMAL,
    val ttlMs: Long? = null,
    val forceRefresh: Boolean = false,
    val retryPolicy: OimRetryPolicy = OimRetryPolicy()
)

sealed interface OimLoadState {
    data object Idle : OimLoadState

    data class Loading(
        val stage: OimLoadStage,
        val attempt: Int = 1,
        val maxAttempts: Int = 1,
        val lastRetryReason: String? = null
    ) : OimLoadState

    data class Success(
        val asset: OimLoadedAsset,
        val cacheSource: OimCacheSource,
        val attemptsUsed: Int = 1
    ) : OimLoadState

    data class DegradedFromCache(
        val asset: OimLoadedAsset,
        val cacheSource: OimCacheSource,
        val networkError: OimLoadError
    ) : OimLoadState

    data class Failure(
        val error: OimLoadError,
        val attemptsUsed: Int = 1
    ) : OimLoadState
}

/**
 * Item fetched from the real OIM public showcase (`https://library.oim.media/v1/showcase`).
 */
data class OimLibraryItem(
    val id: String,
    val title: String,
    val titleEn: String? = null,
    val description: String,
    val descriptionEn: String? = null,
    val author: String = "OIM",
    val category: String,
    val type: String = "image",
    val aspectRatio: String? = null,
    val tags: List<String> = emptyList(),
    val features: List<String> = emptyList(),
    val oimUrl: String,
    val thumbnailUrl: String? = null,
    val languages: List<String> = emptyList(),
    val isTemplate: Boolean = false,
    val createdAt: String? = null
) {
    fun localizedTitle(lang: String): String {
        return if (lang.startsWith("en", ignoreCase = true) && !titleEn.isNullOrBlank()) titleEn else title
    }

    fun localizedDescription(lang: String): String {
        return if (lang.startsWith("en", ignoreCase = true) && !descriptionEn.isNullOrBlank()) descriptionEn else description
    }
}

sealed interface OimLibraryLoadState {
    data object Loading : OimLibraryLoadState

    data class Loaded(
        val items: List<OimLibraryItem>,
        val sourceEndpoint: String,
        val nextCursor: String? = null,
        val isLoadingMore: Boolean = false
    ) : OimLibraryLoadState

    data class Error(
        val title: String,
        val detail: String,
        val attemptedEndpoints: List<String>
    ) : OimLibraryLoadState
}
