/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PhotoSizeSelectLarge
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.PhotoSizeSelectLarge
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import media.oim.viewer.ui.OimStudioViewModel
import media.oim.viewer.ui.StudioTab
import media.oim.viewer.ui.components.OimBrandMark
import media.oim.viewer.ui.screens.LibraryScreen
import media.oim.viewer.ui.screens.ViewerScreen
import media.oim.viewer.ui.theme.OimStudioTheme
import media.oim.sdk.OimSdk
import media.oim.sdk.network.OimLoadState

class MainActivity : ComponentActivity() {

    private val studioViewModel: OimStudioViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleIncomingIntent(intent)
        setContent {
            val state by studioViewModel.uiState.collectAsStateWithLifecycle()
            val isImmersiveViewer = state.activeTab == StudioTab.VIEWER && state.loadState !is OimLoadState.Idle
            OimStudioTheme(
                darkTheme = state.isDarkTheme,
                forceDarkSystemBars = isImmersiveViewer
            ) {
                OimStudioApp(viewModel = studioViewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_VIEW) {
            val uri: Uri? = intent.data
            if (uri != null) {
                studioViewModel.loadFromLocalUri(uri)
            }
        }
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        OimSdk.getInstance(applicationContext).trimMemory(level)
    }
}

private data class NavDestination(
    val tab: StudioTab,
    val labelRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val testTag: String
)

private val NAV_DESTINATIONS = listOf(
    NavDestination(
        tab = StudioTab.LIBRARY,
        labelRes = R.string.nav_library,
        selectedIcon = Icons.Filled.PhotoLibrary,
        unselectedIcon = Icons.Outlined.PhotoLibrary,
        testTag = "nav_tab_library"
    ),
    NavDestination(
        tab = StudioTab.VIEWER,
        labelRes = R.string.nav_viewer,
        selectedIcon = Icons.Filled.PhotoSizeSelectLarge,
        unselectedIcon = Icons.Outlined.PhotoSizeSelectLarge,
        testTag = "nav_tab_viewer"
    )
)

@Composable
fun OimStudioApp(viewModel: OimStudioViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    val openDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            viewModel.loadFromLocalUri(uri)
        }
    }

    val createDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("image/png")
    ) { uri ->
        if (uri != null) {
            viewModel.exportActiveOimToUri(uri)
        }
    }

    LaunchedEffect(state.errorMessage, state.statusBanner) {
        val message = state.errorMessage ?: state.statusBanner
        if (!message.isNullOrBlank()) {
            snackbarHostState.showSnackbar(message)
            viewModel.dismissBanner()
        }
    }

    BackHandler(enabled = state.activeTab != StudioTab.LIBRARY) {
        viewModel.selectTab(StudioTab.LIBRARY)
    }

    // Google Photos ergonomics: hide bottom navigation when viewing an active OIM image
    val isImmersiveViewer = state.activeTab == StudioTab.VIEWER && state.loadState !is OimLoadState.Idle

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val useNavigationRail = maxWidth >= 600.dp

        Scaffold(
            contentWindowInsets = if (isImmersiveViewer) WindowInsets(0, 0, 0, 0) else WindowInsets.safeDrawing,
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            containerColor = if (isImmersiveViewer) Color.Black else MaterialTheme.colorScheme.background,
            bottomBar = {
                if (!useNavigationRail && !isImmersiveViewer) {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp
                    ) {
                        NAV_DESTINATIONS.forEach { dest ->
                            val selected = state.activeTab == dest.tab
                            NavigationBarItem(
                                selected = selected,
                                onClick = { viewModel.selectTab(dest.tab) },
                                icon = {
                                    if (dest.tab == StudioTab.VIEWER) {
                                        OimBrandMark(
                                            size = 22.dp,
                                            contentDescription = stringResource(dest.labelRes)
                                        )
                                    } else {
                                        Icon(
                                            imageVector = if (selected) dest.selectedIcon else dest.unselectedIcon,
                                            contentDescription = stringResource(dest.labelRes)
                                        )
                                    }
                                },
                                label = { Text(stringResource(dest.labelRes)) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                                    selectedTextColor = MaterialTheme.colorScheme.onSurface,
                                    indicatorColor = MaterialTheme.colorScheme.primary,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                                ),
                                modifier = Modifier.testTag(dest.testTag)
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (useNavigationRail && !isImmersiveViewer) {
                    NavigationRail(
                        containerColor = MaterialTheme.colorScheme.surface
                    ) {
                        NAV_DESTINATIONS.forEach { dest ->
                            val selected = state.activeTab == dest.tab
                            NavigationRailItem(
                                selected = selected,
                                onClick = { viewModel.selectTab(dest.tab) },
                                icon = {
                                    if (dest.tab == StudioTab.VIEWER) {
                                        OimBrandMark(
                                            size = 22.dp,
                                            contentDescription = stringResource(dest.labelRes)
                                        )
                                    } else {
                                        Icon(
                                            imageVector = if (selected) dest.selectedIcon else dest.unselectedIcon,
                                            contentDescription = stringResource(dest.labelRes)
                                        )
                                    }
                                },
                                label = { Text(stringResource(dest.labelRes)) },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                                    selectedTextColor = MaterialTheme.colorScheme.onSurface,
                                    indicatorColor = MaterialTheme.colorScheme.primary,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                                ),
                                modifier = Modifier.testTag(dest.testTag)
                            )
                        }
                    }
                }

                Box(
                    contentAlignment = Alignment.TopCenter,
                    modifier = Modifier.fillMaxSize()
                ) {
                    val stageModifier = if (isImmersiveViewer) {
                        Modifier.fillMaxSize()
                    } else {
                        Modifier.widthIn(max = 900.dp).fillMaxSize()
                    }
                    Box(modifier = stageModifier) {
                        when (state.activeTab) {
                            StudioTab.LIBRARY -> LibraryScreen(
                                state = state,
                                onRefreshLibrary = { viewModel.syncKeysAndRefreshLibrary() },
                                onLoadMore = { viewModel.loadMoreLibrary() },
                                onOpenLibraryItem = { viewModel.openLibraryItem(it) },
                                onOpenCachedEntry = { key, label -> viewModel.openCachedEntry(key, label) },
                                onOpenLocalFile = {
                                    openDocumentLauncher.launch(arrayOf("image/png", "application/octet-stream", "*/*"))
                                },
                                onLoadRemoteUrl = { viewModel.loadFromRemoteUrl(it) },
                                onUpdateEndpoints = { base, catalog -> viewModel.updateEndpoints(base, catalog) },
                                onSearchQueryChange = { viewModel.updateSearchQuery(it) },
                                onSelectCategory = { viewModel.selectCategory(it) },
                                onToggleTheme = { viewModel.toggleTheme() }
                            )

                            StudioTab.VIEWER -> ViewerScreen(
                                state = state,
                                onOpenLibrary = { viewModel.selectTab(StudioTab.LIBRARY) },
                                onOpenLocalFile = {
                                    openDocumentLauncher.launch(arrayOf("image/png", "application/octet-stream", "*/*"))
                                },
                                onLoadRemoteUrl = { viewModel.loadFromRemoteUrl(it) },
                                onExportOim = {
                                    val defaultName = state.activeAsset?.sourceLabel ?: "export.oim.png"
                                    createDocumentLauncher.launch(defaultName)
                                },
                                onSelectLanguage = { viewModel.setLanguage(it) },
                                onSelectPalette = { viewModel.setPalette(it) },
                                onReplayAnimations = { viewModel.replayAnimations() },
                                onSelectLayer = { viewModel.selectLayer(it) },
                                onToggleLayerVisibility = { viewModel.toggleLayerVisibility(it) },
                                onToggleGrid = { viewModel.togglePixelGrid() },
                                onTogglePerformance = { viewModel.togglePerformance() },
                                onToggleParallax = { viewModel.toggleParallax() },
                                onRetryLoad = { viewModel.retryLastRequest() },
                                onTogglePinCritical = { key, pin -> viewModel.togglePinCritical(key, pin) },
                                onClearAllCaches = { viewModel.clearAllCaches() }
                            )
                        }
                    }
                }
            }
        }
    }
}
