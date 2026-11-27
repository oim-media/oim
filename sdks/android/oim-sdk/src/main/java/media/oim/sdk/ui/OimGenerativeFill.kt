/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.graphics.Paint
import android.graphics.Path
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import media.oim.sdk.model.OimGenerativeFill
import kotlin.math.abs
import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/** Deterministic Mulberry32 PRNG matching `@oim-media/core/src/generative/rng.ts`. */
internal class OimMulberry32(seed: Int) {
    private var state: Int = seed

    fun next(): Double {
        state += 0x6d2b79f5
        var t = (state xor (state ushr 15)) * (1 or state)
        t = (t + (t xor (t ushr 7)) * (61 or t)) xor t
        return ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }
}

private fun srgbToLinear(c: Double): Double =
    if (c > 0.04045) ((c + 0.055) / 1.055).pow(2.4) else c / 12.92

private fun linearToSrgb(c: Double): Double {
    val clamped = c.coerceIn(0.0, 1.0)
    return if (clamped > 0.0031308) 1.055 * clamped.pow(1.0 / 2.4) - 0.055 else 12.92 * clamped
}

private fun hexToRgbUnit(hex: String): DoubleArray {
    var cleaned = hex.trim().removePrefix("#")
    if (cleaned.length == 3) {
        cleaned = buildString(6) { for (ch in cleaned) append(ch).append(ch) }
    }
    val num = cleaned.toIntOrNull(16) ?: return doubleArrayOf(0.0, 0.0, 0.0)
    return doubleArrayOf(
        ((num ushr 16) and 255) / 255.0,
        ((num ushr 8) and 255) / 255.0,
        (num and 255) / 255.0
    )
}

private fun rgbUnitToHex(r: Double, g: Double, b: Double): String {
    val rb = (r * 255.0).roundToInt().coerceIn(0, 255)
    val gb = (g * 255.0).roundToInt().coerceIn(0, 255)
    val bb = (b * 255.0).roundToInt().coerceIn(0, 255)
    return String.format("#%02x%02x%02x", rb, gb, bb)
}

private fun rgbToOklab(r: Double, g: Double, b: Double): DoubleArray {
    val lr = srgbToLinear(r)
    val lg = srgbToLinear(g)
    val lb = srgbToLinear(b)
    val l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
    val m = 0.2118591070 * lr + 0.6806951351 * lg + 0.1074457579 * lb
    val s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
    val l_ = cbrt(l)
    val m_ = cbrt(m)
    val s_ = cbrt(s)
    return doubleArrayOf(
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    )
}

private fun oklabToRgb(L: Double, a: Double, b: Double): DoubleArray {
    val l_ = L + 0.3963377774 * a + 0.2158037573 * b
    val m_ = L - 0.1055613458 * a - 0.0638541728 * b
    val s_ = L - 0.0894841775 * a - 1.2914855480 * b
    val l = l_ * l_ * l_
    val m = m_ * m_ * m_
    val s = s_ * s_ * s_
    val lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    val lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    val lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return doubleArrayOf(linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb))
}

/** Perceptual OKLab interpolation matching `@oim-media/core/src/generative/ramp.ts`. */
internal fun interpolateOklabHex(color1: String, color2: String, t: Double): String {
    val clampedT = t.coerceIn(0.0, 1.0)
    val rgb1 = hexToRgbUnit(color1)
    val rgb2 = hexToRgbUnit(color2)
    val lab1 = rgbToOklab(rgb1[0], rgb1[1], rgb1[2])
    val lab2 = rgbToOklab(rgb2[0], rgb2[1], rgb2[2])
    val rgbOut = oklabToRgb(
        lab1[0] + (lab2[0] - lab1[0]) * clampedT,
        lab1[1] + (lab2[1] - lab1[1]) * clampedT,
        lab1[2] + (lab2[2] - lab1[2]) * clampedT
    )
    return rgbUnitToHex(rgbOut[0], rgbOut[1], rgbOut[2])
}

internal fun resolveGenerativeColor(
    mode: String,
    stops: List<String>,
    direction: String,
    index: Int,
    total: Int
): String {
    val validStops = if (stops.isNotEmpty()) stops else listOf("#3b82f6", "#0f172a")
    if (total <= 1) return validStops[0]

    var t = index.toDouble() / (total - 1).toDouble()
    when (direction) {
        "reverse" -> t = 1.0 - t
        "radial" -> t = abs(t - 0.5) * 2.0
    }

    if (mode == "monochrome" || validStops.size == 2) {
        return interpolateOklabHex(validStops.first(), validStops.last(), t)
    }

    val segmentCount = validStops.size - 1
    val scaledT = t * segmentCount
    val segmentIndex = min(scaledT.toInt(), segmentCount - 1)
    val segmentT = scaledT - segmentIndex
    return interpolateOklabHex(validStops[segmentIndex], validStops[segmentIndex + 1], segmentT)
}

