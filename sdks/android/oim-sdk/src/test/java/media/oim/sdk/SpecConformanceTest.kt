/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimError
import media.oim.sdk.parser.OimBinaryCodec
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

/**
 * Runs every canonical vector of packages/spec through the SDK, read in place. The vectors are the executable truth of the format: if the
 * web player and this SDK disagree, this test names the file and the field.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SpecConformanceTest {

    /** packages/spec of this repository, passed in by oim-sdk/build.gradle.kts. */
    private val specDir = File(checkNotNull(System.getProperty("oim.spec.dir")) { "oim.spec.dir not set" })

    private fun resourceDir(name: String): File = File(specDir, name)

    private fun vectors(dir: String): List<File> =
        resourceDir(dir).listFiles { f -> f.name.endsWith(".oim.png") }!!.sortedBy { it.name }

    /** Collects every failure so one run reports all diverging vectors, not just the first. */
    private fun checkAll(files: List<File>, check: (File) -> Unit) {
        val failures = files.mapNotNull { f ->
            runCatching { check(f) }.exceptionOrNull()?.let { "${f.name}: ${it.message}" }
        }
        assertTrue("${failures.size}/${files.size} vectors diverge:\n" + failures.joinToString("\n"), failures.isEmpty())
    }

    @Test
    fun allSpecVectorsArePresent() {
        assertEquals(48, vectors("vectors-2").size)
    }

    @Test
    fun v1Vectors_areRejectedAsUnsupportedVersion() = checkAll(vectors("vectors")) { file ->
        val err = runCatching {
            OimBinaryCodec.decodeAndVerify(file.readBytes(), file.name, decodeBitmap = false)
        }.exceptionOrNull()
        check(err is OimError.UnsupportedVersion) { "expected UnsupportedVersion, got $err" }
    }

    @Test
    fun v2Vectors_decodeAndVerify() = checkAll(vectors("vectors-2")) { file ->
        val asset = OimBinaryCodec.decodeAndVerify(file.readBytes(), file.name, decodeBitmap = false)
        checkNotNull(asset.document) { "not parsed" }
        check(!asset.verification.isRefused) { "refused: ${asset.verification.reason}" }
        check(asset.verification.signatureValid) { "signature invalid: ${asset.verification.reason}" }
    }

    @Test
    fun canonicalCases_matchTheSpecBytes() {
        val cases = JSONObject(File(specDir, "canonical-cases.json").readText())
        assertEquals(cases.getString("expected"), OimCanonicalizerAndVerifier.canonicalJson(cases.getJSONObject("input")))
        val outOfRange: JSONArray = cases.getJSONArray("outOfRange")
        for (i in 0 until outOfRange.length()) {
            assertTrue("outOfRange[$i] not detected", OimCanonicalizerAndVerifier.hasNumberOutOfRange(outOfRange.get(i)))
        }
    }
}
