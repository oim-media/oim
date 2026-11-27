/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.model.OimGenerativeFill
import media.oim.sdk.parser.OimBinaryCodec
import media.oim.sdk.ui.OimMulberry32
import media.oim.sdk.ui.buildLayerStackPaths
import media.oim.sdk.ui.interpolateOklabHex
import media.oim.sdk.ui.resolveGenerativeColor
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimGenerativeFillTest {

    @Test
    fun mulberry32_isDeterministicAndWithinUnitInterval() {
        val a = OimMulberry32(7)
        val b = OimMulberry32(7)
        val seqA = List(10) { a.next() }
        val seqB = List(10) { b.next() }
        assertEquals(seqA, seqB)
        assertTrue(seqA.all { it >= 0.0 && it < 1.0 })
    }

    @Test
    fun oklabRamp_resolvesStopsDeterministically() {
        assertEquals("#f59e0b", resolveGenerativeColor("palette", listOf("#f59e0b", "#7c3aed"), "forward", 0, 5))
        assertEquals("#7c3aed", resolveGenerativeColor("palette", listOf("#f59e0b", "#7c3aed"), "forward", 4, 5))
        val mid = interpolateOklabHex("#f59e0b", "#7c3aed", 0.5)
        assertTrue(mid.startsWith("#") && mid.length == 7)
    }

    @Test
    fun buildLayerStackPaths_generatesConfiguredWaveLayers() {
        val fill = OimGenerativeFill(
            generatorId = "stacked-waves",
            seed = 7,
            params = mapOf("amplitude" to 0.5, "frequency" to 4, "layers" to 5),
            colorMode = "palette",
            colorStops = listOf("#f59e0b", "#7c3aed"),
            colorDirection = "forward",
            backgroundColorHex = "#0f172a",
            backgroundVisible = true
        )
        val paths = buildLayerStackPaths(fill, 600f, 400f)
        assertEquals(5, paths.size)
        assertEquals("#f59e0b", paths.first().colorHex)
        assertEquals("#7c3aed", paths.last().colorHex)
    }

    @Test
    fun parseDocumentJson_parsesGenerativeFillIntoLayerStyle() {
        val docJson = JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "canvas": { "width": 800, "height": 600 },
              "languages": ["es"],
              "layers": [
                {
                  "id": "waves",
                  "type": "shape",
                  "box": { "x": 100, "y": 100, "width": 600, "height": 400 },
                  "geometry": { "kind": "rect" },
                  "fills": [
                    {
                      "kind": "generative",
                      "generative": {
                        "generatorId": "stacked-waves",
                        "seed": 7,
                        "params": { "amplitude": 0.5, "frequency": 4, "layers": 5 },
                        "colors": {
                          "mode": "palette",
                          "direction": "forward",
                          "stops": ["#f59e0b", "#7c3aed"],
                          "background": "#0f172a",
                          "backgroundVisible": true
                        }
                      }
                    }
                  ]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(docJson)
        val gen = doc.layers.first().style.generativeFill
        assertNotNull(gen)
        assertEquals("stacked-waves", gen!!.generatorId)
        assertEquals(7, gen.seed)
        assertEquals("#0f172a", gen.backgroundColorHex)
        assertEquals(listOf("#f59e0b", "#7c3aed"), gen.colorStops)
    }
}
