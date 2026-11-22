/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.GppBad
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import media.oim.viewer.R
import media.oim.viewer.ui.OimStudioUiState
import media.oim.viewer.ui.components.OimBrandMark
import media.oim.viewer.ui.theme.AmberPrism
import media.oim.viewer.ui.theme.CrimsonTamper
import media.oim.viewer.ui.theme.EmeraldSeal
import media.oim.sdk.cache.OimCachePriority
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.SecurityStatus
import media.oim.sdk.network.OimLoadState
import media.oim.sdk.ui.OimAsyncPlayer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    state: OimStudioUiState,
    onOpenLibrary: () -> Unit,
    onOpenLocalFile: () -> Unit,
    onLoadRemoteUrl: (String) -> Unit,
    onExportOim: () -> Unit,
    onSelectLanguage: (String) -> Unit,
    onSelectPalette: (String?) -> Unit,
    onReplayAnimations: () -> Unit,
    onSelectLayer: (String?) -> Unit,
    onToggleLayerVisibility: (String) -> Unit,
    onToggleGrid: () -> Unit,
    onTogglePerformance: () -> Unit,
    onToggleParallax: () -> Unit,
    onRetryLoad: () -> Unit,
    onTogglePinCritical: (String, Boolean) -> Unit,
    onClearAllCaches: () -> Unit,
    modifier: Modifier = Modifier
) {
    var chromeVisible by remember { mutableStateOf(true) }
    var showOverflowMenu by remember { mutableStateOf(false) }
    var showLanguageMenu by remember { mutableStateOf(false) }
    var showPaletteMenu by remember { mutableStateOf(false) }
    var showUrlDialog by remember { mutableStateOf(false) }
    var showInspectorSheet by remember { mutableStateOf(false) }
    var urlDraft by remember { mutableStateOf("https://oim.media/") }

    val asset = state.activeAsset
    val doc = asset?.document
    val activeKey = state.activeRequestKey
    val isPinnedCritical = remember(state.cacheStats, activeKey) {
        activeKey != null && state.cacheStats?.entries?.any {
            it.key == activeKey && it.priority == OimCachePriority.CRITICAL
        } == true
    }

    // Calm empty state when user visits Visor tab without an open file
    if (state.loadState is OimLoadState.Idle && asset == null) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(24.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OimBrandMark(
                    size = 52.dp,
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.88f)
                )
                Text(
                    text = stringResource(R.string.viewer_title),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = stringResource(R.string.viewer_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = onOpenLocalFile,
                        modifier = Modifier.testTag("idle_open_local_button")
                    ) {
                        Icon(Icons.Outlined.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(stringResource(R.string.open_file))
                    }
                    OutlinedButton(
                        onClick = onOpenLibrary,
                        modifier = Modifier.testTag("idle_open_library_button")
                    ) {
                        Text(stringResource(R.string.gallery))
                    }
                }
                TextButton(onClick = { showUrlDialog = true }) {
                    Text(stringResource(R.string.open_from_url))
                }
            }
        }
    } else {
        // Google Photos-style full-screen immersive viewer
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black)
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { chromeVisible = !chromeVisible })
                }
        ) {
            // Centered OIM Stage (borderless edge-to-edge on pure black, matching Google Photos)
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                OimAsyncPlayer(
                    loadState = state.loadState,
                    language = state.selectedLanguage,
                    selectedPalette = state.selectedPalette,
                    hiddenLayerIds = state.hiddenLayerIds,
                    selectedLayerId = state.selectedLayerId,
                    showPixelGrid = state.showPixelGrid,
                    showPerformanceOverlay = state.showPerformance,
                    parallaxEnabled = state.parallaxEnabled,
                    replayTrigger = state.replayTrigger,
                    cornerRadius = 0.dp,
                    showFrameBorder = false,
                    externalBlurDp = if (showLanguageMenu || showPaletteMenu) 6.dp else 0.dp,
                    onSelectLayer = { layerId ->
                        onSelectLayer(layerId)
                        if (layerId == null) {
                            chromeVisible = !chromeVisible
                        }
                    },
                    onRetry = onRetryLoad,
                    onOpenLibrary = onOpenLibrary,
                    onOpenLocalFile = onOpenLocalFile
                )
            }

            // Top translucent bar (Back + Title + Security Shield + Info + More menu)
            AnimatedVisibility(
                visible = chromeVisible,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.align(Alignment.TopCenter)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xCC000000), Color(0x66000000), Color.Transparent)
                            )
                        )
                        .windowInsetsPadding(WindowInsets.statusBars)
                        .padding(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    IconButton(
                        onClick = onOpenLibrary,
                        modifier = Modifier.testTag("viewer_back_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = stringResource(R.string.nav_library),
                            tint = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    if (asset != null) {
                        val (secIcon, secTint) = securityIconAndTint(asset.verification.status)
                        IconButton(
                            onClick = { showInspectorSheet = true },
                            modifier = Modifier.testTag("security_status_banner")
                        ) {
                            Icon(
                                imageVector = secIcon,
                                contentDescription = stringResource(R.string.inspector_title),
                                tint = secTint
                            )
                        }
                        IconButton(
                            onClick = { showInspectorSheet = true },
                            modifier = Modifier.testTag("open_inspector_sheet_button")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Info,
                                contentDescription = stringResource(R.string.inspector_title),
                                tint = Color.White
                            )
                        }
                    }

                    Box {
                        IconButton(
                            onClick = { showOverflowMenu = true },
                            modifier = Modifier.testTag("viewer_more_button")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.MoreVert,
                                contentDescription = stringResource(R.string.more_options),
                                tint = Color.White
                            )
                        }
                        DropdownMenu(
                            expanded = showOverflowMenu,
                            onDismissRequest = { showOverflowMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.open_oim)) },
                                leadingIcon = { Icon(Icons.Outlined.AddPhotoAlternate, contentDescription = null) },
                                onClick = {
                                    showOverflowMenu = false
                                    onOpenLocalFile()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.open_from_url)) },
                                leadingIcon = { Icon(Icons.Outlined.CloudDownload, contentDescription = null) },
                                onClick = {
                                    showOverflowMenu = false
                                    showUrlDialog = true
                                }
                            )
                            if (asset != null) {
                                DropdownMenuItem(
                                    text = { Text("Parallax") },
                                    trailingIcon = {
                                        if (state.parallaxEnabled) Icon(Icons.Outlined.Check, contentDescription = null)
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        onToggleParallax()
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.grid_100)) },
                                    trailingIcon = {
                                        if (state.showPixelGrid) Icon(Icons.Outlined.Check, contentDescription = null)
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        onToggleGrid()
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.performance_overlay)) },
                                    trailingIcon = {
                                        if (state.showPerformance) Icon(Icons.Outlined.Check, contentDescription = null)
                                    },
                                    onClick = {
                                        showOverflowMenu = false
                                        onTogglePerformance()
                                    }
                                )
                                if (activeKey != null && !asset.verification.isRefused) {
                                    DropdownMenuItem(
                                        text = { Text(if (isPinnedCritical) stringResource(R.string.unpin_offline) else stringResource(R.string.pin_offline)) },
                                        trailingIcon = {
                                            if (isPinnedCritical) Icon(Icons.Outlined.Check, contentDescription = null)
                                        },
                                        onClick = {
                                            showOverflowMenu = false
                                            onTogglePinCritical(activeKey, !isPinnedCritical)
                                        }
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.save_oim_png)) },
                                    leadingIcon = { Icon(Icons.Outlined.SaveAlt, contentDescription = null) },
                                    onClick = {
                                        showOverflowMenu = false
                                        onExportOim()
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Bottom translucent controls (Language pills + Palette pills + Replay + Open file)
            AnimatedVisibility(
                visible = chromeVisible && doc != null,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.align(Alignment.BottomCenter)
            ) {
                if (doc != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, Color(0x88000000), Color(0xD9000000))
                                )
                            )
                            .windowInsetsPadding(WindowInsets.navigationBars)
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (doc.languages.size > 1) {
                                Box {
                                    ViewerSelectorPill(
                                        icon = Icons.Outlined.Language,
                                        iconContentDescription = stringResource(R.string.language),
                                        label = state.selectedLanguage.uppercase(),
                                        onClick = { showLanguageMenu = true },
                                        modifier = Modifier.testTag("viewer_language_selector")
                                    )
                                    DropdownMenu(
                                        expanded = showLanguageMenu,
                                        onDismissRequest = { showLanguageMenu = false }
                                    ) {
                                        doc.languages.forEach { lang ->
                                            val selected = state.selectedLanguage.equals(lang, ignoreCase = true)
                                            DropdownMenuItem(
                                                text = { Text(lang.uppercase()) },
                                                onClick = {
                                                    showLanguageMenu = false
                                                    onSelectLanguage(lang)
                                                },
                                                trailingIcon = if (selected) {
                                                    { Icon(Icons.Outlined.Check, contentDescription = null) }
                                                } else null,
                                                modifier = Modifier.testTag("lang_chip_$lang")
                                            )
                                        }
                                    }
                                }
                            }
                            if (doc.palettes.isNotEmpty()) {
                                Box {
                                    ViewerSelectorPill(
                                        icon = Icons.Outlined.Palette,
                                        iconContentDescription = stringResource(R.string.theme),
                                        label = state.selectedPalette ?: stringResource(R.string.theme),
                                        onClick = { showPaletteMenu = true },
                                        modifier = Modifier.testTag("viewer_palette_selector")
                                    )
                                    DropdownMenu(
                                        expanded = showPaletteMenu,
                                        onDismissRequest = { showPaletteMenu = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("Auto") },
                                            onClick = {
                                                showPaletteMenu = false
                                                onSelectPalette(null)
                                            },
                                            trailingIcon = if (state.selectedPalette == null) {
                                                { Icon(Icons.Outlined.Check, contentDescription = null) }
                                            } else null
                                        )
                                        doc.palettes.keys.forEach { paletteName ->
                                            val selected = state.selectedPalette == paletteName
                                            DropdownMenuItem(
                                                text = { Text(paletteName) },
                                                onClick = {
                                                    showPaletteMenu = false
                                                    onSelectPalette(paletteName)
                                                },
                                                trailingIcon = if (selected) {
                                                    { Icon(Icons.Outlined.Check, contentDescription = null) }
                                                } else null,
                                                modifier = Modifier.testTag("palette_chip_$paletteName")
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            IconButton(
                                onClick = onReplayAnimations,
                                modifier = Modifier.testTag("replay_oim_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Replay,
                                    contentDescription = "Reiniciar animaciones",
                                    tint = Color.White
                                )
                            }
                            IconButton(
                                onClick = onOpenLocalFile,
                                modifier = Modifier.testTag("open_local_oim_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.AddPhotoAlternate,
                                    contentDescription = stringResource(R.string.action_open_local),
                                    tint = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showUrlDialog) {
        AlertDialog(
            onDismissRequest = { showUrlDialog = false },
            title = { Text(stringResource(R.string.url_dialog_title)) },
            text = {
                OutlinedTextField(
                    value = urlDraft,
                    onValueChange = { urlDraft = it },
                    singleLine = true,
                    placeholder = { Text(stringResource(R.string.url_dialog_hint)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("remote_url_input")
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showUrlDialog = false
                        onLoadRemoteUrl(urlDraft)
                    },
                    modifier = Modifier.testTag("confirm_url_download_button")
                ) {
                    Text(stringResource(R.string.url_dialog_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showUrlDialog = false }) {
                    Text(stringResource(R.string.url_dialog_cancel))
                }
            }
        )
    }

    // Technical Details, Verification, Layers & Cache Inspector Bottom Sheet
    if (showInspectorSheet && asset != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(
            onDismissRequest = { showInspectorSheet = false },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (doc != null) {
                    val resolvedTitle = OimCanonicalizerAndVerifier.resolveContent(
                        doc.title, state.selectedLanguage, doc.defaultLanguage
                    ).text
                    val resolvedDesc = OimCanonicalizerAndVerifier.resolveContent(
                        doc.description, state.selectedLanguage, doc.defaultLanguage
                    ).text
                    Text(
                        text = resolvedTitle.ifBlank { asset.sourceLabel },
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (resolvedDesc.isNotBlank()) {
                        Text(
                            text = resolvedDesc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                HorizontalDivider()

                val v = asset.verification
                AuditLine(stringResource(R.string.audit_verification), v.status.name)
                AuditLine(stringResource(R.string.audit_seal), if (v.imageHashMatches) stringResource(R.string.audit_valid_m) else stringResource(R.string.audit_no_seal))
                AuditLine(stringResource(R.string.audit_signature), if (v.signatureValid) stringResource(R.string.audit_valid_f) else stringResource(R.string.audit_not_verified))
                AuditLine(stringResource(R.string.audit_reedit), v.effectiveReeditPermission.wireName)
                if (doc != null) {
                    AuditLine(stringResource(R.string.audit_resolution), "${doc.canvas.width} × ${doc.canvas.height}")
                    AuditLine(stringResource(R.string.audit_contract), doc.contractVersion)
                }
                AuditLine(stringResource(R.string.audit_decode), String.format("%.2f ms", asset.telemetry.totalMs))

                Text(
                    text = v.reason,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (doc != null && doc.layers.isNotEmpty()) {
                    HorizontalDivider()
                    Text(
                        text = "Capas (${doc.layers.size})",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    doc.layers.forEach { layer ->
                        val isHidden = layer.id in state.hiddenLayerIds
                        val resolved = OimCanonicalizerAndVerifier.resolveContent(
                            layer.content, state.selectedLanguage, doc.defaultLanguage
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${layer.name ?: layer.id} (${layer.rawType})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = resolved.text.ifBlank { "(visual)" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            IconButton(
                                onClick = { onToggleLayerVisibility(layer.id) },
                                modifier = Modifier.testTag("toggle_layer_vis_${layer.id}")
                            ) {
                                Icon(
                                    imageVector = if (isHidden) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                    contentDescription = if (isHidden) "Mostrar capa" else "Ocultar capa",
                                    tint = if (isHidden) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }

                HorizontalDivider()
                Text(
                    text = "Chunks PNG (${asset.chunks.size})",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
                asset.chunks.forEach { chunk ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = buildString {
                                append(chunk.type)
                                if (chunk.keyword != null) append(" [${chunk.keyword}]")
                                if (chunk.isWinningOimChunk) append(" *")
                            },
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "${chunk.lengthBytes} B · ${if (chunk.crcValid) "OK" else "ERR"}",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (chunk.crcValid) EmeraldSeal else CrimsonTamper
                        )
                    }
                }

                state.cacheStats?.let { stats ->
                    HorizontalDivider()
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = stringResource(R.string.local_cache),
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "L1 ${stats.l1UsedBytes / 1024} KB · L2 ${stats.l2UsedBytes / 1024} KB",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        OutlinedButton(
                            onClick = onClearAllCaches,
                            modifier = Modifier.testTag("sheet_clear_cache_button")
                        ) {
                            Icon(Icons.Outlined.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Limpiar")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun ViewerSelectorPill(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconContentDescription: String,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = Color(0x8814161D),
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = iconContentDescription,
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                color = Color.White
            )
            Icon(
                imageVector = Icons.Outlined.KeyboardArrowDown,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.8f),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun AuditLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

private fun securityIconAndTint(status: SecurityStatus) = when (status) {
    SecurityStatus.VERIFIED_TRUSTED,
    SecurityStatus.VERIFIED_SELF_SIGNED -> Icons.Outlined.VerifiedUser to EmeraldSeal
    SecurityStatus.IMAGE_UNSEALED,
    SecurityStatus.UNSIGNED,
    SecurityStatus.UNKNOWN_KEY,
    SecurityStatus.EXPIRED_KEY -> Icons.Outlined.Warning to AmberPrism
    SecurityStatus.INVALID_SIGNATURE,
    SecurityStatus.REFUSED_TAMPERED -> Icons.Outlined.GppBad to CrimsonTamper
}
