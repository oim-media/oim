/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Matrix as AndroidMatrix
import android.graphics.Typeface
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import media.oim.sdk.animation.GlitchRenderState
import media.oim.sdk.animation.KeyframeState
import media.oim.sdk.animation.OimKeyframeSampler
import media.oim.sdk.animation.OimTextAnimator
import media.oim.sdk.crypto.Base64Codec
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimAnimationKind
import media.oim.sdk.model.OimCornerRadii
import media.oim.sdk.model.OimFilterSpec
import media.oim.sdk.model.OimImageFill
import media.oim.sdk.model.OimLayer
import media.oim.sdk.model.OimLayerKind
import media.oim.sdk.model.OimLoadedAsset
import media.oim.sdk.model.OimReveal
import media.oim.sdk.model.OimSvgPathItem
import media.oim.sdk.model.OimTextAlign
import media.oim.sdk.model.OimTextMarkStyle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

private val OimCrimsonRefusal = Color(0xFFF43F5E)
private val OimAmberAccent = Color(0xFFF59E0B)

/**
 * Native Jetpack Compose OIM renderer (`:oim-sdk`).
 *
 * Supports:
 * - Aspect-ratio-locked 0..100 coordinate projection & `cqw` (container width) scaling
 * - Multilingual `content` resolution (`*`, requested lang, `en`, `es`, default)
 * - Named `palettes` & dynamic color role resolution
 * - Interactive `states.active` & `actions` (`show`, `hide`, `toggle`, `setText`, `play`) with `reveal`
 * - Keyframes & loop animation presets (`pulse`, `float`, `bounce`, `spin`, `glow`, text entrances)
 * - Vector `geoShape` & custom `svgPath` rendering + embedded `data:image/` slots
 * - Pinch-to-zoom, pan, double-tap reset, and optional gyro/touch parallax
 * - Hard `isRefused` security gate blocking tampered files
 */
