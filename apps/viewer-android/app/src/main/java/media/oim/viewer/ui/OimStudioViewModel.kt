/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer.ui

import android.app.Application
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import media.oim.sdk.OimSdk
import media.oim.sdk.cache.OimCachePriority
import media.oim.sdk.cache.OimCacheSource
import media.oim.sdk.cache.OimCacheStats
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimLoadedAsset
import media.oim.sdk.network.OimLibraryClient
import media.oim.sdk.network.OimLibraryItem
import media.oim.sdk.network.OimLibraryLoadState
import media.oim.sdk.network.OimLoadState
import media.oim.sdk.network.OimRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class StudioTab {
    LIBRARY,
    VIEWER
}

data class OimStudioUiState(
    val activeTab: StudioTab = StudioTab.LIBRARY,
    val isDarkTheme: Boolean = true,
    val apiBaseUrl: String = OimLibraryClient.DEFAULT_API_BASE_URL,
    val customCatalogUrl: String = "",
    val trustedKeysCount: Int = 0,
    val libraryState: OimLibraryLoadState = OimLibraryLoadState.Loading,
    val librarySearchQuery: String = "",
    val selectedCategory: String? = null,
    val loadState: OimLoadState = OimLoadState.Idle,
    val activeAsset: OimLoadedAsset? = null,
    val activeRequestKey: String? = null,
    val cacheSource: OimCacheSource? = null,
    val cacheStats: OimCacheStats? = null,
    val selectedLanguage: String = "es",
    val selectedPalette: String? = null,
    val selectedLayerId: String? = null,
    val hiddenLayerIds: Set<String> = emptySet(),
    val showPixelGrid: Boolean = false,
    val parallaxEnabled: Boolean = true,
    val replayTrigger: Int = 0,
    val statusBanner: String? = null,
    val errorMessage: String? = null
)

class OimStudioViewModel(application: Application) : AndroidViewModel(application) {

    private val sdk: OimSdk = OimSdk.getInstance(application.applicationContext)
    private var activeLoadJob: Job? = null
    private var lastRequest: OimRequest? = null

    private val _uiState = MutableStateFlow(
        OimStudioUiState(
            cacheStats = sdk.getCacheStats(),
            trustedKeysCount = OimCanonicalizerAndVerifier.trustedKeyCount()
        )
    )
    val uiState: StateFlow<OimStudioUiState> = _uiState.asStateFlow()

    init {
        syncKeysAndRefreshLibrary()
    }

    fun selectTab(tab: StudioTab) {
        _uiState.update { it.copy(activeTab = tab) }
    }

    fun toggleTheme() {
        _uiState.update { it.copy(isDarkTheme = !it.isDarkTheme) }
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { it.copy(librarySearchQuery = query) }
    }

    fun selectCategory(category: String?) {
        _uiState.update { it.copy(selectedCategory = category) }
    }

    fun updateEndpoints(apiBaseUrl: String, customCatalogUrl: String) {
        val cleanBase = apiBaseUrl.trim().trimEnd('/').ifBlank { OimLibraryClient.DEFAULT_API_BASE_URL }
        val cleanCatalog = customCatalogUrl.trim()
        _uiState.update {
            it.copy(
                apiBaseUrl = cleanBase,
                customCatalogUrl = cleanCatalog
            )
        }
        syncKeysAndRefreshLibrary()
    }

    fun syncKeysAndRefreshLibrary() {
        viewModelScope.launch {
            _uiState.update { it.copy(libraryState = OimLibraryLoadState.Loading) }
            val state = _uiState.value
            sdk.syncPublicKeys(state.apiBaseUrl)
            val result = sdk.fetchPublicLibrary(
                apiBaseUrl = state.apiBaseUrl,
                customCatalogUrl = state.customCatalogUrl.ifBlank { null }
            )
            _uiState.update {
                it.copy(
                    libraryState = result,
                    trustedKeysCount = OimCanonicalizerAndVerifier.trustedKeyCount(),
                    cacheStats = sdk.getCacheStats()
                )
            }
        }
    }

