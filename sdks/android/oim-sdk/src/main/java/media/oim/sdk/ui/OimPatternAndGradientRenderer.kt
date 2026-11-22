/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Matrix as AndroidMatrix
import android.graphics.Paint as AndroidPaint
import android.graphics.Path as AndroidPath
import android.graphics.Shader
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.PathParser
import media.oim.sdk.model.OimGradientFill
import media.oim.sdk.model.OimPatternFill
import kotlin.math.abs
import media.oim.sdk.model.OimSvgPathItem
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

private fun posMod(value: Float, period: Float): Float {
    if (period <= 0f) return 0f
    return ((value % period) + period) % period
}

private fun normalizeHexMatch(raw: String?): String? {
    val s = raw?.trim()?.lowercase() ?: return null
    if (!s.startsWith("#")) return s
    return when (s.length) {
        4 -> "#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}"
        5 -> "#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}${s[4]}${s[4]}"
        else -> s
    }
}

private fun resolveTilePathColor(
    rawColor: String?,
    pattern: OimPatternFill,
    bgColor: Color,
    fgColor: Color,
    secondaryColor: Color,
    palette: Map<String, String>
): Color? {
    if (rawColor.isNullOrBlank()) return null
    val trimmed = rawColor.trim()
    if (trimmed.equals("none", ignoreCase = true) || trimmed.equals("transparent", ignoreCase = true)) {
        return null
    }
    val norm = normalizeHexMatch(trimmed)
    if (norm != null) {
        if (norm == normalizeHexMatch(pattern.rawBg)) return bgColor
        pattern.rawColors.forEachIndexed { idx, rawPal ->
            if (norm == normalizeHexMatch(rawPal)) {
                return when (idx) {
                    0 -> fgColor
                    1 -> secondaryColor
                    else -> resolveOimColorString(pattern.colors.getOrNull(idx), palette, secondaryColor)
                }
            }
        }
    }
    return resolveOimColorString(trimmed, palette, fgColor)
}

private fun renderPatternTileBitmap(
    pattern: OimPatternFill,
    vbX: Float,
    vbY: Float,
    vbW: Float,
    vbH: Float,
    bmpW: Int,
    bmpH: Int,
    bgColor: Color,
    fgColor: Color,
    secondaryColor: Color,
    palette: Map<String, String>
): Bitmap {
    val bmp = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bmp)
    val scaleX = bmpW.toFloat() / vbW
    val scaleY = bmpH.toFloat() / vbH
    val fillPaint = AndroidPaint(AndroidPaint.ANTI_ALIAS_FLAG).apply {
        style = AndroidPaint.Style.FILL
    }
    val strokePaint = AndroidPaint(AndroidPaint.ANTI_ALIAS_FLAG).apply {
        style = AndroidPaint.Style.STROKE
    }
    val matrix = AndroidMatrix()
    val matrixValues = FloatArray(9)

    for (item in pattern.tilePaths) {
        val parsedPath = try {
            parsedCopy(item.d).asAndroidPath()
        } catch (_: Exception) {
            null
        } ?: continue

        matrix.reset()
        val tr = item.transform
        if (tr != null && tr.size == 6) {
            matrix.setValues(
                floatArrayOf(
                    tr[0], tr[2], tr[4],
                    tr[1], tr[3], tr[5],
                    0f, 0f, 1f
                )
            )
        }
        matrix.postTranslate(-vbX, -vbY)
        matrix.postScale(scaleX, scaleY)
        parsedPath.transform(matrix)
        parsedPath.fillType = if (item.fillRule.equals("evenodd", ignoreCase = true)) {
            AndroidPath.FillType.EVEN_ODD
        } else {
            AndroidPath.FillType.WINDING
        }

        val itemAlpha = item.opacity.coerceIn(0f, 1f)
        val hasStroke = !item.stroke.isNullOrBlank() &&
            !item.stroke.equals("none", ignoreCase = true) &&
            !item.stroke.equals("transparent", ignoreCase = true)
        val fillResolved = if (item.fill == null && !hasStroke) {
            fgColor
        } else {
            resolveTilePathColor(item.fill, pattern, bgColor, fgColor, secondaryColor, palette)
        }

        if (fillResolved != null && fillResolved.alpha > 0f && itemAlpha > 0f) {
            fillPaint.color = fillResolved.copy(alpha = (fillResolved.alpha * itemAlpha).coerceIn(0f, 1f)).toArgb()
            canvas.drawPath(parsedPath, fillPaint)
        }

        if (hasStroke && itemAlpha > 0f) {
            val strokeResolved = resolveTilePathColor(item.stroke, pattern, bgColor, fgColor, secondaryColor, palette)
            if (strokeResolved != null && strokeResolved.alpha > 0f) {
                matrix.getValues(matrixValues)
                val det = matrixValues[0] * matrixValues[4] - matrixValues[1] * matrixValues[3]
                val strokeScale = sqrt(abs(det)).coerceAtLeast(0.01f)
                strokePaint.color = strokeResolved.copy(alpha = (strokeResolved.alpha * itemAlpha).coerceIn(0f, 1f)).toArgb()
                strokePaint.strokeWidth = ((item.strokeWidth ?: 1f) * strokeScale).coerceAtLeast(0.75f)
                strokePaint.strokeCap = when (item.cap?.lowercase()) {
                    "round" -> AndroidPaint.Cap.ROUND
                    "square" -> AndroidPaint.Cap.SQUARE
                    else -> AndroidPaint.Cap.BUTT
                }
                strokePaint.strokeJoin = when (item.join?.lowercase()) {
                    "round" -> AndroidPaint.Join.ROUND
                    "bevel" -> AndroidPaint.Join.BEVEL
                    else -> AndroidPaint.Join.MITER
                }
                canvas.drawPath(parsedPath, strokePaint)
            }
        }
    }
    return bmp
}

