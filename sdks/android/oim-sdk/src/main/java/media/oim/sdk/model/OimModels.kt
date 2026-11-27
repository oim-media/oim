/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.model

import android.graphics.Bitmap

/**
 * Core contract constants mirroring `@oim-media/core`.
 */
object OimContract {
    const val CONTRACT_VERSION = "2.0.0-draft.1"
    const val DEFAULT_LANGUAGE = "en"
    const val PRIMARY_CHUNK_KEYWORD = "OIM_Data"
    const val IMAGE_HASH_ALG_SHA256_IDAT = "sha256-idat"
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991.0 // 2^53 - 1
    const val MIN_SAFE_INTEGER = -9_007_199_254_740_991.0
    const val CANONICAL_MAX_DECIMALS = 6
    const val MAX_DECOMPRESSED_METADATA_BYTES = 10 * 1024 * 1024 // 10 MB zip-bomb ceiling
    const val MAX_SLOTS = 200
}

/**
 * Security verdict aligned with `@oim-media/player-oim` (`security.ts`).
 */
enum class SecurityStatus(val isRefused: Boolean) {
    VERIFIED_TRUSTED(isRefused = false),
    VERIFIED_SELF_SIGNED(isRefused = false),
    IMAGE_UNSEALED(isRefused = false),
    UNSIGNED(isRefused = false),
    UNKNOWN_KEY(isRefused = false),
    EXPIRED_KEY(isRefused = false),
    INVALID_SIGNATURE(isRefused = true),
    REFUSED_TAMPERED(isRefused = true)
}

/**
 * Mirrors `@oim-media/core/reeditPermission.ts`.
 * Unknown values ALWAYS fall back to `AUTHOR_ONLY`, never `PUBLIC`.
 */
enum class ReeditPermission(val wireName: String) {
    PUBLIC("public"),
    AUTHOR_ONLY("author_only"),
    SEALED("sealed")
}

enum class OimLayerKind {
    TEXT,
    IMAGE,
    GEO,
    ARTISTIC_TEXT,
    BADGE,
    HOTSPOT,
    CALLOUT,
    VECTOR_FRAME,
    MASK,
    CONTAINER,
    OTHER
}

enum class OimAnimationKind {
    NONE,
    FADE_IN,
    SLIDE_UP,
    PULSE_GLOW,
    FLOAT_BREATHE,
    PULSE,
    FLOAT,
    BOUNCE,
    SPIN,
    GLOW
}

enum class OimTextAlign {
    START,
    CENTER,
    END,
    JUSTIFY
}

enum class DecodeBackend(val label: String) {
    NDK_JNI_CPP("NDK C++17 (liboim_native.so)"),
    JVM_DIRECT_BUFFER("Zero-Copy DirectBuffer (JVM Fast-Path)")
}

/**
 * Represents an OIM CSS/container dimension (`cqw`, `%`, or `px`).
 */
sealed class OimDimension {
    data class Cqw(val value: Double) : OimDimension()
    data class Percent(val value: Double) : OimDimension()
    data class Px(val value: Double) : OimDimension()

    fun resolvePx(canvasWidthPx: Float, canvasHeightPx: Float, naturalReferencePx: Int, isHorizontal: Boolean): Float {
        return when (this) {
            is Cqw -> ((value / 100.0) * canvasWidthPx).toFloat()
            is Percent -> ((value / 100.0) * if (isHorizontal) canvasWidthPx else canvasHeightPx).toFloat()
            is Px -> {
                val ref = naturalReferencePx.coerceAtLeast(1)
                val targetAxis = if (isHorizontal) canvasWidthPx else canvasHeightPx
                ((value / ref) * targetAxis).toFloat()
            }
        }
    }

    fun toPercentOf(canvasWidth: Int, canvasHeight: Int, isHorizontal: Boolean): Double {
        return when (this) {
            is Percent -> value
            is Cqw -> if (isHorizontal || canvasHeight <= 0) value else (value * canvasWidth) / canvasHeight.toDouble()
            is Px -> {
                val ref = if (isHorizontal) canvasWidth else canvasHeight
                if (ref > 0) (value / ref) * 100.0 else value
            }
        }
    }
}

data class OimAuthor(
    val name: String,
    val handle: String,
    val keyId: String,
    val website: String = "https://oim.media"
)

data class OimGradientStop(
    val color: String,
    val position: Float? = null
)

data class OimGradientFill(
    val type: String = "linear",
    val angleDeg: Float = 180f,
    val stops: List<OimGradientStop> = emptyList()
)