@Composable
fun OimPlayerView(
    asset: OimLoadedAsset,
    language: String,
    modifier: Modifier = Modifier,
    selectedPalette: String? = null,
    hiddenLayerIds: Set<String> = emptySet(),
    selectedLayerId: String? = null,
    showPixelGrid: Boolean = false,
    parallaxEnabled: Boolean = true,
    replayTrigger: Int = 0,
    cornerRadius: Dp = 20.dp,
    showFrameBorder: Boolean = true,
    externalBlurDp: Dp = 0.dp,
    onSelectLayer: (String?) -> Unit = {}
) {
    val doc = asset.document
    val bitmapAspect = asset.bitmap?.let { bmp ->
        if (bmp.height > 0) bmp.width.toFloat() / bmp.height.toFloat() else null
    }
    val aspectRatio = doc?.canvas?.aspectRatio ?: bitmapAspect ?: (4f / 3f)

    if (asset.verification.isRefused || asset.bitmap == null || doc == null) {
        OimRefusedSecurityGate(
            reason = asset.verification.reason,
            computedHash = asset.verification.computedImageHash,
            declaredHash = asset.verification.declaredImageHash,
            modifier = modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio)
                .clip(RoundedCornerShape(20.dp))
        )
        return
    }

    val animatedExternalBlur by animateDpAsState(
        targetValue = externalBlurDp,
        animationSpec = tween(180),
        label = "oim_external_blur"
    )
    var previousLanguage by remember(asset.sourceLabel) { mutableStateOf(language) }
    val languageBlurAnim = remember { Animatable(0f) }
    LaunchedEffect(language) {
        if (previousLanguage != language) {
            previousLanguage = language
            languageBlurAnim.snapTo(0f)
            languageBlurAnim.animateTo(10f, animationSpec = tween(110))
            languageBlurAnim.animateTo(0f, animationSpec = tween(180))
        }
    }

    val context = LocalContext.current
    val prefersDark = isSystemInDarkTheme()
    val imageBitmap = remember(asset.bitmap) { asset.bitmap.asImageBitmap() }
    val embeddedFonts = remember(doc.fonts) { OimFontLoader.resolveEmbeddedFonts(context, doc.fonts) }
    val resolvedPalette = remember(doc.palettes, doc.defaultPalette, selectedPalette, prefersDark) {
        OimCanonicalizerAndVerifier.resolvePalette(
            palettes = doc.palettes,
            defaultPalette = doc.defaultPalette,
            requested = selectedPalette,
            prefersDark = prefersDark
        )?.second.orEmpty()
    }

    val docDescription = remember(doc.description, doc.title, language) {
        OimCanonicalizerAndVerifier.resolveContent(doc.description, language, doc.defaultLanguage).text
            .ifBlank {
                OimCanonicalizerAndVerifier.resolveContent(doc.title, language, doc.defaultLanguage).text
            }
    }

    // Interactive state engine for `states.active` & `actions`
    val activeSlotIds = remember(asset.sourceLabel, replayTrigger) { mutableStateMapOf<String, Boolean>() }
    val visibilityOverrides = remember(asset.sourceLabel, replayTrigger) { mutableStateMapOf<String, Boolean>() }
    val textOverrides = remember(asset.sourceLabel, replayTrigger) { mutableStateMapOf<String, String>() }
    val playCounters = remember(asset.sourceLabel, replayTrigger) { mutableStateMapOf<String, Int>() }

    // Zoom & pan state
    var zoomScale by remember(asset.sourceLabel) { mutableFloatStateOf(1f) }
    var panOffsetX by remember(asset.sourceLabel) { mutableFloatStateOf(0f) }
    var panOffsetY by remember(asset.sourceLabel) { mutableFloatStateOf(0f) }

    // Sensor & touch parallax (only active when doc actually defines parallax depth)
    val hasParallaxLayers = remember(doc.layers) {
        doc.layers.any { kotlin.math.abs(it.parallaxDepth) > 1e-4 }
    }
    val parallaxActive = parallaxEnabled && doc.parallax.enabled && hasParallaxLayers
    var sensorTiltX by remember { mutableFloatStateOf(0f) }
    var sensorTiltY by remember { mutableFloatStateOf(0f) }
    var touchTiltX by remember { mutableFloatStateOf(0f) }
    var touchTiltY by remember { mutableFloatStateOf(0f) }

    DisposableEffect(context, parallaxActive) {
        if (!parallaxActive) {
            sensorTiltX = 0f
            sensorTiltY = 0f
            return@DisposableEffect onDispose { }
        }
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val gravitySensor = sensorManager?.getDefaultSensor(Sensor.TYPE_GRAVITY)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        val listener = object : SensorEventListener {
            private var baselineGy = Float.NaN

            override fun onSensorChanged(event: SensorEvent) {
                val gx = (event.values[0] / 9.81f).coerceIn(-1f, 1f)
                val gy = (event.values[1] / 9.81f).coerceIn(-1f, 1f)
                if (baselineGy.isNaN()) baselineGy = gy
                val alpha = doc.parallax.smoothing.coerceIn(0.05f, 0.4f)
                sensorTiltX += (gx - sensorTiltX) * alpha
                sensorTiltY += ((gy - baselineGy).coerceIn(-1f, 1f) - sensorTiltY) * alpha
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        if (gravitySensor != null) {
            sensorManager?.registerListener(listener, gravitySensor, SensorManager.SENSOR_DELAY_GAME)
        }
        onDispose {
            sensorManager?.unregisterListener(listener)
        }
    }

    val effectiveTiltX by animateFloatAsState(
        targetValue = if (parallaxActive) {
            (sensorTiltX + touchTiltX).coerceIn(-1f, 1f)
        } else 0f,
        animationSpec = spring(stiffness = 180f, dampingRatio = 0.85f),
        label = "tilt_x"
    )
    val effectiveTiltY by animateFloatAsState(
        targetValue = if (parallaxActive) {
            (sensorTiltY + touchTiltY).coerceIn(-1f, 1f)
        } else 0f,
        animationSpec = spring(stiffness = 180f, dampingRatio = 0.85f),
        label = "tilt_y"
    )

    fun dispatchSlotInteraction(layer: OimLayer) {
        val nextActive = !(activeSlotIds[layer.id] ?: false)
        activeSlotIds[layer.id] = nextActive
        val activeState = layer.states?.active
        if (activeState != null) {
            activeState.actions.forEach { action ->
                when (action.type) {
                    "show" -> visibilityOverrides[action.target] = true
                    "hide" -> visibilityOverrides[action.target] = false
                    "toggle" -> {
                        val current = visibilityOverrides[action.target]
                            ?: doc.layers.firstOrNull { it.id == action.target || it.name == action.target }?.style?.isVisible
                            ?: true
                        visibilityOverrides[action.target] = !current
                    }
                    "setText" -> {
                        if (action.value != null) {
                            textOverrides[action.target] = action.value
                        }
                    }
                    "play" -> {
                        playCounters[action.target] = (playCounters[action.target] ?: 0) + 1
                    }
                }
            }
        }
        onSelectLayer(if (selectedLayerId == layer.id) null else layer.id)
    }

    val frameShape = RoundedCornerShape(cornerRadius)
    val frameBorderModifier = if (showFrameBorder) {
        Modifier.border(
            width = 1.dp,
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.65f),
            shape = frameShape
        )
    } else {
        Modifier
    }

    val clipFrameMod = if (cornerRadius > 0.dp) Modifier.clip(frameShape) else Modifier

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(aspectRatio)
            .then(clipFrameMod)
            .background(parseOimColor(doc.canvas.backgroundColorHex, resolvedPalette, Color(0xFF0E1015)))
            .then(frameBorderModifier)
            .semantics {
                if (docDescription.isNotBlank()) contentDescription = docDescription
            }
            .testTag("oim_player_canvas")
            .pointerInput(asset.sourceLabel, parallaxEnabled, cornerRadius) {
                detectTransformGestures { centroid, pan, zoom, _ ->
                    val nextZoom = (zoomScale * zoom).coerceIn(1f, 5f)
                    zoomScale = nextZoom
                    if (nextZoom > 1.01f) {
                        val panBound = maxOf(size.width, size.height)
                        val maxPanX = (size.width * (nextZoom - 1f)) / 2f
                        val maxPanY = ((if (cornerRadius <= 0.dp) panBound else size.height) * (nextZoom - 1f)) / 2f
                        panOffsetX = (panOffsetX + pan.x).coerceIn(-maxPanX, maxPanX)
                        panOffsetY = (panOffsetY + pan.y).coerceIn(-maxPanY, maxPanY)
                    } else {
                        panOffsetX = 0f
                        panOffsetY = 0f
                        if (parallaxActive) {
                            touchTiltX = ((centroid.x / size.width.coerceAtLeast(1)) - 0.5f) * 2f
                            touchTiltY = ((centroid.y / size.height.coerceAtLeast(1)) - 0.5f) * 2f
                        }
                    }
                }
            }
            .pointerInput(asset.sourceLabel) {
                detectTapGestures(
                    onDoubleTap = {
                        if (zoomScale > 1.05f) {
                            zoomScale = 1f
                            panOffsetX = 0f
                            panOffsetY = 0f
                            touchTiltX = 0f
                            touchTiltY = 0f
                        } else {
                            zoomScale = 2.5f
                        }
                    },
                    onTap = {
                        onSelectLayer(null)
                    }
                )
            }
    ) {
        val canvasWidthPx = constraints.maxWidth.toFloat().coerceAtLeast(1f)
        val canvasHeightPx = constraints.maxHeight.toFloat().coerceAtLeast(1f)
        val density = LocalDensity.current
        val maxParallaxPx = canvasWidthPx * (doc.parallax.maxOffsetPercent / 100f)

        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(if (animatedExternalBlur > 0.2.dp) Modifier.blur(animatedExternalBlur) else Modifier)
                .graphicsLayer {
                    scaleX = zoomScale
                    scaleY = zoomScale
                    translationX = panOffsetX
                    translationY = panOffsetY
                }
                .clipToBounds()
        ) {
            // The canvas under the layers; a backdrop effect paints it again under its box.
            val paintBackground: @Composable () -> Unit = {
                doc.canvas.gradientFill?.let { grad ->
                    OimGradientBox(gradient = grad, palette = resolvedPalette, modifier = Modifier.fillMaxSize())
                }
                doc.canvas.patternFill?.let { pat ->
                    OimPatternCanvas(
                        pattern = pat,
                        palette = resolvedPalette,
                        canvasWidthPx = canvasWidthPx,
                        naturalWidth = doc.canvas.width,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                Image(
                    bitmap = imageBitmap,
                    contentDescription = docDescription.ifBlank { null },
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            val bgScale = if (parallaxActive && (effectiveTiltX != 0f || effectiveTiltY != 0f)) 1.04f else 1f
                            scaleX = bgScale
                            scaleY = bgScale
                            translationX = -effectiveTiltX * maxParallaxPx * 0.35f
                            translationY = -effectiveTiltY * maxParallaxPx * 0.35f
                        }
                )
            }
            paintBackground()

            val langBlurDp = languageBlurAnim.value.dp
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .then(if (langBlurDp > 0.2.dp) Modifier.blur(langBlurDp) else Modifier)
            ) {
                val paintLayer: @Composable (OimLayer) -> Unit = paintLayer@{ layer ->
                        if (layer.style.maskMode == "window") {
                            OimWindowMask(layer, doc.canvas.width, doc.canvas.height, canvasWidthPx, canvasHeightPx, resolvedPalette)
                            return@paintLayer
                        }
                        val effectiveVisible = visibilityOverrides[layer.id]
                            ?: layer.name?.let { visibilityOverrides[it] }
                            ?: layer.style.isVisible
                        val overrideText = textOverrides[layer.id]
                            ?: layer.name?.let { textOverrides[it] }
                        val resolvedText = overrideText ?: OimCanonicalizerAndVerifier.resolveContent(
                            content = layer.content,
                            requestedLang = language,
                            defaultLang = doc.defaultLanguage
                        ).text
                        val layerPlayCount = (playCounters[layer.id] ?: 0) +
                            (layer.name?.let { playCounters[it] } ?: 0) + replayTrigger

                        val revealSpec = layer.reveal ?: OimReveal()
                        AnimatedVisibility(
                            visible = effectiveVisible,
                            enter = buildRevealEnter(revealSpec, canvasWidthPx),
                            exit = buildRevealExit(revealSpec, canvasWidthPx)
                        ) {
                            val isActive = activeSlotIds[layer.id] == true
                            val isSelected = selectedLayerId == layer.id
                            val activeSpec = if (isActive) layer.states?.active else null
                            val transitionMs = activeSpec?.transitionDurationMs ?: 220

                            val activeScale by animateFloatAsState(
                                targetValue = activeSpec?.scale?.let { normalizeScale(it) } ?: 1f,
                                animationSpec = tween(transitionMs),
                                label = "active_scale_${layer.id}"
                            )
                            val activeRotation by animateFloatAsState(
                                targetValue = activeSpec?.rotation?.toFloat() ?: 0f,
                                animationSpec = tween(transitionMs),
                                label = "active_rot_${layer.id}"
                            )
                            val activeAlpha by animateFloatAsState(
                                targetValue = activeSpec?.opacity?.let { (it / 100.0).toFloat() } ?: layer.opacity.toFloat(),
                                animationSpec = tween(transitionMs),
                                label = "active_alpha_${layer.id}"
                            )

                            val scaleFactor = canvasWidthPx / doc.canvas.width.coerceAtLeast(1).toFloat()
                            val kfState = rememberKeyframeState(layer, layerPlayCount)
                            val loopAnim = rememberLoopAnimValues(layer.animation.kind, layer.animation.durationMs, layer.animation.loop, scaleFactor)
                            val entranceAnim = rememberEntranceTransform(
                                layer = layer,
                                playTrigger = layerPlayCount,
                                canvasWidthPx = canvasWidthPx,
                                scaleFactor = scaleFactor
                            )
                            val rawBlurPx = (layer.style.blurRadiusPx + kfState.b).coerceAtLeast(0f)
                            val layerBlurDp = if (rawBlurPx > 0.2f) {
                                with(density) { (rawBlurPx * scaleFactor).toDp() }
                            } else 0.dp

                            val paintLayerInstance: @Composable (Float, Boolean) -> Unit = { copyOffsetX, mirrorCopy ->
                                OimAnchoredLayerBox(
                                    xPercent = layer.x.toFloat(),
                                    yPercent = layer.y.toFloat(),
                                    anchorX = layer.anchorX.toFloat(),
                                    anchorY = layer.anchorY.toFloat(),
                                    canvasWidthPx = canvasWidthPx,
                                    canvasHeightPx = canvasHeightPx
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .then(
                                                if (layerBlurDp > 0.2.dp) {
                                                    Modifier.blur(radius = layerBlurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                                                } else Modifier
                                            )
                                            .graphicsLayer {
                                                val flipScaleX = (if (layer.style.flipX) -1f else 1f) * (if (mirrorCopy) -1f else 1f)
                                                val flipScaleY = if (layer.style.flipY) -1f else 1f
                                                translationX = copyOffsetX +
                                                    (effectiveTiltX * maxParallaxPx * layer.parallaxDepth.toFloat()) +
                                                    (kfState.x * scaleFactor) + loopAnim.offsetX + entranceAnim.offsetX
                                                translationY = (effectiveTiltY * maxParallaxPx * layer.parallaxDepth.toFloat()) +
                                                    (kfState.y * scaleFactor) + loopAnim.offsetY + entranceAnim.offsetY
                                                scaleX = flipScaleX * activeScale * kfState.s * loopAnim.scale * entranceAnim.scale
                                                scaleY = flipScaleY * activeScale * kfState.s * loopAnim.scale * entranceAnim.scale
                                                rotationZ = layer.rotationDeg.toFloat() + activeRotation + kfState.r + loopAnim.rotation
                                                alpha = (activeAlpha * kfState.o * loopAnim.alpha * entranceAnim.alpha).coerceIn(0f, 1f)
                                            }
                                    ) {
                                        OimLayerNode(
                                            layer = layer,
                                            resolvedText = resolvedText,
                                            language = language,
                                            defaultLang = doc.defaultLanguage,
                                            palette = resolvedPalette,
                                            naturalWidth = doc.canvas.width,
                                            naturalHeight = doc.canvas.height,
                                            canvasWidthPx = canvasWidthPx,
                                            canvasHeightPx = canvasHeightPx,
                                            fontScaleOverride = density.fontScale,
                                            embeddedFonts = embeddedFonts,
                                            isSelected = isSelected,
                                            showDebugOutline = showPixelGrid,
                                            playTrigger = layerPlayCount,
                                            onTap = { dispatchSlotInteraction(layer) }
                                        )
                                    }
                                }
                            }

                            val motionLoop = layer.motionLoop
                            if (motionLoop != null && motionLoop.speedPxSec > 0f) {
                                val periodMs = ((doc.canvas.width.toFloat() / motionLoop.speedPxSec) * 1000f)
                                    .toInt()
                                    .coerceIn(800, 120000)
                                val inf = rememberInfiniteTransition(label = "oim_loop_scroll_${layer.id}")
                                val progress by inf.animateFloat(
                                    initialValue = 0f,
                                    targetValue = 1f,
                                    animationSpec = infiniteRepeatable(
                                        animation = tween(durationMillis = periodMs, easing = LinearEasing),
                                        repeatMode = RepeatMode.Restart
                                    ),
                                    label = "loop_scroll_progress"
                                )
                                val tileW = ((layer.width ?: 100.0) / 100.0).toFloat().coerceAtLeast(0.1f) * canvasWidthPx
                                val baseShift = if (motionLoop.direction.contains("left_to_right")) progress * tileW else -progress * tileW
                                val adjacentOffset = if (motionLoop.direction.contains("left_to_right")) -tileW else tileW

                                Box(modifier = Modifier.fillMaxSize().clipToBounds()) {
                                    for (copyIdx in 0..1) {
                                        val mirrorCopy = motionLoop.mirror && copyIdx == 1
                                        val copyOffsetX = baseShift + (if (copyIdx == 1) adjacentOffset else 0f)
                                        paintLayerInstance(copyOffsetX, mirrorCopy)
                                    }
                                }
                            } else {
                                paintLayerInstance(0f, false)
                            }
                        }
                }
                // A cutout mask clips every layer painted before it (CANONICAL_SPEC_2 3.11).
                val visibleLayers = doc.layers
                    .filterNot { it.id in hiddenLayerIds }
                    .filter { layer ->
                        layer.slotLanguages.contains("*") ||
                            layer.slotLanguages.any { it.equals(language, ignoreCase = true) }
                    }
                val cut = visibleLayers.indexOfLast { it.style.maskMode == "cutout" }
                if (cut >= 0) {
                    Box(Modifier.fillMaxSize().clip(cutoutShape(visibleLayers[cut], doc.canvas.width, doc.canvas.height))) {
                        visibleLayers.take(cut).forEach { paintLayer(it) }
                    }
                }
                visibleLayers.withIndex().drop(cut + 1).forEach { (i, layer) ->
                    val backdrop = layer.style.backdropPreset
                    val backdropMatrix = backdrop?.let { if (it == "duotone") duotoneMatrix() else FILTER_PRESET_CSS[it]?.let(::cssFilterMatrix) }
                    if (backdropMatrix != null) {
                        // A backdrop filters what lies under its figure: paint that again, filtered and clipped.
                        Box(Modifier.fillMaxSize().clip(boxShape(layer, doc.canvas.width, doc.canvas.height)).colorMatrixLayer(backdropMatrix)) {
                            paintBackground()
                            visibleLayers.take(i).forEach { paintLayer(it) }
                        }
                    }
                    paintLayer(layer)
                }
            }

            if (showPixelGrid) {
                OimPixelPerfectGridOverlay(
                    layers = doc.layers.filterNot { it.id in hiddenLayerIds },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }

        val selectedLayer = doc.layers.firstOrNull { it.id == selectedLayerId && it.detailContent.isNotEmpty() }
        AnimatedVisibility(
            visible = selectedLayer != null,
            enter = fadeIn(tween(180)) + scaleIn(initialScale = 0.94f, animationSpec = tween(180)),
            exit = fadeOut(tween(150)),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(12.dp)
        ) {
            if (selectedLayer != null) {
                val titleText = OimCanonicalizerAndVerifier.resolveContent(
                    selectedLayer.content, language, doc.defaultLanguage
                ).text
                val detailText = OimCanonicalizerAndVerifier.resolveContent(
                    selectedLayer.detailContent, language, doc.defaultLanguage
                ).text
                val accent = parseOimColor(selectedLayer.accentColorHex, resolvedPalette, OimAmberAccent)

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xEB0E1015),
                    border = BorderStroke(1.dp, accent.copy(alpha = 0.7f)),
                    tonalElevation = 6.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("oim_hotspot_detail_card")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(accent)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            if (titleText.isNotBlank()) {
                                Text(
                                    text = titleText,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = accent
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                            }
                            Text(
                                text = detailText,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFE5E7EB)
                            )
                        }
                        IconButton(
                            onClick = { onSelectLayer(null) },
                            modifier = Modifier
                                .size(36.dp)
                                .testTag("oim_close_detail_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close layer detail",
                                tint = Color(0xFF9CA3AF),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }

        if (zoomScale > 1.05f) {
            Surface(
                shape = RoundedCornerShape(999.dp),
                color = Color(0xCC0E1015),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.35f)),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .clickable {
                        zoomScale = 1f
                        panOffsetX = 0f
                        panOffsetY = 0f
                    }
                    .testTag("oim_zoom_reset_pill")
            ) {
                Text(
                    text = String.format("%.1fx · 2x tap reset", zoomScale),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }
    }
}

private fun normalizeScale(rawScale: Double): Float {
    // Mirrors core `escalaComoFactor`: <= 10 is already a factor (e.g., 1.05), > 10 is percentage (e.g., 105)
    return if (rawScale <= 10.0) rawScale.toFloat() else (rawScale / 100.0).toFloat()
}

private fun buildRevealEnter(reveal: OimReveal, canvasWidthPx: Float) = when (reveal.effect) {
    "slide-up" -> fadeIn(tween(reveal.durationMs)) + slideInVertically(tween(reveal.durationMs)) { (canvasWidthPx * 0.04f).roundToInt() }
    "slide-down" -> fadeIn(tween(reveal.durationMs)) + slideInVertically(tween(reveal.durationMs)) { -(canvasWidthPx * 0.04f).roundToInt() }
    "slide-left" -> fadeIn(tween(reveal.durationMs)) + slideInHorizontally(tween(reveal.durationMs)) { (canvasWidthPx * 0.04f).roundToInt() }
    "slide-right" -> fadeIn(tween(reveal.durationMs)) + slideInHorizontally(tween(reveal.durationMs)) { -(canvasWidthPx * 0.04f).roundToInt() }
    "scale" -> fadeIn(tween(reveal.durationMs)) + scaleIn(tween(reveal.durationMs), initialScale = 0.92f)
    else -> fadeIn(tween(reveal.durationMs))
}

private fun buildRevealExit(reveal: OimReveal, canvasWidthPx: Float) = when (reveal.effect) {
    "slide-up" -> fadeOut(tween(reveal.durationMs)) + slideOutVertically(tween(reveal.durationMs)) { (canvasWidthPx * 0.04f).roundToInt() }
    "slide-down" -> fadeOut(tween(reveal.durationMs)) + slideOutVertically(tween(reveal.durationMs)) { -(canvasWidthPx * 0.04f).roundToInt() }
    "slide-left" -> fadeOut(tween(reveal.durationMs)) + slideOutHorizontally(tween(reveal.durationMs)) { (canvasWidthPx * 0.04f).roundToInt() }
    "slide-right" -> fadeOut(tween(reveal.durationMs)) + slideOutHorizontally(tween(reveal.durationMs)) { -(canvasWidthPx * 0.04f).roundToInt() }
    "scale" -> fadeOut(tween(reveal.durationMs)) + scaleOut(tween(reveal.durationMs), targetScale = 0.92f)
    else -> fadeOut(tween(reveal.durationMs))
}

private data class EntranceTransform(
    val alpha: Float = 1f,
    val offsetX: Float = 0f,
    val offsetY: Float = 0f,
    val scale: Float = 1f
)

@Composable
private fun rememberEntranceTransform(
    layer: OimLayer,
    playTrigger: Int,
    canvasWidthPx: Float,
    scaleFactor: Float
): EntranceTransform {
    // Layers starting hidden (`isVisible = false`) use AnimatedVisibility when revealed by action.
    val revealSpec = layer.reveal ?: when {
        layer.animation.keyframes.isEmpty() && layer.animation.kind == OimAnimationKind.FADE_IN ->
            OimReveal(effect = "fade", durationMs = layer.animation.durationMs, delayMs = layer.animation.delayMs)
        layer.animation.keyframes.isEmpty() && layer.animation.kind == OimAnimationKind.SLIDE_UP ->
            OimReveal(effect = "slide-up", durationMs = layer.animation.durationMs, delayMs = layer.animation.delayMs)
        else -> null
    }
    if (revealSpec == null || !layer.style.isVisible) return EntranceTransform()

    val anim = remember(layer.id, playTrigger) { Animatable(0f) }
    LaunchedEffect(layer.id, revealSpec, playTrigger) {
        if (layer.animation.trigger == "action" && playTrigger == 0) {
            anim.snapTo(1f)
            return@LaunchedEffect
        }
        anim.snapTo(0f)
        if (revealSpec.delayMs > 0) {
            kotlinx.coroutines.delay(revealSpec.delayMs.toLong())
        }
        anim.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = revealSpec.durationMs.coerceAtLeast(120), easing = FastOutSlowInEasing)
        )
    }
    val p = anim.value.coerceIn(0f, 1f)
    val shiftPx = (canvasWidthPx * 0.04f).coerceAtLeast(24f * scaleFactor)
    return when (revealSpec.effect.lowercase()) {
        "slide-up" -> EntranceTransform(alpha = p, offsetY = (1f - p) * shiftPx)
        "slide-down" -> EntranceTransform(alpha = p, offsetY = -(1f - p) * shiftPx)
        "slide-left" -> EntranceTransform(alpha = p, offsetX = (1f - p) * shiftPx)
        "slide-right" -> EntranceTransform(alpha = p, offsetX = -(1f - p) * shiftPx)
        "scale", "zoom-in", "pop" -> EntranceTransform(alpha = p, scale = 0.86f + 0.14f * p)
        else -> EntranceTransform(alpha = p)
    }
}

