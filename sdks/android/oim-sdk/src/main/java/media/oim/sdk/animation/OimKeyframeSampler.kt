/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.animation

import media.oim.sdk.model.OimKeyframe
import kotlin.math.max
import kotlin.math.min

data class KeyframeState(
    val x: Float,
    val y: Float,
    val r: Float,
    val s: Float,
    val o: Float,
    val b: Float
)

/**
 * Direct port of `@oim-media/core/keyframes.ts` (`sampleKeyframes` & `easeProgress`).
 * Guarantees identical motion curves across Web WAAPI, Flutter, and Native Android.
 */
object OimKeyframeSampler {

    private val NAMED_EASINGS: Map<String, FloatArray> = mapOf(
        "ease-in" to floatArrayOf(0.42f, 0f, 1f, 1f),
        "ease-out" to floatArrayOf(0f, 0f, 0.58f, 1f),
        "ease-in-out" to floatArrayOf(0.42f, 0f, 0.58f, 1f),
        "ease" to floatArrayOf(0.25f, 0.1f, 0.25f, 1f)
    )

    private data class ChannelFrame(
        val offset: Double,
        val values: DoubleArray,
        val easingKeyword: String? = null,
        val cubicBezier: List<Double>? = null
    )

    private fun cubicBezier(x1: Float, y1: Float, x2: Float, y2: Float, x: Float): Float {
        fun bx(t: Float): Float {
            val mt = 1f - t
            return 3f * mt * mt * t * x1 + 3f * mt * t * t * x2 + t * t * t
        }
        var lo = 0f
        var hi = 1f
        repeat(40) {
            val mid = (lo + hi) * 0.5f
            if (bx(mid) < x) lo = mid else hi = mid
        }
        val t = (lo + hi) * 0.5f
        val mt = 1f - t
        return 3f * mt * mt * t * y1 + 3f * mt * t * t * y2 + t * t * t
    }

    fun easeProgress(easingKeyword: String?, cubicBezier: List<Double>?, progress: Float): Float {
        val p = progress.coerceIn(0f, 1f)
        if (cubicBezier != null && cubicBezier.size == 4) {
            return cubicBezier(
                cubicBezier[0].toFloat(),
                cubicBezier[1].toFloat(),
                cubicBezier[2].toFloat(),
                cubicBezier[3].toFloat(),
                p
            )
        }
        if (easingKeyword == null || easingKeyword == "linear") return p
        if (easingKeyword == "steps(1, end)") return if (p >= 1f) 1f else 0f
        val b = NAMED_EASINGS[easingKeyword]
        return if (b != null) cubicBezier(b[0], b[1], b[2], b[3], p) else p
    }

    private fun sampleChannel(frames: List<ChannelFrame>, base: DoubleArray, p: Double): DoubleArray {
        if (frames.isEmpty()) return base
        val list = frames.toMutableList()
        if (list.first().offset > 0.0) {
            list.add(0, ChannelFrame(0.0, base))
        }
        if (list.last().offset < 1.0) {
            list.add(ChannelFrame(1.0, base))
        }
        for (i in 0 until list.size - 1) {
            val a = list[i]
            val b = list[i + 1]
            if (p <= b.offset) {
                val span = b.offset - a.offset
                val local = if (span > 0.0) (p - a.offset) / span else 1.0
                val k = easeProgress(a.easingKeyword, a.cubicBezier, local.coerceIn(0.0, 1.0).toFloat()).toDouble()
                return DoubleArray(a.values.size) { j -> a.values[j] + (b.values[j] - a.values[j]) * k }
            }
        }
        return list.last().values
    }

    fun sampleKeyframes(keyframes: List<OimKeyframe>, durationSec: Double, timeSec: Double): KeyframeState {
        if (keyframes.isEmpty()) return KeyframeState(0f, 0f, 0f, 1f, 1f, 0f)
        val p = if (durationSec > 0.0) max(0.0, min(1.0, timeSec / durationSec)) else 1.0
        fun offset(kf: OimKeyframe): Double = if (durationSec > 0.0) (kf.t / durationSec).coerceIn(0.0, 1.0) else 1.0

        val sorted = keyframes.sortedBy { it.t }
        val transformFrames = sorted.map { kf ->
            ChannelFrame(
                offset = offset(kf),
                values = doubleArrayOf(kf.x ?: 0.0, kf.y ?: 0.0, kf.r ?: 0.0, kf.s ?: 1.0),
                easingKeyword = kf.easingKeyword,
                cubicBezier = kf.cubicBezier
            )
        }
        val opacityFrames = sorted.filter { it.o != null }.map { kf ->
            ChannelFrame(offset(kf), doubleArrayOf(kf.o!!), kf.easingKeyword, kf.cubicBezier)
        }
        val blurFrames = sorted.filter { it.b != null }.map { kf ->
            ChannelFrame(offset(kf), doubleArrayOf(kf.b!!), kf.easingKeyword, kf.cubicBezier)
        }

        val tVals = sampleChannel(transformFrames, doubleArrayOf(0.0, 0.0, 0.0, 1.0), p)
        val oVal = sampleChannel(opacityFrames, doubleArrayOf(1.0), p)[0]
        val bVal = sampleChannel(blurFrames, doubleArrayOf(0.0), p)[0]

        return KeyframeState(
            x = tVals[0].toFloat(),
            y = tVals[1].toFloat(),
            r = tVals[2].toFloat(),
            s = tVals[3].toFloat(),
            o = oVal.toFloat(),
            b = bVal.toFloat()
        )
    }
}
