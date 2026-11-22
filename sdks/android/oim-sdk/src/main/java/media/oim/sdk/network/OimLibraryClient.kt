/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Network client for official OIM platform endpoints:
 * - Public Showcase Library: `GET https://library.oim.media/v1/showcase` (`limit`, `category`, `q`, `cursor`, ETag `If-None-Match`)
 * - Public ECDSA P-256 JWKs: `GET https://api.oim.media/v1/media/keys`
 */
class OimLibraryClient(
    private val context: Context? = null,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()
) {
    companion object {
        const val DEFAULT_API_BASE_URL = "https://api.oim.media"
        const val DEFAULT_LIBRARY_BASE_URL = "https://library.oim.media"
        const val DEFAULT_SITE_BASE_URL = "https://oim.media"
        const val SHOWCASE_PATH = "/v1/showcase"
        const val PUBLIC_KEYS_PATH = "/v1/media/keys"
        const val DEFAULT_LIMIT = 48
    }

    private data class CachedShowcasePage(
        val etag: String?,
        val state: OimLibraryLoadState.Loaded
    )

    private val showcaseCache = ConcurrentHashMap<String, CachedShowcasePage>()

    /**
     * Fetches active ECDSA P-256 JWKs from `{apiBaseUrl}/v1/media/keys` (falling back to `/keys`
     * for custom backend mirrors) and registers them in [OimCanonicalizerAndVerifier].
     */
    suspend fun syncPublicKeys(apiBaseUrl: String = DEFAULT_API_BASE_URL): Int = withContext(Dispatchers.IO) {
        if (!isNetworkConnected()) return@withContext 0
        val base = apiBaseUrl.trim().trimEnd('/').ifBlank { DEFAULT_API_BASE_URL }
        val candidates = listOf("$base$PUBLIC_KEYS_PATH", "$base/keys")
        for (url in candidates) {
            try {
                val req = Request.Builder()
                    .url(url)
                    .header("Accept", "application/json")
                    .header("User-Agent", "OIM-Android-SDK/1.2")
                    .build()
                httpClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val body = resp.body?.string()?.trim().orEmpty()
                    if (body.isBlank()) return@use
                    val registered = parseAndRegisterJwks(body)
                    if (registered > 0) return@withContext registered
                }
            } catch (_: Exception) {
                // Try next candidate
            }
        }
        0
    }

    /**
     * Fetches the real OIM public showcase catalog from `https://library.oim.media/v1/showcase`
     * (or `customCatalogUrl` if configured). Supports pagination (`cursor`), server filtering
     * (`category`, `q`), and HTTP 304 ETag revalidation.
     */
    suspend fun fetchPublicLibrary(
        apiBaseUrl: String = DEFAULT_API_BASE_URL,
        customCatalogUrl: String? = null,
        limit: Int = DEFAULT_LIMIT,
        category: String? = null,
        query: String? = null,
        cursor: String? = null
    ): OimLibraryLoadState = withContext(Dispatchers.IO) {
        if (!isNetworkConnected()) {
            return@withContext OimLibraryLoadState.Error(
                title = "No internet connection",
                detail = "The library.oim.media catalog needs a connection. You can still open local .oim files or the ones cached on disk.",
                attemptedEndpoints = emptyList()
            )
        }

        val candidates = if (!customCatalogUrl.isNullOrBlank()) {
            listOf(buildShowcaseUrl(customCatalogUrl.trim(), limit, category, query, cursor))
        } else {
            val normalizedApi = apiBaseUrl.trim().trimEnd('/').ifBlank { DEFAULT_API_BASE_URL }
            listOf(
                buildShowcaseUrl("$DEFAULT_LIBRARY_BASE_URL$SHOWCASE_PATH", limit, category, query, cursor),
                buildShowcaseUrl("$normalizedApi$SHOWCASE_PATH", limit, category, query, cursor),
                buildShowcaseUrl("$DEFAULT_SITE_BASE_URL/api/library", limit, category, query, cursor)
            )
        }

        val attempted = mutableListOf<String>()
        val diagnostics = mutableListOf<String>()
        var allNetworkBlocked = true

        for (endpoint in candidates) {
            attempted.add(endpoint)
            try {
                val cached = showcaseCache[endpoint]
                val reqBuilder = Request.Builder()
                    .url(endpoint)
                    .header("Accept", "application/json")
                    .header("User-Agent", "OIM-Android-SDK/1.2")
                if (cached?.etag != null) {
                    reqBuilder.header("If-None-Match", cached.etag)
                }

                httpClient.newCall(reqBuilder.build()).execute().use { resp ->
                    allNetworkBlocked = false
                    if (resp.code == 304 && cached != null) {
                        return@withContext cached.state
                    }
                    if (!resp.isSuccessful) {
                        diagnostics.add("${endpoint.removePrefix("https://")} -> HTTP ${resp.code}")
                        return@use
                    }
                    val body = resp.body?.string()?.trim().orEmpty()
                    if (body.isBlank() || (!body.startsWith("{") && !body.startsWith("["))) {
                        diagnostics.add("${endpoint.removePrefix("https://")} -> not JSON")
                        return@use
                    }
                    val (parsedItems, nextCursor) = parseShowcaseResponse(body, endpoint)
                    if (parsedItems.isNotEmpty() || nextCursor != null || endpoint.contains(SHOWCASE_PATH)) {
                        val loaded = OimLibraryLoadState.Loaded(
                            items = parsedItems,
                            sourceEndpoint = endpoint,
                            nextCursor = nextCursor
                        )
                        showcaseCache[endpoint] = CachedShowcasePage(resp.header("ETag"), loaded)
                        return@withContext loaded
                    } else {
                        diagnostics.add("${endpoint.removePrefix("https://")} -> empty JSON")
                    }
                }
            } catch (e: Exception) {
                diagnostics.add("${endpoint.removePrefix("https://")} -> ${e.javaClass.simpleName}: ${e.localizedMessage ?: "no network"}")
            }
        }

        val summary = diagnostics.take(3).joinToString("\n")
        val title = if (allNetworkBlocked) {
            "No network access to the OIM server"
        } else {
            "OIM catalog unavailable"
        }
        val hint = if (allNetworkBlocked) {
            "Could not reach library.oim.media (check the device or emulator network)."
        } else {
            "The server returned an error or an unexpected format. You can set a custom catalog URL."
        }

        OimLibraryLoadState.Error(
            title = title,
            detail = "$hint\n\n$summary",
            attemptedEndpoints = attempted
        )
    }

    internal fun buildShowcaseUrl(
        baseEndpoint: String,
        limit: Int,
        category: String?,
        query: String?,
        cursor: String?
    ): String {
        val parsed = baseEndpoint.toHttpUrlOrNull() ?: return baseEndpoint
        val builder = parsed.newBuilder()
        if (parsed.queryParameter("limit") == null) {
            builder.addQueryParameter("limit", limit.coerceIn(1, 96).toString())
        }
        if (!category.isNullOrBlank()) {
            builder.setQueryParameter("category", category.trim())
        }
        if (!query.isNullOrBlank()) {
            builder.setQueryParameter("q", query.trim())
        }
        if (!cursor.isNullOrBlank()) {
            builder.setQueryParameter("cursor", cursor.trim())
        }
        return builder.build().toString()
    }

    fun parseAndRegisterJwks(jsonText: String): Int {
        var count = 0
        val keysArray: JSONArray = if (jsonText.startsWith("[")) {
            JSONArray(jsonText)
        } else {
            val root = JSONObject(jsonText)
            root.optJSONArray("keys") ?: root.optJSONArray("data") ?: JSONArray()
        }
        for (i in 0 until keysArray.length()) {
            val k = keysArray.optJSONObject(i) ?: continue
            val kty = k.optString("kty", "EC")
            val crv = k.optString("crv", "P-256")
            if (!kty.equals("EC", ignoreCase = true) || !crv.equals("P-256", ignoreCase = true)) continue
            val kid = k.optString("kid", k.optString("id", ""))
            val x = k.optString("x", "")
            val y = k.optString("y", "")
            val exp = if (k.has("exp") && !k.isNull("exp")) k.optLong("exp") else null
            val notAfter = k.optString("not_after", "").ifBlank { null }
            val verifyUntil = k.optString("verify_until", "").ifBlank { null }
            if (kid.isNotBlank() && x.isNotBlank() && y.isNotBlank()) {
                if (OimCanonicalizerAndVerifier.registerTrustedJwk(kid, x, y, exp, notAfter, verifyUntil)) {
                    count++
                }
            }
        }
        return count
    }

    fun parseShowcaseResponse(jsonText: String, sourceEndpoint: String): Pair<List<OimLibraryItem>, String?> {
        val baseUri = runCatching { URI(sourceEndpoint) }.getOrNull()
        var nextCursor: String? = null
        val array: JSONArray = if (jsonText.startsWith("[")) {
            JSONArray(jsonText)
        } else {
            val root = JSONObject(jsonText)
            if (root.has("next_cursor") && !root.isNull("next_cursor")) {
                nextCursor = root.optString("next_cursor").ifBlank { null }
            }
            root.optJSONArray("items")
                ?: root.optJSONArray("data")
                ?: root.optJSONArray("library")
                ?: root.optJSONArray("templates")
                ?: root.optJSONArray("showcase")
                ?: root.optJSONArray("results")
                ?: root.optJSONArray("entries")
                ?: JSONArray()
        }

        val items = mutableListOf<OimLibraryItem>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            // Real worker `SHOWCASE_FIELDS` uses `media_url`; keep fallbacks for mirrors
            val rawUrl = obj.optString("media_url")
                .ifBlank { obj.optString("oim_url") }
                .ifBlank { obj.optString("oimUrl") }
                .ifBlank { obj.optString("file_url") }
                .ifBlank { obj.optString("fileUrl") }
                .ifBlank { obj.optString("download_url") }
                .ifBlank { obj.optString("downloadUrl") }
                .ifBlank { obj.optString("image_url") }
                .ifBlank { obj.optString("imageUrl") }
                .ifBlank { obj.optString("src") }
                .ifBlank { obj.optString("url") }
            if (rawUrl.isBlank()) continue

            val resolvedUrl = resolveUrl(rawUrl, baseUri)
            val rawThumb = obj.optString("thumbnail_url")
                .ifBlank { obj.optString("thumbnailUrl") }
                .ifBlank { obj.optString("preview_url") }
                .ifBlank { obj.optString("previewUrl") }
                .ifBlank { obj.optString("thumbnail") }
                .ifBlank { rawUrl }

            val id = obj.optString("id")
                .ifBlank { obj.optString("oim_id") }
                .ifBlank { obj.optString("slug") }
                .ifBlank { "oim_$i" }

            val title = extractLocalizedOrString(obj.opt("title"))
                .ifBlank { extractLocalizedOrString(obj.opt("name")) }
                .ifBlank { id }
            val titleEn = obj.optString("title_en", "").ifBlank { null }

            val description = extractLocalizedOrString(obj.opt("description"))
            val descriptionEn = obj.optString("description_en", "").ifBlank { null }

            val author = when (val rawAuthor = obj.opt("author") ?: obj.opt("creator")) {
                is JSONObject -> rawAuthor.optString("name", rawAuthor.optString("handle", "OIM"))
                is String -> rawAuthor.ifBlank { "OIM" }
                else -> "OIM"
            }

            val type = obj.optString("type", "image").ifBlank { "image" }
            val category = obj.optString("category")
                .ifBlank { type }
                .ifBlank { "OIM" }

            val tags = parseStringArray(obj.optJSONArray("tags"))
            val features = parseStringArray(obj.optJSONArray("features"))
            val langs = parseStringArray(obj.optJSONArray("languages") ?: obj.optJSONArray("lang"))

            items.add(
                OimLibraryItem(
                    id = id,
                    title = title,
                    titleEn = titleEn,
                    description = description,
                    descriptionEn = descriptionEn,
                    author = author,
                    category = category,
                    type = type,
                    aspectRatio = obj.optString("aspect_ratio", "").ifBlank { null },
                    tags = tags,
                    features = features,
                    oimUrl = resolvedUrl,
                    thumbnailUrl = resolveUrl(rawThumb, baseUri),
                    languages = langs,
                    isTemplate = obj.optBoolean("is_template", false),
                    createdAt = obj.optString("created_at", obj.optString("updated_at", "")).ifBlank { null }
                )
            )
        }
        return items to nextCursor
    }

    private fun parseStringArray(arr: JSONArray?): List<String> {
        if (arr == null) return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val s = arr.optString(i)
                if (s.isNotBlank()) add(s)
            }
        }
    }

    private fun extractLocalizedOrString(value: Any?): String {
        return when (value) {
            is String -> value.trim()
            is JSONObject -> {
                value.optString("es")
                    .ifBlank { value.optString("en") }
                    .ifBlank { value.optString("*") }
                    .ifBlank {
                        val iter = value.keys()
                        if (iter.hasNext()) value.optString(iter.next()) else ""
                    }
            }
            else -> ""
        }
    }

    private fun resolveUrl(raw: String, baseUri: URI?): String {
        val trimmed = raw.trim()
        if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed
        return try {
            baseUri?.resolve(trimmed)?.toString() ?: "$DEFAULT_SITE_BASE_URL/${trimmed.trimStart('/')}"
        } catch (_: Exception) {
            trimmed
        }
    }

    private fun isNetworkConnected(): Boolean {
        val ctx = context ?: return true
        return try {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            true
        }
    }
}
