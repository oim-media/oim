/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.animation.OimKeyframeSampler
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimKeyframe
import media.oim.sdk.network.OimLibraryClient
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimCanonicalizerTest {

    @Test
    fun rule2_excludesSignatureKeyVersionTimestampAndCreatorUserIdOnlyAtRoot() {
        val input = JSONObject(
            """
            {
              "signature": "sig123",
              "key_version": "v1",
              "timestamp": 12345678,
              "creator_user_id": "user_xyz",
              "name": "Cartel",
              "slots": [
                {
                  "id": "s1",
                  "timestamp": 9999,
                  "creator_user_id": "preserved_inside"
                }
              ]
            }
            """.trimIndent()
        )
        val out = OimCanonicalizerAndVerifier.canonicalJson(input)
        assertEquals(
            """{"name":"Cartel","slots":[{"creator_user_id":"preserved_inside","id":"s1","timestamp":9999}]}""",
            out
        )
    }

    @Test
    fun rule3_normalizesFloatIntegersAndRoundsToSixDecimals() {
        val input = JSONObject(
            """
            {
              "enteroFloat": 2.0,
              "ceroFloat": -0.0,
              "decimalCorto": 0.5,
              "decimalLargo": 0.123456789,
              "negativoLargo": -45.1234564
            }
            """.trimIndent()
        )
        val out = OimCanonicalizerAndVerifier.canonicalJson(input)
        assertEquals(
            """{"ceroFloat":0,"decimalCorto":0.5,"decimalLargo":0.123457,"enteroFloat":2,"negativoLargo":-45.123456}""",
            out
        )
    }

    @Test
    fun rule4To7_sortsRecursivelyAndEmitsCompactRawUtf8() {
        val input = JSONObject(
            """
            {
              "z": [{"y": 10, "x": 20}],
              "title": "Diseño para niños con acción",
              "a": 2
            }
            """.trimIndent()
        )
        val out = OimCanonicalizerAndVerifier.canonicalJson(input)
        assertEquals(
            """{"a":2,"title":"Diseño para niños con acción","z":[{"x":20,"y":10}]}""",
            out
        )
    }

    @Test
    fun hasNumberOutOfRange_detectsNumbersBeyondSafeInteger() {
        assertFalse(OimCanonicalizerAndVerifier.hasNumberOutOfRange(JSONObject("""{"x": 9007199254740991}""")))
        assertTrue(OimCanonicalizerAndVerifier.hasNumberOutOfRange(JSONObject("""{"x": 9007199254740993.0}""")))
    }

    @Test
    fun resolveContent_followsWildcardAndFallbackChain() {
        val dict = mapOf("es" to "Hola", "en" to "Hello", "fr" to "Bonjour")
        assertEquals("Bonjour", OimCanonicalizerAndVerifier.resolveContent(dict, "fr").text)
        assertEquals("Hello", OimCanonicalizerAndVerifier.resolveContent(dict, "de").text)

        val wildcard = mapOf("*" to "UNIVERSAL", "en" to "Hello")
        val resolved = OimCanonicalizerAndVerifier.resolveContent(wildcard, "en")
        assertEquals("UNIVERSAL", resolved.text)
        assertTrue(resolved.wasFinalWildcard)
    }

    @Test
    fun resolvePalette_prefersRequestedThenDarkLightThenDefault() {
        val palettes = mapOf(
            "light" to mapOf("primary" to "#111111", "surface" to "#ffffff"),
            "dark" to mapOf("primary" to "#f59e0b", "surface" to "#0e1015")
        )
        val byDark = OimCanonicalizerAndVerifier.resolvePalette(palettes, "light", prefersDark = true)
        assertNotNull(byDark)
        assertEquals("dark", byDark!!.first)
        assertEquals("#f59e0b", byDark.second["primary"])

        val byExplicit = OimCanonicalizerAndVerifier.resolvePalette(palettes, "dark", requested = "light", prefersDark = true)
        assertEquals("light", byExplicit!!.first)
    }

    @Test
    fun sampleKeyframes_interpolatesTransformAndOpacity() {
        val frames = listOf(
            OimKeyframe(t = 0.0, o = 0.0, x = 0.0, s = 0.8),
            OimKeyframe(t = 1.0, o = 1.0, x = 100.0, s = 1.0)
        )
        val mid = OimKeyframeSampler.sampleKeyframes(frames, durationSec = 1.0, timeSec = 0.5)
        assertEquals(50f, mid.x, 0.01f)
        assertEquals(0.9f, mid.s, 0.01f)
        assertEquals(0.5f, mid.o, 0.01f)
    }

    @Test
    fun libraryClient_parsesRealWorkerShowcaseResponse() {
        val client = OimLibraryClient()
        val realShowcaseJson = """
            {
              "items": [
                {
                  "id": "550e8400-e29b-41d4-a716-446655440000",
                  "title": "Cartel Urbano",
                  "title_en": "Urban Poster",
                  "description": "Diseño interactivo",
                  "description_en": "Interactive design",
                  "thumbnail_url": "https://assets.oim.media/thumb/poster.webp",
                  "media_url": "https://assets.oim.media/oim/poster.oim.png",
                  "type": "image",
                  "aspect_ratio": "4:3",
                  "category": "Editorial",
                  "tags": ["poster", "parallax"],
                  "features": ["i18n"],
                  "created_at": "2026-10-01T12:00:00Z",
                  "is_template": true
                }
              ],
              "next_cursor": "cursor_abc"
            }
        """.trimIndent()

        val (items, cursor) = client.parseShowcaseResponse(realShowcaseJson, "https://library.oim.media/v1/showcase")
        assertEquals(1, items.size)
        assertEquals("cursor_abc", cursor)
        assertEquals("Cartel Urbano", items[0].localizedTitle("es"))
        assertEquals("Urban Poster", items[0].localizedTitle("en"))
        assertEquals("https://assets.oim.media/oim/poster.oim.png", items[0].oimUrl)
        assertEquals("https://assets.oim.media/thumb/poster.webp", items[0].thumbnailUrl)
        assertTrue(items[0].isTemplate)
    }
}
