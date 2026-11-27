/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.lazy.staggeredgrid.rememberLazyStaggeredGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.BrokenImage
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import media.oim.viewer.R
import media.oim.viewer.ui.OimStudioUiState
import media.oim.viewer.ui.components.OimBrandMark
import media.oim.viewer.ui.theme.AmberPrism
import media.oim.sdk.network.OimLibraryItem
import media.oim.sdk.network.OimLibraryLoadState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    state: OimStudioUiState,
    onRefreshLibrary: () -> Unit,
    onLoadMore: () -> Unit,
    onOpenLibraryItem: (OimLibraryItem) -> Unit,
    onOpenCachedEntry: (key: String, label: String) -> Unit,
    onOpenLocalFile: () -> Unit,
    onLoadRemoteUrl: (String) -> Unit,
    onUpdateEndpoints: (apiBaseUrl: String, customCatalogUrl: String) -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onSelectCategory: (String?) -> Unit,
    onToggleTheme: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchExpanded by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var showUrlDialog by remember { mutableStateOf(false) }
    var showEndpointDialog by remember { mutableStateOf(false) }
    var urlDraft by remember { mutableStateOf("https://oim.media/") }
    var apiBaseDraft by remember(state.apiBaseUrl) { mutableStateOf(state.apiBaseUrl) }
    var catalogDraft by remember(state.customCatalogUrl) { mutableStateOf(state.customCatalogUrl) }

    val cachedEntries = state.cacheStats?.entries.orEmpty()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Quiet Top Bar: Official Brand Mark + Wordmark + Search + Open Local + Settings Sheet
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OimBrandMark(
                    size = 24.dp,
                    tint = MaterialTheme.colorScheme.onBackground,
                    contentDescription = "OIM"
                )
                Text(
                    text = "OIM",
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(
                    onClick = {
                        if (searchExpanded && state.librarySearchQuery.isNotEmpty()) {
                            onSearchQueryChange("")
                        }
                        searchExpanded = !searchExpanded
                    },
                    modifier = Modifier.testTag("library_search_toggle")
                ) {
                    Icon(
                        imageVector = if (searchExpanded) Icons.Outlined.Close else Icons.Outlined.Search,
                        contentDescription = stringResource(R.string.library_search_hint),
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                IconButton(
                    onClick = onOpenLocalFile,
                    modifier = Modifier.testTag("library_open_local_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AddPhotoAlternate,
                        contentDescription = stringResource(R.string.action_open_local),
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                IconButton(
                    onClick = { showSettingsSheet = true },
                    modifier = Modifier.testTag("library_settings_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.MoreVert,
                        contentDescription = stringResource(R.string.action_configure_endpoint),
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }

        // Collapsible search field
        AnimatedVisibility(
            visible = searchExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            OutlinedTextField(
                value = state.librarySearchQuery,
                onValueChange = onSearchQueryChange,
                singleLine = true,
                placeholder = { Text(stringResource(R.string.search)) },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.librarySearchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(Icons.Outlined.Close, contentDescription = null)
                        }
                    }
                },
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .testTag("library_search_input")
            )
        }

        when (val libState = state.libraryState) {
            is OimLibraryLoadState.Loading -> {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("library_loading_card")
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        OimBrandMark(
                            size = 44.dp,
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.72f)
                        )
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.primary,
                            strokeWidth = 2.dp
                        )
                    }
                }
            }

            is OimLibraryLoadState.Loaded -> {
                val categories = remember(libState.items) {
                    libState.items.map { it.category }.distinct().filter { it.isNotBlank() }
                }
                val filtered = remember(libState.items, state.selectedCategory, state.librarySearchQuery) {
                    val q = state.librarySearchQuery.trim()
                    libState.items.filter { item ->
                        val matchesCategory = state.selectedCategory == null || item.category == state.selectedCategory
                        val matchesQuery = q.isBlank() ||
                            item.title.contains(q, ignoreCase = true) ||
                            (item.titleEn?.contains(q, ignoreCase = true) == true) ||
                            item.tags.any { it.contains(q, ignoreCase = true) } ||
                            item.category.contains(q, ignoreCase = true)
                        matchesCategory && matchesQuery
                    }
                }

                if (categories.size > 1) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val allSelected = state.selectedCategory == null
                        FilterChip(
                            selected = allSelected,
                            onClick = { onSelectCategory(null) },
                            label = { Text(stringResource(R.string.filter_all)) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = allSelected,
                                borderColor = MaterialTheme.colorScheme.outline
                            )
                        )
                        categories.forEach { cat ->
                            val selected = state.selectedCategory == cat
                            FilterChip(
                                selected = selected,
                                onClick = { onSelectCategory(if (selected) null else cat) },
                                label = { Text(cat) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = selected,
                                    borderColor = MaterialTheme.colorScheme.outline
                                )
                            )
                        }
                    }
                }

                // Pure visual social-feed masonry grid with automatic lazy prefetching
                val gridState = rememberLazyStaggeredGridState()
                val isUnfiltered = state.selectedCategory == null && state.librarySearchQuery.isBlank()
                LaunchedEffect(gridState, filtered.size, libState.nextCursor, libState.isLoadingMore, isUnfiltered) {
                    if (!isUnfiltered || libState.nextCursor == null) return@LaunchedEffect
                    snapshotFlow {
                        val info = gridState.layoutInfo
                        val lastVisible = info.visibleItemsInfo.lastOrNull()?.index ?: -1
                        lastVisible to info.totalItemsCount
                    }.collect { (lastVisible, total) ->
                        if (total > 0 && lastVisible >= (total - 6).coerceAtLeast(0) && !libState.isLoadingMore) {
                            onLoadMore()
                        }
                    }
                }

                LazyVerticalStaggeredGrid(
                    state = gridState,
                    columns = StaggeredGridCells.Fixed(2),
                    contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalItemSpacing = 6.dp,
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        items = filtered,
                        key = { it.id + it.oimUrl },
                        contentType = { "oim_gallery_tile" }
                    ) { item ->
                        GalleryMediaTile(
                            item = item,
                            onClick = { onOpenLibraryItem(item) }
                        )
                    }

                    if (libState.nextCursor != null) {
                        item(span = StaggeredGridItemSpan.FullLine) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp)
                            ) {
                                TextButton(
                                    onClick = onLoadMore,
                                    enabled = !libState.isLoadingMore,
                                    modifier = Modifier.testTag("library_load_more_button")
                                ) {
                                    if (libState.isLoadingMore) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Text(if (libState.isLoadingMore) stringResource(R.string.loading) else stringResource(R.string.load_more))
                                }
                            }
                        }
                    }
                }
            }

            is OimLibraryLoadState.Error -> {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .testTag("library_error_card")
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CloudOff,
                            contentDescription = libState.title,
                            tint = AmberPrism,
                            modifier = Modifier.size(32.dp)
                        )
                        Text(
                            text = libState.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = libState.detail,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button(
                                onClick = onRefreshLibrary,
                                modifier = Modifier.testTag("library_retry_button")
                            ) {
                                Text("Reintentar")
                            }
                            OutlinedButton(
                                onClick = onOpenLocalFile,
                                modifier = Modifier.testTag("library_error_local_button")
                            ) {
                                Text(stringResource(R.string.open_file))
                            }
                        }
                    }
                }
            }
        }
    }

    // Settings, Offline Cache, URL & Endpoint Bottom Sheet
    if (showSettingsSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showSettingsSheet = false },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 24.dp)
            ) {
                Text(
                    text = "Opciones",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                val itemColors = ListItemDefaults.colors(containerColor = Color.Transparent)
                ListItem(
                    headlineContent = { Text(stringResource(R.string.open_local_oim)) },
                    leadingContent = { Icon(Icons.Outlined.AddPhotoAlternate, contentDescription = null) },
                    colors = itemColors,
                    modifier = Modifier.clickable {
                        showSettingsSheet = false
                        onOpenLocalFile()
                    }
                )
                ListItem(
                    headlineContent = { Text(stringResource(R.string.open_from_url)) },
                    leadingContent = { Icon(Icons.Outlined.CloudDownload, contentDescription = null) },
                    colors = itemColors,
                    modifier = Modifier.clickable {
                        showSettingsSheet = false
                        showUrlDialog = true
                    }
                )
                ListItem(
                    headlineContent = { Text("Actualizar biblioteca") },
                    leadingContent = { Icon(Icons.Outlined.Refresh, contentDescription = null) },
                    colors = itemColors,
                    modifier = Modifier.clickable {
                        showSettingsSheet = false
                        onRefreshLibrary()
                    }
                )
                ListItem(
                    headlineContent = { Text(if (state.isDarkTheme) stringResource(R.string.switch_to_light) else stringResource(R.string.switch_to_dark)) },
                    leadingContent = {
                        Icon(
                            if (state.isDarkTheme) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                            contentDescription = null
                        )
                    },
                    colors = itemColors,
                    modifier = Modifier.clickable {
                        onToggleTheme()
                    }
                )
                ListItem(
                    headlineContent = { Text("Configurar servidor OIM") },
                    supportingContent = {
                        Text(
                            text = "${state.apiBaseUrl.removePrefix("https://")} · ${state.trustedKeysCount} JWKs",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    },
                    leadingContent = { Icon(Icons.Outlined.Settings, contentDescription = null) },
                    colors = itemColors,
                    modifier = Modifier.clickable {
                        showSettingsSheet = false
                        showEndpointDialog = true
                    }
                )

                if (cachedEntries.isNotEmpty()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = stringResource(R.string.recent_cached, cachedEntries.size),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
                    )
                    cachedEntries.take(8).forEach { entry ->
                        ListItem(
                            headlineContent = {
                                Text(entry.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            },
                            supportingContent = {
                                Text("${entry.diskBytes / 1024} KB · ${if (entry.inMemoryL1) "RAM + Disco" else "Disco"}")
                            },
                            leadingContent = { Icon(Icons.Outlined.Storage, contentDescription = null) },
                            colors = itemColors,
                            modifier = Modifier.clickable {
                                showSettingsSheet = false
                                onOpenCachedEntry(entry.key, entry.label)
                            }
                        )
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

    if (showEndpointDialog) {
        AlertDialog(
            onDismissRequest = { showEndpointDialog = false },
            title = { Text(stringResource(R.string.endpoint_dialog_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = apiBaseDraft,
                        onValueChange = { apiBaseDraft = it },
                        singleLine = true,
                        label = { Text("API Base URL") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("endpoint_api_base_input")
                    )
                    OutlinedTextField(
                        value = catalogDraft,
                        onValueChange = { catalogDraft = it },
                        singleLine = true,
                        label = { Text(stringResource(R.string.catalog_url)) },
                        placeholder = { Text("https://library.oim.media/v1/showcase") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("endpoint_catalog_url_input")
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showEndpointDialog = false
                        onUpdateEndpoints(apiBaseDraft, catalogDraft)
                    },
                    modifier = Modifier.testTag("confirm_endpoint_save_button")
                ) {
                    Text(stringResource(R.string.save))
                }
            },
            dismissButton = {
                TextButton(onClick = { showEndpointDialog = false }) {
                    Text(stringResource(R.string.url_dialog_cancel))
                }
            }
        )
    }
}

@Composable
private fun GalleryMediaTile(
    item: OimLibraryItem,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val rawRatio = remember(item.aspectRatio) { parseRawAspectRatio(item.aspectRatio) }
    val ratio = rawRatio.coerceIn(0.62f, 2.2f)
    val imageScale = if (rawRatio > 2.2f || rawRatio < 0.62f) ContentScale.Fit else ContentScale.Crop
    val imageUrl = item.thumbnailUrl ?: item.oimUrl
    val imageRequest = remember(imageUrl, item.id) {
        ImageRequest.Builder(context)
            .data(imageUrl)
            .size(540, 960)
            .crossfade(180)
            .memoryCacheKey("thumb_${item.id}")
            .diskCacheKey("thumb_${item.id}")
            .build()
    }
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(ratio)
            .clip(RoundedCornerShape(12.dp))
            .testTag("library_item_${item.id}")
    ) {
        SubcomposeAsyncImage(
            model = imageRequest,
            contentDescription = item.title,
            contentScale = imageScale,
            modifier = Modifier.fillMaxSize(),
            loading = {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                )
            },
            error = {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        imageVector = Icons.Outlined.BrokenImage,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        )
    }
}

private fun parseRawAspectRatio(raw: String?): Float {
    if (raw.isNullOrBlank()) return 1f
    val parts = raw.trim().split('/', ':')
    if (parts.size == 2) {
        val w = parts[0].trim().toFloatOrNull()
        val h = parts[1].trim().toFloatOrNull()
        if (w != null && h != null && h > 0f) {
            return w / h
        }
    }
    return 1f
}