internal fun resolveOimColorString(
    raw: String?,
    palette: Map<String, String>,
    fallback: Color
): Color {
    if (raw.isNullOrBlank()) return fallback
    val trimmed = raw.trim()
    if (trimmed.equals("transparent", ignoreCase = true) || trimmed.equals("none", ignoreCase = true)) {
        return Color.Transparent
    }
    if (trimmed.startsWith("var(")) {
        val inner = trimmed.removePrefix("var(").removeSuffix(")")
        val commaIdx = inner.indexOf(',')
        val varName = (if (commaIdx >= 0) inner.substring(0, commaIdx) else inner).trim().removePrefix("--")
        val roleHit = palette[varName] ?: palette[varName.removePrefix("oim-color-")]
        if (roleHit != null) return resolveOimColorString(roleHit, palette, fallback)
        if (commaIdx >= 0) return resolveOimColorString(inner.substring(commaIdx + 1).trim(), palette, fallback)
        return fallback
    }
    if (trimmed.startsWith("rgb", ignoreCase = true)) {
        val nums = trimmed.substringAfter('(').substringBefore(')').split(',').map { it.trim().toFloatOrNull() }
        if (nums.size >= 3 && nums[0] != null && nums[1] != null && nums[2] != null) {
            val r = nums[0]!!.toInt().coerceIn(0, 255)
            val g = nums[1]!!.toInt().coerceIn(0, 255)
            val b = nums[2]!!.toInt().coerceIn(0, 255)
            val a = ((nums.getOrNull(3) ?: 1f) * 255f).roundToInt().coerceIn(0, 255)
            return Color(r, g, b, a)
        }
    }
    return try {
        Color(AndroidColor.parseColor(trimmed))
    } catch (_: Exception) {
        fallback
    }
}

@Composable
internal fun OimGradientBox(
    gradient: OimGradientFill,
    palette: Map<String, String>,
    modifier: Modifier = Modifier
) {
    val stops = gradient.stops.mapIndexed { idx, stop ->
        val pos = stop.position ?: if (gradient.stops.size > 1) idx.toFloat() / (gradient.stops.size - 1) else 0f
        val c = resolveOimColorString(stop.color, palette, Color.Transparent)
        pos.coerceIn(0f, 1f) to c
    }
    if (stops.isEmpty()) return

    Canvas(modifier = modifier) {
        val colorStops = if (stops.size == 1) {
            arrayOf(0f to stops[0].second, 1f to stops[0].second)
        } else {
            stops.toTypedArray()
        }
        val brush = if (gradient.type == "radial") {
            Brush.radialGradient(
                colorStops = colorStops,
                center = Offset(size.width / 2f, size.height / 2f),
                radius = maxOf(size.width, size.height) * 0.7f
            )
        } else {
            val rad = Math.toRadians((gradient.angleDeg - 90f).toDouble())
            val dx = cos(rad).toFloat()
            val dy = sin(rad).toFloat()
            val halfLen = (kotlin.math.abs(size.width * dx) + kotlin.math.abs(size.height * dy)) / 2f
            val cx = size.width / 2f
            val cy = size.height / 2f
            Brush.linearGradient(
                colorStops = colorStops,
                start = Offset(cx - dx * halfLen, cy - dy * halfLen),
                end = Offset(cx + dx * halfLen, cy + dy * halfLen)
            )
        }
        drawRect(brush = brush)
    }
}