@Composable
private fun rememberKeyframeState(layer: OimLayer, playTrigger: Int): KeyframeState {
    val keyframes = layer.animation.keyframes
    if (keyframes.isEmpty()) return KeyframeState(0f, 0f, 0f, 1f, 1f, 0f)

    val durationSec = (layer.animation.durationMs / 1000.0).coerceAtLeast(0.05)
    var state by remember(layer.id, keyframes, playTrigger) {
        mutableStateOf(OimKeyframeSampler.sampleKeyframes(keyframes, durationSec, 0.0))
    }

    LaunchedEffect(layer.id, keyframes, playTrigger) {
        if (layer.animation.trigger == "action" && playTrigger == 0) return@LaunchedEffect
        val delayNs = layer.animation.delayMs.toLong() * 1_000_000L
        var startNanos = -1L
        var finished = false
        while (!finished) {
            withFrameNanos { frameNanos ->
                if (startNanos < 0L) startNanos = frameNanos
                val elapsedAfterDelayNs = (frameNanos - startNanos - delayNs).coerceAtLeast(0L)
                val elapsedSec = elapsedAfterDelayNs / 1_000_000_000.0
                if (!layer.animation.loop && elapsedSec >= durationSec) {
                    state = OimKeyframeSampler.sampleKeyframes(keyframes, durationSec, durationSec)
                    finished = true
                } else {
                    val t = if (layer.animation.loop) elapsedSec % durationSec else elapsedSec
                    state = OimKeyframeSampler.sampleKeyframes(keyframes, durationSec, t)
                }
            }
        }
    }
    return state
}

private data class LoopAnimValues(
    val scale: Float = 1f,
    val alpha: Float = 1f,
    val offsetX: Float = 0f,
    val offsetY: Float = 0f,
    val rotation: Float = 0f
)

@Composable
private fun rememberLoopAnimValues(kind: OimAnimationKind, durationMs: Int, loop: Boolean, scaleFactor: Float): LoopAnimValues {
    if (!loop || kind == OimAnimationKind.NONE) return LoopAnimValues()
    val transition = rememberInfiniteTransition(label = "oim_loop_$kind")
    val safeDuration = durationMs.coerceAtLeast(450)
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(safeDuration, easing = if (kind == OimAnimationKind.SPIN) LinearEasing else FastOutSlowInEasing),
            repeatMode = if (kind == OimAnimationKind.SPIN) RepeatMode.Restart else RepeatMode.Reverse
        ),
        label = "loop_progress"
    )
    return when (kind) {
        OimAnimationKind.PULSE, OimAnimationKind.PULSE_GLOW, OimAnimationKind.GLOW ->
            LoopAnimValues(scale = 1f + 0.045f * progress, alpha = 0.85f + 0.15f * progress)
        OimAnimationKind.FLOAT, OimAnimationKind.FLOAT_BREATHE ->
            LoopAnimValues(offsetY = -6f * scaleFactor * progress)
        OimAnimationKind.BOUNCE ->
            LoopAnimValues(offsetY = -8f * scaleFactor * sin(progress * PI.toFloat()))
        OimAnimationKind.SPIN ->
            LoopAnimValues(rotation = 360f * progress)
        else -> LoopAnimValues()
    }
}

@Composable
private fun OimAnchoredLayerBox(
    xPercent: Float,
    yPercent: Float,
    anchorX: Float,
    anchorY: Float,
    canvasWidthPx: Float,
    canvasHeightPx: Float,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Layout(
        content = content,
        modifier = modifier
    ) { measurables, constraints ->
        val looseConstraints = constraints.copy(minWidth = 0, minHeight = 0)
        val placeables = measurables.map { it.measure(looseConstraints) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            placeables.forEach { placeable ->
                val rawX = (xPercent / 100f) * canvasWidthPx - (placeable.width * anchorX)
                val rawY = (yPercent / 100f) * canvasHeightPx - (placeable.height * anchorY)
                placeable.placeRelative(
                    IntOffset(rawX.roundToInt(), rawY.roundToInt())
                )
            }
        }
    }
}

