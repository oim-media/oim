/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private fun parseEvenOddPath(pathData: String): Path =
    PathParser().parsePathString(pathData).toPath().apply {
        fillType = PathFillType.EvenOdd
    }

// Official `oim-marca.svg` (256x256, centered at 128,128 with -75deg rotation)
private val FULL_MARK_PATHS: List<Path> by lazy {
    listOf(
        "M-66.40 -75.10H66.40A35.00 35.00 0 0 1 101.40 -40.10V40.10A35.00 35.00 0 0 1 66.40 75.10H-66.40A35.00 35.00 0 0 1 -101.40 40.10V-40.10A35.00 35.00 0 0 1 -66.40 -75.10ZM-66.40 -65.10H66.40A25.00 25.00 0 0 1 91.40 -40.10V40.10A25.00 25.00 0 0 1 66.40 65.10H-66.40A25.00 25.00 0 0 1 -91.40 40.10V-40.10A25.00 25.00 0 0 1 -66.40 -65.10Z",
        "M-55.40 -41.90H55.50A10.00 10.00 0 0 1 65.50 -31.90V31.90A10.00 10.00 0 0 1 55.50 41.90H-55.40A10.00 10.00 0 0 1 -65.40 31.90V-31.90A10.00 10.00 0 0 1 -55.40 -41.90ZM-50.40 -30.60H37.00A15.00 15.00 0 0 1 52.00 -15.60V26.90A15.00 15.00 0 0 1 37.00 41.90H-50.40A15.00 15.00 0 0 1 -65.40 26.90V-15.60A15.00 15.00 0 0 1 -50.40 -30.60Z",
        "M-55.40 -20.60H32.00A10.00 10.00 0 0 1 42.00 -10.60V31.90A10.00 10.00 0 0 1 32.00 41.90H-55.40A10.00 10.00 0 0 1 -65.40 31.90V-10.60A10.00 10.00 0 0 1 -55.40 -20.60ZM-50.40 -10.00H12.90A15.00 15.00 0 0 1 27.90 5.00V26.90A15.00 15.00 0 0 1 12.90 41.90H-50.40A15.00 15.00 0 0 1 -65.40 26.90V5.00A15.00 15.00 0 0 1 -50.40 -10.00Z",
        "M-55.40 0.00H7.90A10.00 10.00 0 0 1 17.90 10.00V31.90A10.00 10.00 0 0 1 7.90 41.90H-55.40A10.00 10.00 0 0 1 -65.40 31.90V10.00A10.00 10.00 0 0 1 -55.40 0.00Z"
    ).map(::parseEvenOddPath)
}

// Official `oim-marca-simple.svg` (256x256 inner coordinate space for sizes < 32dp)
private val SIMPLE_OUTER_PATH: Path by lazy {
    parseEvenOddPath(
        "M84.00 15.00H172.00A69.00 69.00 0 0 1 241.00 84.00V172.00A69.00 69.00 0 0 1 172.00 241.00H84.00A69.00 69.00 0 0 1 15.00 172.00V84.00A69.00 69.00 0 0 1 84.00 15.00ZM84.00 33.00H172.00A51.00 51.00 0 0 1 223.00 84.00V172.00A51.00 51.00 0 0 1 172.00 223.00H84.00A51.00 51.00 0 0 1 33.00 172.00V84.00A51.00 51.00 0 0 1 84.00 33.00Z"
    )
}

private val SIMPLE_INNER_PATH: Path by lazy {
    parseEvenOddPath(
        "M-44.00 -53.00H44.00A25.00 25.00 0 0 1 69.00 -28.00V28.00A25.00 25.00 0 0 1 44.00 53.00H-44.00A25.00 25.00 0 0 1 -69.00 28.00V-28.00A25.00 25.00 0 0 1 -44.00 -53.00ZM-44.00 -35.00H44.00A7.00 7.00 0 0 1 51.00 -28.00V28.00A7.00 7.00 0 0 1 44.00 35.00H-44.00A7.00 7.00 0 0 1 -51.00 28.00V-28.00A7.00 7.00 0 0 1 -44.00 -35.00Z"
    )
}

/**
 * Official OIM vector brand mark.
 * Automatically follows the ecosystem size rule: `oim-marca-simple` under 32dp, `oim-marca` at 32dp+.
 */
@Composable
fun OimBrandMark(
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
    tint: Color = LocalContentColor.current,
    contentDescription: String? = null
) {
    val semanticMod = if (contentDescription != null) {
        modifier.semantics {
            this.contentDescription = contentDescription
            this.role = Role.Image
        }
    } else {
        modifier
    }
    Canvas(modifier = semanticMod.size(size)) {
        val uniformScaleX = this.size.width / 256f
        val uniformScaleY = this.size.height / 256f
        withTransform({
            scale(scaleX = uniformScaleX, scaleY = uniformScaleY, pivot = Offset.Zero)
        }) {
            if (size < 32.dp) {
                drawPath(SIMPLE_OUTER_PATH, color = tint)
                withTransform({
                    translate(128f, 128f)
                    rotate(degrees = -75f, pivot = Offset.Zero)
                }) {
                    drawPath(SIMPLE_INNER_PATH, color = tint)
                }
            } else {
                withTransform({
                    translate(128f, 128f)
                    rotate(degrees = -75f, pivot = Offset.Zero)
                }) {
                    FULL_MARK_PATHS.forEach { path ->
                        drawPath(path, color = tint)
                    }
                }
            }
        }
    }
}