internal data class GenerativeLayerPath(val path: Path, val colorHex: String)

private data class LayerStackSpec(
    val interpolation: String,
    val boundary: String,
    val defaultLayers: Int = 5,
    val defaultFrequency: Int = 4,
    val defaultAmplitude: Double = 0.5
)

private val LAYER_STACK_SPECS = mapOf(
    "stacked-waves" to LayerStackSpec("wave", "shared", 5, 4, 0.5),
    "layered-waves" to LayerStackSpec("wave", "independent", 5, 4, 0.5),
    "stacked-peaks" to LayerStackSpec("peak", "shared", 5, 4, 0.6),
    "layered-peaks" to LayerStackSpec("peak", "independent", 5, 4, 0.5),
    "stacked-steps" to LayerStackSpec("step", "shared", 5, 5, 0.5),
    "layered-steps" to LayerStackSpec("step", "independent", 5, 4, 0.5),
    "zigzag-chevron" to LayerStackSpec("zigzag", "independent", 6, 4, 0.5)
)

private fun paramNumber(params: Map<String, Any>, key: String, fallback: Double): Double =
    when (val v = params[key]) {
        is Number -> v.toDouble()
        is String -> v.toDoubleOrNull() ?: fallback
        else -> fallback
    }

/** Generates paths matching `@oim-media/core/src/generative/primitives/layer-stack.ts`. */
internal fun buildLayerStackPaths(
    fill: OimGenerativeFill,
    width: Float,
    height: Float,
    bleed: Float = 1f
): List<GenerativeLayerPath> {
    val spec = LAYER_STACK_SPECS[fill.generatorId] ?: LAYER_STACK_SPECS.getValue("stacked-waves")
    val layers = paramNumber(fill.params, "layers", spec.defaultLayers.toDouble()).toInt().coerceIn(1, 12)
    val frequency = paramNumber(fill.params, "frequency", spec.defaultFrequency.toDouble()).toInt().coerceIn(2, 12)
    val amplitude = paramNumber(fill.params, "amplitude", spec.defaultAmplitude).coerceIn(0.0, 1.0)
    val balance = paramNumber(fill.params, "balance", 0.5).coerceIn(0.0, 1.0)
    val anchor = (fill.params["anchor"] as? String)?.ifBlank { "bottom" } ?: "bottom"

    val w = width.toDouble()
    val h = height.toDouble()
    val bleedD = bleed.toDouble()
    val isVertical = anchor == "bottom" || anchor == "top"
    val mainSize = if (isVertical) h else w
    val crossSize = if (isVertical) w else h

    val layerSpan = mainSize / (layers + 1).toDouble()
    val bias = (balance - 0.5) * crossSize * 0.4
    val rng = OimMulberry32(fill.seed)

    val allPoints = ArrayList<List<Pair<Float, Float>>>(layers)
    val stepCross = crossSize / frequency.toDouble()
    for (l in 0 until layers) {
        val baseOffset = (l + 1) * layerSpan
        val currentPoints = ArrayList<Pair<Float, Float>>(frequency + 1)
        for (f in 0..frequency) {
            val crossPos = f * stepCross
            val noise = (rng.next() - 0.5) * layerSpan * amplitude * 1.6
            val pointOffset = max(10.0, min(mainSize - 10.0, baseOffset + noise))
            if (isVertical) {
                val x = crossPos + if (f > 0 && f < frequency) bias else 0.0
                val y = if (anchor == "bottom") h - pointOffset else pointOffset
                currentPoints.add(x.toFloat() to y.toFloat())
            } else {
                val y = crossPos + if (f > 0 && f < frequency) bias else 0.0
                val x = if (anchor == "right") w - pointOffset else pointOffset
                currentPoints.add(x.toFloat() to y.toFloat())
            }
        }
        allPoints.add(currentPoints)
    }

    val layerIndices = if (spec.boundary == "independent") {
        (layers - 1 downTo 0).toList()
    } else {
        (0 until layers).toList()
    }

    return layerIndices.map { l ->
        val colorHex = resolveGenerativeColor(fill.colorMode, fill.colorStops, fill.colorDirection, l, layers)
        val pts = allPoints[l]
        val path = Path()
        path.moveTo(pts[0].first, pts[0].second)

        when (spec.interpolation) {
            "step" -> {
                for (p in 0 until pts.size - 1) {
                    val p1 = pts[p]
                    val p2 = pts[p + 1]
                    if (isVertical) {
                        path.lineTo(p2.first, p1.second)
                        path.lineTo(p2.first, p2.second)
                    } else {
                        path.lineTo(p1.first, p2.second)
                        path.lineTo(p2.first, p2.second)
                    }
                }
            }
            "peak" -> {
                for (p in 1 until pts.size) {
                    path.lineTo(pts[p].first, pts[p].second)
                }
            }
            "zigzag", "chevron" -> {
                for (p in 0 until pts.size - 1) {
                    val p1 = pts[p]
                    val p2 = pts[p + 1]
                    val midShift = if (l % 2 == 0) 30f else -30f
                    val midX = (p1.first + p2.first) / 2f + if (isVertical) 0f else midShift
                    val midY = (p1.second + p2.second) / 2f + if (isVertical) midShift else 0f
                    path.lineTo(midX, midY)
                    path.lineTo(p2.first, p2.second)
                }
            }
            else -> {
                for (p in 0 until pts.size - 1) {
                    val p1 = pts[p]
                    val p2 = pts[p + 1]
                    val cp1x = p1.first + (p2.first - p1.first) * 0.5f
                    path.cubicTo(cp1x, p1.second, cp1x, p2.second, p2.first, p2.second)
                }
            }
        }

        if (spec.boundary == "shared" && l > 0) {
            val prev = allPoints[l - 1]
            val dy = when (anchor) {
                "bottom" -> bleed
                "top" -> -bleed
                else -> 0f
            }
            val dx = when (anchor) {
                "right" -> bleed
                "left" -> -bleed
                else -> 0f
            }
            for (p in prev.size - 1 downTo 0) {
                path.lineTo(prev[p].first + dx, prev[p].second + dy)
            }
        } else {
            when (anchor) {
                "bottom" -> {
                    path.lineTo(width, height + bleed)
                    path.lineTo(0f, height + bleed)
                }
                "top" -> {
                    path.lineTo(width, -bleed)
                    path.lineTo(0f, -bleed)
                }
                "right" -> {
                    path.lineTo(width + bleed, height)
                    path.lineTo(width + bleed, 0f)
                }
                else -> {
                    path.lineTo(-bleed, height)
                    path.lineTo(-bleed, 0f)
                }
            }
        }
        path.close()
        GenerativeLayerPath(path = path, colorHex = colorHex)
    }
}

