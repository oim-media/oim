/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import media.oim.sdk.model.OimArtisticStyle
import java.text.BreakIterator
import kotlin.math.atan2
import kotlin.math.min

/** `artisticTextLines` of `@oim-media/core`: each line and its vertical offset from box centre. */
internal fun artisticTextLines(text: String, fontSize: Float, lineHeight: Float): List<Pair<String, Float>> {
    val lines = text.split(Regex("\\r\\n|\\r|\\n"))
    val middle = (lines.size - 1) / 2f
    return lines.mapIndexed { i, line -> line to (i - middle) * fontSize * lineHeight }
}

/** `calculateTextCurvePath` of `@oim-media/core`, as a native Android [Path]. */
internal fun buildArtisticCurvePath(
    width: Float,
    height: Float,
    curveAmount: Float,
    curveType: String
): Path {
    val midY = height / 2f
    val c = curveAmount.coerceIn(-100f, 100f)
    val path = Path()
    if (c == 0f) {
        path.moveTo(0f, midY)
        path.lineTo(width, midY)
        return path
    }
    val deltaY = (c / 100f) * height * 0.45f
    if (curveType == "wave") {
        path.moveTo(0f, midY)
        path.cubicTo(
            width * 0.25f,
            midY - deltaY,
            width * 0.75f,
            midY + deltaY,
            width,
            midY
        )
    } else {
        val yEnds = midY + deltaY * 0.5f
        path.moveTo(0f, yEnds)
        path.quadTo(width / 2f, midY - deltaY, width, yEnds)
    }
    return path
}

private val GRADIENT_PRESETS = setOf("sunset-gold", "metallic-chrome", "neon-glow")