@Composable
private fun OimLayerNode(
    layer: OimLayer,
    resolvedText: String,
    language: String,
    defaultLang: String,
    palette: Map<String, String>,
    naturalWidth: Int,
    naturalHeight: Int,
    canvasWidthPx: Float,
    canvasHeightPx: Float,
    fontScaleOverride: Float,
    embeddedFonts: Map<String, List<Pair<Int, FontFamily>>>,
    isSelected: Boolean,
    showDebugOutline: Boolean,
    playTrigger: Int,
    onTap: () -> Unit
) {
    val density = LocalDensity.current
    val fontSizePx = remember(canvasWidthPx, layer.style.fontSizeDim, layer.style.fontSizeRatio) {
        layer.style.fontSizeDim?.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true)
            ?: (canvasWidthPx * layer.style.fontSizeRatio)
    }.coerceAtLeast(8f)

    val pixelLockedSp = remember(fontSizePx, fontScaleOverride) {
        with(density) { (fontSizePx / fontScaleOverride.coerceAtLeast(0.5f)).toSp() }
    }

    val widthDp = remember(canvasWidthPx, canvasHeightPx, layer.widthDim) {
        layer.widthDim?.let { dim ->
            with(density) { dim.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true).toDp() }
        }
    }
    val heightDp = remember(canvasWidthPx, canvasHeightPx, layer.heightDim) {
        layer.heightDim?.let { dim ->
            with(density) { dim.resolvePx(canvasWidthPx, canvasHeightPx, naturalHeight, isHorizontal = false).toDp() }
        }
    }
    val maxWidthDp = remember(canvasWidthPx, canvasHeightPx, layer.maxWidthDim, widthDp) {
        layer.maxWidthDim?.let { dim ->
            with(density) { dim.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true).toDp() }
        } ?: widthDp
    }

    val shape = remember(canvasWidthPx, canvasHeightPx, layer.style.cornerRadii, layer.style.cornerRadiusRatio) {
        buildCornerShape(layer.style.cornerRadii, layer.style.cornerRadiusRatio, canvasWidthPx, canvasHeightPx, naturalWidth, density)
    }

    val borderWidthDp = remember(canvasWidthPx, layer.style.borderWidthRatio) {
        with(density) { (canvasWidthPx * layer.style.borderWidthRatio).toDp() }
    }

    val textColor = resolveSlotColor(layer.style.colorRole, layer.style.textColorHex, palette, Color.White)
    val fillColor = resolveSlotColor(layer.style.fillColorRole, layer.style.fillColorHex ?: layer.style.backgroundColorHex, palette, Color.Transparent)
    val bgColor = resolveSlotColor(null, layer.style.backgroundColorHex, palette, Color.Transparent)
    val borderColor = resolveSlotColor(layer.style.strokeColorRole, layer.style.borderColorHex, palette, Color.Transparent)
    val accentColor = parseOimColor(layer.accentColorHex, palette, OimAmberAccent)
    val scaleFactor = canvasWidthPx / naturalWidth.coerceAtLeast(1).toFloat()

    val shadowBaseColor = if (layer.style.shadowEnabled &&
        (!layer.style.shadowColorHex.isNullOrBlank() || !layer.style.shadowColorRole.isNullOrBlank())
    ) {
        resolveSlotColor(layer.style.shadowColorRole, layer.style.shadowColorHex, palette, Color.Transparent)
    } else {
        Color.Transparent
    }
    val shadowColor = if (shadowBaseColor.alpha > 0f) {
        shadowBaseColor.copy(alpha = (shadowBaseColor.alpha * layer.style.shadowOpacity).coerceIn(0f, 1f))
    } else {
        Color.Transparent
    }
    val shadowBlurDp = with(density) { (layer.style.shadowBlur.coerceAtLeast(0f) * 0.55f * scaleFactor).toDp() }
    val shadowDxDp = with(density) { (layer.style.shadowOffsetX * scaleFactor).toDp() }
    val shadowDyDp = with(density) { (layer.style.shadowOffsetY * scaleFactor).toDp() }

    val glowColor = if (layer.style.glowEnabled) {
        if (!layer.style.glowColorHex.isNullOrBlank() || !layer.style.glowColorRole.isNullOrBlank()) {
            resolveSlotColor(layer.style.glowColorRole, layer.style.glowColorHex, palette, Color(0xFFF59E0B))
        } else {
            Color(0xFFF59E0B)
        }
    } else {
        Color.Transparent
    }
    val glowRadiusPx = layer.style.glowRadiusPx.coerceAtLeast(0f)
    val glowOuterBlurDp = with(density) { (glowRadiusPx * 0.7f * scaleFactor).toDp() }
    val glowInnerBlurDp = with(density) { (glowRadiusPx * 0.3f * scaleFactor).toDp() }

    val famLower = layer.style.fontFamily?.trim()?.lowercase().orEmpty()
    val fontFamily = OimFontLoader.findBestFont(embeddedFonts, layer.style.fontFamily, layer.style.fontWeight) ?: when {
        layer.style.monospace || "mono" in famLower || "code" in famLower -> FontFamily.Monospace
        "serif" in famLower && "sans" !in famLower -> FontFamily.Serif
        "fjalla" in famLower || "oswald" in famLower || "bebas" in famLower || "anton" in famLower || "condensed" in famLower ->
            FontFamily(Typeface.create("sans-serif-condensed", Typeface.NORMAL))
        else -> FontFamily.SansSerif
    }
    val fontWeight = when {
        layer.style.fontWeight >= 700 -> FontWeight.Bold
        layer.style.fontWeight >= 600 -> FontWeight.SemiBold
        layer.style.fontWeight >= 500 -> FontWeight.Medium
        layer.style.fontWeight <= 300 -> FontWeight.Light
        else -> FontWeight.Normal
    }

    val semanticsMod = if (layer.style.decorative) {
        Modifier.clearAndSetSemantics { }
    } else {
        val altText = OimCanonicalizerAndVerifier.resolveContent(layer.style.alt, language, defaultLang).text
        if (altText.isNotBlank()) {
            Modifier.semantics { contentDescription = altText }
        } else {
            Modifier
        }
    }

    val interactiveMod = if (layer.isInteractive || layer.kind == OimLayerKind.HOTSPOT || layer.detailContent.isNotEmpty() || layer.states?.active != null) {
        Modifier.clickable(onClick = onTap)
    } else {
        Modifier
    }

    val debugModifier = if (showDebugOutline || isSelected) {
        Modifier.border(
            width = 1.dp,
            color = if (isSelected) accentColor else Color(0x9922D3EE),
            shape = shape
        )
    } else {
        Modifier
    }

    // Text animations (entrance, typewriter, wave-chars, glitch-cyberpunk, glitch-slice)
    val animatedTextRender = rememberAnimatedTextRender(
        rawText = resolvedText,
        marks = layer.style.textMarks,
        palette = palette,
        baseTextColor = textColor,
        baseStrokeColor = borderColor,
        animationType = layer.style.textAnimationType,
        speed = layer.style.textAnimationSpeed,
        delaySec = layer.style.textAnimationDelay,
        playTrigger = playTrigger
    )

    when (layer.kind) {
        OimLayerKind.HOTSPOT -> {
            val pulseTransition = rememberInfiniteTransition(label = "hotspot_${layer.id}")
            val pulseScale by pulseTransition.animateFloat(
                initialValue = 1.0f,
                targetValue = 1.75f,
                animationSpec = infiniteRepeatable(
                    animation = tween(layer.animation.durationMs.coerceAtLeast(900), delayMillis = layer.animation.delayMs),
                    repeatMode = RepeatMode.Restart
                ),
                label = "pulse_scale"
            )
            val pulseAlpha by pulseTransition.animateFloat(
                initialValue = 0.75f,
                targetValue = 0.0f,
                animationSpec = infiniteRepeatable(
                    animation = tween(layer.animation.durationMs.coerceAtLeast(900), delayMillis = layer.animation.delayMs),
                    repeatMode = RepeatMode.Restart
                ),
                label = "pulse_alpha"
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = semanticsMod
                    .then(interactiveMod)
                    .padding(4.dp)
                    .testTag("oim_hotspot_${layer.id}")
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(28.dp)) {
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .graphicsLayer {
                                scaleX = pulseScale
                                scaleY = pulseScale
                                alpha = pulseAlpha
                            }
                            .clip(CircleShape)
                            .border(2.dp, accentColor, CircleShape)
                    )
                    Box(
                        modifier = Modifier
                            .size(if (isSelected) 16.dp else 13.dp)
                            .clip(CircleShape)
                            .background(accentColor)
                            .border(2.dp, Color(0xFF0E1015), CircleShape)
                    )
                }
                if (resolvedText.isNotBlank()) {
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = if (isSelected) accentColor else Color(0xD90E1015),
                        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.85f))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = animatedTextRender.fillText,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = with(density) { ((canvasWidthPx * 0.017f) / fontScaleOverride.coerceAtLeast(0.5f)).toSp() },
                                color = if (isSelected) Color(0xFF0E1015) else Color(0xFFF8FAFC),
                                maxLines = 1
                            )
                            Icon(
                                imageVector = Icons.Default.TouchApp,
                                contentDescription = null,
                                tint = if (isSelected) Color(0xFF0E1015) else accentColor,
                                modifier = Modifier.size(11.dp)
                            )
                        }
                    }
                }
            }
        }

        OimLayerKind.GEO, OimLayerKind.VECTOR_FRAME -> {
            val w = widthDp ?: 48.dp
            val h = heightDp ?: w
            val isFullCanvasLayer = layer.id == "background-pattern-slot" ||
                (kotlin.math.abs(layer.x) < 0.2 && kotlin.math.abs(layer.y) < 0.2 &&
                    (layer.width ?: 0.0) >= 99.5 && (layer.height ?: 0.0) >= 99.5)
            val strokePx = with(density) { borderWidthDp.toPx() }
            val cornerRadiiPx = layer.style.cornerRadii?.let { cr ->
                floatArrayOf(
                    cr.topStart.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true),
                    cr.topEnd.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true),
                    cr.bottomEnd.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true),
                    cr.bottomStart.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true)
                )
            }
            val resolvedCornerPx = cornerRadiiPx?.get(0) ?: (canvasWidthPx * layer.style.cornerRadiusRatio)
            val geoKindStr = layer.style.geoShape ?: "rectangle"
            val clipShape = customFrameShape(layer.style.svgPaths, layer.style.svgViewBox) ?: buildGeoClipShape(geoKindStr, shape)
            val imageFill = layer.style.imageFill
            val fillBitmap by produceState<ImageBitmap?>(initialValue = null, key1 = imageFill?.src) {
                val src = imageFill?.src
                value = if (!src.isNullOrBlank()) {
                    withContext(Dispatchers.Default) { decodeDataUriBitmap(src) }
                } else null
            }
            val fillColorFilter = remember(imageFill?.filters, layer.style.filter) {
                buildComposeColorFilter(imageFill?.filters ?: layer.style.filter)
            }
            val fillOwnBlurDp = ((imageFill?.filters?.blurPx ?: 0f) * scaleFactor).let { px ->
                if (px > 0.2f) with(density) { px.toDp() } else 0.dp
            }
            val hasFilledBody = fillColor.alpha > 0f || imageFill != null ||
                layer.style.patternFill != null || layer.style.gradientFill != null

            val renderGeoEffect: @Composable (Color, Dp, Dp, Dp) -> Unit = { effColor, blurDp, dxDp, dyDp ->
                Canvas(
                    modifier = Modifier
                        .fillMaxSize()
                        .offset(x = dxDp, y = dyDp)
                        .then(
                            if (blurDp > 0.2.dp) {
                                Modifier.blur(radius = blurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                            } else Modifier
                        )
                ) {
                    if (layer.style.svgPaths.isNotEmpty()) {
                        drawGeoShape(
                            geoShape = geoKindStr,
                            svgPath = layer.style.svgPath,
                            svgPaths = layer.style.svgPaths,
                            svgViewBox = layer.style.svgViewBox,
                            palette = palette,
                            fillColor = effColor,
                            strokeColor = effColor,
                            strokeWidthPx = strokePx,
                            cornerRadiusPx = resolvedCornerPx,
                            cornerRadiiPx = cornerRadiiPx,
                            tintOverride = effColor
                        )
                    } else {
                        val isStrokeOnly = geoKindStr.equals("line", ignoreCase = true) || !hasFilledBody
                        val silhouetteStrokeW = if (isStrokeOnly) strokePx.coerceAtLeast(1f) else strokePx
                        drawGeoShape(
                            geoShape = geoKindStr,
                            svgPath = layer.style.svgPath,
                            svgPaths = emptyList(),
                            svgViewBox = layer.style.svgViewBox,
                            palette = palette,
                            fillColor = if (isStrokeOnly) Color.Transparent else effColor,
                            strokeColor = if (silhouetteStrokeW > 0f && (borderColor.alpha > 0f || isStrokeOnly)) effColor else Color.Transparent,
                            strokeWidthPx = silhouetteStrokeW,
                            cornerRadiusPx = resolvedCornerPx,
                            cornerRadiiPx = cornerRadiiPx
                        )
                    }
                }
            }

            Box(modifier = if (isFullCanvasLayer) Modifier.fillMaxSize() else Modifier.size(width = w, height = h)) {
                // The web's drop-shadow follows painted pixels: a pattern on a clear ground shadows only its figures.
                // shortcut: that faint per-figure halo is not drawn; draw it from the tile when a file shows it.
                val seeThroughPattern = fillColor.alpha == 0f && imageFill == null && layer.style.gradientFill == null &&
                    layer.style.patternFill?.let { parseOimColor(it.bg, palette, Color.Transparent).alpha == 0f } == true
                if (shadowColor.alpha > 0f && !seeThroughPattern) {
                    renderGeoEffect(shadowColor, shadowBlurDp, shadowDxDp, shadowDyDp)
                }
                if (layer.style.glowEnabled && glowColor.alpha > 0f && glowRadiusPx > 0f) {
                    renderGeoEffect(glowColor, glowOuterBlurDp, 0.dp, 0.dp)
                    renderGeoEffect(glowColor, glowInnerBlurDp, 0.dp, 0.dp)
                }

                val activeBitmap = fillBitmap
                if (imageFill != null && activeBitmap != null) {
                    Box(
                        modifier = semanticsMod
                            .fillMaxSize()
                            .then(debugModifier)
                            .then(interactiveMod)
                            .testTag("oim_layer_${layer.id}")
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(clipShape)
                                .then(if (fillColor.alpha > 0f) Modifier.background(fillColor) else Modifier)
                        ) {
                            OimCroppedImage(
                                bitmap = activeBitmap,
                                fill = imageFill,
                                contentDescription = OimCanonicalizerAndVerifier.resolveContent(layer.style.alt, language, defaultLang).text.ifBlank { null },
                                colorFilter = fillColorFilter,
                                blurDp = fillOwnBlurDp
                            )
                        }
                        if (strokePx > 0f && borderColor.alpha > 0f) {
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                drawGeoShape(
                                    geoShape = geoKindStr,
                                    svgPath = layer.style.svgPath,
                                    svgPaths = emptyList(),
                                    svgViewBox = layer.style.svgViewBox,
                                    palette = palette,
                                    fillColor = Color.Transparent,
                                    strokeColor = borderColor,
                                    strokeWidthPx = strokePx,
                                    cornerRadiusPx = resolvedCornerPx,
                                    cornerRadiiPx = cornerRadiiPx
                                )
                            }
                        }
                    }
                } else if (layer.style.patternFill != null || layer.style.gradientFill != null) {
                    Box(
                        modifier = semanticsMod
                            .fillMaxSize()
                            .then(debugModifier)
                            .then(interactiveMod)
                            .testTag("oim_layer_${layer.id}")
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(clipShape)
                                .then(if (fillColor.alpha > 0f) Modifier.background(fillColor) else Modifier)
                        ) {
                            layer.style.gradientFill?.let { grad ->
                                OimGradientBox(gradient = grad, palette = palette, modifier = Modifier.fillMaxSize())
                            }
                            layer.style.patternFill?.let { pat ->
                                OimPatternCanvas(
                                    pattern = pat,
                                    palette = palette,
                                    canvasWidthPx = canvasWidthPx,
                                    naturalWidth = naturalWidth,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        }
                        if (strokePx > 0f && borderColor.alpha > 0f) {
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                drawGeoShape(
                                    geoShape = geoKindStr,
                                    svgPath = layer.style.svgPath,
                                    svgPaths = emptyList(),
                                    svgViewBox = layer.style.svgViewBox,
                                    palette = palette,
                                    fillColor = Color.Transparent,
                                    strokeColor = borderColor,
                                    strokeWidthPx = strokePx,
                                    cornerRadiusPx = resolvedCornerPx,
                                    cornerRadiiPx = cornerRadiiPx
                                )
                            }
                        }
                    }
                } else {
                    Canvas(
                        modifier = semanticsMod
                            .fillMaxSize()
                            .then(debugModifier)
                            .then(interactiveMod)
                            .testTag("oim_layer_${layer.id}")
                    ) {
                        drawGeoShape(
                            geoShape = geoKindStr,
                            svgPath = layer.style.svgPath,
                            svgPaths = layer.style.svgPaths,
                            svgViewBox = layer.style.svgViewBox,
                            palette = palette,
                            fillColor = fillColor,
                            strokeColor = borderColor,
                            strokeWidthPx = strokePx,
                            cornerRadiusPx = resolvedCornerPx,
                            cornerRadiiPx = cornerRadiiPx
                        )
                    }
                }
            }
        }

        OimLayerKind.IMAGE -> {
            val layerImageFill = layer.style.imageFill
            val imgSrc = layerImageFill?.src ?: resolvedText
            val embeddedBmp by produceState<ImageBitmap?>(initialValue = null, key1 = imgSrc) {
                value = if (imgSrc.startsWith("data:image/")) {
                    withContext(Dispatchers.Default) { decodeDataUriBitmap(imgSrc) }
                } else null
            }
            val effectiveFill = layerImageFill ?: OimImageFill(
                src = imgSrc,
                fit = layer.style.objectFit ?: "cover",
                filters = layer.style.filter
            )
            val imgColorFilter = remember(effectiveFill.filters, layer.style.filter) {
                buildComposeColorFilter(effectiveFill.filters ?: layer.style.filter)
            }
            val imgOwnBlurDp = ((effectiveFill.filters?.blurPx ?: 0f) * scaleFactor).let { px ->
                if (px > 0.2f) with(density) { px.toDp() } else 0.dp
            }
            val sizeMod = run {
                var m: Modifier = Modifier
                if (widthDp != null && heightDp != null) m = m.size(widthDp, heightDp)
                else if (widthDp != null) m = m.widthIn(max = widthDp)
                m
            }
            val loadedBmp = embeddedBmp
            if (loadedBmp != null) {
                Box(
                    modifier = semanticsMod
                        .then(sizeMod)
                        .then(debugModifier)
                        .then(interactiveMod)
                        .testTag("oim_layer_${layer.id}")
                ) {
                    val renderImageSilhouette: @Composable (Color, Dp, Dp, Dp) -> Unit = { effColor, blurDp, dxDp, dyDp ->
                        Box(
                            modifier = Modifier
                                .matchParentSize()
                                .offset(x = dxDp, y = dyDp)
                                .then(
                                    if (blurDp > 0.2.dp) {
                                        Modifier.blur(radius = blurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                                    } else Modifier
                                )
                                .clip(shape)
                        ) {
                            OimCroppedImage(
                                bitmap = loadedBmp,
                                fill = effectiveFill.copy(opacity = 1f),
                                contentDescription = null,
                                colorFilter = ColorFilter.tint(effColor, BlendMode.SrcIn),
                                blurDp = 0.dp
                            )
                        }
                    }
                    if (shadowColor.alpha > 0f) {
                        val effShadow = shadowColor.copy(alpha = (shadowColor.alpha * effectiveFill.opacity).coerceIn(0f, 1f))
                        renderImageSilhouette(effShadow, shadowBlurDp, shadowDxDp, shadowDyDp)
                    }
                    if (layer.style.glowEnabled && glowColor.alpha > 0f && glowRadiusPx > 0f) {
                        val effGlow = glowColor.copy(alpha = (glowColor.alpha * effectiveFill.opacity).coerceIn(0f, 1f))
                        renderImageSilhouette(effGlow, glowOuterBlurDp, 0.dp, 0.dp)
                        renderImageSilhouette(effGlow, glowInnerBlurDp, 0.dp, 0.dp)
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(shape)
                    ) {
                        OimCroppedImage(
                            bitmap = loadedBmp,
                            fill = effectiveFill,
                            contentDescription = OimCanonicalizerAndVerifier.resolveContent(layer.style.alt, language, defaultLang).text.ifBlank { null },
                            colorFilter = imgColorFilter,
                            blurDp = imgOwnBlurDp
                        )
                    }
                }
            }
        }

        OimLayerKind.BADGE, OimLayerKind.CALLOUT -> {
            Surface(
                shape = shape,
                color = bgColor,
                border = if (borderWidthDp > 0.dp) BorderStroke(borderWidthDp.coerceAtLeast(0.75.dp), borderColor) else null,
                modifier = semanticsMod
                    .then(debugModifier)
                    .then(interactiveMod)
                    .testTag("oim_layer_${layer.id}")
            ) {
                Text(
                    text = animatedTextRender.fillText,
                    fontFamily = fontFamily,
                    fontWeight = fontWeight,
                    fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                    fontSize = pixelLockedSp,
                    letterSpacing = (layer.style.letterSpacingEm * 10f).sp,
                    color = textColor,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }

        OimLayerKind.MASK, OimLayerKind.CONTAINER, OimLayerKind.OTHER -> {
            // Structural / mask container; renders outline in debug grid mode
            if (showDebugOutline && widthDp != null && heightDp != null) {
                Box(
                    modifier = semanticsMod
                        .size(widthDp, heightDp)
                        .then(debugModifier)
                        .testTag("oim_layer_${layer.id}")
                )
            }
        }

        OimLayerKind.TEXT, OimLayerKind.ARTISTIC_TEXT -> {
            val hasBoxChrome = bgColor.alpha > 0f
            val boxMod = run {
                var m: Modifier = Modifier
                if (widthDp != null) m = m.width(widthDp)
                else if (maxWidthDp != null) m = m.widthIn(max = maxWidthDp)
                if (heightDp != null) {
                    m = if (hasBoxChrome) m.height(heightDp) else m.heightIn(min = heightDp)
                }
                m
            }
            val lineHeightSp = layer.style.lineHeightFactor?.let { pixelLockedSp * it } ?: (pixelLockedSp * 1.15f)
            val resolvedTextAlign = when (layer.style.textAlign) {
                OimTextAlign.START -> TextAlign.Start
                OimTextAlign.CENTER -> TextAlign.Center
                OimTextAlign.END -> TextAlign.End
                OimTextAlign.JUSTIFY -> TextAlign.Justify
            }
            val boxContentAlignment = when (layer.style.textAlign) {
                OimTextAlign.CENTER -> Alignment.Center
                OimTextAlign.END -> Alignment.CenterEnd
                else -> Alignment.CenterStart
            }
            val textWidthMod = if (widthDp != null) Modifier.fillMaxWidth() else Modifier
            val glyphStrokePx = with(density) { borderWidthDp.toPx() }
            val artistic = layer.style.artistic
            val extColor = artistic?.extrusionColorHex?.let {
                parseOimColor(it, palette, Color.Transparent)
            } ?: Color.Transparent
            val extDepthPx = (artistic?.extrusionDepthPx ?: 0f) * scaleFactor

            val textAnimMod = Modifier
                .then(if (animatedTextRender.clipToBox) Modifier.clipToBounds() else Modifier)
                .then(
                    if (animatedTextRender.containerScale != 1f || animatedTextRender.containerAlpha != 1f) {
                        Modifier.graphicsLayer {
                            scaleX = animatedTextRender.containerScale
                            scaleY = animatedTextRender.containerScale
                            alpha = animatedTextRender.containerAlpha
                        }
                    } else Modifier
                )

            val hasChromeEffects = hasBoxChrome && (
                shadowColor.alpha > 0f || (layer.style.glowEnabled && glowColor.alpha > 0f && glowRadiusPx > 0f)
                )

            val renderTextBoxContent: @Composable (Modifier) -> Unit = { chromeModifier ->
                Box(
                    contentAlignment = boxContentAlignment,
                    modifier = chromeModifier
                        .then(boxMod)
                        .then(if (hasBoxChrome) Modifier.clip(shape) else Modifier)
                        .background(bgColor)
                        .then(if (hasChromeEffects) Modifier else textAnimMod)
                        .then(if (hasBoxChrome) Modifier.padding(horizontal = 2.dp, vertical = 1.dp) else Modifier)
                ) {
                    if (resolvedText.isNotEmpty()) {
                        val plainOrBaseAnnotated = animatedTextRender.plainText
                        val fillAnnotated = animatedTextRender.fillText
                        val glitchState = animatedTextRender.glitchState
                        val baseTextStyle = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))
                        val strokeTextStyle = TextStyle(
                            drawStyle = Stroke(width = glyphStrokePx * 2f, join = StrokeJoin.Round),
                            platformStyle = PlatformTextStyle(includeFontPadding = false)
                        )
                        val renderTextSilhouette: @Composable (Color, Dp, Dp, Dp) -> Unit = { effColor, blurDp, dxDp, dyDp ->
                            Text(
                                text = tintAnnotatedTextSilhouette(plainOrBaseAnnotated, effColor),
                                fontFamily = fontFamily,
                                fontWeight = fontWeight,
                                fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                                fontSize = pixelLockedSp,
                                lineHeight = lineHeightSp,
                                style = baseTextStyle,
                                color = effColor,
                                modifier = textWidthMod
                                    .offset(x = dxDp, y = dyDp)
                                    .then(
                                        if (blurDp > 0.2.dp) {
                                            Modifier.blur(radius = blurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                                        } else Modifier
                                    ),
                                textAlign = resolvedTextAlign
                            )
                        }

                        if (!hasBoxChrome) {
                            if (shadowColor.alpha > 0f) {
                                renderTextSilhouette(shadowColor, shadowBlurDp, shadowDxDp, shadowDyDp)
                            }
                            if (layer.style.glowEnabled && glowColor.alpha > 0f && glowRadiusPx > 0f) {
                                renderTextSilhouette(glowColor, glowOuterBlurDp, 0.dp, 0.dp)
                                renderTextSilhouette(glowColor, glowInnerBlurDp, 0.dp, 0.dp)
                            }
                        }
                        if (extColor.alpha > 0f && extDepthPx > 0.5f) {
                            val steps = 5
                            for (step in steps downTo 1) {
                                val d = with(density) { ((extDepthPx * step) / steps).toDp() }
                                Text(
                                    text = plainOrBaseAnnotated,
                                    fontFamily = fontFamily,
                                    fontWeight = fontWeight,
                                    fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                                    fontSize = pixelLockedSp,
                                    lineHeight = lineHeightSp,
                                    style = baseTextStyle,
                                    color = extColor,
                                    modifier = textWidthMod.offset(x = d * 0.5f, y = d),
                                    textAlign = resolvedTextAlign
                                )
                            }
                        }
                        if (glitchState != null && glitchState.isActive && layer.style.textAnimationType.equals("glitch-cyberpunk", ignoreCase = true)) {
                            glitchState.copies.forEach { copy ->
                                val ghostColor = parseOimColor(copy.colorHex, palette, Color.Cyan).copy(alpha = copy.opacity)
                                val dxDp = with(density) { (copy.dxPx * scaleFactor).toDp() }
                                val dyDp = with(density) { (copy.dyPx * scaleFactor).toDp() }
                                Text(
                                    text = plainOrBaseAnnotated,
                                    fontFamily = fontFamily,
                                    fontWeight = fontWeight,
                                    fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                                    fontSize = pixelLockedSp,
                                    lineHeight = lineHeightSp,
                                    style = baseTextStyle,
                                    color = ghostColor,
                                    modifier = textWidthMod.offset(x = dxDp, y = dyDp),
                                    textAlign = resolvedTextAlign
                                )
                            }
                        }
                        if (glyphStrokePx > 0f && borderColor.alpha > 0f) {
                            Text(
                                text = animatedTextRender.strokeText,
                                fontFamily = fontFamily,
                                fontWeight = fontWeight,
                                fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                                fontSize = pixelLockedSp,
                                lineHeight = lineHeightSp,
                                style = strokeTextStyle,
                                color = borderColor,
                                modifier = textWidthMod,
                                textAlign = resolvedTextAlign
                            )
                        }
                        Text(
                            text = fillAnnotated,
                            fontFamily = fontFamily,
                            fontWeight = fontWeight,
                            fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                            fontSize = pixelLockedSp,
                            lineHeight = lineHeightSp,
                            style = baseTextStyle,
                            color = textColor,
                            modifier = textWidthMod,
                            textAlign = resolvedTextAlign
                        )
                        if (glitchState != null && glitchState.isActive && layer.style.textAnimationType.equals("glitch-slice", ignoreCase = true)) {
                            glitchState.copies.forEach { copy ->
                                val dxDp = with(density) { (copy.dxPx * scaleFactor).toDp() }
                                Text(
                                    text = fillAnnotated,
                                    fontFamily = fontFamily,
                                    fontWeight = fontWeight,
                                    fontStyle = if (layer.style.fontStyleItalic) FontStyle.Italic else FontStyle.Normal,
                                    fontSize = pixelLockedSp,
                                    lineHeight = lineHeightSp,
                                    style = baseTextStyle,
                                    color = textColor,
                                    modifier = textWidthMod
                                        .offset(x = dxDp)
                                        .drawWithContent {
                                            val topY = (size.height * (copy.clipTopPct / 100f)).coerceIn(0f, size.height)
                                            val botY = (size.height * (copy.clipBottomPct / 100f)).coerceIn(topY, size.height)
                                            clipRect(left = 0f, top = topY, right = size.width, bottom = botY) {
                                                this@drawWithContent.drawContent()
                                            }
                                        },
                                    textAlign = resolvedTextAlign
                                )
                            }
                        }
                    }
                }
            }

            if (hasChromeEffects) {
                Box(
                    modifier = semanticsMod
                        .then(textAnimMod)
                        .then(debugModifier)
                        .then(interactiveMod)
                        .testTag("oim_layer_${layer.id}")
                ) {
                    if (shadowColor.alpha > 0f) {
                        Box(
                            modifier = Modifier
                                .matchParentSize()
                                .offset(x = shadowDxDp, y = shadowDyDp)
                                .then(
                                    if (shadowBlurDp > 0.2.dp) {
                                        Modifier.blur(radius = shadowBlurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                                    } else Modifier
                                )
                                .background(shadowColor, shape)
                        )
                    }
                    if (layer.style.glowEnabled && glowColor.alpha > 0f && glowRadiusPx > 0f) {
                        listOf(glowOuterBlurDp, glowInnerBlurDp).forEach { passDp ->
                            Box(
                                modifier = Modifier
                                    .matchParentSize()
                                    .then(
                                        if (passDp > 0.2.dp) {
                                            Modifier.blur(radius = passDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                                        } else Modifier
                                    )
                                    .background(glowColor, shape)
                            )
                        }
                    }
                    renderTextBoxContent(Modifier)
                }
            } else {
                renderTextBoxContent(
                    semanticsMod
                        .then(debugModifier)
                        .then(interactiveMod)
                        .testTag("oim_layer_${layer.id}")
                )
            }
        }
    }
}

private data class AnimatedTextRender(
    val fillText: AnnotatedString,
    val plainText: AnnotatedString,
    val strokeText: AnnotatedString = plainText,
    val clipToBox: Boolean = false,
    val containerScale: Float = 1f,
    val containerAlpha: Float = 1f,
    val glitchState: GlitchRenderState? = null
)

@Composable
private fun rememberAnimatedTextRender(
    rawText: String,
    marks: Map<String, OimTextMarkStyle>,
    palette: Map<String, String>,
    baseTextColor: Color,
    baseStrokeColor: Color,
    animationType: String?,
    speed: Double?,
    delaySec: Double?,
    playTrigger: Int
): AnimatedTextRender {
    val fillBase = remember(rawText, marks, palette) {
        buildMarkedAnnotatedString(
            rawText = rawText,
            marks = marks,
            palette = palette,
            includeHighlightBackground = true
        )
    }
    val plainBase = remember(rawText, marks, palette) {
        buildMarkedAnnotatedString(
            rawText = rawText,
            marks = marks,
            palette = palette,
            includeHighlightBackground = false
        )
    }

    val effect = animationType?.trim()?.lowercase()?.ifBlank { null }
    if (effect == null || fillBase.isEmpty()) {
        return AnimatedTextRender(fillText = fillBase, plainText = plainBase, strokeText = plainBase)
    }

    val delay = (delaySec ?: 0.0).coerceAtLeast(0.0)
    var elapsedSec by remember(fillBase, effect, speed, delay, playTrigger) {
        mutableStateOf(0.0)
    }

    val isEntrance = OimTextAnimator.isEntranceEffect(effect)
    val isTypewriter = OimTextAnimator.isTypewriterEffect(effect)
    val isWave = OimTextAnimator.isWaveEffect(effect)
    val isGlitch = OimTextAnimator.isGlitchEffect(effect)

    if (!isEntrance && !isTypewriter && !isWave && !isGlitch) {
        return AnimatedTextRender(fillText = fillBase, plainText = plainBase, strokeText = plainBase)
    }

    val units = remember(fillBase.text, effect, isEntrance) {
        if (isEntrance) OimTextAnimator.entranceUnits(fillBase.text, effect) else emptyList()
    }
    val stagger = OimTextAnimator.resolveEntranceStaggerSec(speed)
    val twSpeed = OimTextAnimator.resolveTypewriterCharsPerSec(speed)
    val waveSpeed = OimTextAnimator.resolveWaveLagSec(speed)
    val entranceTotalSec = remember(units.size, stagger, delay) {
        OimTextAnimator.entranceTotalDurationSec(units.size, stagger, delay)
    }
    val typewriterTotalSec = remember(fillBase.length, twSpeed, delay) {
        delay + (fillBase.length / twSpeed) + 0.05
    }

    LaunchedEffect(fillBase, effect, speed, delay, playTrigger) {
        var startNanos = -1L
        var finished = false
        while (!finished) {
            withFrameNanos { frameNanos ->
                if (startNanos < 0L) startNanos = frameNanos
                val sec = (frameNanos - startNanos) / 1_000_000_000.0
                when {
                    isEntrance && sec >= entranceTotalSec -> {
                        elapsedSec = entranceTotalSec
                        finished = true
                    }
                    isTypewriter && sec >= typewriterTotalSec -> {
                        elapsedSec = typewriterTotalSec
                        finished = true
                    }
                    else -> elapsedSec = sec
                }
            }
        }
    }

    if (isTypewriter) {
        val visibleCount = OimTextAnimator.typewriterVisibleCount(fillBase.length, elapsedSec, twSpeed, delay)
        val slicedFill = fillBase.subSequence(0, visibleCount)
        val slicedPlain = plainBase.subSequence(0, visibleCount.coerceAtMost(plainBase.length))
        return AnimatedTextRender(fillText = slicedFill, plainText = slicedPlain, strokeText = slicedPlain)
    }

    if (isWave) {
        fun applyWave(base: AnnotatedString): AnnotatedString = buildAnnotatedString {
            append(base)
            for (i in 0 until base.length) {
                if (!base.text[i].isWhitespace()) {
                    val shift = OimTextAnimator.waveUnitBaselineShift(elapsedSec, i, waveSpeed, delay)
                    addStyle(SpanStyle(baselineShift = BaselineShift(shift)), i, i + 1)
                }
            }
        }
        return AnimatedTextRender(
            fillText = applyWave(fillBase),
            plainText = applyWave(plainBase),
            strokeText = applyWave(plainBase)
        )
    }

    if (isGlitch) {
        val glitchSpeed = speed ?: 1.0
        val glitch = OimTextAnimator.calculateGlitchRenderState(effect, elapsedSec, glitchSpeed, delay)
        return AnimatedTextRender(
            fillText = fillBase,
            plainText = plainBase,
            strokeText = plainBase,
            glitchState = glitch
        )
    }

    // Entrance effect (fade-chars, slide-up, bounce-chars, reveal-mask, scale-in, rise-words)
    if (elapsedSec >= entranceTotalSec) {
        return AnimatedTextRender(fillText = fillBase, plainText = plainBase, strokeText = plainBase)
    }

    fun applyUnits(base: AnnotatedString, fallbackColor: Color): AnnotatedString = buildAnnotatedString {
        append(base)
        var pos = 0
        units.forEachIndexed { uIdx, unit ->
            val start = pos
            val end = pos + unit.length
            pos = end
            if (unit.isBlank() || start >= base.length) return@forEachIndexed
            val safeEnd = end.coerceAtMost(base.length)
            val frame = OimTextAnimator.entranceFrameAt(effect, elapsedSec, uIdx, stagger, delay)
            val markColor = base.spanStyles.lastOrNull {
                it.start <= start && it.end >= safeEnd && it.item.color != Color.Unspecified
            }?.item?.color ?: fallbackColor
            val unitColor = markColor.copy(alpha = (markColor.alpha * frame.opacity).coerceIn(0f, 1f))
            val shift = if (kotlin.math.abs(frame.translateYEm) > 0.01f) {
                BaselineShift((-frame.translateYEm.coerceIn(-1.2f, 1.2f) * 0.45f))
            } else null
            addStyle(SpanStyle(color = unitColor, baselineShift = shift), start, safeEnd)
        }
    }

    val midFrame = OimTextAnimator.entranceFrameAt(effect, elapsedSec, (units.size / 2).coerceAtLeast(0), stagger, delay)
    val boxScale = if (effect == "scale-in" || effect == "bounce-chars") midFrame.scale.coerceAtLeast(0.6f) else 1f
    return AnimatedTextRender(
        fillText = applyUnits(fillBase, baseTextColor),
        plainText = applyUnits(plainBase, baseTextColor),
        strokeText = applyUnits(plainBase, baseStrokeColor),
        clipToBox = (effect == "reveal-mask"),
        containerScale = boxScale
    )
}

@Composable
private fun OimCroppedImage(
    bitmap: ImageBitmap,
    fill: OimImageFill,
    contentDescription: String?,
    colorFilter: ColorFilter?,
    blurDp: Dp
) {
    val semanticMod = if (!contentDescription.isNullOrBlank()) {
        Modifier.semantics { this.contentDescription = contentDescription }
    } else Modifier
    val hasCrop = fill.cropX != null || fill.cropY != null || fill.cropZoom != 1f
    val cropXPct = (fill.cropX ?: 50f).coerceIn(0f, 100f)
    val cropYPct = (fill.cropY ?: 50f).coerceIn(0f, 100f)
    val zoom = fill.cropZoom.coerceAtLeast(0.1f)

    Canvas(
        modifier = semanticMod
            .fillMaxSize()
            .then(
                if (blurDp > 0.2.dp) {
                    Modifier.blur(radius = blurDp, edgeTreatment = BlurredEdgeTreatment.Unbounded)
                } else Modifier
            )
            .clipToBounds()
    ) {
        val imgW = bitmap.width.toFloat().coerceAtLeast(1f)
        val imgH = bitmap.height.toFloat().coerceAtLeast(1f)
        val (dw, dh) = when {
            hasCrop -> {
                val s = maxOf(size.width / imgW, size.height / imgH) * zoom
                (imgW * s) to (imgH * s)
            }
            fill.fit.equals("contain", ignoreCase = true) || fill.fit.equals("scale-down", ignoreCase = true) -> {
                val s = minOf(size.width / imgW, size.height / imgH)
                (imgW * s) to (imgH * s)
            }
            fill.fit.equals("fill", ignoreCase = true) -> size.width to size.height
            else -> {
                val s = maxOf(size.width / imgW, size.height / imgH)
                (imgW * s) to (imgH * s)
            }
        }
        val dx = (size.width - dw) * (cropXPct / 100f)
        val dy = (size.height - dh) * (cropYPct / 100f)

        withTransform({
            if (fill.flipX || fill.flipY) {
                scale(
                    scaleX = if (fill.flipX) -1f else 1f,
                    scaleY = if (fill.flipY) -1f else 1f,
                    pivot = Offset(size.width / 2f, size.height / 2f)
                )
            }
        }) {
            drawImage(
                image = bitmap,
                dstOffset = IntOffset(dx.roundToInt(), dy.roundToInt()),
                dstSize = IntSize(dw.roundToInt().coerceAtLeast(1), dh.roundToInt().coerceAtLeast(1)),
                alpha = fill.opacity,
                colorFilter = colorFilter
            )
        }
    }
}

private fun tintAnnotatedTextSilhouette(src: AnnotatedString, tint: Color): AnnotatedString {
    if (src.spanStyles.isEmpty()) return src
    return buildAnnotatedString {
        append(src.text)
        src.spanStyles.forEach { range ->
            val orig = range.item
            val mappedColor = if (orig.color != Color.Unspecified) {
                tint.copy(alpha = (tint.alpha * orig.color.alpha).coerceIn(0f, 1f))
            } else {
                Color.Unspecified
            }
            addStyle(orig.copy(color = mappedColor, background = Color.Transparent), range.start, range.end)
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawGeoShape(
    geoShape: String,
    svgPath: String?,
    svgPaths: List<OimSvgPathItem>,
    svgViewBox: String?,
    palette: Map<String, String>,
    fillColor: Color,
    strokeColor: Color,
    strokeWidthPx: Float,
    cornerRadiusPx: Float,
    cornerRadiiPx: FloatArray? = null,
    tintOverride: Color? = null
) {
    val vbParts = svgViewBox?.trim()?.split(Regex("[\\s,]+"))?.mapNotNull { it.toFloatOrNull() }
    val minX = vbParts?.getOrNull(0) ?: 0f
    val minY = vbParts?.getOrNull(1) ?: 0f

    if (svgPaths.isNotEmpty()) {
        val vbW = vbParts?.getOrNull(2)?.takeIf { it > 0f } ?: 24f
        val vbH = vbParts?.getOrNull(3)?.takeIf { it > 0f } ?: 24f
        val uniformScale = minOf(size.width / vbW, size.height / vbH)
        val offsetX = (size.width - vbW * uniformScale) / 2f
        val offsetY = (size.height - vbH * uniformScale) / 2f
        val androidMatrix = AndroidMatrix().apply {
            setTranslate(-minX, -minY)
            postScale(uniformScale, uniformScale)
            postTranslate(offsetX, offsetY)
        }
        val layerFillFallback = fillColor.takeIf { it.alpha > 0f } ?: strokeColor
        val layerStrokeFallback = strokeColor.takeIf { it.alpha > 0f } ?: fillColor
        val itemMatrix = AndroidMatrix()
        val matrixVals = FloatArray(9)

        svgPaths.forEach { item ->
            val parsed = runCatching { PathParser().parsePathString(item.d).toPath() }.getOrNull() ?: return@forEach
            val androidPath = parsed.asAndroidPath()
            itemMatrix.reset()
            val tr = item.transform
            if (tr != null && tr.size == 6) {
                itemMatrix.setValues(
                    floatArrayOf(
                        tr[0], tr[2], tr[4],
                        tr[1], tr[3], tr[5],
                        0f, 0f, 1f
                    )
                )
            }
            itemMatrix.postConcat(androidMatrix)
            androidPath.transform(itemMatrix)
            androidPath.fillType = if (item.fillRule.equals("evenodd", ignoreCase = true)) {
                android.graphics.Path.FillType.EVEN_ODD
            } else {
                android.graphics.Path.FillType.WINDING
            }
            val itemOpacity = item.opacity.coerceIn(0f, 1f)
            val baseFill = when {
                item.fill.equals("currentColor", ignoreCase = true) -> layerFillFallback
                !item.fill.isNullOrBlank() && !item.fill.equals("none", ignoreCase = true) ->
                    parseOimColor(item.fill, palette, Color.Transparent)
                else -> Color.Transparent
            }
            val baseStroke = when {
                item.stroke.equals("currentColor", ignoreCase = true) -> layerStrokeFallback
                !item.stroke.isNullOrBlank() && !item.stroke.equals("none", ignoreCase = true) ->
                    parseOimColor(item.stroke, palette, Color.Transparent)
                else -> Color.Transparent
            }
            val resolvedFill = if (tintOverride != null) {
                if (baseFill.alpha > 0f || baseStroke.alpha == 0f) {
                    tintOverride.copy(alpha = (tintOverride.alpha * itemOpacity).coerceIn(0f, 1f))
                } else {
                    Color.Transparent
                }
            } else {
                baseFill.copy(alpha = (baseFill.alpha * itemOpacity).coerceIn(0f, 1f))
            }
            if (resolvedFill.alpha > 0f) {
                drawPath(parsed, resolvedFill)
            }
            val resolvedStroke = if (tintOverride != null) {
                if (baseStroke.alpha > 0f) {
                    tintOverride.copy(alpha = (tintOverride.alpha * itemOpacity).coerceIn(0f, 1f))
                } else {
                    Color.Transparent
                }
            } else {
                baseStroke.copy(alpha = (baseStroke.alpha * itemOpacity).coerceIn(0f, 1f))
            }
            itemMatrix.getValues(matrixVals)
            val det = matrixVals[0] * matrixVals[4] - matrixVals[1] * matrixVals[3]
            val itemScale = sqrt(abs(det)).coerceAtLeast(0.01f)
            val pathStrokePx = (item.strokeWidth ?: 1f) * itemScale
            if (resolvedStroke.alpha > 0f && pathStrokePx > 0f) {
                val cap = when (item.cap?.lowercase()) {
                    "round" -> StrokeCap.Round
                    "square" -> StrokeCap.Square
                    else -> StrokeCap.Butt
                }
                val join = when (item.join?.lowercase()) {
                    "round" -> StrokeJoin.Round
                    "bevel" -> StrokeJoin.Bevel
                    else -> StrokeJoin.Miter
                }
                drawPath(
                    path = parsed,
                    color = resolvedStroke,
                    style = Stroke(width = pathStrokePx, cap = cap, join = join)
                )
            }
        }
        return
    }

    if (!svgPath.isNullOrBlank()) {
        val parsed = runCatching { PathParser().parsePathString(svgPath).toPath() }.getOrNull()
        if (parsed != null) {
            val vbW = vbParts?.getOrNull(2)?.takeIf { it > 0f } ?: 100f
            val vbH = vbParts?.getOrNull(3)?.takeIf { it > 0f } ?: 100f
            val androidMatrix = AndroidMatrix().apply {
                setTranslate(-minX, -minY)
                postScale(size.width / vbW, size.height / vbH)
            }
            parsed.asAndroidPath().transform(androidMatrix)
            if (fillColor != Color.Transparent) drawPath(parsed, fillColor)
            if (strokeColor != Color.Transparent && strokeWidthPx > 0f) {
                drawPath(parsed, strokeColor, style = Stroke(width = strokeWidthPx))
            }
            return
        }
    }

    when (geoShape.lowercase()) {
        "circle" -> {
            if (fillColor != Color.Transparent) drawOval(fillColor)
            if (strokeColor != Color.Transparent && strokeWidthPx > 0f) drawOval(strokeColor, style = Stroke(strokeWidthPx))
        }
        "pill" -> {
            val r = minOf(size.width, size.height) / 2f
            if (fillColor != Color.Transparent) drawRoundRect(fillColor, cornerRadius = CornerRadius(r, r))
            if (strokeColor != Color.Transparent && strokeWidthPx > 0f) {
                drawRoundRect(strokeColor, cornerRadius = CornerRadius(r, r), style = Stroke(strokeWidthPx))
            }
        }
        "triangle" -> {
            val p = Path().apply {
                moveTo(size.width / 2f, 0f)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            if (fillColor != Color.Transparent) drawPath(p, fillColor)
            if (strokeColor != Color.Transparent && strokeWidthPx > 0f) drawPath(p, strokeColor, style = Stroke(strokeWidthPx))
        }
        "diamond" -> {
            val p = Path().apply {
                moveTo(size.width / 2f, 0f)
                lineTo(size.width, size.height / 2f)
                lineTo(size.width / 2f, size.height)
                lineTo(0f, size.height / 2f)
                close()
            }
            if (fillColor != Color.Transparent) drawPath(p, fillColor)
            if (strokeColor != Color.Transparent && strokeWidthPx > 0f) drawPath(p, strokeColor, style = Stroke(strokeWidthPx))
        }
        "pentagon" -> drawRegularPolygon(5, fillColor, strokeColor, strokeWidthPx)
        "hexagon" -> drawRegularPolygon(6, fillColor, strokeColor, strokeWidthPx)
        "octagon" -> drawRegularPolygon(8, fillColor, strokeColor, strokeWidthPx)
        "star" -> drawStar(5, fillColor, strokeColor, strokeWidthPx)
        "line" -> {
            val lineColor = strokeColor.takeIf { it.alpha > 0f } ?: fillColor
            if (lineColor.alpha > 0f) {
                drawLine(
                    color = lineColor,
                    start = Offset(0f, size.height / 2f),
                    end = Offset(size.width, size.height / 2f),
                    strokeWidth = strokeWidthPx.coerceAtLeast(1f)
                )
            }
        }
        else -> {
            if (cornerRadiiPx != null && cornerRadiiPx.size == 4 && cornerRadiiPx.any { abs(it - cornerRadiiPx[0]) > 0.1f }) {
                val p = Path().apply {
                    addRoundRect(
                        RoundRect(
                            left = 0f,
                            top = 0f,
                            right = size.width,
                            bottom = size.height,
                            topLeftCornerRadius = CornerRadius(cornerRadiiPx[0], cornerRadiiPx[0]),
                            topRightCornerRadius = CornerRadius(cornerRadiiPx[1], cornerRadiiPx[1]),
                            bottomRightCornerRadius = CornerRadius(cornerRadiiPx[2], cornerRadiiPx[2]),
                            bottomLeftCornerRadius = CornerRadius(cornerRadiiPx[3], cornerRadiiPx[3])
                        )
                    )
                }
                if (fillColor != Color.Transparent) drawPath(p, fillColor)
                if (strokeColor != Color.Transparent && strokeWidthPx > 0f) {
                    drawPath(p, strokeColor, style = Stroke(strokeWidthPx))
                }
            } else {
                if (fillColor != Color.Transparent) {
                    drawRoundRect(fillColor, cornerRadius = CornerRadius(cornerRadiusPx, cornerRadiusPx))
                }
                if (strokeColor != Color.Transparent && strokeWidthPx > 0f) {
                    drawRoundRect(strokeColor, cornerRadius = CornerRadius(cornerRadiusPx, cornerRadiusPx), style = Stroke(strokeWidthPx))
                }
            }
        }
    }
}

private fun buildRegularPolygonPath(sides: Int, width: Float, height: Float): Path {
    val cx = width / 2f
    val cy = height / 2f
    val rx = width / 2f
    val ry = height / 2f
    return Path().apply {
        for (i in 0 until sides) {
            val angle = -PI / 2.0 + (2.0 * PI * i / sides)
            val x = cx + (rx * cos(angle)).toFloat()
            val y = cy + (ry * sin(angle)).toFloat()
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
}

private fun buildStarPath(points: Int, width: Float, height: Float): Path {
    val cx = width / 2f
    val cy = height / 2f
    val outerR = minOf(width, height) / 2f
    val innerR = outerR * 0.42f
    return Path().apply {
        for (i in 0 until points * 2) {
            val r = if (i % 2 == 0) outerR else innerR
            val angle = -PI / 2.0 + (PI * i / points)
            val x = cx + (r * cos(angle)).toFloat()
            val y = cy + (r * sin(angle)).toFloat()
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
}

private fun buildGeoClipShape(geoKindStr: String, cornerShape: RoundedCornerShape): Shape {
    // The core catalogue first, so the frame matches the web player's (CANONICAL: presetPath).
    if (presetSilhouette(geoKindStr.lowercase(), 100f, 100f) != null) {
        return GenericShape { size, _ -> presetSilhouette(geoKindStr.lowercase(), size.width, size.height)?.let { addPath(it) } }
    }
    return when (geoKindStr.lowercase()) {
        "circle" -> CircleShape
        "pill" -> RoundedCornerShape(50)
        "triangle" -> GenericShape { size, _ ->
            moveTo(size.width / 2f, 0f)
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        "diamond" -> GenericShape { size, _ ->
            moveTo(size.width / 2f, 0f)
            lineTo(size.width, size.height / 2f)
            lineTo(size.width / 2f, size.height)
            lineTo(0f, size.height / 2f)
            close()
        }
        "pentagon" -> GenericShape { size, _ -> addPath(buildRegularPolygonPath(5, size.width, size.height)) }
        "hexagon" -> GenericShape { size, _ -> addPath(buildRegularPolygonPath(6, size.width, size.height)) }
        "octagon" -> GenericShape { size, _ -> addPath(buildRegularPolygonPath(8, size.width, size.height)) }
        "star" -> GenericShape { size, _ -> addPath(buildStarPath(5, size.width, size.height)) }
        else -> cornerShape
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRegularPolygon(
    sides: Int,
    fillColor: Color,
    strokeColor: Color,
    strokeWidthPx: Float
) {
    val path = buildRegularPolygonPath(sides, size.width, size.height)
    if (fillColor != Color.Transparent) drawPath(path, fillColor)
    if (strokeColor != Color.Transparent && strokeWidthPx > 0f) drawPath(path, strokeColor, style = Stroke(strokeWidthPx))
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawStar(
    points: Int,
    fillColor: Color,
    strokeColor: Color,
    strokeWidthPx: Float
) {
    val path = buildStarPath(points, size.width, size.height)
    if (fillColor != Color.Transparent) drawPath(path, fillColor)
    if (strokeColor != Color.Transparent && strokeWidthPx > 0f) drawPath(path, strokeColor, style = Stroke(strokeWidthPx))
}

private fun buildCornerShape(
    radii: OimCornerRadii?,
    fallbackRatio: Float,
    canvasWidthPx: Float,
    canvasHeightPx: Float,
    naturalWidth: Int,
    density: androidx.compose.ui.unit.Density
): RoundedCornerShape {
    if (radii == null) {
        val dp = with(density) { (canvasWidthPx * fallbackRatio).toDp() }
        return RoundedCornerShape(dp)
    }
    fun toDp(dim: media.oim.sdk.model.OimDimension): Dp = with(density) {
        dim.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true).toDp()
    }
    return RoundedCornerShape(
        topStart = toDp(radii.topStart),
        topEnd = toDp(radii.topEnd),
        bottomEnd = toDp(radii.bottomEnd),
        bottomStart = toDp(radii.bottomStart)
    )
}

private fun buildComposeColorFilter(filter: OimFilterSpec?): ColorFilter? {
    if (filter == null) return null
    val hasColorAdj = filter.brightness != 1f || filter.contrast != 1f || filter.saturate != 1f
    if (!hasColorAdj) return null

    val matrix = ColorMatrix()
    if (filter.saturate != 1f) {
        val sat = ColorMatrix().apply { setToSaturation(filter.saturate.coerceAtLeast(0f)) }
        matrix.timesAssign(sat)
    }
    if (filter.brightness != 1f || filter.contrast != 1f) {
        val b = filter.brightness.coerceIn(0f, 3f)
        val c = filter.contrast.coerceIn(0f, 3f)
        val scale = b * c
        val translate = 127.5f * (1f - c) * b
        val bc = ColorMatrix(
            floatArrayOf(
                scale, 0f, 0f, 0f, translate,
                0f, scale, 0f, 0f, translate,
                0f, 0f, scale, 0f, translate,
                0f, 0f, 0f, 1f, 0f
            )
        )
        matrix.timesAssign(bc)
    }
    return ColorFilter.colorMatrix(matrix)
}

private val MARK_TAG_REGEX = Regex("^\\{(/?)([a-z][a-z0-9-]{0,23})\\}")

private fun buildMarkedAnnotatedString(
    rawText: String,
    marks: Map<String, OimTextMarkStyle>,
    palette: Map<String, String>,
    includeHighlightBackground: Boolean
): AnnotatedString {
    if (marks.isEmpty() || !rawText.contains('{')) return AnnotatedString(rawText)
    return buildAnnotatedString {
        var openMark: String? = null
        var i = 0
        fun emitText(s: String) {
            if (s.isEmpty()) return
            val style = openMark?.let { marks[it] }
            if (style == null) {
                append(s)
            } else {
                val fg = resolveSlotColor(style.colorRole, style.colorHex, palette, Color.Unspecified)
                val hl = if (includeHighlightBackground && (!style.highlightColorHex.isNullOrBlank() || !style.highlightColorRole.isNullOrBlank())) {
                    resolveSlotColor(style.highlightColorRole, style.highlightColorHex, palette, Color(0x59F59E0B))
                } else {
                    Color.Unspecified
                }
                pushStyle(
                    SpanStyle(
                        color = fg,
                        fontWeight = if (style.bold) FontWeight.Bold else null,
                        fontStyle = if (style.italic) FontStyle.Italic else null,
                        textDecoration = if (style.underline) TextDecoration.Underline else null,
                        background = hl
                    )
                )
                append(s)
                pop()
            }
        }

        while (i < rawText.length) {
            val ch = rawText[i]
            if (ch == '{' || ch == '}') {
                if (i + 1 < rawText.length && rawText[i + 1] == ch) {
                    emitText(ch.toString())
                    i += 2
                    continue
                }
                if (ch == '{') {
                    val m = MARK_TAG_REGEX.find(rawText.substring(i))
                    if (m != null) {
                        val isClose = m.groupValues[1].isNotEmpty()
                        val name = m.groupValues[2]
                        if (name in marks) {
                            if (!isClose && openMark == null) {
                                openMark = name
                                i += m.value.length
                                continue
                            } else if (isClose && openMark == name) {
                                openMark = null
                                i += m.value.length
                                continue
                            }
                        }
                    }
                }
                emitText(ch.toString())
                i += 1
            } else {
                var j = i
                while (j < rawText.length && rawText[j] != '{' && rawText[j] != '}') j++
                emitText(rawText.substring(i, j))
                i = j
            }
        }
    }
}

private val DECODE_LOCK = Any()

private fun decodeDataUriBitmap(content: String): ImageBitmap? {
    if (!content.startsWith("data:image/")) return null
    val commaIdx = content.indexOf(',')
    if (commaIdx < 0) return null
    return try {
        val b64 = content.substring(commaIdx + 1)
        val bytes = Base64Codec.decode(b64)
        // One decode at a time: concurrent decodes come back empty under Robolectric's native graphics.
        synchronized(DECODE_LOCK) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }?.asImageBitmap()
    } catch (_: Exception) {
        null
    }
}

private fun resolveSlotColor(
    role: String?,
    rawValue: String?,
    palette: Map<String, String>,
    fallback: Color
): Color {
    if (!role.isNullOrBlank()) {
        palette[role]?.let { roleColor ->
            return parseOimColor(roleColor, palette, fallback)
        }
    }
    return parseOimColor(rawValue, palette, fallback)
}

private fun parseOimColor(raw: String?, palette: Map<String, String>, fallback: Color): Color =
    resolveOimColorString(raw, palette, fallback)

@Composable
private fun OimPixelPerfectGridOverlay(
    layers: List<OimLayer>,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val stepX = size.width / 10f
        val stepY = size.height / 10f
        val minorColor = Color(0x3322D3EE)
        val majorColor = Color(0x8822D3EE)

        for (i in 1..9) {
            val isCenter = i == 5
            drawLine(
                color = if (isCenter) majorColor else minorColor,
                start = Offset(stepX * i, 0f),
                end = Offset(stepX * i, size.height),
                strokeWidth = if (isCenter) 2f else 1f
            )
            drawLine(
                color = if (isCenter) majorColor else minorColor,
                start = Offset(0f, stepY * i),
                end = Offset(size.width, stepY * i),
                strokeWidth = if (isCenter) 2f else 1f
            )
        }

        layers.forEach { layer ->
            val cx = (layer.x.toFloat() / 100f) * size.width
            val cy = (layer.y.toFloat() / 100f) * size.height
            drawLine(OimAmberAccent, Offset(cx - 8f, cy), Offset(cx + 8f, cy), strokeWidth = 2f)
            drawLine(OimAmberAccent, Offset(cx, cy - 8f), Offset(cx, cy + 8f), strokeWidth = 2f)
            drawCircle(OimAmberAccent, radius = 3.5f, center = Offset(cx, cy))
        }
    }
}

@Composable
private fun OimRefusedSecurityGate(
    reason: String,
    computedHash: String,
    declaredHash: String,
    modifier: Modifier = Modifier
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF1F0911), Color(0xFF12070D), Color(0xFF0E1015))
                )
            )
            .border(1.5.dp, OimCrimsonRefusal.copy(alpha = 0.85f), RoundedCornerShape(20.dp))
            .padding(20.dp)
            .testTag("oim_refused_security_gate")
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = OimCrimsonRefusal.copy(alpha = 0.18f),
                border = BorderStroke(1.dp, OimCrimsonRefusal.copy(alpha = 0.6f))
            ) {
                Icon(
                    imageVector = Icons.Default.GppBad,
                    contentDescription = "OIM file refused: it was tampered with",
                    tint = OimCrimsonRefusal,
                    modifier = Modifier
                        .padding(14.dp)
                        .size(34.dp)
                )
            }
            Text(
                text = "Renderizado Bloqueado (is_refused = true)",
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFFFECDD3),
                textAlign = TextAlign.Center
            )
            Text(
                text = reason,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFFDA4AF),
                textAlign = TextAlign.Center
            )
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0x99090C12),
                border = BorderStroke(1.dp, OimCrimsonRefusal.copy(alpha = 0.35f))
            ) {
                Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text(
                        text = "Esperado:  ${declaredHash.take(24)}…",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF94A3B8)
                    )
                    Text(
                        text = "Calculado: ${computedHash.take(24)}…",
                        style = MaterialTheme.typography.labelSmall,
                        color = OimCrimsonRefusal
                    )
                }
            }
        }
    }
}

