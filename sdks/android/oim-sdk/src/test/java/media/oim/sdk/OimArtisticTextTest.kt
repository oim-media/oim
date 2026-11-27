/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import android.graphics.PathMeasure
import android.graphics.RectF
import media.oim.sdk.ui.artisticTextLines
import media.oim.sdk.ui.buildArtisticCurvePath
import media.oim.sdk.ui.buildArtisticFaceShader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimArtisticTextTest {

    @Test
    fun artisticTextLines_splitsAndCentersOffsets() {
        val single = artisticTextLines("Fuente", 120f, 1.25f)
        assertEquals(listOf("Fuente" to 0f), single)

        val multi = artisticTextLines("ciudad\nsur", 64f, 1.25f)
        assertEquals(2, multi.size)
        assertEquals("ciudad", multi[0].first)
        assertEquals(-40f, multi[0].second, 0.01f)
        assertEquals("sur", multi[1].first)
        assertEquals(40f, multi[1].second, 0.01f)
    }

    @Test
    fun buildArtisticCurvePath_generatesExpectedLengths() {
        val straight = PathMeasure(buildArtisticCurvePath(800f, 220f, 0f, "arc"), false)
        assertEquals(800f, straight.length, 0.5f)

        val arc = PathMeasure(buildArtisticCurvePath(800f, 220f, 60f, "arc"), false)
        assertTrue("Expected arc curve longer than chord, got ${arc.length}", arc.length > 800f)

        val wave = PathMeasure(buildArtisticCurvePath(800f, 220f, 50f, "wave"), false)
        assertTrue("Expected wave curve longer than chord, got ${wave.length}", wave.length > 800f)
    }

    @Test
    fun buildArtisticFaceShader_returnsShadersForPresetsAndNullOtherwise() {
        val bounds = RectF(0f, 0f, 400f, 120f)
        assertNotNull(buildArtisticFaceShader("sunset-gold", bounds))
        assertNotNull(buildArtisticFaceShader("metallic-chrome", bounds))
        assertNotNull(buildArtisticFaceShader("neon-glow", bounds))
        assertNull(buildArtisticFaceShader(null, bounds))
        assertNull(buildArtisticFaceShader("unknown", bounds))
        assertNull(buildArtisticFaceShader("sunset-gold", RectF()))
    }
}