/** Built-in face gradients (`textGradientType`), matching web SVG `<linearGradient>` presets. */
internal fun buildArtisticFaceShader(textGradientType: String?, bounds: RectF): Shader? {
    if (bounds.width() <= 0f || bounds.height() <= 0f) return null
    return when (textGradientType) {
        "sunset-gold" -> LinearGradient(
            bounds.left,
            bounds.top,
            bounds.left,
            bounds.bottom,
            intArrayOf(0xFFFDE047.toInt(), 0xFFF97316.toInt(), 0xFFBE185D.toInt()),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        "metallic-chrome" -> LinearGradient(
            bounds.left,
            bounds.top,
            bounds.left,
            bounds.bottom,
            intArrayOf(
                0xFFFFFFFF.toInt(),
                0xFFE2E8F0.toInt(),
                0xFF64748B.toInt(),
                0xFF0F172A.toInt(),
                0xFF94A3B8.toInt(),
                0xFFFFFFFF.toInt()
            ),
            floatArrayOf(0f, 0.35f, 0.50f, 0.51f, 0.75f, 1f),
            Shader.TileMode.CLAMP
        )
        "neon-glow" -> LinearGradient(
            bounds.left,
            bounds.top,
            bounds.right,
            bounds.top,
            intArrayOf(0xFF67E8F9.toInt(), 0xFFA5F3FC.toInt()),
            floatArrayOf(0f, 1f),
            Shader.TileMode.CLAMP
        )
        else -> null
    }
}

private fun splitGraphemeClusters(text: String): List<String> {
    if (text.isEmpty()) return emptyList()
    val it = BreakIterator.getCharacterInstance()
    it.setText(text)
    val clusters = mutableListOf<String>()
    var start = it.first()
    var end = it.next()
    while (end != BreakIterator.DONE) {
        clusters.add(text.substring(start, end))
        start = end
        end = it.next()
    }
    return clusters
}

@Composable
internal fun OimArtisticTextCanvas(
    text: String,
    boxWidthPx: Float,
    boxHeightPx: Float,
    fontSizePx: Float,
    lineHeight: Float,
    letterSpacingEm: Float,
    typeface: Typeface,
    fillColor: Color,
    outerStrokeColor: Color,
    innerStrokeColor: Color,
    extrusionColor: Color,
    artistic: OimArtisticStyle,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val safeBoxW = boxWidthPx.coerceAtLeast(1f)
        val safeBoxH = boxHeightPx.coerceAtLeast(1f)
        val scale = min(size.width / safeBoxW, size.height / safeBoxH)
        val offsetX = (size.width - safeBoxW * scale) / 2f
        val offsetY = (size.height - safeBoxH * scale) / 2f

        val curvePath = if (artistic.curveAmount == 0f) {
            null
        } else {
            buildArtisticCurvePath(safeBoxW, safeBoxH, artistic.curveAmount, artistic.curveType)
        }
        val pathMeasure = curvePath?.let { PathMeasure(it, false) }
        val pathLength = pathMeasure?.length ?: 0f

        val extSteps = computeAndroidExtrusionLayers(
            depth = artistic.extrusionDepthPx,
            angleDegrees = artistic.extrusionAngleDeg,
            baseColor = if (extrusionColor.alpha > 0f) extrusionColor else Color(0xFF111827),
            shading = artistic.extrusionShading
        )
        val extStrokePx = if (artistic.outerStrokeWidthPx > 0f) artistic.outerStrokeWidthPx else 1f
        val resolvedLines = artisticTextLines(text, fontSizePx, lineHeight)

        fun makePaint(): Paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG or Paint.LINEAR_TEXT_FLAG).apply {
            textSize = fontSizePx
            this.typeface = typeface
            textAlign = Paint.Align.LEFT
            if (letterSpacingEm != 0f) letterSpacing = letterSpacingEm
        }

        drawIntoCanvas { composeCanvas ->
            val nativeCanvas = composeCanvas.nativeCanvas
            val canvasSave = nativeCanvas.save()
            nativeCanvas.translate(offsetX, offsetY)
            nativeCanvas.scale(scale, scale)

            fun drawLinePass(lineText: String, paint: Paint, lineOffsetY: Float): RectF {
                val fm = paint.fontMetrics
                if (pathMeasure == null || pathLength <= 0f) {
                    val textW = paint.measureText(lineText)
                    val x = (safeBoxW - textW) / 2f
                    val baselineY = safeBoxH / 2f + lineOffsetY - (fm.ascent + fm.descent) / 2f
                    nativeCanvas.drawText(lineText, x, baselineY, paint)
                    return RectF(x, baselineY + fm.ascent, x + textW, baselineY + fm.descent).apply {
                        inset(-fontSizePx * 0.25f, -fontSizePx * 0.25f)
                    }
                }

                val clusters = splitGraphemeClusters(lineText)
                val advances = FloatArray(clusters.size) { paint.measureText(clusters[it]) }
                val centers = curvedGlyphCenters(advances, paint.letterSpacing * paint.textSize, pathLength)
                val area = RectF()
                val pos = FloatArray(2)
                val tan = FloatArray(2)
                val pad = fontSizePx * 0.1f
                for (i in clusters.indices) {
                    val g = clusters[i]
                    val w = advances[i]
                    val mid = centers[i]
                    if (pathMeasure.getPosTan(mid, pos, tan)) {
                        val angleDeg = Math.toDegrees(atan2(tan[1].toDouble(), tan[0].toDouble())).toFloat()
                        nativeCanvas.save()
                        nativeCanvas.translate(pos[0], pos[1] + lineOffsetY)
                        nativeCanvas.rotate(angleDeg)
                        nativeCanvas.drawText(g, -w / 2f, 0f, paint)
                        nativeCanvas.restore()

                        val gRect = RectF(
                            pos[0] - w / 2f - pad,
                            pos[1] + lineOffsetY + fm.ascent - pad,
                            pos[0] + w / 2f + pad,
                            pos[1] + lineOffsetY + fm.descent + pad
                        )
                        area.union(gRect)
                    }
                }
                return area
            }

            val fillPaint = makePaint().apply { style = Paint.Style.FILL }
            val strokePaint = makePaint().apply {
                style = Paint.Style.STROKE
                strokeJoin = Paint.Join.ROUND
            }
            val srcInPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            }

            for ((lineText, lineOffsetY) in resolvedLines) {
                for (step in extSteps) {
                    val stepArgb = step.color.toArgb()
                    nativeCanvas.save()
                    nativeCanvas.translate(step.dx, step.dy)
                    fillPaint.color = stepArgb
                    drawLinePass(lineText, fillPaint, lineOffsetY)
                    strokePaint.color = stepArgb
                    strokePaint.strokeWidth = extStrokePx
                    drawLinePass(lineText, strokePaint, lineOffsetY)
                    nativeCanvas.restore()
                }

                if (artistic.outerStrokeWidthPx > 0f && outerStrokeColor.alpha > 0f) {
                    strokePaint.color = outerStrokeColor.toArgb()
                    strokePaint.strokeWidth = artistic.outerStrokeWidthPx * 2f
                    drawLinePass(lineText, strokePaint, lineOffsetY)
                }

                if (artistic.innerStrokeWidthPx > 0f && innerStrokeColor.alpha > 0f) {
                    strokePaint.color = innerStrokeColor.toArgb()
                    strokePaint.strokeWidth = artistic.innerStrokeWidthPx
                    drawLinePass(lineText, strokePaint, lineOffsetY)
                }

                val hasPresetGradient = artistic.textGradientType in GRADIENT_PRESETS
                if (!hasPresetGradient) {
                    fillPaint.color = fillColor.toArgb()
                    drawLinePass(lineText, fillPaint, lineOffsetY)
                } else {
                    val layerSave = nativeCanvas.saveLayer(null, null)
                    fillPaint.color = android.graphics.Color.WHITE
                    val area = drawLinePass(lineText, fillPaint, lineOffsetY)
                    val shader = buildArtisticFaceShader(artistic.textGradientType, area)
                    if (shader != null) {
                        srcInPaint.shader = shader
                        nativeCanvas.drawRect(area, srcInPaint)
                    }
                    nativeCanvas.restoreToCount(layerSave)
                }
            }

            nativeCanvas.restoreToCount(canvasSave)
        }
    }
}

/**
 * Where each glyph's centre falls along a curve of [pathLength], the line centred on it.
 * [spacing] (px) goes between glyphs: measureText of one glyph drops letterSpacing, which
 * Android trims at a run's ends, so it is added back here.
 */
internal fun curvedGlyphCenters(widths: FloatArray, spacing: Float, pathLength: Float): FloatArray {
    val total = widths.sum() + spacing * (widths.size - 1).coerceAtLeast(0)
    var dist = pathLength / 2f - total / 2f
    return FloatArray(widths.size) { i ->
        val mid = (dist + widths[i] / 2f).coerceIn(0f, pathLength)
        dist += widths[i] + spacing
        mid
    }
}
