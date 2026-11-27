/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class CurvedGlyphCentersTest {
    @Test
    fun letterSpacingGoesBetweenGlyphsAndTheLineStaysCentred() {
        // Three 10px glyphs, 2px apart: 34px wide, centred on a 100px curve -> from 33 to 67.
        val centers = curvedGlyphCenters(floatArrayOf(10f, 10f, 10f), 2f, 100f)
        assertArrayEquals(floatArrayOf(38f, 50f, 62f), centers, 1e-4f)
    }

    @Test
    fun withoutSpacingGlyphsTouch() {
        assertArrayEquals(floatArrayOf(40f, 50f, 60f), curvedGlyphCenters(floatArrayOf(10f, 10f, 10f), 0f, 100f), 1e-4f)
    }
}
