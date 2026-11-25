/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import android.graphics.Bitmap
import media.oim.sdk.model.OimLayerKind
import media.oim.sdk.parser.OimBinaryCodec
import media.oim.sdk.ui.blurBitmapGaussian
import media.oim.sdk.ui.createCssBlurMaskFilter
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimBlurTest {

    @Test
    fun createCssBlurMaskFilterReturnsNullAtZeroSigma() {
        assertNull(createCssBlurMaskFilter(0f))
        assertNull(createCssBlurMaskFilter(0.1f))
        assertNotNull(createCssBlurMaskFilter(6f))
    }

    @Test
    fun blurBitmapGaussianReturnsSourceBelowThreshold() {
        val src = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888)
        src.setPixel(4, 4, 0xFFFF0000.toInt())
        val out = blurBitmapGaussian(src, 0.2f)
        assertSame(src, out)
    }

    @Test
    fun blurBitmapGaussianPreservesPremultipliedColorWithoutDarkHalo() {
        // White square centered inside a transparent bitmap: soft edges must stay white (RGB ~ 255).
        val src = Bitmap.createBitmap(21, 21, Bitmap.Config.ARGB_8888)
        for (y in 7..13) {
            for (x in 7..13) {
                src.setPixel(x, y, 0xFFFFFFFF.toInt())
            }
        }
        val blurred = blurBitmapGaussian(src, 2.5f)
        assertEquals(21, blurred.width)
        assertEquals(21, blurred.height)

        val leftEdge = blurred.getPixel(5, 10)
        val rightEdge = blurred.getPixel(15, 10)
        val topEdge = blurred.getPixel(10, 5)
        val bottomEdge = blurred.getPixel(10, 15)

        val leftAlpha = (leftEdge ushr 24) and 0xFF
        val rightAlpha = (rightEdge ushr 24) and 0xFF
        val topAlpha = (topEdge ushr 24) and 0xFF
        val bottomAlpha = (bottomEdge ushr 24) and 0xFF

        assertTrue("expected non-zero blurred alpha, got $leftAlpha", leftAlpha in 10..200)
        assertEquals(leftAlpha, rightAlpha)
        assertEquals(leftAlpha, topAlpha)
        assertEquals(leftAlpha, bottomAlpha)

        val r = (leftEdge ushr 16) and 0xFF
        val g = (leftEdge ushr 8) and 0xFF
        val b = leftEdge and 0xFF
        assertTrue("expected white RGB without dark fringe, got ($r,$g,$b)", r >= 250 && g >= 250 && b >= 250)
    }

    @Test
    fun v2TextLayerWithoutFillsDefaultsToBlack() {
        val root = JSONObject().apply {
            put("oim", "2.0")
            put("canvas", JSONObject().apply {
                put("width", 800)
                put("height", 600)
            })
            put("languages", JSONArray().put("es"))
            put("layers", JSONArray().put(
                JSONObject().apply {
                    put("id", "titulo")
                    put("type", "text")
                    put("box", JSONObject().apply {
                        put("x", 80)
                        put("y", 60)
                        put("width", 400)
                        put("height", 90)
                    })
                    put("text", JSONObject().apply {
                        put("content", JSONObject().put("es", "Borroso"))
                        put("font", JSONObject().put("size", 40))
                    })
                }
            ))
        }
        val doc = OimBinaryCodec.parseDocumentJson(root, 800, 600)
        assertEquals("es", doc.defaultLanguage)
        val textLayer = doc.layers.first { it.kind == OimLayerKind.TEXT }
        assertEquals("#000000", textLayer.style.textColorHex)
    }
}
