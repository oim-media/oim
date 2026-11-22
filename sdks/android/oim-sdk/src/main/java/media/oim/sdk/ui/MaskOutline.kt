/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.asComposePath

/** GEO_SHAPES of @oim-media/core (geoShapes.ts), in its viewBox 0 0 100 100. Keep in step with it. */
private val CATALOGUE = mapOf(
    "triangle" to "M50 5 L95 90 L5 90 Z",
    "star" to "M50 2 L62 38 L100 38 L69 59 L80 95 L50 73 L20 95 L31 59 L0 38 L38 38 Z",
    "arrow" to "M5 40 L60 40 L60 20 L95 50 L60 80 L60 60 L5 60 Z",
    "diamond" to "M50 5 L95 50 L50 95 L5 50 Z",
    "hexagon" to "M25 5 L75 5 L95 50 L75 95 L25 95 L5 50 Z",
    "circle" to "M 50,5 A 45,45 0 1,1 49.999,5 Z",
    "heart" to "M 50,88 C 10,60 -5,30 15,12 C 30,-2 50,5 50,25 C 50,5 70,-2 85,12 C 105,30 90,60 50,88 Z",
    "blob" to "M 50,10 C 75,10 92,25 90,50 C 88,75 75,90 50,90 C 25,90 10,75 10,50 C 10,25 25,10 50,10 Z",
    "scribble" to "M 5,80 Q 25,65 50,75 T 95,70 Q 75,85 50,82 T 5,88 Z",
    "pill" to "M 30,25 L 70,25 C 83.8,25 95,36.2 95,50 C 95,63.8 83.8,75 70,75 L 30,75 C 16.2,75 5,63.8 5,50 C 5,36.2 16.2,25 30,25 Z",
    "octagon" to "M30 5 L70 5 L95 30 L95 70 L70 95 L30 95 L5 70 L5 30 Z",
    "pentagon" to "M50 5 L94.7 37.5 L77.6 90 L22.4 90 L5.3 37.5 Z",
    "cross" to "M35 5 L65 5 L65 35 L95 35 L95 65 L65 65 L65 95 L35 95 L35 65 L5 65 L5 35 L35 35 Z",
    "moon" to "M 50,5 C 25.15,5 5,25.15 5,50 C 5,74.85 25.15,95 50,95 C 30,80 30,20 50,5 Z",
    "cloud" to "M 25,85 C 8,85 5,62 22,58 C 14,40 35,32 45,42 C 48,22 75,20 78,42 C 96,40 97,66 80,68 C 80,78 78,85 68,85 Z",
    "drop" to "M 50,5 C 62,25 80,45 80,65 C 80,81.5 66.5,95 50,95 C 33.5,95 20,81.5 20,65 C 20,45 38,25 50,5 Z",
    "bolt" to "M62 5 L18 58 L46 58 L34 95 L82 40 L55 40 L72 5 Z",
    "bubble" to "M 20,5 L 80,5 C 88.3,5 95,11.7 95,20 L 95,57 C 95,65.3 88.3,72 80,72 L 42,72 L 22,93 L 28,72 L 20,72 C 11.7,72 5,65.3 5,57 L 5,20 C 5,11.7 11.7,5 20,5 Z",
    "flower" to "M 65.6,41.0 C 85.5,35.7 97.5,39.9 95.0,50.0 C 97.5,60.1 85.5,64.3 65.6,59.0 C 80.1,73.5 82.5,86.1 72.5,89.0 C 65.0,96.2 55.3,87.9 50.0,68.0 C 44.7,87.9 35.0,96.2 27.5,89.0 C 17.5,86.1 19.9,73.5 34.4,59.0 C 14.5,64.3 2.5,60.1 5.0,50.0 C 2.5,39.9 14.5,35.7 34.4,41.0 C 19.9,26.5 17.5,13.9 27.5,11.0 C 35.0,3.8 44.7,12.1 50.0,32.0 C 55.3,12.1 65.0,3.8 72.5,11.0 C 82.5,13.9 80.1,26.5 65.6,41.0 Z",
    "burst" to "M95 50 L82.8 58.8 L89 72.5 L74 74 L72.5 89 L58.8 82.8 L50 95 L41.2 82.8 L27.5 89 L26 74 L11 72.5 L17.2 58.8 L5 50 L17.2 41.2 L11 27.5 L26 26 L27.5 11 L41.2 17.2 L50 5 L58.8 17.2 L72.5 11 L74 26 L89 27.5 L82.8 41.2 Z",
    "arch" to "M 5,95 L 5,50 C 5,25.15 25.15,5 50,5 C 74.85,5 95,25.15 95,50 L 95,95 Z",
    // A line is a stroke; as a mask it must cut a surface (mask-outline.ts LINE_SURFACE).
    "line" to "M5 45 L95 45 L95 55 L5 55 Z",
)

