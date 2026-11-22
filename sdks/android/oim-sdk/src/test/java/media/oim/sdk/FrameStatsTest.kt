/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.ui.FrameStats
import org.junit.Assert.assertEquals
import org.junit.Test

class FrameStatsTest {
    private val frame60 = 16_666_667L

    @Test fun steadyFramesReadAsTheRefreshRate() {
        val s = FrameStats(10).apply { repeat(10) { add(frame60) } }
        assertEquals(60.0, s.fps(), 0.1)
        assertEquals(16.67, s.percentileMs(0.95), 0.01)
        assertEquals(0, s.janky(frame60))
    }

    @Test fun aDroppedFrameIsJankAndShowsInTheTail() {
        val s = FrameStats(20).apply { repeat(19) { add(frame60) }; add(frame60 * 3) }
        assertEquals(1, s.janky(frame60))
        assertEquals(16.67, s.percentileMs(0.5), 0.01)
        assertEquals(50.0, s.percentileMs(1.0), 0.01)
    }

    @Test fun onlyTheLastFramesCount() {
        val s = FrameStats(4).apply { repeat(4) { add(frame60 * 3) }; repeat(4) { add(frame60) } }
        assertEquals(0, s.janky(frame60))
    }
}
