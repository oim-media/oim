/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.animation

import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

data class TextUnitFrame(
    val opacity: Float,
    val translateYEm: Float,
    val scale: Float,
    val rotateDeg: Float
)

data class GlitchCopySpec(
    val colorHex: String?,
    val dxPx: Float,
    val dyPx: Float,
    val opacity: Float,
    val clipTopPct: Float = 0f,
    val clipBottomPct: Float = 100f
)

data class GlitchRenderState(
    val isActive: Boolean,
    val skewXDeg: Float,
    val copies: List<GlitchCopySpec>
)

/**
 * Pure Kotlin port of `@oim-media/core/text-effects.ts`, `glitch.ts`,
 * `@oim-media/scene/blocks/waveText.ts`, and `typewriterText.ts`.
 */
object OimTextAnimator {
    const val ENTRANCE_SECONDS = 0.35
    const val DEFAULT_ENTRANCE_STAGGER = 0.05
    const val DEFAULT_TYPEWRITER_SPEED = 20.0
    const val WAVE_ANGULAR_FREQUENCY = 6.0
    const val GLITCH_CALM_RATIO = 0.7

    val ENTRANCE_EFFECTS = setOf(
        "fade-chars",
        "slide-up",
        "bounce-chars",
        "reveal-mask",
        "scale-in",
        "rise-words"
    )

    private val WORD_EFFECTS = setOf("slide-up", "reveal-mask", "rise-words")
    private val WORD_OR_SPACE_REGEX = Regex("\\S+|\\s+")

    fun isEntranceEffect(type: String?): Boolean =
        type != null && type.lowercase() in ENTRANCE_EFFECTS

    fun isWaveEffect(type: String?): Boolean =
        type.equals("wave-chars", ignoreCase = true)

    fun isTypewriterEffect(type: String?): Boolean =
        type.equals("typewriter", ignoreCase = true)

    fun isGlitchEffect(type: String?): Boolean =
        type.equals("glitch-cyberpunk", ignoreCase = true) ||
            type.equals("glitch-slice", ignoreCase = true)

    fun resolveEntranceStaggerSec(rawSpeed: Double?): Double {
        if (rawSpeed == null || rawSpeed.isNaN() || rawSpeed <= 0.0) return DEFAULT_ENTRANCE_STAGGER
        // Explicit stagger values live in 0.01..0.35s; showcase presets sometimes encode relative multipliers (1.1x..1.3x).
        return if (rawSpeed <= 0.35) {
            rawSpeed.coerceAtLeast(0.01)
        } else {
            (DEFAULT_ENTRANCE_STAGGER / rawSpeed.coerceIn(0.5, 4.0)).coerceIn(0.015, 0.25)
        }
    }

    fun resolveTypewriterCharsPerSec(rawSpeed: Double?): Double {
        if (rawSpeed == null || rawSpeed.isNaN() || rawSpeed <= 0.0) return DEFAULT_TYPEWRITER_SPEED
        // Explicit typewriter speeds are chars/sec (>= 4.5); values like 1.1..1.5 in showcase presets mean multiplier * 20 chars/sec.
        return if (rawSpeed < 4.5) {
            DEFAULT_TYPEWRITER_SPEED * rawSpeed.coerceIn(0.25, 4.0)
        } else {
            rawSpeed
        }
    }

    fun resolveWaveLagSec(rawSpeed: Double?): Double {
        if (rawSpeed == null || rawSpeed.isNaN() || rawSpeed <= 0.0) return 0.05
        return if (rawSpeed <= 0.35) {
            rawSpeed.coerceAtLeast(0.005)
        } else {
            (0.05 / rawSpeed.coerceIn(0.5, 4.0)).coerceIn(0.015, 0.15)
        }
    }

    fun entranceUnits(text: String, effect: String): List<String> {
        if (text.isEmpty()) return emptyList()
        if (effect.lowercase() in WORD_EFFECTS) {
            return WORD_OR_SPACE_REGEX.findAll(text).map { it.value }.toList()
        }
        return text.map { it.toString() }
    }

    fun entranceStartSec(
        index: Int,
        stagger: Double = DEFAULT_ENTRANCE_STAGGER,
        delay: Double = 0.0
    ): Double = delay + index * stagger

    fun entranceTotalDurationSec(
        unitCount: Int,
        stagger: Double = DEFAULT_ENTRANCE_STAGGER,
        delay: Double = 0.0
    ): Double {
        if (unitCount <= 0) return delay.coerceAtLeast(0.0)
        return (delay + (unitCount - 1).coerceAtLeast(0) * stagger + ENTRANCE_SECONDS + 0.05).coerceAtLeast(0.1)
    }