/**
 * A mask's silhouette in canvas pixels inside [box], as maskOutlinePath in @oim-media/core:
 * the catalogue's content area (5 5 90 90) is fitted to the box, so tips such as the star's
 * may cross it. A rectangle, or a name the catalogue lacks, is the box itself.
 */
/** Parsing a d string allocates and costs on every frame a shape relayouts: parse each once. */
private val PARSED = java.util.concurrent.ConcurrentHashMap<String, android.graphics.Path>()

internal fun parsedCopy(d: String): Path =
    android.graphics.Path(PARSED.getOrPut(d) { traced("oim:parse-path") { PathParser().parsePathString(d).toPath().asAndroidPath() } }).asComposePath()

internal fun maskSilhouette(name: String?, box: Rect): Path {
    val d = CATALOGUE[name ?: "circle"] ?: return Path().apply { addRect(box) }
    val (v0, vSize) = if (name == "line") 0f to 100f else 5f to 90f
    val path = parsedCopy(d)
    path.asAndroidPath().transform(android.graphics.Matrix().apply {
        setTranslate(-v0, -v0)
        postScale(box.width / vSize, box.height / vSize)
        postTranslate(box.left, box.top)
    })
    return path
}

/** presetPath(name, 100, 100) of @oim-media/core: each catalogue shape stretched to fill its box. */
private val PRESET_UNIT = mapOf(
    "triangle" to "M50 0L100 100L0 100Z",
    "star" to "M50 0L62 38.71L100 38.71L69 61.29L80 100L50 76.34L20 100L31 61.29L0 38.71L38 38.71Z",
    "arrow" to "M0 33.33L61.11 33.33L61.11 0L100 50L61.11 100L61.11 66.67L0 66.67Z",
    "diamond" to "M50 0L100 50L50 100L0 50Z",
    "hexagon" to "M22.22 0L77.78 0L100 50L77.78 100L22.22 100L0 50Z",
    "heart" to "M50 100C4.36 66.4 -12.76 30.4 10.06 8.79C27.18 -8.01 50 0.39 50 24.4C50 0.39 72.82 -8.01 89.94 8.79C112.76 30.4 95.64 66.4 50 100Z",
    "blob" to "M49.9 0C81.09 0 102.3 18.75 99.8 50C97.31 81.25 81.09 100 49.9 100C18.71 100 0 81.25 0 50C0 18.75 18.71 0 49.9 0Z",
    "scribble" to "M0 55.56C14.81 0 31.48 -9.26 50 27.78C68.52 64.81 85.19 55.56 100 0C85.19 55.56 68.52 77.78 50 66.67C31.48 55.56 14.81 66.67 0 100",
    "octagon" to "M27.78 0L72.22 0L100 27.78L100 72.22L72.22 100L27.78 100L0 72.22L0 27.78Z",
    "pentagon" to "M50 0L100 38.24L80.87 100L19.13 100L0 38.24Z",
    "cross" to "M33.33 0L66.67 0L66.67 33.33L100 33.33L100 66.67L66.67 66.67L66.67 100L33.33 100L33.33 66.67L0 66.67L0 33.33L33.33 33.33Z",
    "moon" to "M100 0C44.78 0 0 22.39 0 50C0 77.61 44.78 100 100 100C55.56 83.33 55.56 16.67 100 0Z",
    "cloud" to "M17.61 100C-3.25 100 -6.94 60.86 13.92 54.05C4.11 23.41 29.88 9.8 42.15 26.82C45.83 -7.22 78.96 -10.62 82.64 26.82C104.73 23.41 105.95 67.66 85.09 71.07C85.09 88.09 82.64 100 70.37 100Z",
    "drop" to "M50 0C70 22.22 100 44.44 100 66.67C100 85 77.5 100 50 100C22.5 100 0 85 0 66.67C0 44.44 30 22.22 50 0Z",
    "bolt" to "M68.75 0L0 58.89L43.75 58.89L25 100L100 38.89L57.81 38.89L84.38 0Z",
    "bubble" to "M15 0L85 0A15 15 0 0 1 100 15L100 61.14A15 15 0 0 1 85 76.14L41.11 76.14L18.89 100L25.56 76.14L15 76.14A15 15 0 0 1 0 61.14L0 15A15 15 0 0 1 15 0Z",
    "flower" to "M67.21 39.17C89.16 32.8 102.4 37.85 99.64 50C102.4 62.15 89.16 67.2 67.21 60.83C83.2 78.27 85.85 93.43 74.82 96.92C66.55 105.58 55.85 95.6 50 71.66C44.15 95.6 33.45 105.58 25.18 96.92C14.15 93.43 16.8 78.27 32.79 60.83C10.84 67.2 -2.4 62.15 0.36 50C-2.4 37.85 10.84 32.8 32.79 39.17C16.8 21.73 14.15 6.57 25.18 3.08C33.45 -5.58 44.15 4.4 50 28.34C55.85 4.4 66.55 -5.58 74.82 3.08C85.85 6.57 83.2 21.73 67.21 39.17Z",
    "burst" to "M100 50L86.44 59.78L93.33 75L76.67 76.67L75 93.33L59.78 86.44L50 100L40.22 86.44L25 93.33L23.33 76.67L6.67 75L13.56 59.78L0 50L13.56 40.22L6.67 25L23.33 23.33L25 6.67L40.22 13.56L50 0L59.78 13.56L75 6.67L76.67 23.33L93.33 25L86.44 40.22Z",
)

