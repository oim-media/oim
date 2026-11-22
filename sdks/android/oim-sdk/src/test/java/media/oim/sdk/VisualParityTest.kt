/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import media.oim.sdk.parser.OimBinaryCodec
import media.oim.sdk.ui.OimPlayerView
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.nio.ByteBuffer

/**
 * Visual conformance adapter (CANONICAL_SPEC.md 9.1): renders every vector of
 * packages/spec/vectors-2 to build/parity/android/<vector>.png. It does not compare;
 * packages/spec/tools/parity.mjs does. Runs only with OIM_PARITY=1.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
// mdpi: 1 dp = 1 px, the device pixel ratio 1 the procedure asks for.
@Config(sdk = [34], qualifiers = "w800dp-h1600dp-mdpi")
class VisualParityTest(private val name: String) {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    companion object {
        private const val WIDTH = 800
        private val vectorsDir = File(System.getProperty("oim.spec.dir") ?: ".", "vectors-2")

        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun vectors(): List<Array<Any>> =
            (vectorsDir.listFiles { f -> f.name.endsWith(".oim.png") } ?: emptyArray())
                .map { arrayOf<Any>(it.name.removeSuffix(".oim.png")) }
                .sortedBy { it[0] as String }
    }

    @Test
    fun render() {
        assumeTrue("OIM_PARITY=1 not set", System.getProperty("oim.parity") == "1")
        val out = File(checkNotNull(System.getProperty("oim.parity.out"))).apply { mkdirs() }
        // A vector the web player has no golden for yet cannot be compared: say so instead of failing.
        if (!File(vectorsDir, "golden/$name.web.png").exists()) {
            File(out, "$name.skipped").writeText("[\"no web golden yet\"]")
            return
        }
        val bytes = File(vectorsDir, "$name.oim.png").readBytes()
        // Same size rule as the web goldens: 800 wide, height from the vector's PNG header.
        val header = ByteBuffer.wrap(bytes)
        val height = Math.round(WIDTH.toDouble() * header.getInt(20) / header.getInt(16)).toInt()
        val asset = OimBinaryCodec.decodeAndVerify(bytes, name)

        compose.mainClock.autoAdvance = false
        compose.setContent {
            Box(Modifier.size(WIDTH.dp, height.dp).background(Color.White)) {
                OimPlayerView(
                    asset = asset,
                    language = "en",
                    modifier = Modifier.size(WIDTH.dp, height.dp),
                    parallaxEnabled = false,
                    cornerRadius = 0.dp,
                    showFrameBorder = false,
                )
            }
        }
        // "Animations disabled": let entrances reach their final pose.
        compose.mainClock.advanceTimeBy(30_000)
        compose.waitForIdle()
        // Image fills decode off the main thread (Dispatchers.Default), which waitForIdle does not wait
        // for, and a decode can take seconds there: capture until the frame holds still for 4 s (30 s at most).
        fun capture(): Bitmap {
            val image = Bitmap.createBitmap(WIDTH, height, Bitmap.Config.ARGB_8888)
            compose.runOnUiThread {
                // Draw the content view straight into a bitmap (captureToImage times out under Robolectric).
                compose.activity.findViewById<android.view.View>(android.R.id.content).draw(android.graphics.Canvas(image))
            }
            return image
        }
        var image = capture()
        var same = 0
        val deadline = System.currentTimeMillis() + 30_000
        while (same < 40 && System.currentTimeMillis() < deadline) {
            Thread.sleep(100)
            compose.mainClock.advanceTimeBy(100)
            compose.waitForIdle()
            val next = capture()
            same = if (next.sameAs(image)) same + 1 else 0
            image = next
        }
        File(out, "$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
