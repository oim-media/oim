/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer

import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimAuthor
import media.oim.sdk.model.OimCanvasSpec
import media.oim.sdk.model.OimDocument
import media.oim.sdk.model.OimSecurityBlock
import media.oim.sdk.model.ReeditPermission
import media.oim.sdk.model.SecurityStatus
import media.oim.sdk.parser.OimBinaryCodec
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.Deflater

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimSdkUnitTest {

    @Test
    fun resolveContent_followsExactOimFallbackOrderAndWildcard() {
        val dict = mapOf("es" to "Hola", "en" to "Hello", "fr" to "Bonjour")

        assertEquals("Bonjour", OimCanonicalizerAndVerifier.resolveContent(dict, "fr").text)
        assertEquals("Hello", OimCanonicalizerAndVerifier.resolveContent(dict, "de").text)

        val noEn = mapOf("es" to "Hola", "ja" to "こんにちは")
        assertEquals("Hola", OimCanonicalizerAndVerifier.resolveContent(noEn, "de").text)

        val wildcard = mapOf("*" to "UNIVERSAL", "en" to "Hello")
        val resolvedWildcard = OimCanonicalizerAndVerifier.resolveContent(wildcard, "en")
        assertEquals("UNIVERSAL", resolvedWildcard.text)
        assertTrue(resolvedWildcard.wasFinalWildcard)
    }

    @Test
    fun canonicalJson_sortsKeysRoundsDecimalsAndExcludesRootSignature() {
        val json = JSONObject(
            """
            {
              "z": 1.123456789,
              "a": "日本語",
              "signature": "SHOULD_BE_EXCLUDED",
              "key_version": "v1",
              "timestamp": 1234,
              "creator_user_id": "uid",
              "m": 42.000000
            }
            """.trimIndent()
        )
        val canonical = OimCanonicalizerAndVerifier.canonicalJson(json)
        assertEquals("""{"a":"日本語","m":42,"z":1.123457}""", canonical)
    }

    @Test
    fun hasNumberOutOfRange_detectsUnsafeIntegersBeyond2Pow53Minus1() {
        val safeObj = JSONObject("""{"x": 9007199254740991}""")
        assertFalse(OimCanonicalizerAndVerifier.hasNumberOutOfRange(safeObj))

        val unsafeObj = JSONObject("""{"x": 9007199254740993.0}""")
        assertTrue(OimCanonicalizerAndVerifier.hasNumberOutOfRange(unsafeObj))
    }

    @Test
    fun binaryCodec_signsVerifiesAndRefusesTamperedOimPng() {
        val basePng = buildMinimalValidPng()
        val (keyId, keyPair) = OimCanonicalizerAndVerifier.getLocalAuthorityKeyPair()
        val doc = OimDocument(
            id = "test-oim-01",
            title = mapOf("es" to "Prueba", "en" to "Test"),
            description = mapOf("en" to "Round-trip binary test"),
            author = OimAuthor("Tester", "@test", keyId),
            canvas = OimCanvasSpec(1, 1),
            languages = listOf("es", "en"),
            layers = emptyList(),
            security = OimSecurityBlock(
                imageHash = "",
                signature = null,
                keyId = keyId,
                reeditPermission = ReeditPermission.PUBLIC
            )
        )

        val signedBytes = OimBinaryCodec.encodeSignedOimPng(basePng, doc, keyId, keyPair)
        val verified = OimBinaryCodec.decodeAndVerify(signedBytes, "test.oim.png")
        assertEquals(SecurityStatus.VERIFIED_SELF_SIGNED, verified.verification.status)
        assertFalse(verified.verification.isRefused)
        assertEquals(ReeditPermission.PUBLIC, verified.verification.effectiveReeditPermission)

        val tamperedBytes = OimBinaryCodec.createTamperedCopy(signedBytes)
        val refused = OimBinaryCodec.decodeAndVerify(tamperedBytes, "tampered.oim.png")
        assertEquals(SecurityStatus.REFUSED_TAMPERED, refused.verification.status)
        assertTrue(refused.verification.isRefused)
        assertEquals(ReeditPermission.AUTHOR_ONLY, refused.verification.effectiveReeditPermission)
    }

    private fun buildMinimalValidPng(): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val ihdr = ByteBuffer.allocate(13).order(ByteOrder.BIG_ENDIAN)
            .putInt(1).putInt(1).put(8).put(6).put(0).put(0).put(0).array()
        writePngChunk(out, "IHDR", ihdr)
        val rawScanlines = ByteArray(25) { idx -> if (idx % 5 == 0) 0 else 0x55 }
        val deflater = Deflater()
        deflater.setInput(rawScanlines)
        deflater.finish()
        val idatBuf = ByteArray(128)
        val idatLen = deflater.deflate(idatBuf)
        deflater.end()
        writePngChunk(out, "IDAT", idatBuf.copyOf(idatLen))
        writePngChunk(out, "IEND", ByteArray(0))
        return out.toByteArray()
    }

    private fun writePngChunk(out: ByteArrayOutputStream, type: String, data: ByteArray) {
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
