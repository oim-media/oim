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
internal fun maskSilhouette(name: String?, box: Rect): Path {
    val d = CATALOGUE[name ?: "circle"] ?: return Path().apply { addRect(box) }
    val (v0, vSize) = if (name == "line") 0f to 100f else 5f to 90f
    val path = PathParser().parsePathString(d).toPath()
    path.asAndroidPath().transform(android.graphics.Matrix().apply {
        setTranslate(-v0, -v0)
        postScale(box.width / vSize, box.height / vSize)
        postTranslate(box.left, box.top)
    })
    return path
}
