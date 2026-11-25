/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.roundToInt

/**
 * Converts a CSS Gaussian standard deviation (`sigmaPx`) into the radius expected by
 * Skia/Android `BlurMaskFilter` (inverse of Skia's `sigma = radius * 0.57735 + 0.5`).
 */
internal fun createCssBlurMaskFilter(sigmaPx: Float): BlurMaskFilter? {
    if (sigmaPx <= 0.1f) return null
    val radius = if (sigmaPx <= 0.5f) sigmaPx else (sigmaPx - 0.5f) / 0.57735f
    return BlurMaskFilter(radius.coerceAtLeast(0.1f), BlurMaskFilter.Blur.NORMAL)
}

/**
 * Separable premultiplied-alpha 2D Gaussian blur matching CSS `filter: blur(sigma)`
 * with transparent zero-padding outside bounds (no dark edge bleed).
 */
internal fun blurBitmapGaussian(src: Bitmap, sigmaPx: Float): Bitmap {
    if (sigmaPx <= 0.25f || src.width <= 0 || src.height <= 0) return src
    val w = src.width
    val h = src.height
    val count = w * h
    val pixels = IntArray(count)
    val readable = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
    readable.getPixels(pixels, 0, w, 0, 0, w, h)
    if (readable !== src) readable.recycle()

    val r = ceil(sigmaPx * 3f).toInt().coerceIn(1, 64)
    val kSize = r * 2 + 1
    val weights = FloatArray(kSize)
    var weightSum = 0.0
    val invTwoSigmaSq = 1.0 / (2.0 * sigmaPx.toDouble() * sigmaPx.toDouble())
    for (k in -r..r) {
        val v = exp(-(k * k) * invTwoSigmaSq)
        weights[k + r] = v.toFloat()
        weightSum += v
    }
    val norm = (1.0 / weightSum).toFloat()
    for (i in weights.indices) {
        weights[i] *= norm
    }

    val preR = FloatArray(count)
    val preG = FloatArray(count)
    val preB = FloatArray(count)
    val preA = FloatArray(count)
    for (i in 0 until count) {
        val px = pixels[i]
        val a = ((px ushr 24) and 0xFF) / 255f
        preA[i] = a
        preR[i] = ((px ushr 16) and 0xFF) * a
        preG[i] = ((px ushr 8) and 0xFF) * a
        preB[i] = (px and 0xFF) * a
    }

    val tmpR = FloatArray(count)
    val tmpG = FloatArray(count)
    val tmpB = FloatArray(count)
    val tmpA = FloatArray(count)

    // Horizontal pass with zero-padding outside [0, w).
    for (y in 0 until h) {
        val row = y * w
        for (x in 0 until w) {
            var sr = 0f
            var sg = 0f
            var sb = 0f
            var sa = 0f
            val kMin = maxOf(-r, -x)
            val kMax = minOf(r, (w - 1) - x)
            for (k in kMin..kMax) {
                val wt = weights[k + r]
                val idx = row + x + k
                sr += preR[idx] * wt
                sg += preG[idx] * wt
                sb += preB[idx] * wt
                sa += preA[idx] * wt
            }
            val outIdx = row + x
            tmpR[outIdx] = sr
            tmpG[outIdx] = sg
            tmpB[outIdx] = sb
            tmpA[outIdx] = sa
        }
    }

    // Vertical pass with zero-padding outside [0, h) and un-premultiply back to ARGB.
    val out = IntArray(count)
    for (y in 0 until h) {
        val kMin = maxOf(-r, -y)
        val kMax = minOf(r, (h - 1) - y)
        val row = y * w
        for (x in 0 until w) {
            var sr = 0f
            var sg = 0f
            var sb = 0f
            var sa = 0f
            for (k in kMin..kMax) {
                val wt = weights[k + r]
                val idx = (y + k) * w + x
                sr += tmpR[idx] * wt
                sg += tmpG[idx] * wt
                sb += tmpB[idx] * wt
                sa += tmpA[idx] * wt
            }
            val aInt = (sa * 255f).roundToInt().coerceIn(0, 255)
            out[row + x] = if (aInt == 0 || sa <= 1e-5f) {
                0
            } else {
                val invA = 1f / sa
                val rInt = (sr * invA).roundToInt().coerceIn(0, 255)
                val gInt = (sg * invA).roundToInt().coerceIn(0, 255)
                val bInt = (sb * invA).roundToInt().coerceIn(0, 255)
                (aInt shl 24) or (rInt shl 16) or (gInt shl 8) or bInt
            }
        }
    }

    return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
}