    fun loadMoreLibrary() {
        val current = _uiState.value.libraryState as? OimLibraryLoadState.Loaded ?: return
        val cursor = current.nextCursor ?: return
        if (current.isLoadingMore) return

        viewModelScope.launch {
            _uiState.update { it.copy(libraryState = current.copy(isLoadingMore = true)) }
            val state = _uiState.value
            val nextPage = sdk.fetchPublicLibrary(
                apiBaseUrl = state.apiBaseUrl,
                customCatalogUrl = state.customCatalogUrl.ifBlank { null },
                cursor = cursor
            )
            when (nextPage) {
                is OimLibraryLoadState.Loaded -> {
                    val existingIds = current.items.mapTo(mutableSetOf()) { it.id + it.oimUrl }
                    val merged = current.items + nextPage.items.filter { (it.id + it.oimUrl) !in existingIds }
                    _uiState.update {
                        it.copy(
                            libraryState = current.copy(
                                items = merged,
                                nextCursor = nextPage.nextCursor,
                                isLoadingMore = false
                            )
                        )
                    }
                }
                is OimLibraryLoadState.Error -> {
                    _uiState.update {
                        it.copy(
                            libraryState = current.copy(isLoadingMore = false),
                            errorMessage = nextPage.title
                        )
                    }
                }
                OimLibraryLoadState.Loading -> Unit
            }
        }
    }

    fun openLibraryItem(item: OimLibraryItem, forceRefresh: Boolean = false) {
        _uiState.update { it.copy(activeTab = StudioTab.VIEWER) }
        executeSdkLoad(
            OimRequest(
                key = item.oimUrl,
                label = item.localizedTitle(_uiState.value.selectedLanguage),
                remoteUrl = item.oimUrl,
                priority = OimCachePriority.HIGH,
                forceRefresh = forceRefresh
            )
        )
    }

    fun openCachedEntry(key: String, label: String) {
        _uiState.update { it.copy(activeTab = StudioTab.VIEWER) }
        val remoteUrl = if (key.startsWith("http://") || key.startsWith("https://")) key else null
        executeSdkLoad(
            OimRequest(
                key = key,
                label = label,
                remoteUrl = remoteUrl,
                priority = OimCachePriority.NORMAL
            )
        )
    }