@Composable
internal fun OimGenerativeFillCanvas(
    fill: OimGenerativeFill,
    boxWidthPx: Float,
    boxHeightPx: Float,
    palette: Map<String, String>,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val safeW = boxWidthPx.coerceAtLeast(1f)
        val safeH = boxHeightPx.coerceAtLeast(1f)
        val bleed = 1f
        val totalH = safeH + bleed
        val scale = max(size.width / safeW, size.height / totalH)
        val tx = (size.width - safeW * scale) / 2f
        val ty = (size.height - totalH * scale) / 2f
        val layers = buildLayerStackPaths(fill, safeW, safeH, bleed)

        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 0.5f
            strokeJoin = Paint.Join.ROUND
            strokeCap = Paint.Cap.ROUND
        }

        drawIntoCanvas { composeCanvas ->
            val nativeCanvas = composeCanvas.nativeCanvas
            val save = nativeCanvas.save()
            nativeCanvas.clipRect(0f, 0f, size.width, size.height)
            nativeCanvas.translate(tx, ty)
            nativeCanvas.scale(scale, scale)

            if (fill.backgroundVisible && !fill.backgroundColorHex.isNullOrBlank()) {
                val bgColor = parseOimColor(fill.backgroundColorHex, palette, Color.Transparent)
                if (bgColor.alpha > 0f) {
                    fillPaint.color = bgColor.toArgb()
                    nativeCanvas.drawRect(0f, 0f, safeW, totalH, fillPaint)
                }
            }

            for (layer in layers) {
                val argb = parseOimColor(layer.colorHex, palette, Color(0xFF3B82F6)).toArgb()
                fillPaint.color = argb
                nativeCanvas.drawPath(layer.path, fillPaint)
                strokePaint.color = argb
                nativeCanvas.drawPath(layer.path, strokePaint)
            }

            nativeCanvas.restoreToCount(save)
        }
    }
}
