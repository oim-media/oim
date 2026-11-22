/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.ui.woff2ToSfnt
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.awt.Font
import java.awt.font.FontRenderContext
import java.awt.geom.PathIterator

class Woff2Test {
    private fun fixture(n: String) = checkNotNull(javaClass.getResourceAsStream("/woff2/$n")).readBytes()

    /** Every outline point of [text], so two fonts can be compared glyph by glyph. */
    private fun outline(sfnt: ByteArray, text: String): Pair<Double, DoubleArray> {
        val font = Font.createFont(Font.TRUETYPE_FONT, sfnt.inputStream()).deriveFont(48f)
        val gv = font.createGlyphVector(FontRenderContext(null, false, false), text)
        val it = gv.outline.getPathIterator(null)
        val pts = ArrayList<Double>()
        val seg = DoubleArray(6)
        while (!it.isDone) {
            val type = it.currentSegment(seg)
            pts += type.toDouble()
            val n = when (type) { PathIterator.SEG_QUADTO -> 4; PathIterator.SEG_CUBICTO -> 6; PathIterator.SEG_CLOSE -> 0; else -> 2 }
            for (k in 0 until n) pts += seg[k]
            it.next()
        }
        return gv.logicalBounds.width to pts.toDoubleArray()
    }

    @Test fun anythingThatIsNotWoff2IsRefused() {
        assertNull(woff2ToSfnt(byteArrayOf(1, 2, 3, 4)))
        assertNull(woff2ToSfnt(fixture("fraunces.ttf")))
    }

    @Test fun decodedFontsHaveTheOutlinesOfFontToolsTtf() {
        for ((name, text) in listOf("fraunces" to "El renacer analógico", "pixelify" to "SIEMPRE SIN CONEXIÓN")) {
            val sfnt = woff2ToSfnt(fixture("$name.woff2"))
            assertNotNull(name, sfnt)
            val ref = outline(fixture("$name.ttf"), text)
            val dec = outline(sfnt!!, text)
            assertEquals(name, ref.first, dec.first, 0.0)
            assertArrayEquals(name, ref.second, dec.second, 0.0)
        }
    }
}