/**
 * A shape layer's figure in a w x h box, as presetPath in @oim-media/core: the catalogue
 * drawing fitted to its own bounds. Null for the rectangle and names the catalogue lacks.
 * shortcut: the bubble's corner radius scales with the box instead of staying round; draw it per size if a frame shows it.
 */
internal fun presetSilhouette(name: String?, w: Float, h: Float): Path? {
    val rect = Rect(0f, 0f, w, h)
    fun rounded(top: Float, bottom: Float) = Path().apply {
        addRoundRect(androidx.compose.ui.geometry.RoundRect(rect,
            androidx.compose.ui.geometry.CornerRadius(top), androidx.compose.ui.geometry.CornerRadius(top),
            androidx.compose.ui.geometry.CornerRadius(bottom), androidx.compose.ui.geometry.CornerRadius(bottom)))
    }
    return when (name) {
        "circle" -> Path().apply { addOval(rect) }
        "arch" -> rounded(minOf(w / 2f, h), 0f)
        "pill" -> rounded(minOf(w, h) / 2f, minOf(w, h) / 2f)
        else -> PRESET_UNIT[name]?.let { d ->
            parsedCopy(d).also {
                it.asAndroidPath().transform(android.graphics.Matrix().apply { setScale(w / 100f, h / 100f) })
            }
        }
    }
}
