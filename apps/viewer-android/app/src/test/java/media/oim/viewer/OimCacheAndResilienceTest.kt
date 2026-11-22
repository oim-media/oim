/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer

import media.oim.sdk.OimSdk
import media.oim.sdk.cache.OimCacheManager
import media.oim.sdk.cache.OimCachePriority
import media.oim.sdk.cache.OimCacheSource
import media.oim.sdk.cache.OimSdkConfig
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimAuthor
import media.oim.sdk.model.OimCanvasSpec
import media.oim.sdk.model.OimDocument
import media.oim.sdk.model.OimLoadedAsset
import media.oim.sdk.model.OimSecurityBlock
import media.oim.sdk.network.OimLibraryClient
import media.oim.sdk.network.OimLoadError
import media.oim.sdk.network.OimLoadState
import media.oim.sdk.network.OimRequest
import media.oim.sdk.network.OimRetryPolicy
import media.oim.sdk.network.OimServiceClient
import media.oim.sdk.parser.OimBinaryCodec
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.net.UnknownHostException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.Deflater

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimCacheAndResilienceTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun priorityEviction_preservesCriticalEntryOverLowAndNormal() {
        val assetA = buildSignedAsset("critical.oim.png")
        val assetB = buildSignedAsset("low.oim.png")
        val assetC = buildSignedAsset("normal.oim.png")

        val singleEntryBytes = assetA.rawBytes.size.toLong() + 4096L
        val cache = OimCacheManager(
            cacheRootDir = tempFolder.newFolder("oim_evict"),
            config = OimSdkConfig(
                maxMemoryCacheBytes = singleEntryBytes * 2 + 1024L,
                maxDiskCacheBytes = assetA.rawBytes.size.toLong() * 2 + 100L
            )
        )

        cache.put("k_critical", assetA, priority = OimCachePriority.CRITICAL)
        cache.put("k_low", assetB, priority = OimCachePriority.LOW)
        cache.put("k_normal", assetC, priority = OimCachePriority.NORMAL)

        assertNotNull("CRITICAL entry must remain in L1", cache.getFromMemory("k_critical"))
        assertNull("LOW entry should have been evicted first from L1", cache.getFromMemory("k_low"))
        assertTrue(cache.getStats().evictions >= 1)
    }

    @Test
    fun frequencyPromotionAndInvalidation_workAcrossL1AndL2() {
        val asset = buildSignedAsset("hero.oim.png")
        val cache = OimCacheManager(
            cacheRootDir = tempFolder.newFolder("oim_promo"),
            config = OimSdkConfig(frequencyPromotionThreshold = 3)
        )

        val t0 = 1_000_000L
        cache.put("https://oim.media/gallery/hero.oim.png", asset, priority = OimCachePriority.NORMAL, ttlMs = 5_000L, nowMs = t0)
        cache.getFromMemory("https://oim.media/gallery/hero.oim.png", nowMs = t0 + 100)
        val promoted = cache.getFromMemory("https://oim.media/gallery/hero.oim.png", nowMs = t0 + 200)
        assertEquals(OimCachePriority.HIGH, promoted?.priority)

        assertNull(cache.getFromMemory("https://oim.media/gallery/hero.oim.png", allowStale = false, nowMs = t0 + 10_000L))
        assertNotNull(cache.getFromMemory("https://oim.media/gallery/hero.oim.png", allowStale = true, nowMs = t0 + 10_000L))

        assertTrue(cache.invalidateIfHashChanged("https://oim.media/gallery/hero.oim.png", "different_sha256"))
        assertNull(cache.getFromMemory("https://oim.media/gallery/hero.oim.png", allowStale = true))
        assertNull(cache.getFromDisk("https://oim.media/gallery/hero.oim.png", allowStale = true))
    }

    @Test
    fun tamperedAsset_isNeverCachedAndPurgesPreviousValidEntry() {
        val signedBytes = buildSignedBytes("seal.oim.png")
        val validAsset = OimBinaryCodec.decodeAndVerify(signedBytes, "seal.oim.png")
        val tamperedAsset = OimBinaryCodec.decodeAndVerify(
            OimBinaryCodec.createTamperedCopy(signedBytes),
            "seal.oim.png"
        )
        assertTrue(tamperedAsset.verification.isRefused)

        val cache = OimCacheManager(tempFolder.newFolder("oim_sec"))
        cache.put("doc_1", validAsset, priority = OimCachePriority.CRITICAL)
        assertNotNull(cache.getFromMemory("doc_1"))

        cache.put("doc_1", tamperedAsset, priority = OimCachePriority.CRITICAL)
        assertNull(cache.getFromMemory("doc_1", allowStale = true))
        assertNull(cache.getFromDisk("doc_1", allowStale = true))
    }

    @Test
    fun resilience_detectsIncompleteStreamAndServesStaleCacheOnNetworkError() = runTest {
        val signedBytes = buildSignedBytes("offline_test.oim.png")
        val offlineHttpClient = OkHttpClient.Builder()
            .addInterceptor { throw UnknownHostException("api.oim.media unreachable") }
            .build()
        val client = OimServiceClient(context = null, httpClient = offlineHttpClient)

        assertTrue(client.hasCompletePngTrailer(signedBytes))
        assertFalse(client.hasCompletePngTrailer(signedBytes.copyOf(signedBytes.size / 2)))

        val retryPolicy = OimRetryPolicy(maxAttempts = 2, initialBackoffMs = 50L, maxBackoffMs = 200L, jitterRatio = 0.0)
        assertEquals(50L, retryPolicy.computeDelayMs(0, randomFraction = 0.5))
        assertEquals(100L, retryPolicy.computeDelayMs(1, randomFraction = 0.5))

        val sdk = OimSdk(
            config = OimSdkConfig(),
            cacheManager = OimCacheManager(tempFolder.newFolder("oim_sdk_resilience")),
            serviceClient = client
        )

        val seedStates = sdk.load(
            OimRequest(
                key = "https://oim.media/offline_test.oim.png",
                label = "offline_test.oim.png",
                rawBytesProvider = { signedBytes },
                priority = OimCachePriority.CRITICAL
            )
        ).toList()
        assertTrue(seedStates.last() is OimLoadState.Success)

        val offlineStates = sdk.load(
            OimRequest(
                key = "https://oim.media/offline_test.oim.png",
                label = "offline_test.oim.png",
                remoteUrl = "https://oim.media/offline_test.oim.png",
                forceRefresh = true,
                retryPolicy = retryPolicy
            )
        ).toList()
        val lastState = offlineStates.last()
        assertTrue("Expected DegradedFromCache fallback", lastState is OimLoadState.DegradedFromCache)
        val degraded = lastState as OimLoadState.DegradedFromCache
        assertEquals(OimCacheSource.MEMORY_L1, degraded.cacheSource)
        assertTrue(degraded.networkError is OimLoadError.NetworkUnavailable)
    }

    @Test
    fun libraryClient_parsesRealOimCatalogShapes() {
        val client = OimLibraryClient()
        val sampleCatalogJson = """
            {
              "items": [
                {
                  "id": "banner-01",
                  "title": {"es": "Cartel Interactivo", "en": "Interactive Banner"},
                  "description": "Demo oficial",
                  "author": {"name": "OIM Team"},
                  "category": "Templates",
                  "media_url": "/media/banner-01.oim.png",
                  "languages": ["es", "en"]
                }
              ]
            }
        """.trimIndent()
        val (parsed, _) = client.parseShowcaseResponse(sampleCatalogJson, "https://library.oim.media/v1/showcase")
        assertEquals(1, parsed.size)
        assertEquals("banner-01", parsed[0].id)
        assertEquals("Cartel Interactivo", parsed[0].title)
        assertEquals("https://library.oim.media/media/banner-01.oim.png", parsed[0].oimUrl)
        assertEquals(listOf("es", "en"), parsed[0].languages)
    }

    private fun buildSignedAsset(name: String): OimLoadedAsset {
        val bytes = buildSignedBytes(name)
        return OimBinaryCodec.decodeAndVerify(bytes, name)
    }

    private fun buildSignedBytes(name: String): ByteArray {
        val (keyId, keyPair) = OimCanonicalizerAndVerifier.getLocalAuthorityKeyPair()
        val doc = OimDocument(
            id = "id_$name",
            title = mapOf("en" to name),
            description = mapOf("en" to "Test OIM asset"),
            author = OimAuthor("SDK Test", "@sdk", keyId),
            canvas = OimCanvasSpec(2, 2),
            languages = listOf("en", "es"),
            layers = emptyList(),
            security = OimSecurityBlock(imageHash = "", signature = null, keyId = keyId)
        )
        return OimBinaryCodec.encodeSignedOimPng(buildMinimalPng(), doc, keyId, keyPair)
    }

    private fun buildMinimalPng(): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val ihdr = ByteBuffer.allocate(13).order(ByteOrder.BIG_ENDIAN)
            .putInt(2).putInt(2).put(8).put(6).put(0).put(0).put(0).array()
        writeChunk(out, "IHDR", ihdr)
        val raw = ByteArray(18) { idx -> if (idx % 9 == 0) 0 else 0x42 }
        val deflater = Deflater()
        deflater.setInput(raw)
        deflater.finish()
        val buf = ByteArray(128)
        val n = deflater.deflate(buf)
        deflater.end()
        writeChunk(out, "IDAT", buf.copyOf(n))
        writeChunk(out, "IEND", ByteArray(0))
        return out.toByteArray()
    }

    private fun writeChunk(out: ByteArrayOutputStream, type: String, data: ByteArray) {
        val typeBytes = type.toByteArray(Charsets.US_ASCII)
        out.write(ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(data.size).array())
        out.write(typeBytes)
        out.write(data)
        val crc = CRC32().apply {
            update(typeBytes)
            update(data)
        }
        out.write(ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(crc.value.toInt()).array())
    }
}
