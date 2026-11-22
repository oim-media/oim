/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntSize

/**
 * Zoom, pan and touch tilt of a player. Pass it to [OimPlayerView] and put [oimZoomGestures] on
 * the area the reader touches: a zoomed picture overflows its canvas, so a gesture on the canvas
 * alone misses the fingers that land on the overflow (a pinch out started there did nothing).
 */
@Stable
class OimZoomState {
    var scale by mutableFloatStateOf(1f)
    var panX by mutableFloatStateOf(0f)
    var panY by mutableFloatStateOf(0f)
    var tiltX by mutableFloatStateOf(0f)
    var tiltY by mutableFloatStateOf(0f)
    /** The canvas's size in px, set by the player: pan is bounded by it. */
    internal var canvasSize by mutableStateOf(IntSize.Zero)

    fun reset() {
        scale = 1f; panX = 0f; panY = 0f; tiltX = 0f; tiltY = 0f
    }

    /** Double tap: zoom in to 2.5x, or back to the whole picture. */
    fun toggleZoom() {
        if (scale > 1.05f) reset() else scale = 2.5f
    }

    /** One pinch/pan step: scale by [zoom] (1x to 5x) and move by [panDx], [panDy], kept over the canvas. */
    internal fun transform(zoom: Float, panDx: Float, panDy: Float, overflowVertically: Boolean) {
        scale = (scale * zoom).coerceIn(1f, 5f)
        if (scale <= 1.01f) {
            panX = 0f; panY = 0f
            return
        }
        val w = canvasSize.width.toFloat()
        val h = canvasSize.height.toFloat()
        val maxX = w * (scale - 1f) / 2f
        val maxY = (if (overflowVertically) maxOf(w, h) else h) * (scale - 1f) / 2f
        panX = (panX + panDx).coerceIn(-maxX, maxX)
        panY = (panY + panDy).coerceIn(-maxY, maxY)
    }
}

@Composable
fun rememberOimZoomState(key: Any? = null): OimZoomState = remember(key) { OimZoomState() }

/**
 * Pinch to zoom and pan over this element. Double tap is the host's: call [toggleZoom] from its tap detector.
 * With [tilt], a one-finger drag at 1x tilts the parallax layers instead.
 * [overflowVertically]: the picture may be panned past the canvas's height (no rounded frame clips it).
 */
fun Modifier.oimZoomGestures(state: OimZoomState, tilt: Boolean = false, overflowVertically: Boolean = true): Modifier =
    pointerInput(state, tilt, overflowVertically) {
        detectTransformGestures { centroid, pan, zoom, _ ->
            state.transform(zoom, pan.x, pan.y, overflowVertically)
            if (state.scale <= 1.01f && tilt) {
                state.tiltX = ((centroid.x / size.width.coerceAtLeast(1)) - 0.5f) * 2f
                state.tiltY = ((centroid.y / size.height.coerceAtLeast(1)) - 0.5f) * 2f
            }
        }
    }
