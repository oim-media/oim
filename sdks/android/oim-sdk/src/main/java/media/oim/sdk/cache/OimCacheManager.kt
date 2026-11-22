/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.cache

import android.content.ComponentCallbacks2
import android.content.Context
import android.util.Log
import media.oim.sdk.model.OimLoadedAsset
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicLong

private const val TAG = "OimCacheManager"

data class DiskCacheRecord(
    val key: String,
    val fileName: String,
    val label: String,
    val bytes: ByteArray,
    val priority: OimCachePriority,
    val accessCount: Int,
    val eTag: String?,
    val lastModified: String?,
    val imageHash: String,
    val cachedAtMs: Long,
    val expiresAtMs: Long
) {
    fun isExpired(nowMs: Long = System.currentTimeMillis()): Boolean = nowMs > expiresAtMs
}

data class MemoryCacheRecord(
    val key: String,
    val asset: OimLoadedAsset,
    val sizeBytes: Long,
    var priority: OimCachePriority,
    var accessCount: Int,
    var lastAccessedMs: Long,
    val eTag: String?,
    val lastModified: String?,
    val cachedAtMs: Long,
    var expiresAtMs: Long
) {
    fun isExpired(nowMs: Long = System.currentTimeMillis()): Boolean = nowMs > expiresAtMs
}

private data class DiskIndexEntry(
    val key: String,
    val fileName: String,
    val label: String,
    val sizeBytes: Long,
    var priority: OimCachePriority,
    var accessCount: Int,
    var lastAccessedMs: Long,
    val eTag: String?,
    val lastModified: String?,
    val imageHash: String,
    val cachedAtMs: Long,
    var expiresAtMs: Long
) {
    fun isExpired(nowMs: Long = System.currentTimeMillis()): Boolean = nowMs > expiresAtMs
}

/**
 * Two-tier (L1 RAM + L2 Disk) Priority-Weighted LRU Cache Manager for `:oim-sdk`.
 * Never persists `isRefused` / tampered binaries and actively purges poisoned entries.
 */