data class OimPatternFill(
    val preset: String,
    val bg: String = "#00000000",
    val colors: List<String> = emptyList(),
    val scale: Float = 1f,
    val motionDirection: String? = null,
    val motionPeriodSec: Float = 0f,
    val rawBg: String? = null,
    val rawColors: List<String> = emptyList(),
    val tileViewBox: List<Float>? = null,
    val tilePaths: List<OimSvgPathItem> = emptyList()
)

data class OimMotionLoop(
    val speedPxSec: Float,
    val direction: String = "right_to_left",
    val mirror: Boolean = true
)

data class OimGenerativeFill(
    val generatorId: String = "stacked-waves",
    val seed: Int = 42,
    val params: Map<String, Any> = emptyMap(),
    val colorMode: String = "monochrome",
    val colorStops: List<String> = listOf("#3b82f6", "#0f172a"),
    val colorDirection: String = "forward",
    val backgroundColorHex: String? = null,
    val backgroundVisible: Boolean = true
)

data class OimCanvasSpec(
    val width: Int,
    val height: Int,
    val backgroundColorHex: String = "#0E1015",
    val gradientFill: OimGradientFill? = null,
    val patternFill: OimPatternFill? = null,
    val generativeFill: OimGenerativeFill? = null
) {
    val naturalWidth: Int get() = width
    val naturalHeight: Int get() = height
    val aspectRatio: Float
        get() = if (height > 0) width.toFloat() / height.toFloat() else 4f / 3f
}

data class OimParallaxConfig(
    val enabled: Boolean = true,
    val maxOffsetPercent: Float = 2.8f,
    val smoothing: Float = 0.16f
)

data class OimKeyframe(
    val t: Double,
    val o: Double? = null,
    val s: Double? = null,
    val r: Double? = null,
    val x: Double? = null,
    val y: Double? = null,
    val b: Double? = null,
    val easingKeyword: String? = null,
    val cubicBezier: List<Double>? = null
)

data class OimStateAction(
    val target: String,
    val type: String, // "show", "hide", "toggle", "setText", "play"
    val value: String? = null
)

data class OimInteractiveState(
    val scale: Double? = null,
    val rotation: Double? = null,
    val opacity: Double? = null, // 0..100
    val transitionDurationMs: Int? = null,
    val actions: List<OimStateAction> = emptyList()
)

data class OimSlotStates(
    val hover: OimInteractiveState? = null,
    val active: OimInteractiveState? = null
)

data class OimReveal(
    val effect: String = "fade", // fade, slide-up, slide-down, slide-left, slide-right, scale
    val durationMs: Int = 300,
    val delayMs: Int = 0,
    val easingKeyword: String? = null,
    val cubicBezier: List<Double>? = null
)

data class OimCornerRadii(
    val topStart: OimDimension,
    val topEnd: OimDimension,
    val bottomEnd: OimDimension,
    val bottomStart: OimDimension
)

data class OimTextLine(
    val text: String,
    val width: Double,
    val yOffset: Double
)

data class OimTextRun(
    val fontSize: Double? = null,
    val lineHeight: Double? = null,
    val lines: List<OimTextLine> = emptyList()
)

data class OimEmbeddedFont(
    val family: String,
    val name: String,
    val weight: Int = 400,
    val style: String = "normal",
    val format: String = "woff",
    val dataBase64: String? = null
)

data class OimSvgPathItem(
    val d: String,
    val fill: String? = null,
    val fillRule: String? = null,
    val stroke: String? = null,
    val strokeWidth: Float? = null,
    val cap: String? = null,
    val join: String? = null,
    val opacity: Float = 1f,
    val transform: List<Float>? = null
)

data class OimFilterSpec(
    val brightness: Float = 1f,
    val contrast: Float = 1f,
    val saturate: Float = 1f,
    val blurPx: Float = 0f
)

data class OimTextMarkStyle(
    val colorHex: String? = null,
    val colorRole: String? = null,
    val bold: Boolean = false,
    val italic: Boolean = false,
    val underline: Boolean = false,
    val highlightColorHex: String? = null,
    val highlightColorRole: String? = null,
    val highlightStyle: String? = null,
    /** CSS of the highlight box in canvas px (marked-text.ts): radius 3, padding 2px 4px. */
    val highlightRadius: Float = 3f,
    val highlightPaddingX: Float = 4f,
    val highlightPaddingY: Float = 2f
)

data class OimImageFill(
    val src: String,
    val fit: String = "cover",
    val cropX: Float? = null,
    val cropY: Float? = null,
    val cropZoom: Float = 1f,
    val flipX: Boolean = false,
    val flipY: Boolean = false,
    val opacity: Float = 1f,
    val filters: OimFilterSpec? = null
)