    fun entranceFrame(effect: String, progress: Double): TextUnitFrame {
        val p = progress.coerceIn(0.0, 1.0)
        val eased = (p * (2.0 - p)).toFloat()
        return when (effect.lowercase()) {
            "slide-up" -> TextUnitFrame(
                opacity = eased,
                translateYEm = (1f - eased) * 0.6f,
                scale = 1f,
                rotateDeg = 0f
            )
            "reveal-mask" -> TextUnitFrame(
                opacity = 1f,
                translateYEm = (1f - eased) * 1.2f,
                scale = 1f,
                rotateDeg = 0f
            )
            "scale-in" -> TextUnitFrame(
                opacity = eased,
                translateYEm = 0f,
                scale = 0.6f + 0.4f * eased,
                rotateDeg = 0f
            )
            "rise-words" -> TextUnitFrame(
                opacity = eased,
                translateYEm = (1f - eased) * 0.8f,
                scale = 1f,
                rotateDeg = (1f - eased) * 8f
            )
            "bounce-chars" -> {
                val sc = when {
                    eased == 0f -> 0f
                    eased < 0.7f -> (eased / 0.7f) * 1.15f
                    else -> 1.15f - ((eased - 0.7f) / 0.3f) * 0.15f
                }
                TextUnitFrame(
                    opacity = eased,
                    translateYEm = 0f,
                    scale = sc,
                    rotateDeg = 0f
                )
            }
            else -> TextUnitFrame(
                opacity = eased,
                translateYEm = 0f,
                scale = 1f,
                rotateDeg = 0f
            )
        }
    }

    fun entranceFrameAt(
        effect: String,
        timeSec: Double,
        index: Int,
        stagger: Double = DEFAULT_ENTRANCE_STAGGER,
        delay: Double = 0.0
    ): TextUnitFrame {
        val start = entranceStartSec(index, stagger, delay)
        val progress = (timeSec - start) / ENTRANCE_SECONDS
        return entranceFrame(effect, progress)
    }

    fun typewriterVisibleCount(
        totalLength: Int,
        timeSec: Double,
        speed: Double = DEFAULT_TYPEWRITER_SPEED,
        delay: Double = 0.0
    ): Int {
        if (totalLength <= 0) return 0
        val elapsed = timeSec - delay
        if (elapsed <= 0.0) return 0
        return min(totalLength, floor(elapsed * max(0.1, speed) + 1e-9).toInt())
    }

    fun waveUnitBaselineShift(
        timeSec: Double,
        charIndex: Int,
        speed: Double = 0.05,
        delay: Double = 0.0
    ): Float {
        val phase = WAVE_ANGULAR_FREQUENCY * (timeSec - delay - charIndex * speed)
        // Maps -1..1 sine oscillation to -0.16..+0.16 baseline multiplier (~5px on ~32px display text)
        return (sin(phase) * 0.16).toFloat()
    }

    private fun hashSeed(seed: Double): Double {
        val x = sin(seed * 12.9898 + 78.233) * 43758.5453
        return x - floor(x)
    }

    fun calculateGlitchRenderState(
        type: String,
        timeSec: Double,
        speed: Double = 1.0,
        delay: Double = 0.0,
        intensity: Double = 50.0
    ): GlitchRenderState {
        if (timeSec <= 0.0 || timeSec < delay) {
            return GlitchRenderState(isActive = false, skewXDeg = 0f, copies = emptyList())
        }
        val sp = max(0.01, speed)
        val t = timeSec - delay
        val tau = (t * sp) % 1.0
        if (tau < GLITCH_CALM_RATIO) {
            return GlitchRenderState(isActive = false, skewXDeg = 0f, copies = emptyList())
        }
        val clampedIntensity = intensity.coerceIn(1.0, 100.0)
        val seed = floor(t * sp) * 100.0 + floor(((tau - GLITCH_CALM_RATIO) / (1.0 - GLITCH_CALM_RATIO)) * 6.0) * 10.0
        val maxPx = 0.08 * clampedIntensity
        fun off(s: Double): Pair<Float, Float> {
            val dx = ((hashSeed(s) * 2.0 - 1.0) * maxPx).toFloat()
            val dy = ((hashSeed(s + 1.0) * 2.0 - 1.0) * maxPx * 0.4).toFloat()
            return dx to dy
        }
        if (type.equals("glitch-slice", ignoreCase = true)) {
            val sd = seed + 10.0
            val top = (hashSeed(sd) * 80.0).toFloat()
            val bottom = (top + 5.0 + hashSeed(sd + 1.0) * 20.0).coerceAtMost(100.0).toFloat()
            val shiftX = ((hashSeed(sd + 2.0) * 2.0 - 1.0) * 1.5 * maxPx).toFloat()
            return GlitchRenderState(
                isActive = true,
                skewXDeg = 0f,
                copies = listOf(
                    GlitchCopySpec(
                        colorHex = null,
                        dxPx = shiftX,
                        dyPx = 0f,
                        opacity = 1f,
                        clipTopPct = top,
                        clipBottomPct = bottom
                    )
                )
            )
        }
        val hSkew = hashSeed(seed + 5.0)
        val skew = if (hSkew > 0.6) ((hSkew * 2.0 - 1.0) * 0.03 * clampedIntensity).toFloat() else 0f
        val (cx, cy) = off(seed + 1.0)
        val (mx, my) = off(seed + 3.0)
        return GlitchRenderState(
            isActive = true,
            skewXDeg = skew,
            copies = listOf(
                GlitchCopySpec(colorHex = "#00FFFF", dxPx = cx, dyPx = cy, opacity = 0.85f),
                GlitchCopySpec(colorHex = "#FF00FF", dxPx = mx, dyPx = my, opacity = 0.85f)
            )
        )
    }
}
