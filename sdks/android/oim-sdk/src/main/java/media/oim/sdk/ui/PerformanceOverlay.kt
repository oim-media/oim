/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The last [capacity] frame intervals, and what a performance check reads from them. */
internal class FrameStats(private val capacity: Int = 120) {
    private val intervals = LongArray(capacity)
    private var count = 0
    private var next = 0

    fun add(intervalNanos: Long) {
        intervals[next] = intervalNanos
        next = (next + 1) % capacity
        if (count < capacity) count++
    }

    private fun sortedMs(): List<Double> = (0 until count).map { intervals[it] / 1e6 }.sorted()

    /** Interval in ms below which [q] of the frames fall (0.5 = median, 0.95 = the slow tail). */
    fun percentileMs(q: Double): Double = sortedMs().let { if (it.isEmpty()) 0.0 else it[((it.size - 1) * q).toInt()] }

    fun fps(): Double = if (count == 0) 0.0 else 1000.0 / ((0 until count).sumOf { intervals[it] } / 1e6 / count)

    /** Frames that missed the display's budget by half a frame or more (a visible stutter). */
    fun janky(budgetNanos: Long): Int = (0 until count).count { intervals[it] > budgetNanos * 3 / 2 }
}

/**
 * Frame rate, frame time and stutters of the player, drawn over it.
 * It asks for a frame every vsync, so it keeps an idle player drawing: read it while
 * the file animates or the reader scrolls, and use a Perfetto trace (sections `oim:*`) for idle cost.
 */
@Composable
internal fun OimPerformanceOverlay(layerCount: Int, modifier: Modifier = Modifier) {
    val refreshHz = LocalView.current.display?.refreshRate?.takeIf { it > 0f } ?: 60f
    val budget = (1e9 / refreshHz).toLong()
    val stats = remember { FrameStats() }
    var label by remember { mutableStateOf("…") }
    LaunchedEffect(budget) {
        var last = 0L
        var shown = 0L
        while (true) {
            withFrameNanos { now ->
                if (last != 0L) stats.add(now - last)
                last = now
                if (now - shown > 500_000_000L) {
                    shown = now
                    label = "%.0f fps @%.0fHz  p50 %.1fms  p95 %.1fms  jank %d/120  layers %d".format(
                        stats.fps(), refreshHz, stats.percentileMs(0.5), stats.percentileMs(0.95), stats.janky(budget), layerCount
                    )
                }
            }
        }
    }
    Text(
        text = label,
        style = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 10.sp, color = Color.White),
        modifier = modifier.background(Color(0xB3000000)).padding(horizontal = 6.dp, vertical = 3.dp)
    )
}

/** A section `name` in a system trace (Perfetto, Android Studio's profiler); free when nothing records. */
internal inline fun <T> traced(name: String, block: () -> T): T {
    android.os.Trace.beginSection(name)
    try {
        return block()
    } finally {
        android.os.Trace.endSection()
    }
}
