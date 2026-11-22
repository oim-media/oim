/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.parser.OimBinaryCodec
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BaseLayerTest {
    private fun has(layers: String, resources: String? = null) =
        OimBinaryCodec.hasV2BaseLayer(JSONArray(layers), resources?.let(::JSONObject))

    @Test fun aPosterFileHasNoBase() = assertFalse(has("""[{"image":{"src":"data:image/png;base64,x"}},{"text":{}}]"""))

    @Test fun aDirectBaseLayer() = assertTrue(has("""[{"image":{"src":"oim:base"}}]"""))

    @Test fun aNestedBaseLayer() = assertTrue(has("""[{"children":[{"image":{"src":"oim:base"}}]}]"""))

    @Test fun aBaseThroughAResource() = assertTrue(has("""[{"image":{"src":{"ref":"r"}}}]""", """{"r":{"kind":"image","src":"oim:base"}}"""))

    @Test fun aBaseInOneLanguage() = assertTrue(has("""[{"image":{"src":{"value":"data:x","modes":{"es":"oim:base"}}}}]"""))

    @Test fun aPosterFileDoesNotPaintItsPng() {
        val doc = OimBinaryCodec.parseDocumentJson(JSONObject("""{"oim":"2.0.0","canvas":{"width":800,"height":600},"layers":[{"id":"t","type":"text","box":{"x":0,"y":0,"width":10,"height":10},"text":{"content":"a"}}]}"""))
        assertFalse(doc.pngIsBase)
    }

    @Test fun aShapeFilledThroughAResourceShowsTheImage() {
        val doc = OimBinaryCodec.parseDocumentJson(JSONObject("""{"oim":"2.0.0","canvas":{"width":800,"height":600},
            "resources":{"r":{"kind":"image","src":"data:image/png;base64,AA","flipY":true}},
            "layers":[{"id":"h","type":"shape","box":{"x":0,"y":0,"width":10,"height":10},"geometry":{"kind":"preset","name":"drop"},"fills":[{"ref":"r"}]}]}"""))
        val fill = doc.layers.single().style.imageFill
        assertTrue(fill?.src == "data:image/png;base64,AA" && fill.flipY)
    }
}