@Composable
internal fun OimPatternCanvas(
    pattern: OimPatternFill,
    palette: Map<String, String>,
    canvasWidthPx: Float,
    naturalWidth: Int,
    modifier: Modifier = Modifier
) {
    @Suppress("NAME_SHADOWING") val pattern = remember(pattern) { scatteredPresetTile(pattern) }
    val bgColor = resolveOimColorString(pattern.bg, palette, Color.Transparent)
    val fgColor = resolveOimColorString(pattern.colors.firstOrNull(), palette, Color(0x66FFFFFF))
    val secondaryColor = resolveOimColorString(pattern.colors.getOrNull(1), palette, fgColor.copy(alpha = 0.5f))

    val hasMotion = pattern.motionPeriodSec > 0f && !pattern.motionDirection.isNullOrBlank()
    val periodMs = (pattern.motionPeriodSec * 1000f).toInt().coerceIn(300, 30000)
    val animProgress = if (hasMotion) {
        val dir = pattern.motionDirection.orEmpty()
        val isOscillating = dir == "zoom-in" || dir == "zoom-out" || dir == "pulse"
        val transition = rememberInfiniteTransition(label = "oim_pattern_${pattern.preset}")
        val value by transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = periodMs, easing = LinearEasing),
                repeatMode = if (isOscillating) RepeatMode.Reverse else RepeatMode.Restart
            ),
            label = "pattern_phase"
        )
        value
    } else {
        0f
    }

    val scaleFactor = (canvasWidthPx / naturalWidth.coerceAtLeast(1).toFloat()).coerceAtLeast(0.1f)
    val motionDir = pattern.motionDirection.orEmpty()
    val alphaMod = if (motionDir == "pulse") 1f - 0.35f * animProgress else 1f
    val zoomMod = when (motionDir) {
        "zoom-in" -> 1f + 0.15f * animProgress
        "zoom-out" -> 1.15f - 0.15f * animProgress
        else -> 1f
    }

    val hasTile = pattern.tilePaths.isNotEmpty()
    val vb = pattern.tileViewBox
    val vbX = vb?.getOrNull(0) ?: 0f
    val vbY = vb?.getOrNull(1) ?: 0f
    val vbW = (vb?.getOrNull(2) ?: 160f).coerceAtLeast(1f)
    val vbH = (vb?.getOrNull(3) ?: 160f).coerceAtLeast(1f)
    val bmpW = (vbW * pattern.scale * scaleFactor).roundToInt().coerceIn(16, 1024)
    val bmpH = (vbH * pattern.scale * scaleFactor).roundToInt().coerceIn(16, 1024)
    val tileBitmap = remember(pattern, bgColor, fgColor, secondaryColor, bmpW, bmpH, hasTile) {
        if (!hasTile) {
            null
        } else {
            renderPatternTileBitmap(
                pattern = pattern,
                vbX = vbX,
                vbY = vbY,
                vbW = vbW,
                vbH = vbH,
                bmpW = bmpW,
                bmpH = bmpH,
                bgColor = bgColor,
                fgColor = fgColor,
                secondaryColor = secondaryColor,
                palette = palette
            )
        }
    }
    val tileShader = remember(tileBitmap) {
        tileBitmap?.let { BitmapShader(it, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT) }
    }
    val shaderPaint = remember { AndroidPaint(AndroidPaint.ANTI_ALIAS_FLAG) }
    val shaderMatrix = remember { AndroidMatrix() }

    Box(modifier = modifier.then(if (bgColor.alpha > 0f) Modifier.background(bgColor) else Modifier)) {
        Canvas(modifier = Modifier.matchParentSize()) {
            val baseTile = (160f * pattern.scale * scaleFactor * zoomMod).coerceAtLeast(14f)
            val strokeW = (2.2f * scaleFactor * pattern.scale).coerceAtLeast(1f)
            val ink = fgColor.copy(alpha = (fgColor.alpha * alphaMod).coerceIn(0f, 1f))
            val ink2 = secondaryColor.copy(alpha = (secondaryColor.alpha * alphaMod).coerceIn(0f, 1f))

            fun rawPhase(periodPx: Float): Pair<Float, Float> {
                val px = when (motionDir) {
                    "right" -> animProgress * periodPx
                    "left" -> -animProgress * periodPx
                    else -> 0f
                }
                val py = when (motionDir) {
                    "down" -> animProgress * periodPx
                    "up" -> -animProgress * periodPx
                    else -> 0f
                }
                return posMod(px, periodPx) to posMod(py, periodPx)
            }

            clipRect {
                if (tileShader != null) {
                    val scaledTileW = (bmpW * zoomMod).coerceAtLeast(1f)
                    val scaledTileH = (bmpH * zoomMod).coerceAtLeast(1f)
                    val shiftX = when (motionDir) {
                        "right" -> posMod(animProgress * scaledTileW, scaledTileW)
                        "left" -> posMod(-animProgress * scaledTileW, scaledTileW)
                        else -> 0f
                    }
                    val shiftY = when (motionDir) {
                        "down" -> posMod(animProgress * scaledTileH, scaledTileH)
                        "up" -> posMod(-animProgress * scaledTileH, scaledTileH)
                        else -> 0f
                    }
                    shaderMatrix.reset()
                    shaderMatrix.setScale(zoomMod, zoomMod)
                    shaderMatrix.postTranslate(shiftX, shiftY)
                    tileShader.setLocalMatrix(shaderMatrix)
                    shaderPaint.shader = tileShader
                    shaderPaint.alpha = (alphaMod * 255f).roundToInt().coerceIn(0, 255)
                    drawContext.canvas.nativeCanvas.drawRect(0f, 0f, size.width, size.height, shaderPaint)
                } else when (pattern.preset.lowercase()) {
                    "waves", "wave", "olas" -> {
                        val waveRowH = (baseTile / 3f).coerceAtLeast(10f)
                        val rowPeriod = waveRowH * 2f
                        val (shiftX, _) = rawPhase(baseTile)
                        val (_, shiftY) = rawPhase(rowPeriod)
                        val startY = -rowPeriod + shiftY
                        val startX = -baseTile + shiftX
                        val waveRows = ceil((size.height + rowPeriod * 2f) / waveRowH).toInt() + 2
                        val amp = waveRowH * 0.22f
                        val segW = baseTile / 2f
                        val segCols = ceil((size.width + baseTile * 2f) / segW).toInt() + 2
                        for (r in 0..waveRows) {
                            val cy = startY + r * waveRowH
                            val path = Path()
                            path.moveTo(startX, cy)
                            for (c in 0..segCols) {
                                val x0 = startX + c * segW
                                val midX = x0 + segW / 2f
                                val x1 = x0 + segW
                                val peak = if (c % 2 == 0) cy - amp else cy + amp
                                path.quadraticTo(midX, peak, x1, cy)
                            }
                            drawPath(
                                path = path,
                                color = if (r % 2 == 0) ink else ink2.takeIf { it.alpha > 0f } ?: ink,
                                style = Stroke(width = strokeW)
                            )
                        }
                    }

                    "grid", "cuadricula", "lines", "lineas" -> {
                        val step = (baseTile / 2f).coerceAtLeast(12f)
                        val (shiftX, shiftY) = rawPhase(step)
                        val gxCols = ceil(size.width / step).toInt() + 3
                        val gyRows = ceil(size.height / step).toInt() + 3
                        for (c in -1..gxCols) {
                            val x = c * step + shiftX
                            drawLine(ink, Offset(x, 0f), Offset(x, size.height), strokeWidth = strokeW * 0.7f)
                        }
                        for (r in -1..gyRows) {
                            val y = r * step + shiftY
                            drawLine(ink, Offset(0f, y), Offset(size.width, y), strokeWidth = strokeW * 0.7f)
                        }
                    }

                    "checker", "checkered", "ajedrez" -> {
                        val half = (baseTile / 2f).coerceAtLeast(10f)
                        val tile2 = half * 2f
                        val (shiftX, shiftY) = rawPhase(tile2)
                        val cCols = ceil(size.width / half).toInt() + 4
                        val cRows = ceil(size.height / half).toInt() + 4
                        for (r in -2..cRows) {
                            for (c in -2..cCols) {
                                if ((r + c) % 2 == 0) {
                                    drawRect(
                                        color = ink,
                                        topLeft = Offset(c * half + shiftX, r * half + shiftY),
                                        size = Size(half, half)
                                    )
                                }
                            }
                        }
                    }

                    "stripes", "diagonal", "rayas" -> {
                        val step = (baseTile / 3f).coerceAtLeast(10f)
                        val (shiftX, shiftY) = rawPhase(step)
                        val count = ceil((size.width + size.height) / step).toInt() + 4
                        for (i in -count..count) {
                            val x = i * step + shiftX - shiftY
                            drawLine(
                                color = ink,
                                start = Offset(x, 0f),
                                end = Offset(x + size.height, size.height),
                                strokeWidth = strokeW * 1.4f
                            )
                        }
                    }

                    else -> {
                        val step = (baseTile / 3f).coerceAtLeast(12f)
                        val (shiftX, _) = rawPhase(step)
                        val (_, shiftY) = rawPhase(step * 2f)
                        val dCols = ceil(size.width / step).toInt() + 4
                        val dRows = ceil(size.height / step).toInt() + 4
                        val radius = (step * 0.1f).coerceAtLeast(1.8f)
                        for (r in -2..dRows) {
                            val offsetRow = if (r % 2 == 0) 0f else step / 2f
                            for (c in -2..dCols) {
                                drawCircle(
                                    color = ink,
                                    radius = radius,
                                    center = Offset(c * step + offsetRow + shiftX, r * step + shiftY)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** seededRandom of @oim-media/core patterns.ts. */
private fun seededRandom(seed: Double): Double {
    val x = sin(seed) * 10000.0
    return x - kotlin.math.floor(x)
}

/** The filled figures of PATTERN_PRESET_SVGS (@oim-media/core patterns.ts), in their 24 x 24 box. */
private val SCATTER_FIGURES = mapOf(
    "clouds" to "M17.5 19A5.5 5.5 0 0 0 18 8.02a7.5 7.5 0 0 0-14.93 2.1A5.5 5.5 0 0 0 4.5 21h13a1 1 0 0 0 0-2z",
    "stars" to "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    "heart" to "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
    "bolt" to "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    "leaf" to "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 8a7 7 0 0 1-9 10z",
    "drop" to "M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z",
    "moon" to "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
    "crown" to "M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z",
    "dots" to "M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0z",
)

/**
 * A preset pattern without a drawn tile gets the tile generatePatternSVG draws in
 * @oim-media/core: 15 figures scattered over a 160-unit tile (dispersion 0.5), each
 * repeated across the edges. Several colours take turns, as there.
 * shortcut: stroke presets (grid, waves, stripes, zigzags) and bubbles keep the old drawing; port them when a file needs it.
 */
internal fun scatteredPresetTile(pattern: OimPatternFill): OimPatternFill {
    if (pattern.tilePaths.isNotEmpty()) return pattern
    val figure = SCATTER_FIGURES[pattern.preset.lowercase()] ?: return pattern
    val base = 160.0
    val count = 15
    val dispersion = 0.5
    val cols = kotlin.math.ceil(kotlin.math.sqrt(count.toDouble())).toInt()
    val rows = kotlin.math.ceil(count.toDouble() / cols).toInt()
    val grid = base / cols
    val items = mutableListOf<OimSvgPathItem>()
    for (r in 0 until rows) for (c in 0 until cols) {
        val idx = r * cols + c
        if (idx >= count) break
        val seed = idx * 23.456 + 1.23
        val x0 = (c * grid + grid / 2 + (seededRandom(seed) - 0.5) * grid * dispersion * 1.5).coerceIn(5.0, base - 5)
        val y0 = (r * grid + grid / 2 + (seededRandom(seed + 7.4) - 0.5) * grid * dispersion * 1.5).coerceIn(5.0, base - 5)
        val k = (0.8 + (seededRandom(seed + 13.9) - 0.5) * 0.7 * dispersion) * pattern.scale
        val rad = Math.toRadians(seededRandom(seed + 19.3) * 360 * dispersion)
        val (cs, sn) = cos(rad) * k to sin(rad) * k
        val color = if (pattern.colors.size > 1) pattern.colors[idx % pattern.colors.size] else null
        for (dx in -1..1) for (dy in -1..1) {
            val x = x0 + dx * base
            val y = y0 + dy * base
            if (x <= -30 || x >= base + 30 || y <= -30 || y >= base + 30) continue
            // translate(x, y) scale(k) rotate(r) translate(-12, -12), as an SVG matrix [a b c d e f].
            val m = listOf(cs, sn, -sn, cs, x - 12 * (cs - sn), y - 12 * (sn + cs)).map { it.toFloat() }
            items += OimSvgPathItem(d = figure, fill = color, transform = m)
        }
    }
    return pattern.copy(tileViewBox = listOf(0f, 0f, 160f, 160f), tilePaths = items)
}