/**
 * A window mask (CANONICAL_SPEC_2 3.11): its fill covers the whole canvas except its own
 * silhouette, which stays a window onto the layers below; its stroke rings the silhouette.
 * Same result as applyWindowMask in @oim-media/scene.
 */
@Composable
private fun OimWindowMask(
    layer: OimLayer,
    naturalWidth: Int,
    naturalHeight: Int,
    canvasWidthPx: Float,
    canvasHeightPx: Float,
    palette: Map<String, String>
) {
    val scale = canvasWidthPx / naturalWidth.coerceAtLeast(1)
    val left = (layer.x / 100.0 * canvasWidthPx).toFloat()
    val top = (layer.y / 100.0 * canvasHeightPx).toFloat()
    val w = layer.widthDim?.resolvePx(canvasWidthPx, canvasHeightPx, naturalWidth, isHorizontal = true) ?: 0f
    val h = layer.heightDim?.resolvePx(canvasWidthPx, canvasHeightPx, naturalHeight, isHorizontal = false) ?: 0f
    if (w <= 0f || h <= 0f) return
    val fill = resolveSlotColor(layer.style.fillColorRole, layer.style.fillColorHex, palette, Color.Transparent)
    val stroke = resolveSlotColor(layer.style.strokeColorRole, layer.style.borderColorHex, palette, Color.Transparent)
    val strokeWidth = (layer.style.strokeWidthPx ?: 0f) * scale
    val window = androidx.compose.ui.geometry.Rect(left, top, left + w, top + h)
    val silhouette = maskSilhouette(layer.style.geoShape, window)
    // The fill (color, gradient or pattern) spans the canvas, clipped to everything but the window.
    val outside = androidx.compose.foundation.shape.GenericShape { size, _ ->
        fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
        addRect(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height))
        addPath(silhouette)
    }
    Box(Modifier.fillMaxSize().clip(outside).background(fill)) {
        layer.style.gradientFill?.let { OimGradientBox(gradient = it, palette = palette, modifier = Modifier.fillMaxSize()) }
        layer.style.patternFill?.let {
            OimPatternCanvas(pattern = it, palette = palette, canvasWidthPx = canvasWidthPx, naturalWidth = naturalWidth, modifier = Modifier.fillMaxSize())
        }
    }
    if (strokeWidth > 0f) {
        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
            drawPath(silhouette, stroke, style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeWidth))
        }
    }
}

