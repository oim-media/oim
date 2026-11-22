# OIM Viewer for Android

Sample app for the [OIM Android SDK](../../sdks/android): a gallery of the public OIM library and an immersive viewer for `.oim` / `.oim.png` files, with signature verification, language and palette switching, zoom and parallax.

- **Library** ([`LibraryScreen.kt`](app/src/main/java/media/oim/viewer/ui/screens/LibraryScreen.kt)): staggered grid of `https://library.oim.media/v1/showcase` with infinite scroll, categories, search and opening local files (`ACTION_OPEN_DOCUMENT`).
- **Viewer** ([`ViewerScreen.kt`](app/src/main/java/media/oim/viewer/ui/screens/ViewerScreen.kt)): opens on the library's blurred thumbnail and sharpens when the file is ready; full-screen pinch-to-zoom, pan, double tap to reset, sensor and touch parallax, language and theme pickers, animation replay and a verification inspector.
- **Language**: files open in the device's language when it is Spanish, otherwise in English; if a file lacks it, in the file's default language. A language the reader picks applies to the next files too.
- UI strings in English (`res/values`) and Spanish (`res/values-es`).

## Build and run

Requirements: JDK 17+ and the Android SDK (`compileSdk = 36`, `minSdk = 24`). The build includes `../../sdks/android`, so the SDK is compiled from source and both share `sdks/android/gradle/libs.versions.toml`.

```bash
cd apps/viewer-android
./gradlew :app:testDebugUnitTest :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
