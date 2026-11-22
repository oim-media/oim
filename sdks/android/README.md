# Native Android OIM SDK (`:oim-sdk` · `media.oim.sdk`)

A native Kotlin, Jetpack Compose and C++17 (Android NDK) framework to browse **OIM (Object Interactive Media)** catalogs, verify ECDSA P-256 signatures and `sha256-idat` fingerprints, and render `.oim` / `.oim.png` documents (v1 and v2 `2.0.0-draft.1`) with parity against `@oim-media/player-oim` and `oim_flutter`.

---

## `:oim-sdk` architecture

1. **Entry point ([`OimSdk.kt`](oim-sdk/src/main/java/media/oim/sdk/OimSdk.kt))**
   - Singleton entry point (`OimSdk.init(context, config)` / `OimSdk.getInstance(context, config)`).
   - Reactive `Flow<OimLoadState>` streams: `load(request)`, `loadFromUrl(...)`, `loadFromUri(...)`, `loadFromBytes(...)`.
   - Lifecycle and prefetching: `prefetch(...)`, `syncPublicKeys(...)`, `fetchPublicLibrary(...)`, `pinAsCritical(...)`, `setPriority(...)`, `invalidate(...)`, `purgeExpired()`, `trimMemory(...)`, `clearAllCaches()` and `getCacheStats()`.

2. **Library and public keys ([`OimLibraryClient.kt`](oim-sdk/src/main/java/media/oim/sdk/network/OimLibraryClient.kt))**
   - `syncPublicKeys(apiBaseUrl)`: calls `GET https://api.oim.media/v1/media/keys` (falling back to `/keys`) and registers the ECDSA P-256 public keys (JWK) in `OimCanonicalizerAndVerifier`.
   - `fetchPublicLibrary(...)`: calls `GET https://library.oim.media/v1/showcase` (or `customCatalogUrl`) with `limit`, `category`, `query`, `cursor` pagination and conditional revalidation by `ETag` (`If-None-Match` → HTTP `304`).

3. **Binary parser and NDK ([`OimBinaryCodec.kt`](oim-sdk/src/main/java/media/oim/sdk/parser/OimBinaryCodec.kt), [`OimNativeBridge.kt`](oim-sdk/src/main/java/media/oim/sdk/ndk/OimNativeBridge.kt), [`oim-sdk/src/main/cpp/`](oim-sdk/src/main/cpp/))**
   - Zero-copy C++17 PNG scanner (`oim_png_scanner.hpp` + `oim_ndk_engine.cpp`), optionally built as `liboim_native.so` (`-O3`, `-march=armv8-a+crc` on `arm64-v8a`), with a transparent Kotlin fallback.
   - `decodeAndVerify(pngBytes, label)`: extracts the `OIM_Data` chunk (`tEXt`, `zTXt`, `iTXt`, `oIMd`; *last chunk wins*), inflates raw DEFLATE (RFC 1951) / zlib and runs the cryptographic verification.
   - `parseDocumentJson(...)` / `serializeDocumentToJson(...)`: parses schema v1 (`slots`) and v2 (`layers`; `groups` flattened to root-canvas coordinates; `palettes`; `variables`; color/gradient/pattern/image `fills`; `strokes`; `shadow`/`glow`/`blur`/`filter` `effects`; `geometry` with `paths` and `corners`; `motion.loop`; `parallax` off unless declared; `animations` / `tracks`; `text.marks` / `runs` / `artistic`; and `states`).
   - Extra utilities: `computeIdatSha256Hash(...)`, `encodeSignedOimPng(...)`, `createTamperedCopy(...)`.

4. **Cryptographic verification and resolution ([`OimCanonicalizerAndVerifier.kt`](oim-sdk/src/main/java/media/oim/sdk/crypto/OimCanonicalizerAndVerifier.kt))**
   - `canonicalJson(...)` / `serializeCanonicalBytes(...)`: drops `signature`, `key_version`, `timestamp` and `creator_user_id` at the root only, sorts keys recursively by Unicode code point, turns integral floats into integers, rounds the exact binary value to 6 decimals (as JS `toFixed(6)`) and emits unescaped UTF-8.
   - `hasNumberOutOfRange(...)`: rejects integers outside the IEEE-754 safe range ($\le 2^{53} - 1$).
   - `verify(...)` and `signCanonicalPayload(...)`: ECDSA P-256 signatures (a 64-byte signature is always IEEE P1363; other lengths are ASN.1 DER) plus `IDAT` raster integrity (`sha256-idat`). On tampering, `SecurityStatus` sets `isRefused = true` and `reeditPermission` drops to `ReeditPermission.AUTHOR_ONLY`.
   - `resolveContent(...)` and `resolvePalette(...)`: multilingual chain (`*`, requested language, variants, `en`, `es`, default) and palette resolution (`requested`, `dark`/`light`, `default`).