class OimCacheManager(
    cacheRootDir: File,
    private val config: OimSdkConfig = OimSdkConfig()
) {
    constructor(context: Context, config: OimSdkConfig = OimSdkConfig()) : this(
        File(context.cacheDir, "oim_sdk_cache"),
        config
    )

    private val lock = Any()
    private val diskDir: File = cacheRootDir.apply { mkdirs() }
    private val indexFile: File = File(diskDir, "oim_cache_index.json")

    private val l1Map = LinkedHashMap<String, MemoryCacheRecord>(16, 0.75f, true)
    private val l2Index = LinkedHashMap<String, DiskIndexEntry>(32, 0.75f, true)

    private var l1CurrentBytes: Long = 0L
    private var l2CurrentBytes: Long = 0L

    private val l1Hits = AtomicLong(0)
    private val l2Hits = AtomicLong(0)
    private val revalidated304 = AtomicLong(0)
    private val misses = AtomicLong(0)
    private val evictions = AtomicLong(0)
    private val invalidations = AtomicLong(0)

    init {
        loadDiskIndex()
    }

    fun getFromMemory(
        key: String,
        allowStale: Boolean = false,
        nowMs: Long = System.currentTimeMillis()
    ): MemoryCacheRecord? = synchronized(lock) {
        val entry = l1Map[key] ?: return null
        if (entry.asset.verification.isRefused) {
            invalidateLocked(key)
            return null
        }
        if (!allowStale && entry.isExpired(nowMs)) {
            return null
        }
        entry.accessCount++
        entry.lastAccessedMs = nowMs
        maybePromotePriority(entry)
        l1Hits.incrementAndGet()
        l2Index[key]?.let { diskEntry ->
            diskEntry.accessCount = maxOf(diskEntry.accessCount + 1, entry.accessCount)
            diskEntry.lastAccessedMs = nowMs
            diskEntry.priority = maxPriority(diskEntry.priority, entry.priority)
        }
        entry
    }

    fun getFromDisk(
        key: String,
        allowStale: Boolean = false,
        nowMs: Long = System.currentTimeMillis()
    ): DiskCacheRecord? = synchronized(lock) {
        val indexEntry = l2Index[key] ?: return null
        if (!allowStale && indexEntry.isExpired(nowMs)) {
            return null
        }
        val file = File(diskDir, indexEntry.fileName)
        if (!file.exists() || !file.isFile) {
            l2Index.remove(key)
            l2CurrentBytes = (l2CurrentBytes - indexEntry.sizeBytes).coerceAtLeast(0L)
            persistDiskIndexLocked()
            return null
        }
        val bytes = try {
            file.readBytes()
        } catch (e: Exception) {
            runCatching { Log.w(TAG, "Failed to read disk cache entry $key", e) }
            return null
        }
        indexEntry.accessCount++
        indexEntry.lastAccessedMs = nowMs
        if (indexEntry.priority == OimCachePriority.NORMAL &&
            indexEntry.accessCount >= config.frequencyPromotionThreshold
        ) {
            indexEntry.priority = OimCachePriority.HIGH
        }
        l2Hits.incrementAndGet()
        DiskCacheRecord(
            key = indexEntry.key,
            fileName = indexEntry.fileName,
            label = indexEntry.label,
            bytes = bytes,
            priority = indexEntry.priority,
            accessCount = indexEntry.accessCount,
            eTag = indexEntry.eTag,
            lastModified = indexEntry.lastModified,
            imageHash = indexEntry.imageHash,
            cachedAtMs = indexEntry.cachedAtMs,
            expiresAtMs = indexEntry.expiresAtMs
        )
    }

    fun getValidationHeaders(key: String): Pair<String?, String?> = synchronized(lock) {
        val mem = l1Map[key]
        if (mem != null) return mem.eTag to mem.lastModified
        val disk = l2Index[key]
        return (disk?.eTag) to (disk?.lastModified)
    }

    fun recordCacheMiss() {
        misses.incrementAndGet()
    }

    fun touchRevalidated304(
        key: String,
        newTtlMs: Long? = null,
        nowMs: Long = System.currentTimeMillis()
    ) = synchronized(lock) {
        revalidated304.incrementAndGet()
        l1Map[key]?.let { entry ->
            val ttl = newTtlMs ?: entry.priority.defaultTtlMs
            entry.expiresAtMs = nowMs + ttl
            entry.lastAccessedMs = nowMs
        }
        l2Index[key]?.let { entry ->
            val ttl = newTtlMs ?: entry.priority.defaultTtlMs
            entry.expiresAtMs = nowMs + ttl
            entry.lastAccessedMs = nowMs
            persistDiskIndexLocked()
        }
    }

    fun put(
        key: String,
        asset: OimLoadedAsset,
        priority: OimCachePriority = OimCachePriority.NORMAL,
        eTag: String? = null,
        lastModified: String? = null,
        ttlMs: Long? = null,
        writeToDisk: Boolean = true,
        nowMs: Long = System.currentTimeMillis()
    ) {
        synchronized(lock) {
            if (asset.verification.isRefused) {
                invalidateLocked(key)
                return
            }

            val existingPriority = maxPriority(
                l1Map[key]?.priority ?: priority,
                l2Index[key]?.priority ?: priority
            )
            val effectivePriority = maxPriority(priority, existingPriority)
            val effectiveTtl = ttlMs ?: effectivePriority.defaultTtlMs
            val expiresAt = nowMs + effectiveTtl
            val entryMemoryBytes = estimateMemorySize(asset)

            if (entryMemoryBytes <= config.maxMemoryCacheBytes) {
                val prevL1 = l1Map.remove(key)
                if (prevL1 != null) {
                    l1CurrentBytes = (l1CurrentBytes - prevL1.sizeBytes).coerceAtLeast(0L)
                }
                val record = MemoryCacheRecord(
                    key = key,
                    asset = asset,
                    sizeBytes = entryMemoryBytes,
                    priority = effectivePriority,
                    accessCount = (prevL1?.accessCount ?: 0) + 1,
                    lastAccessedMs = nowMs,
                    eTag = eTag ?: prevL1?.eTag,
                    lastModified = lastModified ?: prevL1?.lastModified,
                    cachedAtMs = nowMs,
                    expiresAtMs = expiresAt
                )
                maybePromotePriority(record)
                l1Map[key] = record
                l1CurrentBytes += entryMemoryBytes
                trimMemoryToBudgetLocked(config.maxMemoryCacheBytes, preserveKey = key)
            }

            val rawSize = asset.rawBytes.size.toLong()
            if (writeToDisk && rawSize <= config.maxDiskCacheBytes) {
                val fileName = "${sha256Hex(key)}.oim.png"
                val targetFile = File(diskDir, fileName)
                val tmpFile = File(diskDir, "$fileName.tmp")
                try {
                    tmpFile.writeBytes(asset.rawBytes)
                    if (targetFile.exists()) targetFile.delete()
                    if (!tmpFile.renameTo(targetFile)) {
                        targetFile.writeBytes(asset.rawBytes)
                        tmpFile.delete()
                    }
                    val prevL2 = l2Index.remove(key)
                    if (prevL2 != null) {
                        l2CurrentBytes = (l2CurrentBytes - prevL2.sizeBytes).coerceAtLeast(0L)
                    }
                    val diskEntry = DiskIndexEntry(
                        key = key,
                        fileName = fileName,
                        label = asset.sourceLabel,
                        sizeBytes = rawSize,
                        priority = effectivePriority,
                        accessCount = (prevL2?.accessCount ?: 0) + 1,
                        lastAccessedMs = nowMs,
                        eTag = eTag ?: prevL2?.eTag,
                        lastModified = lastModified ?: prevL2?.lastModified,
                        imageHash = asset.verification.computedImageHash,
                        cachedAtMs = nowMs,
                        expiresAtMs = expiresAt
                    )
                    l2Index[key] = diskEntry
                    l2CurrentBytes += rawSize
                    trimDiskToBudgetLocked(config.maxDiskCacheBytes, preserveKey = key, nowMs = nowMs)
                    persistDiskIndexLocked()
                } catch (e: Exception) {
                    tmpFile.delete()
                    runCatching { Log.w(TAG, "Failed to persist OIM entry $key to L2 disk cache", e) }
                }
            }
        }
    }

    fun setPriority(key: String, priority: OimCachePriority): Boolean = synchronized(lock) {
        var found = false
        val now = System.currentTimeMillis()
        l1Map[key]?.let {
            it.priority = priority
            it.expiresAtMs = maxOf(it.expiresAtMs, now + priority.defaultTtlMs)
            found = true
        }
        l2Index[key]?.let {
            it.priority = priority
            it.expiresAtMs = maxOf(it.expiresAtMs, now + priority.defaultTtlMs)
            found = true
        }
        if (found) persistDiskIndexLocked()
        found
    }

    fun invalidate(key: String) = synchronized(lock) {
        invalidateLocked(key)
    }

    fun invalidateByPrefix(prefix: String): Int = synchronized(lock) {
        val matchingKeys = (l1Map.keys + l2Index.keys).filter { it.startsWith(prefix) }.toSet()
        matchingKeys.forEach { invalidateLocked(it) }
        matchingKeys.size
    }

    fun invalidateIfHashChanged(key: String, expectedImageHash: String): Boolean = synchronized(lock) {
        val storedHash = l1Map[key]?.asset?.verification?.computedImageHash ?: l2Index[key]?.imageHash
        if (storedHash != null && !storedHash.equals(expectedImageHash, ignoreCase = true)) {
            invalidateLocked(key)
            true
        } else {
            false
        }
    }

    fun purgeExpired(nowMs: Long = System.currentTimeMillis()): Int = synchronized(lock) {
        var removed = 0
        val expiredL1 = l1Map.values.filter { it.isExpired(nowMs) }.map { it.key }
        expiredL1.forEach { key ->
            l1Map.remove(key)?.let {
                l1CurrentBytes = (l1CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
                removed++
            }
        }
        val expiredL2 = l2Index.values.filter { it.isExpired(nowMs) }.map { it.key }
        expiredL2.forEach { key ->
            l2Index.remove(key)?.let {
                File(diskDir, it.fileName).delete()
                l2CurrentBytes = (l2CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
                removed++
            }
        }
        if (expiredL2.isNotEmpty()) persistDiskIndexLocked()
        if (removed > 0) invalidations.addAndGet(removed.toLong())
        removed
    }

    @Suppress("DEPRECATION")
    fun onTrimMemory(level: Int) = synchronized(lock) {
        when {
            level >= ComponentCallbacks2.TRIM_MEMORY_COMPLETE -> clearMemory(keepCritical = false)
            level >= ComponentCallbacks2.TRIM_MEMORY_MODERATE -> clearMemory(keepCritical = true)
            level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> trimMemoryToBudgetLocked(config.maxMemoryCacheBytes / 2, null)
            level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> trimMemoryToBudgetLocked(config.maxMemoryCacheBytes / 3, null)
        }
    }

    fun clearMemory(keepCritical: Boolean = true) = synchronized(lock) {
        val toRemove = l1Map.values.filter { !keepCritical || it.priority != OimCachePriority.CRITICAL }.map { it.key }
        toRemove.forEach { key ->
            l1Map.remove(key)?.let {
                l1CurrentBytes = (l1CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
                evictions.incrementAndGet()
            }
        }
    }

    fun clearAll() = synchronized(lock) {
        val total = (l1Map.keys + l2Index.keys).size
        l1Map.clear()
        l1CurrentBytes = 0L
        l2Index.values.forEach { File(diskDir, it.fileName).delete() }
        l2Index.clear()
        l2CurrentBytes = 0L
        if (indexFile.exists()) indexFile.delete()
        if (total > 0) invalidations.addAndGet(total.toLong())
    }

    fun getStats(nowMs: Long = System.currentTimeMillis()): OimCacheStats = synchronized(lock) {
        val allKeys = (l1Map.keys + l2Index.keys).distinct()
        val snapshots = allKeys.map { key ->
            val mem = l1Map[key]
            val disk = l2Index[key]
            OimCacheEntrySnapshot(
                key = key,
                label = mem?.asset?.sourceLabel ?: disk?.label ?: key,
                inMemoryL1 = mem != null,
                onDiskL2 = disk != null,
                memoryBytes = mem?.sizeBytes ?: 0L,
                diskBytes = disk?.sizeBytes ?: 0L,
                priority = maxPriority(mem?.priority ?: OimCachePriority.LOW, disk?.priority ?: OimCachePriority.LOW),
                accessCount = maxOf(mem?.accessCount ?: 0, disk?.accessCount ?: 0),
                eTag = mem?.eTag ?: disk?.eTag,
                imageHashPrefix = (mem?.asset?.verification?.computedImageHash ?: disk?.imageHash ?: "").take(12),
                isExpired = (mem?.isExpired(nowMs) ?: disk?.isExpired(nowMs) ?: false),
                cachedAtMs = mem?.cachedAtMs ?: disk?.cachedAtMs ?: 0L,
                expiresAtMs = mem?.expiresAtMs ?: disk?.expiresAtMs ?: 0L
            )
        }.sortedWith(
            compareByDescending<OimCacheEntrySnapshot> { it.priority.weight }
                .thenByDescending { it.accessCount }
                .thenByDescending { it.cachedAtMs }
        )

        OimCacheStats(
            l1UsedBytes = l1CurrentBytes,
            l1MaxBytes = config.maxMemoryCacheBytes,
            l1EntryCount = l1Map.size,
            l2UsedBytes = l2CurrentBytes,
            l2MaxBytes = config.maxDiskCacheBytes,
            l2EntryCount = l2Index.size,
            l1Hits = l1Hits.get(),
            l2Hits = l2Hits.get(),
            revalidated304Count = revalidated304.get(),
            misses = misses.get(),
            evictions = evictions.get(),
            invalidations = invalidations.get(),
            entries = snapshots
        )
    }

    private fun invalidateLocked(key: String) {
        var removed = false
        l1Map.remove(key)?.let {
            l1CurrentBytes = (l1CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
            removed = true
        }
        l2Index.remove(key)?.let {
            File(diskDir, it.fileName).delete()
            l2CurrentBytes = (l2CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
            persistDiskIndexLocked()
            removed = true
        }
        if (removed) invalidations.incrementAndGet()
    }

    private fun trimMemoryToBudgetLocked(maxBytes: Long, preserveKey: String?) {
        while (l1CurrentBytes > maxBytes && l1Map.isNotEmpty()) {
            val victim = l1Map.values
                .filter { it.key != preserveKey }
                .minWithOrNull(
                    compareBy<MemoryCacheRecord> { it.priority.weight }
                        .thenBy { it.accessCount }
                        .thenBy { it.lastAccessedMs }
                ) ?: break
            l1Map.remove(victim.key)
            l1CurrentBytes = (l1CurrentBytes - victim.sizeBytes).coerceAtLeast(0L)
            evictions.incrementAndGet()
        }
    }

    private fun trimDiskToBudgetLocked(maxBytes: Long, preserveKey: String?, nowMs: Long) {
        if (l2CurrentBytes <= maxBytes) return
        val expired = l2Index.values
            .filter { it.key != preserveKey && it.isExpired(nowMs) && it.priority != OimCachePriority.CRITICAL }
            .map { it.key }
        expired.forEach { key ->
            l2Index.remove(key)?.let {
                File(diskDir, it.fileName).delete()
                l2CurrentBytes = (l2CurrentBytes - it.sizeBytes).coerceAtLeast(0L)
                evictions.incrementAndGet()
            }
        }
        while (l2CurrentBytes > maxBytes && l2Index.isNotEmpty()) {
            val victim = l2Index.values
                .filter { it.key != preserveKey }
                .minWithOrNull(
                    compareBy<DiskIndexEntry> { it.priority.weight }
                        .thenBy { it.accessCount }
                        .thenBy { it.lastAccessedMs }
                ) ?: break
            l2Index.remove(victim.key)
            File(diskDir, victim.fileName).delete()
            l2CurrentBytes = (l2CurrentBytes - victim.sizeBytes).coerceAtLeast(0L)
            evictions.incrementAndGet()
        }
    }

    private fun maybePromotePriority(entry: MemoryCacheRecord) {
        if (entry.priority == OimCachePriority.NORMAL &&
            entry.accessCount >= config.frequencyPromotionThreshold
        ) {
            entry.priority = OimCachePriority.HIGH
        }
    }

    private fun estimateMemorySize(asset: OimLoadedAsset): Long {
        val bitmapBytes = runCatching { asset.bitmap?.allocationByteCount?.toLong() ?: 0L }.getOrDefault(0L)
        return bitmapBytes + asset.rawBytes.size.toLong() + 4096L
    }

    private fun maxPriority(a: OimCachePriority, b: OimCachePriority): OimCachePriority {
        return if (a.weight >= b.weight) a else b
    }

    private fun loadDiskIndex() {
        synchronized(lock) {
            if (!indexFile.exists()) return
            try {
                val arr = JSONArray(indexFile.readText(Charsets.UTF_8))
                var totalBytes = 0L
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val fileName = obj.optString("fileName")
                    val file = File(diskDir, fileName)
                    if (!file.exists()) continue
                    val entry = DiskIndexEntry(
                        key = obj.getString("key"),
                        fileName = fileName,
                        label = obj.optString("label", fileName),
                        sizeBytes = file.length(),
                        priority = runCatching {
                            OimCachePriority.valueOf(obj.optString("priority", "NORMAL"))
                        }.getOrDefault(OimCachePriority.NORMAL),
                        accessCount = obj.optInt("accessCount", 1),
                        lastAccessedMs = obj.optLong("lastAccessedMs", System.currentTimeMillis()),
                        eTag = obj.optString("eTag", "").ifBlank { null },
                        lastModified = obj.optString("lastModified", "").ifBlank { null },
                        imageHash = obj.optString("imageHash", ""),
                        cachedAtMs = obj.optLong("cachedAtMs", System.currentTimeMillis()),
                        expiresAtMs = obj.optLong("expiresAtMs", System.currentTimeMillis() + config.defaultTtlMs)
                    )
                    l2Index[entry.key] = entry
                    totalBytes += entry.sizeBytes
                }
                l2CurrentBytes = totalBytes
            } catch (e: Exception) {
                runCatching { Log.w(TAG, "Disk cache index corrupted; rebuilding clean index.", e) }
                l2Index.clear()
                l2CurrentBytes = 0L
            }
        }
    }

    private fun persistDiskIndexLocked() {
        try {
            val arr = JSONArray()
            l2Index.values.forEach { entry ->
                arr.put(JSONObject().apply {
                    put("key", entry.key)
                    put("fileName", entry.fileName)
                    put("label", entry.label)
                    put("sizeBytes", entry.sizeBytes)
                    put("priority", entry.priority.name)
                    put("accessCount", entry.accessCount)
                    put("lastAccessedMs", entry.lastAccessedMs)
                    if (entry.eTag != null) put("eTag", entry.eTag)
                    if (entry.lastModified != null) put("lastModified", entry.lastModified)
                    put("imageHash", entry.imageHash)
                    put("cachedAtMs", entry.cachedAtMs)
                    put("expiresAtMs", entry.expiresAtMs)
                })
            }
            val tmp = File(diskDir, "oim_cache_index.json.tmp")
            tmp.writeText(arr.toString(), Charsets.UTF_8)
            if (indexFile.exists()) indexFile.delete()
            if (!tmp.renameTo(indexFile)) {
                indexFile.writeText(arr.toString(), Charsets.UTF_8)
                tmp.delete()
            }
        } catch (e: Exception) {
            runCatching { Log.w(TAG, "Failed to persist L2 disk cache index", e) }
        }
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }.take(32)
    }
}