data class OimArtisticStyle(
    val curveAmount: Float = 0f,
    val curveType: String = "arc",
    val extrusionColorHex: String? = null,
    val extrusionDepthPx: Float = 0f,
    val extrusionAngleDeg: Float = 45f,
    val extrusionShading: Boolean = true,
    val outerStrokeColorHex: String? = null,
    val outerStrokeWidthPx: Float = 0f,
    val innerStrokeColorHex: String? = null,
    val innerStrokeWidthPx: Float = 0f,
    val textGradientType: String? = null
)

data class OimLayerStyle(
    val fontSizeRatio: Float = 0.032f,
    val fontSizeDim: OimDimension? = null,
    val fontFamily: String? = null,
    val fontWeight: Int = 600,
    val fontStyleItalic: Boolean = false,
    val lineHeightFactor: Float? = null,
    val letterSpacingEm: Float = 0f,
    val textColorHex: String = "#F8FAFC",
    val colorRole: String? = null,
    val fillColorHex: String? = null,
    val fillColorRole: String? = null,
    val backgroundColorHex: String = "#00000000",
    val borderColorHex: String = "#00000000",
    val strokeColorRole: String? = null,
    val borderWidthRatio: Float = 0f,
    val strokeWidthPx: Float? = null,
    val cornerRadiusRatio: Float = 0.014f,
    val cornerRadii: OimCornerRadii? = null,
    val textAlign: OimTextAlign = OimTextAlign.START,
    val monospace: Boolean = false,
    val geoShape: String? = null,
    val svgPath: String? = null,
    val svgPaths: List<OimSvgPathItem> = emptyList(),
    val svgViewBox: String? = null,
    /** `mask.mode` of a v2 layer (`window` or `cutout`); null when the layer is not a mask. */
    val maskMode: String? = null,
    /** `preset` of the layer's first `backdrop` effect: duotone or a FILTER_PRESET_CSS name. */
    val backdropPreset: String? = null,
    /** CSS mix-blend-mode of a v2 layer (`blend`); null or `normal` paints over. */
    val blendMode: String? = null,
    val flipX: Boolean = false,
    val flipY: Boolean = false,
    val isVisible: Boolean = true,
    val decorative: Boolean = false,
    val alt: Map<String, String> = emptyMap(),
    /** v2 `text.highlight` (block): a band behind the whole body, as wide as the box. */
    val blockHighlightHex: String? = null,
    /** v2 `text.dropCap`: lines it spans (0 = none), color and gap to the rest. */
    val dropCapLines: Int = 0,
    val dropCapColorHex: String? = null,
    val dropCapMarginRight: Float = 8f,
    val textAnimationType: String? = null,
    val textAnimationSpeed: Double? = null,
    val textAnimationDelay: Double? = null,
    val shadowEnabled: Boolean = false,
    val shadowColorHex: String? = null,
    val shadowColorRole: String? = null,
    val shadowBlur: Float = 0f,
    val shadowOffsetX: Float = 0f,
    val shadowOffsetY: Float = 0f,
    val shadowOpacity: Float = 0.35f,
    val glowEnabled: Boolean = false,
    val glowColorHex: String? = null,
    val glowColorRole: String? = null,
    val glowRadiusPx: Float = 0f,
    val fillGradient: String? = null,
    val gradientFill: OimGradientFill? = null,
    val patternFill: OimPatternFill? = null,
    val generativeFill: OimGenerativeFill? = null,
    val blurRadiusPx: Float = 0f,
    val filter: OimFilterSpec? = null,
    val imageFill: OimImageFill? = null,
    val artistic: OimArtisticStyle? = null,
    val textMarks: Map<String, OimTextMarkStyle> = emptyMap(),
    val objectFit: String? = null,
    val textRuns: Map<String, OimTextRun> = emptyMap()
)

data class OimAnimationSpec(
    val kind: OimAnimationKind = OimAnimationKind.NONE,
    val hoverKind: String? = null,
    val durationMs: Int = 650,
    val delayMs: Int = 0,
    val loop: Boolean = false,
    val keyframes: List<OimKeyframe> = emptyList(),
    val trigger: String = "load" // "load" or "action"
)

/**
 * Interactive layer/slot positioned on the normalized 0..100 OIM coordinate grid.
 */
