/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.cache

/**
 * Caching priority tier controlling eviction order in both L1 (RAM) and L2 (Disk).
 * Lower weight values are evicted first when budgets are exceeded.
 */
enum class OimCachePriority(val weight: Int, val defaultTtlMs: Long) {
    LOW(weight = 1, defaultTtlMs = 30 * 60 * 1000L),
    NORMAL(weight = 2, defaultTtlMs = 6 * 60 * 60 * 1000L),
    HIGH(weight = 3, defaultTtlMs = 24 * 60 * 60 * 1000L),
    CRITICAL(weight = 4, defaultTtlMs = 7 * 24 * 60 * 60 * 1000L)
}

enum class OimCacheSource(val label: String) {
    MEMORY_L1("L1 RAM (0 ms I/O)"),
    DISK_L2("L2 Disco Local"),
    NETWORK_FRESH("Network (full download)"),
    NETWORK_REVALIDATED_304("Network 304 (ETag revalidated)"),
    LOCAL_STREAM("Local file / sample")
}

data class OimSdkConfig(
    val maxMemoryCacheBytes: Long = 32L * 1024L * 1024L,
    val maxDiskCacheBytes: Long = 64L * 1024L * 1024L,
    val frequencyPromotionThreshold: Int = 3,
    val maxRemotePayloadBytes: Long = 25L * 1024L * 1024L,
    val allowStaleCacheOnNetworkError: Boolean = true,
    val defaultTtlMs: Long = 6 * 60 * 60 * 1000L
)

data class OimCacheEntrySnapshot(
    val key: String,
    val label: String,
    val inMemoryL1: Boolean,
    val onDiskL2: Boolean,
    val memoryBytes: Long,
    val diskBytes: Long,
    val priority: OimCachePriority,
    val accessCount: Int,
    val eTag: String?,
    val imageHashPrefix: String,
    val isExpired: Boolean,
    val cachedAtMs: Long,
    val expiresAtMs: Long
)

data class OimCacheStats(
    val l1UsedBytes: Long,
    val l1MaxBytes: Long,
    val l1EntryCount: Int,
    val l2UsedBytes: Long,
    val l2MaxBytes: Long,
    val l2EntryCount: Int,
    val l1Hits: Long,
    val l2Hits: Long,
    val revalidated304Count: Long,
    val misses: Long,
    val evictions: Long,
    val invalidations: Long,
    val entries: List<OimCacheEntrySnapshot>
) {
    val totalRequests: Long
        get() = l1Hits + l2Hits + misses

    val hitRatePercent: Float
        get() = if (totalRequests > 0) ((l1Hits + l2Hits) * 100f) / totalRequests else 0f
}
