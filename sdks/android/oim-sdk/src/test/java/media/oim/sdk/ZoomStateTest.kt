/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import androidx.compose.ui.unit.IntSize
import media.oim.sdk.ui.OimZoomState
import org.junit.Assert.assertEquals
import org.junit.Test

class ZoomStateTest {
    private fun state() = OimZoomState().apply { canvasSize = IntSize(800, 600) }

    @Test fun pinchOutReturnsToTheWholePicture() {
        val s = state().apply { transform(3f, 200f, 100f, overflowVertically = false) }
        s.transform(0.1f, 0f, 0f, overflowVertically = false)
        assertEquals(1f, s.scale)
        assertEquals(0f, s.panX)
        assertEquals(0f, s.panY)
    }

    @Test fun panStaysOverTheCanvas() {
        val s = state().apply { transform(2f, 5000f, -5000f, overflowVertically = false) }
        assertEquals(400f, s.panX) // 800 * (2 - 1) / 2
        assertEquals(-300f, s.panY)
    }

    @Test fun withoutAFrameThePictureMayPanPastItsHeight() {
        val s = state().apply { transform(2f, 0f, 5000f, overflowVertically = true) }
        assertEquals(400f, s.panY) // max(800, 600) * (2 - 1) / 2
    }

    @Test fun doubleTapTogglesZoom() {
        val s = state().apply { toggleZoom() }
        assertEquals(2.5f, s.scale)
        s.toggleZoom()
        assertEquals(1f, s.scale)
    }
}