    fun loadFromRemoteUrl(url: String, forceRefresh: Boolean = false) {
        val trimmed = url.trim()
        if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
            _uiState.update { it.copy(errorMessage = "The URL must start with https:// or http://") }
            return
        }
        val fileName = trimmed.substringAfterLast('/').ifBlank { "remote.oim.png" }
        _uiState.update { it.copy(activeTab = StudioTab.VIEWER) }
        executeSdkLoad(
            OimRequest(
                key = trimmed,
                label = fileName,
                remoteUrl = trimmed,
                priority = OimCachePriority.NORMAL,
                forceRefresh = forceRefresh
            )
        )
    }

    fun loadFromLocalUri(uri: Uri) {
        val resolver = getApplication<Application>().contentResolver
        val displayName = queryDisplayName(uri) ?: uri.lastPathSegment ?: "local.oim.png"
        _uiState.update { it.copy(activeTab = StudioTab.VIEWER) }
        executeSdkLoad(
            OimRequest(
                key = "local:$uri",
                label = displayName,
                rawBytesProvider = {
                    withContext(Dispatchers.IO) {
                        resolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("Could not open the local file.")
                    }
                },
                priority = OimCachePriority.HIGH,
                forceRefresh = true
            )
        )
    }

    fun retryLastRequest() {
        val req = lastRequest ?: return
        executeSdkLoad(req.copy(forceRefresh = true))
    }

    private fun executeSdkLoad(request: OimRequest) {
        lastRequest = request
        activeLoadJob?.cancel()
        activeLoadJob = viewModelScope.launch {
            sdk.load(request).collect { loadState ->
                when (loadState) {
                    is OimLoadState.Idle -> {
                        _uiState.update { it.copy(loadState = loadState) }
                    }
                    is OimLoadState.Loading -> {
                        _uiState.update {
                            it.copy(
                                loadState = loadState,
                                errorMessage = null
                            )
                        }
                    }
                    is OimLoadState.Success -> {
                        val asset = loadState.asset
                        val preferredLang = resolveInitialLanguage(asset)
                        _uiState.update {
                            it.copy(
                                loadState = loadState,
                                activeAsset = asset,
                                activeRequestKey = request.key,
                                cacheSource = loadState.cacheSource,
                                cacheStats = sdk.getCacheStats(),
                                selectedLanguage = preferredLang,
                                selectedPalette = asset.document?.defaultPalette,
                                selectedLayerId = null,
                                hiddenLayerIds = emptySet(),
                                replayTrigger = it.replayTrigger + 1,
                                errorMessage = null
                            )
                        }
                    }
                    is OimLoadState.DegradedFromCache -> {
                        val asset = loadState.asset
                        val preferredLang = resolveInitialLanguage(asset)
                        _uiState.update {
                            it.copy(
                                loadState = loadState,
                                activeAsset = asset,
                                activeRequestKey = request.key,
                                cacheSource = loadState.cacheSource,
                                cacheStats = sdk.getCacheStats(),
                                selectedLanguage = preferredLang,
                                selectedPalette = asset.document?.defaultPalette,
                                selectedLayerId = null,
                                hiddenLayerIds = emptySet(),
                                replayTrigger = it.replayTrigger + 1,
                                statusBanner = "Offline: showing the verified copy from ${loadState.cacheSource.label}."
                            )
                        }
                    }
                    is OimLoadState.Failure -> {
                        _uiState.update {
                            it.copy(
                                loadState = loadState,
                                cacheStats = sdk.getCacheStats()
                            )
                        }
                    }
                }
            }
        }
    }

    private fun resolveInitialLanguage(asset: OimLoadedAsset): String {
        val current = _uiState.value.selectedLanguage
        val doc = asset.document ?: return current
        return if (doc.languages.any { it.equals(current, ignoreCase = true) }) {
            current
        } else {
            doc.languages.firstOrNull() ?: doc.defaultLanguage
        }
    }

    fun exportActiveOimToUri(uri: Uri) {
        val rawBytes = _uiState.value.activeAsset?.rawBytes ?: return
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    getApplication<Application>().contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(rawBytes)
                        out.flush()
                    } ?: error("Could not write the file.")
                }
                _uiState.update {
                    it.copy(statusBanner = "Exported .oim.png (${rawBytes.size / 1024} KB).")
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(errorMessage = "Error al exportar: ${e.localizedMessage}")
                }
            }
        }
    }

    fun setLanguage(lang: String) {
        _uiState.update { it.copy(selectedLanguage = lang) }
    }

    fun setPalette(palette: String?) {
        _uiState.update { it.copy(selectedPalette = palette) }
    }

    fun replayAnimations() {
        _uiState.update { it.copy(replayTrigger = it.replayTrigger + 1) }
    }

    fun selectLayer(layerId: String?) {
        _uiState.update { it.copy(selectedLayerId = layerId) }
    }

    fun toggleLayerVisibility(layerId: String) {
        _uiState.update { current ->
            val updated = if (layerId in current.hiddenLayerIds) {
                current.hiddenLayerIds - layerId
            } else {
                current.hiddenLayerIds + layerId
            }
            current.copy(hiddenLayerIds = updated)
        }
    }

    fun togglePixelGrid() {
        _uiState.update { it.copy(showPixelGrid = !it.showPixelGrid) }
    }

    fun toggleParallax() {
        _uiState.update { it.copy(parallaxEnabled = !it.parallaxEnabled) }
    }

    fun togglePinCritical(key: String, pinCritical: Boolean) {
        sdk.setPriority(key, if (pinCritical) OimCachePriority.CRITICAL else OimCachePriority.NORMAL)
        _uiState.update {
            it.copy(
                cacheStats = sdk.getCacheStats(),
                statusBanner = if (pinCritical) "Pinned in cache as CRITICAL." else "Priority restored to NORMAL."
            )
        }
    }

    fun clearAllCaches() {
        sdk.clearAllCaches()
        _uiState.update {
            it.copy(
                cacheStats = sdk.getCacheStats(),
                statusBanner = "L1 and L2 caches cleared."
            )
        }
    }

    fun dismissBanner() {
        _uiState.update { it.copy(statusBanner = null, errorMessage = null) }
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            getApplication<Application>().contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
            }
        } catch (_: Exception) {
            null
        }
    }
}