/** Shows outside the mask's box and inside its figure, the player's evenodd clip path. */
private fun cutoutShape(mask: OimLayer, naturalWidth: Int, naturalHeight: Int) = androidx.compose.foundation.shape.GenericShape { size, _ ->
    val left = (mask.x / 100.0 * size.width).toFloat()
    val top = (mask.y / 100.0 * size.height).toFloat()
    val w = mask.widthDim?.resolvePx(size.width, size.height, naturalWidth, isHorizontal = true) ?: 0f
    val h = mask.heightDim?.resolvePx(size.width, size.height, naturalHeight, isHorizontal = false) ?: 0f
    val box = androidx.compose.ui.geometry.Rect(left, top, left + w, top + h)
    fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
    addRect(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height))
    addRect(box)
    addPath(maskSilhouette(mask.style.geoShape, box))
}

/**
 * A single unpainted path is a custom frame (geometryOutline in @oim-media/core): its
 * viewBox is stretched over the box, like the web's preserveAspectRatio="none".
 */
private fun customFrameShape(paths: List<OimSvgPathItem>, viewBox: String?): Shape? {
    if (customFrameOutline(paths, viewBox, 1f, 1f) == null) return null
    return GenericShape { size, _ -> customFrameOutline(paths, viewBox, size.width, size.height)?.let { addPath(it) } }
}

