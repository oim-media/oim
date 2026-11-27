/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import androidx.compose.ui.graphics.ShaderBrush
import media.oim.sdk.model.OimGradientFill
import media.oim.sdk.model.OimGradientStop
import media.oim.sdk.ui.oimGradientBrush
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TextGradientTest {
    @Test
    fun `a gradient with stops gives a brush that a text can paint with`() {
        val g = OimGradientFill(angleDeg = 90f, stops = listOf(OimGradientStop("#f59e0b", 0f), OimGradientStop("#ec4899", 1f)))
        assertTrue(oimGradientBrush(g, emptyMap()) is ShaderBrush)
    }

    @Test
    fun `a gradient without stops gives no brush, so the text keeps its colour`() {
        assertNull(oimGradientBrush(OimGradientFill(), emptyMap()))
    }
}