data class OimLayer(
    val id: String,
    val name: String? = null,
    val kind: OimLayerKind,
    val rawType: String = "text",
    val zIndex: Int,
    val x: Double,
    val y: Double,
    val width: Double? = null,
    val height: Double? = null,
    val widthDim: OimDimension? = null,
    val heightDim: OimDimension? = null,
    val maxWidthDim: OimDimension? = null,
    val anchorX: Double = 0.0,
    val anchorY: Double = 0.0,
    val rotationDeg: Double = 0.0,
    val opacity: Double = 1.0,
    val parallaxDepth: Double = 0.0,
    val slotLanguages: List<String> = listOf("*"),
    val content: Map<String, String> = emptyMap(),
    val detailContent: Map<String, String> = emptyMap(),
    val style: OimLayerStyle = OimLayerStyle(),
    val animation: OimAnimationSpec = OimAnimationSpec(),
    val isInteractive: Boolean = false,
    val states: OimSlotStates? = null,
    val reveal: OimReveal? = null,
    val accentColorHex: String = "#F59E0B",
    val motionLoop: OimMotionLoop? = null
)

data class OimSecurityBlock(
    val imageHash: String,
    val imageHashAlg: String? = null,
    val signature: String?,
    val keyId: String?,
    val algorithm: String = "ECDSA-P256-SHA256",
    val issuedAtIso: String = "",
    val signedAtIso: String? = null,
    val expiresAtEpochSec: Long? = null,
    val immutableLock: Boolean = false,
    val reeditPermission: ReeditPermission = ReeditPermission.AUTHOR_ONLY
)

data class OimDocument(
    val contractVersion: String = OimContract.CONTRACT_VERSION,
    val minPlayer: String? = null,
    val id: String,
    val title: Map<String, String>,
    val description: Map<String, String>,
    val author: OimAuthor,
    val canvas: OimCanvasSpec,
    val languages: List<String>,
    val defaultLanguage: String = OimContract.DEFAULT_LANGUAGE,
    val palettes: Map<String, Map<String, String>> = emptyMap(),
    val defaultPalette: String? = null,
    val fonts: List<OimEmbeddedFont> = emptyList(),
    val parallax: OimParallaxConfig = OimParallaxConfig(),
    val layers: List<OimLayer>,
    val security: OimSecurityBlock,
    /**
     * Whether the PNG is the picture's base, painted under the layers. A 2.0 file's PNG is only a
     * poster unless some image layer shows `oim:base` (hasBaseLayer in @oim-media/core).
     */
    val pngIsBase: Boolean = true
)

data class PngChunkRecord(
    val index: Int,
    val type: String,
    val offsetBytes: Int,
    val lengthBytes: Int,
    val crcHex: String,
    val crcValid: Boolean,
    val isOimChunk: Boolean,
    val isWinningOimChunk: Boolean = false,
    val keyword: String? = null
)

data class OimDecodeTelemetry(
    val backend: DecodeBackend,
    val pngScanUs: Long,
    val inflateUs: Long,
    val canonicalizeUs: Long,
    val sha256Us: Long,
    val ecdsaVerifyUs: Long,
    val bitmapDecodeUs: Long,
    val fileSizeBytes: Int,
    val compressedChunkBytes: Int,
    val uncompressedJsonBytes: Int,
    val chunkCount: Int
) {
    val totalUs: Long
        get() = pngScanUs + inflateUs + canonicalizeUs + sha256Us + ecdsaVerifyUs + bitmapDecodeUs

    val totalMs: Double
        get() = totalUs / 1000.0
}

data class ResolvedTextResult(
    val text: String,
    val matchedKey: String,
    val fallbackPath: List<String>,
    val wasFinalWildcard: Boolean
)

data class OimVerificationReport(
    val status: SecurityStatus,
    val isRefused: Boolean,
    val effectiveReeditPermission: ReeditPermission,
    val imageHashMatches: Boolean,
    val signatureValid: Boolean,
    val hasOutOfRangeNumbers: Boolean,
    val keyTrustedOffline: Boolean,
    val keyExpired: Boolean,
    val computedImageHash: String,
    val declaredImageHash: String,
    val canonicalJson: String,
    val reason: String
)

data class OimLoadedAsset(
    val sourceLabel: String,
    val rawBytes: ByteArray,
    val bitmap: Bitmap?,
    val document: OimDocument?,
    val rawJson: String?,
    val chunks: List<PngChunkRecord>,
    val verification: OimVerificationReport,
    val telemetry: OimDecodeTelemetry
)

sealed class OimError(message: String) : Exception(message) {
    class InvalidPngSignature : OimError("The file does not start with the PNG signature (89 50 4E 47).")
    class TruncatedChunk(offset: Int) : OimError("PNG chunk truncated at offset $offset.")
    class MissingOimPayload : OimError("No OIM metadata chunk found (tEXt/zTXt/iTXt/oIMd).")
    class DecompressionFailed(cause: String) : OimError("Could not decompress the OIM payload: $cause")
    class MalformedJson(cause: String) : OimError("Invalid or incomplete OIM JSON: $cause")
    class UnsupportedVersion(version: String) : OimError("OIM $version files are not supported; only OIM 2.x documents are supported.")
}