private fun customFrameOutline(paths: List<OimSvgPathItem>, viewBox: String?, w: Float, h: Float): androidx.compose.ui.graphics.Path? {
    val only = paths.singleOrNull()?.takeIf { it.fill == null && it.stroke == null && it.transform == null } ?: return null
    val vb = viewBox?.trim()?.split(Regex("[\\s,]+"))?.mapNotNull { it.toFloatOrNull() }?.takeIf { it.size == 4 && it[2] > 0f && it[3] > 0f } ?: return null
    return PathParser().parsePathString(only.d).toPath().also {
        it.asAndroidPath().transform(AndroidMatrix().apply {
            setTranslate(-vb[0], -vb[1])
            postScale(w / vb[2], h / vb[3])
        })
    }
}

private fun boxShape(layer: OimLayer, naturalWidth: Int, naturalHeight: Int) = androidx.compose.foundation.shape.GenericShape { size, _ ->
    val left = (layer.x / 100.0 * size.width).toFloat()
    val top = (layer.y / 100.0 * size.height).toFloat()
    val w = layer.widthDim?.resolvePx(size.width, size.height, naturalWidth, isHorizontal = true) ?: 0f
    val h = layer.heightDim?.resolvePx(size.width, size.height, naturalHeight, isHorizontal = false) ?: 0f
    // filterClipPath in @oim-media/core: a preset backdrop shows through the mask outline of its figure.
    val box = androidx.compose.ui.geometry.Rect(left, top, left + w, top + h)
    val name = layer.style.geoShape
    if (name == null || name == "rectangle" || name == "line" || name == "scribble") addRect(box) else addPath(maskSilhouette(name, box))
}

