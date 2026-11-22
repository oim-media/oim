/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.FileOpen
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import media.oim.sdk.network.OimLoadError
import media.oim.sdk.network.OimLoadState

private val OimAmberWarning = Color(0xFFF59E0B)
private val OimCrimsonError = Color(0xFFF43F5E)

/**
 * Resilient Jetpack Compose SDK component wrapping [OimPlayerView] with complete loading,
 * offline degraded cache fallback, and typed error recovery states.
 */
@Composable
fun OimAsyncPlayer(
    loadState: OimLoadState,
    language: String,
    modifier: Modifier = Modifier,
    selectedPalette: String? = null,
    hiddenLayerIds: Set<String> = emptySet(),
    selectedLayerId: String? = null,
    showPixelGrid: Boolean = false,
    showPerformanceOverlay: Boolean = false,
    zoomState: OimZoomState? = null,
    parallaxEnabled: Boolean = true,
    replayTrigger: Int = 0,
    cornerRadius: Dp = 20.dp,
    showFrameBorder: Boolean = true,
    externalBlurDp: Dp = 0.dp,
    onSelectLayer: (String?) -> Unit = {},
    /**
     * What the reader sees while the file loads, instead of a spinner: typically its thumbnail, blurred.
     * When the file is ready it fades out over the real render.
     */
    placeholder: (@Composable () -> Unit)? = null,
    onRetry: () -> Unit = {},
    onOpenLibrary: () -> Unit = {},
    onOpenLocalFile: () -> Unit = {}
) {
    when (loadState) {
        is OimLoadState.Idle -> {
            Box(
                contentAlignment = Alignment.Center,
                modifier = modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(20.dp))
                    .padding(24.dp)
                    .testTag("oim_async_idle_box")
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PhotoLibrary,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(36.dp)
                    )
                    Text(
                        text = "No OIM file open",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "Pick a piece from the oim.media library, open a local .oim.png or paste a direct URL.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = onOpenLibrary,
                            modifier = Modifier.testTag("idle_open_library_button")
                        ) {
                            Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Biblioteca")
                        }
                        OutlinedButton(
                            onClick = onOpenLocalFile,
                            modifier = Modifier.testTag("idle_open_local_button")
                        ) {
                            Icon(Icons.Default.FileOpen, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Abrir .oim")
                        }
                    }
                }
            }
        }

        is OimLoadState.Loading -> if (placeholder != null) {
            Box(modifier.testTag("oim_async_loading_box")) { placeholder() }
        } else {
            Box(
                contentAlignment = Alignment.Center,
                modifier = modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(20.dp))
                    .padding(20.dp)
                    .testTag("oim_async_loading_box")
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Text(
                        text = loadState.stage.label,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (loadState.maxAttempts > 1) {
                        Text(
                            text = "Attempt ${loadState.attempt} of ${loadState.maxAttempts}" +
                                (loadState.lastRetryReason?.let { " · $it" } ?: ""),
                            style = MaterialTheme.typography.labelSmall,
                            color = OimAmberWarning,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }

        is OimLoadState.Success -> Box(modifier, propagateMinConstraints = true) {
            OimPlayerView(
                asset = loadState.asset,
                language = language,
                selectedPalette = selectedPalette,
                hiddenLayerIds = hiddenLayerIds,
                selectedLayerId = selectedLayerId,
                showPixelGrid = showPixelGrid,
                showPerformanceOverlay = showPerformanceOverlay,
                zoomState = zoomState,
                parallaxEnabled = parallaxEnabled,
                replayTrigger = replayTrigger,
                cornerRadius = cornerRadius,
                showFrameBorder = showFrameBorder,
                externalBlurDp = externalBlurDp,
                onSelectLayer = onSelectLayer
            )
            if (placeholder != null) {
                // The thumbnail fades out over the render: alpha only, so the blur under it is drawn once, not per frame.
                var covering by remember(loadState.asset) { mutableStateOf(true) }
                LaunchedEffect(loadState.asset) { covering = false }
                val alpha by animateFloatAsState(if (covering) 1f else 0f, tween(350), label = "oim-placeholder")
                if (alpha > 0f) Box(Modifier.matchParentSize().graphicsLayer { this.alpha = alpha }) { placeholder() }
            }
        }

        is OimLoadState.DegradedFromCache -> {
            Column(
                modifier = modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = OimAmberWarning.copy(alpha = 0.14f),
                    border = BorderStroke(1.dp, OimAmberWarning.copy(alpha = 0.55f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("oim_degraded_cache_banner")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudOff,
                            contentDescription = "Offline mode, from cache",
                            tint = OimAmberWarning,
                            modifier = Modifier.size(18.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Fallback offline · ${loadState.cacheSource.label}",
                                style = MaterialTheme.typography.labelLarge,
                                color = OimAmberWarning
                            )
                            Text(
                                text = loadState.networkError.technicalDetail,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        TextButton(
                            onClick = onRetry,
                            modifier = Modifier.testTag("oim_degraded_retry_button")
                        ) {
                            Text("Reintentar")
                        }
                    }
                }
                OimPlayerView(
                    asset = loadState.asset,
                    language = language,
                    selectedPalette = selectedPalette,
                    hiddenLayerIds = hiddenLayerIds,
                    selectedLayerId = selectedLayerId,
                    showPixelGrid = showPixelGrid,
                    showPerformanceOverlay = showPerformanceOverlay,
                    zoomState = zoomState,
                    parallaxEnabled = parallaxEnabled,
                    replayTrigger = replayTrigger,
                    cornerRadius = cornerRadius,
                    showFrameBorder = showFrameBorder,
                    externalBlurDp = externalBlurDp,
                    onSelectLayer = onSelectLayer
                )
            }
        }

        is OimLoadState.Failure -> {
            val err = loadState.error
            val accent = when (err) {
                is OimLoadError.NetworkUnavailable,
                is OimLoadError.Timeout,
                is OimLoadError.IncompleteStream -> OimAmberWarning
                else -> OimCrimsonError
            }
            val icon = when (err) {
                is OimLoadError.NetworkUnavailable -> Icons.Default.CloudOff
                is OimLoadError.CorruptedPayload,
                is OimLoadError.IncompleteStream -> Icons.Default.BrokenImage
                else -> Icons.Default.Warning
            }

            Box(
                contentAlignment = Alignment.Center,
                modifier = modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF17131D), Color(0xFF0E121B), Color(0xFF0E1015))
                        )
                    )
                    .border(1.5.dp, accent.copy(alpha = 0.7f), RoundedCornerShape(20.dp))
                    .padding(20.dp)
                    .testTag("oim_async_failure_card")
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = CircleShape,
                        color = accent.copy(alpha = 0.16f),
                        border = BorderStroke(1.dp, accent.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = err.userTitle,
                            tint = accent,
                            modifier = Modifier
                                .padding(12.dp)
                                .size(30.dp)
                        )
                    }
                    Text(
                        text = err.userTitle,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFF8FAFC),
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = err.technicalDetail,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFCBD5E1),
                        textAlign = TextAlign.Center
                    )
                    if (loadState.attemptsUsed > 1) {
                        Text(
                            text = "Intentos realizados: ${loadState.attemptsUsed}",
                            style = MaterialTheme.typography.labelSmall,
                            color = accent
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (err.isRetryable) {
                            Button(
                                onClick = onRetry,
                                colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color(0xFF0E1015)),
                                modifier = Modifier.testTag("oim_failure_retry_button")
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Reintentar")
                            }
                        }
                        OutlinedButton(
                            onClick = onOpenLibrary,
                            modifier = Modifier.testTag("oim_failure_library_button")
                        ) {
                            Text("Ir a Biblioteca")
                        }
                    }
                }
            }
        }
    }
}