5. **L1/L2 cache and resilient transport ([`OimCacheManager.kt`](oim-sdk/src/main/java/media/oim/sdk/cache/OimCacheManager.kt), [`OimServiceClient.kt`](oim-sdk/src/main/java/media/oim/sdk/network/OimServiceClient.kt))**
   - Two-level cache: **L1 (RAM)** + **L2 (disk, atomic `.tmp -> rename` writes)** with an LRU policy weighted by `OimCachePriority` (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`), TTL, `ETag` / `Last-Modified`, `onTrimMemory`, `invalidateIfHashChanged`, and unverified files rejected.
   - `OimServiceClient` with `ConnectivityManager`, retries with exponential backoff + jitter (`OimRetryPolicy`), `Content-Length` and final `IEND` checks (`hasCompletePngTrailer`), and `OimLoadState.DegradedFromCache` when the network fails.

6. **Rendering, typography and animation**
   - **[`OimAsyncPlayer.kt`](oim-sdk/src/main/java/media/oim/sdk/ui/OimAsyncPlayer.kt)** and **[`OimPlayerView.kt`](oim-sdk/src/main/java/media/oim/sdk/ui/OimPlayerView.kt)**:
     - Normalized `0..100` projection with `cqw`-scaled type independent of `fontScale`, `.clipToBounds()` clipping under zoom/pan, and optional gravity-sensor and touch-drag parallax.
     - Shared polygon clipping (`buildGeoClipShape` / `buildRegularPolygonPath` / `buildStarPath`) for `circle`, `pill`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`, rectangles with 4 independent radii and multi-path `svgPaths` (`fillRule`, `opacity`, 6-float `transform`).
     - `OimCroppedImage`: `cover`, `contain`, `scale-down`, `fill`, focal framing (`cropX`, `cropY`, `cropZoom`) and mirroring (`flipX`, `flipY`).
     - `effects`: shadow (`blur`, `x`, `y`, `opacity`, `colorRole`), two-pass glow (`0.3r` and `0.7r`) with `BlurredEdgeTreatment.Unbounded` over alpha silhouettes (`BlendMode.SrcIn` for images, `tintAnnotatedTextSilhouette` for text, `tintOverride` for vectors), layer blur and filters (`OimFilterSpec`).
   - **[`OimPatternAndGradientRenderer.kt`](oim-sdk/src/main/java/media/oim/sdk/ui/OimPatternAndGradientRenderer.kt)**:
     - Vector `pattern.tile` rendering with `renderPatternTileBitmap` + `BitmapShader(TileMode.REPEAT)`, zoom matrix and animated offset (`motion`), palette recoloring (`rawBg`/`rawColors`), procedural presets (`waves`, `grid`, `checker`, `stripes`, `dots`) and `linear`/`radial` gradients (`OimGradientBox`).
   - **[`OimFontLoader.kt`](oim-sdk/src/main/java/media/oim/sdk/ui/OimFontLoader.kt)**:
     - Embedded TTF/OTF, **WOFF1** (`0x774F4646` → SFNT) and **WOFF2** ([`Woff2.kt`](oim-sdk/src/main/java/media/oim/sdk/ui/Woff2.kt): Brotli via `org.brotli:dec`, rebuilt `glyf`/`loca`), and nearest-weight selection (`findBestFont`). A transformed `hmtx` or a font collection falls back to the system font.
   - **[`OimKeyframeSampler.kt`](oim-sdk/src/main/java/media/oim/sdk/animation/OimKeyframeSampler.kt)** and **[`OimTextAnimator.kt`](oim-sdk/src/main/java/media/oim/sdk/animation/OimTextAnimator.kt)**:
     - Track sampling (`x`, `y`, `r`, `s`, `o`, `b`) with `cubic-bezier` curves and CSS easings.
     - Text effects: `fade-chars`, `slide-up`, `bounce-chars`, `reveal-mask`, `scale-in`, `rise-words`, `wave-chars`, `typewriter`, `glitch-cyberpunk` and `glitch-slice`.

---

## Build and test

Requirements: JDK 17+ and the Android SDK (`compileSdk = 36`, `minSdk = 24`). Add `sdk.dir` to `local.properties` or set `ANDROID_HOME`.

```bash
cd sdks/android
./gradlew :oim-sdk:testDebugUnitTest
```

The sample app lives in [`apps/viewer-android`](../../apps/viewer-android) and builds this SDK from source.

## Quick start

```kotlin
val sdk = OimSdk.getInstance(context)

// 1. Sync the official JWKs and query the live catalog
sdk.syncPublicKeys("https://api.oim.media")
val libraryState = sdk.fetchPublicLibrary(limit = 48)

// 2. Load a remote .oim.png (or from a Uri / ByteArray)
val flow: Flow<OimLoadState> = sdk.loadFromUrl(
    url = item.oimUrl,
    label = item.title,
    priority = OimCachePriority.HIGH
)
```

Rendering in Compose:

```kotlin
val loadState by flow.collectAsState(initial = OimLoadState.Idle)

OimAsyncPlayer(
    loadState = loadState,
    language = "es",
    selectedPalette = selectedTheme,
    parallaxEnabled = true,
    onRetry = { /* reload */ },
    onOpenLibrary = { /* back to the library */ },
    onOpenLocalFile = { /* file picker */ }
)
```

Two optional parameters of `OimAsyncPlayer`:

- `placeholder`: shown while the file loads and faded out once it paints, e.g. the library's blurred thumbnail instead of a spinner.
- `zoomState`: pass `rememberOimZoomState(key)` and put `Modifier.oimZoomGestures(zoomState)` on the whole screen, so a pinch that starts outside the canvas (over a zoomed picture's overflow) still zooms. Without it the player handles zoom on its own canvas.

To build with the C++17 native library (`liboim_native.so`) when the Android NDK and CMake `3.22.1` are available:

```bash
./gradlew :oim-sdk:assembleDebug :app:assembleDebug -PoimEnableNdk=true
```

---

## Performance checks

- **On screen:** `OimPlayerView(..., showPerformanceOverlay = true)` draws frame rate, median and p95 frame time,
  and stutters (frames over 1.5x the display's budget) against the screen's real refresh rate (60/90/120 Hz).
  It requests a frame every vsync, so it keeps an idle player drawing: read it while the file animates or scrolls.
- **System trace:** record with Perfetto or Android Studio's profiler and look for the `oim:decode-image` and
  `oim:parse-path` sections, beside Compose's own composition and draw slices. That also measures an idle player.

## Conformance, tests and references

- **Unit suites**:
  - [`SpecConformanceTest.kt`](oim-sdk/src/test/java/media/oim/sdk/SpecConformanceTest.kt): every `@oim-media/spec` vector. The 48 v1 vectors must verify and match their `.expected.json` (canvas, slot ids, positions, content); the 48 v2 vectors must decode and verify; `canonical-cases.json` must produce the exact canonical bytes and flag every out-of-range number.
  - [`OimBinaryCodecTest.kt`](oim-sdk/src/test/java/media/oim/sdk/OimBinaryCodecTest.kt): detailed decoding of selected vectors, v2 schema, animations, `pattern.tile` and `glow`/`shadow` effects.
  - [`OimCanonicalizerTest.kt`](oim-sdk/src/test/java/media/oim/sdk/OimCanonicalizerTest.kt): canonical JSON rules, multilingual fallback, palettes and keyframe sampling.
  - App suites in [`app/src/test/java/com/example/`](../../apps/viewer-android/app/src/test/java/media/oim/viewer/): `OimSdkUnitTest`, `OimCacheAndResilienceTest`.
- **Conformance files**: read in place from [`packages/spec`](../../packages/spec) (`vectors/`, `vectors-2/`, `canonical-cases.json`); `oim-sdk/build.gradle.kts` passes the path to the tests, so there are no copies to keep in sync.
- **External references**:
  - OIM documentation: https://oim.media/docs/
  - OIM repository: https://github.com/oim-media/oim
  - Spec and reference packages used for parity: `@oim-media/core`, `@oim-media/scene`, `@oim-media/player-oim` and `@oim-media/spec`.
  - Platform endpoints: `https://library.oim.media/v1/showcase` and `https://api.oim.media/v1/media/keys`.