/** DUOTONE_COLORS of @oim-media/scene: luminance (0.33 per channel) mapped from shadows to lights, in sRGB. */
private val DUOTONE_SHADOWS = floatArrayOf(0x1e / 255f, 0x1b / 255f, 0x4b / 255f)
private val DUOTONE_LIGHTS = floatArrayOf(0xfb / 255f, 0xbf / 255f, 0x24 / 255f)

private fun duotoneMatrix(): androidx.compose.ui.graphics.ColorMatrix {
    // The two-stop table is linear in the grey, so one colour matrix draws the whole filter.
    val m = FloatArray(20)
    for (c in 0..2) {
        val k = (DUOTONE_LIGHTS[c] - DUOTONE_SHADOWS[c]) * 0.33f
        m[c * 5] = k; m[c * 5 + 1] = k; m[c * 5 + 2] = k; m[c * 5 + 4] = DUOTONE_SHADOWS[c] * 255f
    }
    m[18] = 1f
    return androidx.compose.ui.graphics.ColorMatrix(m)
}

private fun Modifier.colorMatrixLayer(matrix: androidx.compose.ui.graphics.ColorMatrix): Modifier = drawWithContent {
    val paint = androidx.compose.ui.graphics.Paint().apply {
        colorFilter = androidx.compose.ui.graphics.ColorFilter.colorMatrix(matrix)
    }
    drawContext.canvas.saveLayer(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height), paint)
    drawContent()
    drawContext.canvas.restore()
}
