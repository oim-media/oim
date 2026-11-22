/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import androidx.compose.ui.graphics.ColorMatrix
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** FILTER_PRESET_CSS of @oim-media/core media-filters.ts. Keep in step with it. */
internal val FILTER_PRESET_CSS = mapOf(
    "grayscale" to "grayscale(1)",
    "sepia" to "sepia(0.8)",
    "high-contrast" to "contrast(1.5) saturate(1.2)",
    "vintage" to "sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)",
    "cool" to "saturate(1.1) hue-rotate(15deg) brightness(1.02)",
    "warm" to "saturate(1.15) hue-rotate(-12deg) brightness(1.03)",
    "faded" to "contrast(0.85) brightness(1.1) saturate(0.8)",
    "cinema" to "contrast(1.25) saturate(1.1) hue-rotate(-8deg) brightness(0.95)",
    "nordic" to "saturate(0.7) hue-rotate(20deg) brightness(1.05) contrast(1.1)",
    "sunset" to "sepia(0.4) saturate(1.4) hue-rotate(-20deg) brightness(1.05)",
    "noir" to "grayscale(1) contrast(1.6) brightness(0.9)",
    "dramatic" to "contrast(1.6) saturate(1.3) brightness(0.95)",
    "cyberpunk" to "contrast(1.3) saturate(1.8) hue-rotate(140deg)",
    "pastel" to "brightness(1.15) saturate(1.3) contrast(0.9) hue-rotate(-5deg)",
    "vhs" to "sepia(0.2) contrast(1.2) saturate(1.5) hue-rotate(30deg) brightness(1.05)",
)

private fun rgb(r: DoubleArray, g: DoubleArray, b: DoubleArray, offset: Double = 0.0): ColorMatrix {
    val o = (offset * 255).toFloat()
    return ColorMatrix(
        floatArrayOf(
            r[0].toFloat(), r[1].toFloat(), r[2].toFloat(), 0f, o,
            g[0].toFloat(), g[1].toFloat(), g[2].toFloat(), 0f, o,
            b[0].toFloat(), b[1].toFloat(), b[2].toFloat(), 0f, o,
            0f, 0f, 0f, 1f, 0f,
        )
    )
}

/** One CSS filter function as a colour matrix (Filter Effects 1, 9.6 and the transfer functions). Null for blur and unknowns. */
private fun cssFunction(name: String, a: Double): ColorMatrix? = when (name) {
    "grayscale" -> {
        val k = 1 - a.coerceIn(0.0, 1.0)
        rgb(
            doubleArrayOf(0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k),
            doubleArrayOf(0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k),
            doubleArrayOf(0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k),
        )
    }
    "sepia" -> {
        val k = 1 - a.coerceIn(0.0, 1.0)
        rgb(
            doubleArrayOf(0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k),
            doubleArrayOf(0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k),
            doubleArrayOf(0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k),
        )
    }
    "saturate" -> rgb(
        doubleArrayOf(0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a),
        doubleArrayOf(0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a),
        doubleArrayOf(0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a),
    )
    "hue-rotate" -> {
        val t = a * PI / 180
        val c = cos(t)
        val s = sin(t)
        rgb(
            doubleArrayOf(0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928),
            doubleArrayOf(0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283),
            doubleArrayOf(0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072),
        )
    }
    "contrast" -> rgb(doubleArrayOf(a, 0.0, 0.0), doubleArrayOf(0.0, a, 0.0), doubleArrayOf(0.0, 0.0, a), 0.5 - 0.5 * a)
    "brightness" -> rgb(doubleArrayOf(a, 0.0, 0.0), doubleArrayOf(0.0, a, 0.0), doubleArrayOf(0.0, 0.0, a))
    else -> null
}

private val CSS_FUNCTION = Regex("""([a-z-]+)\(\s*(-?[0-9.]+)(deg|%)?\s*\)""")

/** A CSS filter list (blur left out) as one colour matrix, applied left to right; null when it has none. */
internal fun cssFilterMatrix(css: String): ColorMatrix? {
    val steps = CSS_FUNCTION.findAll(css).mapNotNull { m ->
        val raw = m.groupValues[2].toDouble()
        cssFunction(m.groupValues[1], if (m.groupValues[3] == "%") raw / 100 else raw)
    }.toList()
    if (steps.isEmpty()) return null
    // timesAssign makes `this = this x other`: the later step stays on the left.
    return steps.reduce { acc, next -> ColorMatrix(next.values.copyOf()).apply { timesAssign(acc) } }
}
