/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.animation.OimKeyframeSampler
import media.oim.sdk.animation.OimTextAnimator
import media.oim.sdk.crypto.OimCanonicalizerAndVerifier
import media.oim.sdk.model.OimAuthor
import media.oim.sdk.model.OimCanvasSpec
import media.oim.sdk.model.OimDimension
import media.oim.sdk.model.OimDocument
import media.oim.sdk.model.OimError
import media.oim.sdk.model.OimLayerKind
import media.oim.sdk.model.OimSecurityBlock
import media.oim.sdk.model.ReeditPermission
import media.oim.sdk.model.SecurityStatus
import media.oim.sdk.parser.OimBinaryCodec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.zip.CRC32
import java.util.zip.Deflater

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimBinaryCodecTest {

    @Test(expected = OimError.UnsupportedVersion::class)
    fun decodeConformanceVector_v1_throwsUnsupportedVersion() {
        val bytes = loadVector("vectors/basic-text.oim.png")
        OimBinaryCodec.decodeAndVerify(bytes, "basic-text.oim.png", decodeBitmap = false)
    }

    @Test
    fun decodeConformanceVector_basicText_extractsMetadataAndVerifiesSignature() {
        val bytes = loadVector("vectors-2/basic-text.oim.png")
        val asset = OimBinaryCodec.decodeAndVerify(bytes, "basic-text.oim.png", decodeBitmap = false)

        val doc = asset.document
        assertNotNull("Expected parsed OimDocument", doc)
        doc!!

        assertEquals(800, doc.canvas.naturalWidth)
        assertEquals(600, doc.canvas.naturalHeight)
        assertTrue(doc.pngIsBase)
        assertEquals(1, doc.layers.size)

        val layer = doc.layers[0]
        assertEquals("titulo", layer.id)
        assertEquals(OimLayerKind.TEXT, layer.kind)
        assertEquals(10.0, layer.x, 0.001)
        assertEquals(10.0, layer.y, 0.001)
        assertEquals("Hello", layer.content["en"])
        assertEquals("Hola", layer.content["es"])
        assertEquals(OimDimension.Px(400.0), layer.widthDim)
        assertEquals(OimDimension.Px(90.0), layer.heightDim)
        assertEquals(OimDimension.Px(40.0), layer.style.fontSizeDim)

        assertFalse("Real conformance vector must not be refused: ${asset.verification.reason}", asset.verification.isRefused)
        assertTrue("Expected valid ECDSA signature with embedded v1 key", asset.verification.signatureValid)
        assertTrue(asset.chunks.all { it.crcValid })
    }

    @Test
    fun decodeConformanceVector_animationPresets_extractsFontsAndPresets() {
        val bytes = loadVector("vectors-2/animation-presets.oim.png")
        val asset = OimBinaryCodec.decodeAndVerify(bytes, "animation-presets.oim.png", decodeBitmap = false)

        val doc = asset.document!!
        assertEquals(800, doc.canvas.width)
        assertEquals(600, doc.canvas.height)
        assertEquals(ReeditPermission.AUTHOR_ONLY, doc.security.reeditPermission)
        assertEquals(1, doc.fonts.size)
        assertEquals("Inter", doc.fonts[0].family)
        assertEquals(3, doc.layers.size)

        assertEquals("pulse", doc.layers[0].id)
        assertEquals(OimLayerKind.GEO, doc.layers[0].kind)
        assertEquals("grow", doc.layers[1].id)
        assertEquals("grow", doc.layers[1].animation.hoverKind)
        assertEquals("chars", doc.layers[2].id)
        assertEquals("fade-chars", doc.layers[2].style.textAnimationType)
        assertFalse(asset.verification.isRefused)
        assertTrue(asset.verification.signatureValid)
    }

    @Test
    fun decodeConformanceVector_accessibility_extractsAltAndDecorativeFlags() {
        val bytes = loadVector("vectors-2/accessibility.oim.png")
        val asset = OimBinaryCodec.decodeAndVerify(bytes, "accessibility.oim.png", decodeBitmap = false)

        val doc = asset.document!!
        assertEquals(3, doc.layers.size)

        val foto = doc.layers.first { it.id == "foto" }
        assertEquals(OimLayerKind.IMAGE, foto.kind)
        assertEquals("A fjord between mountains", foto.style.alt["en"])
        assertEquals("Un fiordo entre montañas", foto.style.alt["es"])

        val adorno = doc.layers.first { it.id == "adorno" }
        assertTrue(adorno.style.decorative)
        assertFalse(asset.verification.isRefused)
        assertTrue(asset.verification.signatureValid)
    }

    @Test
    fun computeIdatSha256Hash_hashesOnlyIdatPayloads() {
        val idatPayload = byteArrayOf(10, 20, 30, 40, 50, 60)
        val expectedHash = MessageDigest.getInstance("SHA-256")
            .digest(idatPayload)
            .joinToString("") { "%02x".format(it) }

        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val ihdr = ByteBuffer.allocate(13).order(ByteOrder.BIG_ENDIAN)
            .putInt(1).putInt(1).put(8).put(6).put(0).put(0).put(0).array()
        writePngChunk(out, "IHDR", ihdr)
        writePngChunk(out, "IDAT", idatPayload.copyOfRange(0, 3))
        writePngChunk(out, "IDAT", idatPayload.copyOfRange(3, 6))
        writePngChunk(out, "IEND", ByteArray(0))

        assertEquals(expectedHash, OimBinaryCodec.computeIdatSha256Hash(out.toByteArray()))
    }

    @Test
    fun encodeSignedOimPng_verifiesValidAndRefusesTamperedIdat() {
        val basePng = buildMinimalValidPng()
        val (keyId, keyPair) = OimCanonicalizerAndVerifier.getLocalAuthorityKeyPair()
        val doc = OimDocument(
            id = "test-oim-01",
            title = mapOf("es" to "Prueba", "en" to "Test"),
            description = mapOf("en" to "Round-trip binary test"),
            author = OimAuthor("Tester", "@test", keyId),
            canvas = OimCanvasSpec(1, 1),
            languages = listOf("es", "en"),
            layers = emptyList(),
            security = OimSecurityBlock(
                imageHash = "",
                signature = null,
                keyId = keyId,
                reeditPermission = ReeditPermission.PUBLIC
            )
        )

        val signedBytes = OimBinaryCodec.encodeSignedOimPng(basePng, doc, keyId, keyPair)
        val verified = OimBinaryCodec.decodeAndVerify(signedBytes, "test.oim.png", decodeBitmap = false)
        assertEquals(SecurityStatus.VERIFIED_SELF_SIGNED, verified.verification.status)
        assertFalse(verified.verification.isRefused)
        assertTrue(verified.verification.imageHashMatches)
        assertEquals(ReeditPermission.PUBLIC, verified.verification.effectiveReeditPermission)

        val tamperedBytes = OimBinaryCodec.createTamperedCopy(signedBytes)
        val refused = OimBinaryCodec.decodeAndVerify(tamperedBytes, "tampered.oim.png", decodeBitmap = false)
        assertEquals(SecurityStatus.REFUSED_TAMPERED, refused.verification.status)
        assertTrue(refused.verification.isRefused)
        assertEquals(ReeditPermission.AUTHOR_ONLY, refused.verification.effectiveReeditPermission)
    }

    @Test
    fun parseDocumentJson_supportsOimV2TextAndBoxWithoutLanguagePollution() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Poster V2",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es", "en"],
              "reedit": "public",
              "layers": [
                {
                  "id": "bg",
                  "type": "image",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 1080 },
                  "image": { "src": "oim:base" }
                },
                {
                  "id": "headline",
                  "type": "text",
                  "box": { "x": 54, "y": 108, "width": 972, "height": 120 },
                  "fills": [{ "kind": "color", "value": "#111827" }],
                  "text": {
                    "content": { "en": "SIDE A: PACIFIC BREEZE", "es": "CARA A: BRISA DEL PACÍFICO" },
                    "align": "center",
                    "font": { "family": "Inter", "size": 54, "weight": 700 }
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(listOf("es", "en"), doc.languages)
        assertEquals(1, doc.layers.size)
        val textLayer = doc.layers[0]
        assertEquals("headline", textLayer.id)
        assertEquals(OimLayerKind.TEXT, textLayer.kind)
        assertEquals(5.0, textLayer.x, 0.01)
        assertEquals(10.0, textLayer.y, 0.01)
        assertEquals("SIDE A: PACIFIC BREEZE", textLayer.content["en"])
        assertEquals("CARA A: BRISA DEL PACÍFICO", textLayer.content["es"])
        assertEquals("#111827", textLayer.style.textColorHex)
        assertEquals(700, textLayer.style.fontWeight)
    }

    @Test
    fun parseDocumentJson_v2GroupChildrenKeepRootCanvasCoordinates() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Grouped V2",
              "canvas": { "width": 1080, "height": 1920 },
              "languages": ["es", "en"],
              "reedit": "public",
              "layers": [
                {
                  "id": "date_group",
                  "type": "group",
                  "box": { "x": 186, "y": 718, "width": 710, "height": 97 },
                  "children": [
                    {
                      "id": "date_text",
                      "type": "text",
                      "box": { "x": 186, "y": 718, "width": 543, "height": 97 },
                      "text": {
                        "content": { "es": "Saturday, 9 Oct, 2026" },
                        "font": { "family": "Inter", "size": 60 }
                      }
                    },
                    {
                      "id": "lock_icon",
                      "type": "shape",
                      "box": { "x": 491, "y": 1522, "width": 100, "height": 100 }
                    }
                  ]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(2, doc.layers.size)
        val dateText = doc.layers[0]
        val lockIcon = doc.layers[1]
        assertEquals(186.0 / 1080.0 * 100.0, dateText.x, 0.05)
        assertEquals(718.0 / 1920.0 * 100.0, dateText.y, 0.05)
        assertEquals(491.0 / 1080.0 * 100.0, lockIcon.x, 0.05)
        assertEquals(1522.0 / 1920.0 * 100.0, lockIcon.y, 0.05)
    }

    @Test
    fun parseDocumentJson_v2MultiPathSvgAndCornersArePreserved() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Vector Icon V2",
              "canvas": { "width": 1080, "height": 1920 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "lock_vec",
                  "type": "shape",
                  "box": { "x": 501, "y": 1537, "width": 80, "height": 70, "rotation": 90 },
                  "corners": 24,
                  "geometry": {
                    "kind": "paths",
                    "viewBox": [0, 0, 24, 24],
                    "paths": [
                      { "d": "M4 13V19", "stroke": "#FFFFFF", "strokeWidth": 1.5, "cap": "round", "join": "round" },
                      { "d": "M12 16A1 1 0 1 0 12 14", "fill": "#FFFFFF" }
                    ]
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(1, doc.layers.size)
        val layer = doc.layers[0]
        assertEquals(90.0, layer.rotationDeg, 0.01)
        assertEquals(24.0, (layer.style.cornerRadii?.topStart as? media.oim.sdk.model.OimDimension.Px)?.value ?: -1.0, 0.01)
        assertEquals(2, layer.style.svgPaths.size)
        assertEquals("M4 13V19", layer.style.svgPaths[0].d)
        assertEquals("#FFFFFF", layer.style.svgPaths[0].stroke)
        assertEquals(1.5f, layer.style.svgPaths[0].strokeWidth)
        assertEquals("round", layer.style.svgPaths[0].cap)
        assertEquals("round", layer.style.svgPaths[0].join)
        assertEquals("M12 16A1 1 0 1 0 12 14", layer.style.svgPaths[1].d)
        assertEquals("#FFFFFF", layer.style.svgPaths[1].fill)
    }

    @Test
    fun parseDocumentJson_v2ImageFillLineShadowAndArtisticTextAreParsed() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Rich V2 Features",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "circle_photo",
                  "type": "shape",
                  "box": { "x": 120, "y": 395, "width": 330, "height": 330 },
                  "geometry": { "kind": "ellipse" },
                  "fills": [
                    { "kind": "image", "src": "data:image/png;base64,iVBORw==", "crop": { "x": 50, "y": 88.5, "zoom": 1.25 } },
                    { "kind": "color", "value": "#e76f51" }
                  ],
                  "strokes": [{ "paint": { "kind": "color", "value": "#fdf0d5" }, "width": 4 }],
                  "effects": [{ "kind": "shadow", "x": 8, "y": 8, "blur": 0, "color": "#f4a261" }]
                },
                {
                  "id": "divider",
                  "type": "shape",
                  "box": { "x": 120, "y": 860, "width": 840, "height": 4 },
                  "geometry": { "kind": "line" },
                  "strokes": [{ "paint": { "kind": "color", "value": "#f4a261" }, "width": 2 }]
                },
                {
                  "id": "hero_title",
                  "type": "text",
                  "box": { "x": 80, "y": 175, "width": 920, "height": 190 },
                  "fills": [{ "kind": "gradient", "preset": "sunset-gold", "stops": [] }],
                  "strokes": [
                    { "paint": { "kind": "color", "value": "#1d3557" }, "width": 3, "align": "outside" },
                    { "paint": { "kind": "color", "value": "#ffffff" }, "width": 1.5, "align": "inside" }
                  ],
                  "text": {
                    "content": { "es": "SOLARIS GROOVE" },
                    "font": { "family": "Righteous", "size": 82 },
                    "artistic": {
                      "curve": { "amount": 24, "type": "arc" },
                      "extrusion": { "color": "#e76f51", "depth": 16, "angle": 60, "shading": false }
                    }
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(3, doc.layers.size)

        val circlePhoto = doc.layers[0]
        assertEquals("circle", circlePhoto.style.geoShape)
        assertNotNull(circlePhoto.style.imageFill)
        assertEquals("data:image/png;base64,iVBORw==", circlePhoto.style.imageFill?.src)
        assertEquals(88.5f, circlePhoto.style.imageFill?.cropY ?: -1f, 0.01f)
        assertEquals(1.25f, circlePhoto.style.imageFill?.cropZoom ?: -1f, 0.01f)
        assertTrue(circlePhoto.style.shadowEnabled)
        assertEquals("#f4a261", circlePhoto.style.shadowColorHex)
        assertEquals(8f, circlePhoto.style.shadowOffsetX, 0.01f)

        val divider = doc.layers[1]
        assertEquals("line", divider.style.geoShape)

        val heroTitle = doc.layers[2]
        assertEquals(media.oim.sdk.model.OimTextAlign.CENTER, heroTitle.style.textAlign)
        assertNotNull(heroTitle.style.artistic)
        assertEquals("arc", heroTitle.style.artistic?.curveType)
        assertEquals("#e76f51", heroTitle.style.artistic?.extrusionColorHex)
        assertEquals(16f, heroTitle.style.artistic?.extrusionDepthPx ?: -1f, 0.01f)
        assertEquals(60f, heroTitle.style.artistic?.extrusionAngleDeg ?: -1f, 0.01f)
        assertFalse(heroTitle.style.artistic?.extrusionShading ?: true)
        assertEquals("#1d3557", heroTitle.style.artistic?.outerStrokeColorHex)
        assertEquals(3f, heroTitle.style.artistic?.outerStrokeWidthPx ?: -1f, 0.01f)
        assertEquals("#ffffff", heroTitle.style.artistic?.innerStrokeColorHex)
        assertEquals(1.5f, heroTitle.style.artistic?.innerStrokeWidthPx ?: -1f, 0.01f)
        assertEquals("sunset-gold", heroTitle.style.artistic?.textGradientType)
    }

    @Test
    fun parseDocumentJson_v2VariablesPalettesGradientsPatternAndMotionLoop() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Dynamic V2 Scene",
              "canvas": {
                "width": 1080,
                "height": 1080,
                "fills": [
                  {
                    "kind": "gradient",
                    "gradient": {
                      "type": "linear",
                      "angle": 135,
                      "stops": [
                        { "color": "#0F172A", "at": 0 },
                        { "color": "#1E293B", "at": 100 }
                      ]
                    }
                  }
                ]
              },
              "languages": ["es", "en", "fr"],
              "reedit": "public",
              "variables": {
                "modes": { "palette": ["day", "night"] },
                "defaults": { "palette": "night" },
                "values": {
                  "accent": { "day": "#2563EB", "night": "#F59E0B" },
                  "ink": { "day": "#111827", "night": "#F8FAFC" }
                }
              },
              "layers": [
                {
                  "id": "bg_waves",
                  "type": "shape",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 1080 },
                  "geometry": { "kind": "rect" },
                  "fills": [
                    {
                      "kind": "pattern",
                      "pattern": {
                        "preset": "waves",
                        "bg": "#fdf0d5",
                        "colors": ["#f4a261"],
                        "scale": 1.2,
                        "motion": { "direction": "right", "period": 2 }
                      }
                    }
                  ]
                },
                {
                  "id": "cloud_loop",
                  "type": "image",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 400 },
                  "image": { "src": "data:image/png;base64,iVBORw==" },
                  "motion": {
                    "loop": { "speedPxSec": 40, "direction": "right_to_left", "mirror": true }
                  }
                },
                {
                  "id": "themed_headline",
                  "type": "text",
                  "box": { "x": 100, "y": 200, "width": 880, "height": 120 },
                  "fills": [{ "kind": "color", "value": { "var": "accent", "fallback": "#F59E0B" } }],
                  "effects": [{ "kind": "blur", "radius": 4 }],
                  "text": {
                    "content": { "es": "Hola", "en": "Hello", "fr": "Bonjour" },
                    "font": { "family": "Inter", "size": 48 }
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(listOf("es", "en", "fr"), doc.languages)
        assertEquals("night", doc.defaultPalette)
        assertEquals("#2563EB", doc.palettes["day"]?.get("accent"))
        assertEquals("#F59E0B", doc.palettes["night"]?.get("accent"))
        assertNotNull(doc.canvas.gradientFill)
        assertEquals(135f, doc.canvas.gradientFill?.angleDeg ?: -1f, 0.01f)
        assertEquals(1.0f, doc.canvas.gradientFill?.stops?.get(1)?.position ?: -1f, 0.01f)

        val patternLayer = doc.layers[0]
        assertEquals("waves", patternLayer.style.patternFill?.preset)
        assertEquals("right", patternLayer.style.patternFill?.motionDirection)
        assertEquals(2f, patternLayer.style.patternFill?.motionPeriodSec ?: -1f, 0.01f)

        val loopLayer = doc.layers[1]
        assertNotNull(loopLayer.motionLoop)
        assertEquals(40f, loopLayer.motionLoop?.speedPxSec ?: -1f, 0.01f)
        assertEquals("right_to_left", loopLayer.motionLoop?.direction)
        assertTrue(loopLayer.motionLoop?.mirror == true)

        val themedText = doc.layers[2]
        assertEquals("accent", themedText.style.colorRole)
        assertEquals("#F59E0B", themedText.style.textColorHex)
        assertEquals(4f, themedText.style.blurRadiusPx, 0.01f)
    }

    @Test
    fun parseDocumentJson_v2AnimationTracksTextMarksAndFilterEffectsAreParsed() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Keyframes Marks Filter V2",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es", "en"],
              "reedit": "public",
              "layers": [
                {
                  "id": "filtered_photo",
                  "type": "image",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 600 },
                  "image": { "src": "data:image/png;base64,iVBORw==" },
                  "effects": [
                    { "kind": "filter", "brightness": 1.15, "contrast": 1.2, "saturate": 0.85, "blur": 6 }
                  ],
                  "animations": [
                    {
                      "on": "load",
                      "duration": 1.2,
                      "tracks": [
                        { "property": "opacity", "keyframes": [{ "t": 0, "v": 0 }, { "t": 1, "v": 1, "e": "ease-out" }] },
                        { "property": "y", "keyframes": [{ "t": 0, "v": 24 }, { "t": 1, "v": 0 }] }
                      ]
                    }
                  ]
                },
                {
                  "id": "marked_text",
                  "type": "text",
                  "box": { "x": 80, "y": 640, "width": 920, "height": 160 },
                  "text": {
                    "content": { "es": "Texto {accent}resaltado{/accent} aqui" },
                    "font": { "family": "Inter", "size": 36 },
                    "marks": {
                      "accent": {
                        "bold": true,
                        "color": "#1D3557",
                        "highlight": { "color": "#F4A261", "style": "pill" }
                      }
                    }
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(2, doc.layers.size)

        val photo = doc.layers[0]
        assertNotNull(photo.style.filter)
        assertEquals(1.15f, photo.style.filter?.brightness ?: -1f, 0.01f)
        assertEquals(1.2f, photo.style.filter?.contrast ?: -1f, 0.01f)
        assertEquals(0.85f, photo.style.filter?.saturate ?: -1f, 0.01f)
        assertEquals(6f, photo.style.blurRadiusPx, 0.01f)
        assertEquals(1200, photo.animation.durationMs)
        assertEquals(2, photo.animation.keyframes.size)
        assertEquals(0.0, photo.animation.keyframes[0].o ?: -1.0, 0.01)
        assertEquals(24.0, photo.animation.keyframes[0].y ?: -1.0, 0.01)
        assertEquals(1.0, photo.animation.keyframes[1].o ?: -1.0, 0.01)

        val marked = doc.layers[1]
        assertTrue(marked.style.textMarks.containsKey("accent"))
        val accentMark = marked.style.textMarks["accent"]
        assertTrue(accentMark?.bold == true)
        assertEquals("#1D3557", accentMark?.colorHex)
        assertEquals("#F4A261", accentMark?.highlightColorHex)
        assertEquals("pill", accentMark?.highlightStyle)
    }

    @Test
    fun parseDocumentJson_v2PreservesMillisecondDurationsAndGroupInheritedAnimations() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0",
              "name": "Group Animations V2",
              "canvas": { "width": 1080, "height": 1920 },
              "languages": ["es", "en"],
              "reedit": "public",
              "layers": [
                {
                  "id": "group_rwt0lyfue",
                  "type": "group",
                  "opacity": 0.9,
                  "box": { "x": 491, "y": 1522, "width": 98, "height": 140 },
                  "animations": [
                    {
                      "on": "loop",
                      "duration": 2000,
                      "delay": 100,
                      "tracks": [
                        {
                          "property": "opacity",
                          "keyframes": [
                            { "t": 0, "v": 0 },
                            { "t": 0.5, "v": 1 },
                            { "t": 1, "v": 0 }
                          ]
                        },
                        {
                          "property": "y",
                          "keyframes": [
                            { "t": 0, "v": 35, "e": [0.16, 1, 0.3, 1] },
                            { "t": 1, "v": 0 }
                          ]
                        }
                      ]
                    }
                  ],
                  "children": [
                    {
                      "id": "chevron_1",
                      "type": "shape",
                      "opacity": 0.5,
                      "box": { "x": 491, "y": 1522, "width": 98, "height": 40 }
                    }
                  ]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(1, doc.layers.size)
        val chevron = doc.layers[0]
        assertEquals("chevron_1", chevron.id)
        assertEquals(0.45, chevron.opacity, 0.001)
        assertEquals(2000, chevron.animation.durationMs)
        assertEquals(100, chevron.animation.delayMs)
        assertTrue(chevron.animation.loop)
        assertEquals(3, chevron.animation.keyframes.size)
        assertEquals(0.0, chevron.animation.keyframes[0].t, 0.001)
        assertEquals(1.0, chevron.animation.keyframes[1].t, 0.001)
        assertEquals(2.0, chevron.animation.keyframes[2].t, 0.001)
        assertEquals(listOf(0.16, 1.0, 0.3, 1.0), chevron.animation.keyframes[0].cubicBezier)

        val sampledMid = OimKeyframeSampler.sampleKeyframes(chevron.animation.keyframes, 2.0, 1.0)
        assertEquals(1.0f, sampledMid.o, 0.02f)
        assertTrue("Expected eased y translation at t=1.0s to have moved significantly from 35 toward 0, got ${sampledMid.y}", sampledMid.y < 20f)
    }

    @Test
    fun parseDocumentJson_v2ExtractsLayerRevealAndTextAnimations() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0",
              "name": "Entrances V2",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "cta_bg",
                  "type": "shape",
                  "box": { "x": 100, "y": 800, "width": 320, "height": 64 },
                  "animations": [
                    { "on": "enter", "preset": "slide-up", "duration": 420, "delay": 80 }
                  ]
                },
                {
                  "id": "headline_anim",
                  "type": "text",
                  "box": { "x": 80, "y": 140, "width": 920, "height": 120 },
                  "text": {
                    "content": { "es": "Diseño Vivo" },
                    "font": { "family": "Inter", "size": 56 }
                  },
                  "animations": [
                    { "on": "load", "target": "chars", "preset": "bounce-chars", "duration": 350, "delay": 150, "params": { "speed": 0.04 } }
                  ]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(2, doc.layers.size)

        val shape = doc.layers[0]
        assertNotNull(shape.reveal)
        assertEquals("slide-up", shape.reveal?.effect)
        assertEquals(420, shape.reveal?.durationMs)
        assertEquals(80, shape.reveal?.delayMs)

        val text = doc.layers[1]
        assertEquals("bounce-chars", text.style.textAnimationType)
        assertEquals(0.04, text.style.textAnimationSpeed ?: -1.0, 0.001)
        assertEquals(0.15, text.style.textAnimationDelay ?: -1.0, 0.001)
    }

    @Test
    fun oimTextAnimator_computesCanonicalEntrancesTypewriterWaveAndGlitch() {
        val units = OimTextAnimator.entranceUnits("Hello World", "rise-words")
        assertEquals(listOf("Hello", " ", "World"), units)

        val frameEnd = OimTextAnimator.entranceFrameAt("rise-words", timeSec = 1.0, index = 0)
        assertEquals(1f, frameEnd.opacity, 0.001f)
        assertEquals(0f, frameEnd.translateYEm, 0.001f)
        assertEquals(0f, frameEnd.rotateDeg, 0.001f)

        val frameStart = OimTextAnimator.entranceFrameAt("slide-up", timeSec = 0.0, index = 0)
        assertEquals(0f, frameStart.opacity, 0.001f)
        assertEquals(0.6f, frameStart.translateYEm, 0.001f)

        assertEquals(0, OimTextAnimator.typewriterVisibleCount(10, timeSec = 0.05, speed = 20.0, delay = 0.1))
        assertEquals(5, OimTextAnimator.typewriterVisibleCount(10, timeSec = 0.35, speed = 20.0, delay = 0.1))

        val calmGlitch = OimTextAnimator.calculateGlitchRenderState("glitch-cyberpunk", timeSec = 0.25)
        assertFalse(calmGlitch.isActive)
        val activeGlitch = OimTextAnimator.calculateGlitchRenderState("glitch-cyberpunk", timeSec = 0.85)
        assertTrue(activeGlitch.isActive)
        assertEquals(2, activeGlitch.copies.size)
        assertEquals("#00FFFF", activeGlitch.copies[0].colorHex)
        assertEquals("#FF00FF", activeGlitch.copies[1].colorHex)

        // Speed multiplier normalization vs explicit speeds
        assertEquals(0.05, OimTextAnimator.resolveEntranceStaggerSec(null), 0.001)
        assertEquals(0.10, OimTextAnimator.resolveEntranceStaggerSec(0.10), 0.001)
        assertEquals(0.05 / 1.25, OimTextAnimator.resolveEntranceStaggerSec(1.25), 0.001)
        assertEquals(15.0, OimTextAnimator.resolveTypewriterCharsPerSec(15.0), 0.001)
        assertEquals(26.0, OimTextAnimator.resolveTypewriterCharsPerSec(1.3), 0.001)
    }

    @Test
    fun parseDocumentJson_v2ImageLayerExtractsCropAndFitIntoImageFill() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0",
              "name": "Sprite Crop V2",
              "canvas": { "width": 800, "height": 600 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "dino_sprite",
                  "type": "image",
                  "box": { "x": 106, "y": 533, "width": 56, "height": 60, "flipX": true },
                  "image": {
                    "src": "data:image/png;base64,iVBORw==",
                    "fit": "contain",
                    "crop": { "x": 57.798, "y": 0, "zoom": 1.32813 }
                  }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertEquals(1, doc.layers.size)
        val dino = doc.layers[0]
        assertTrue(dino.style.flipX)
        assertNotNull(dino.style.imageFill)
        assertEquals("contain", dino.style.imageFill?.fit)
        assertEquals(57.798f, dino.style.imageFill?.cropX ?: -1f, 0.001f)
        assertEquals(0f, dino.style.imageFill?.cropY ?: -1f, 0.001f)
        assertEquals(1.32813f, dino.style.imageFill?.cropZoom ?: -1f, 0.001f)
        assertFalse(dino.style.imageFill?.flipX ?: true)
    }

    @Test
    fun parseDocumentJson_v2WithoutParallaxDisablesParallaxByDefault() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Solaris Groove",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "background-pattern-slot",
                  "type": "shape",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 1080 }
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        assertFalse("V2 document without explicit parallax must default parallax.enabled to false", doc.parallax.enabled)
    }

    @Test
    fun parseDocumentJson_v2PatternTilePreservesViewBoxPathsAndTransform() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Drop Tile Test",
              "canvas": { "width": 1080, "height": 1920 },
              "languages": ["es"],
              "reedit": "public",
              "palettes": {
                "default": { "bg": "#d9f99d", "ink": "#1f1f23" }
              },
              "layers": [
                {
                  "id": "background-pattern-slot",
                  "type": "shape",
                  "box": { "x": 0, "y": 0, "width": 1080, "height": 1920 },
                  "fills": [
                    {
                      "kind": "pattern",
                      "pattern": {
                        "bg": { "var": "bg", "fallback": "#d9f99d" },
                        "colors": [{ "var": "ink", "fallback": "#1f1f23" }],
                        "scale": 1.4,
                        "motion": { "direction": "left", "period": 3 },
                        "tile": {
                          "viewBox": [0, 0, 160, 160],
                          "paths": [
                            { "d": "M0 0H160V160H0Z", "fill": "#d9f99d", "fillRule": "evenodd", "opacity": 0.9 },
                            {
                              "d": "M0 0L40 40",
                              "stroke": "#1f1f23",
                              "strokeWidth": 4,
                              "cap": "round",
                              "join": "bevel",
                              "transform": [1, 0, 0, 1, 20, -10]
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        val pat = doc.layers.first().style.patternFill
        assertNotNull(pat)
        assertEquals("custom", pat!!.preset)
        assertEquals("var(--bg, #d9f99d)", pat.bg)
        assertEquals("#d9f99d", pat.rawBg)
        assertEquals(listOf("var(--ink, #1f1f23)"), pat.colors)
        assertEquals(listOf("#1f1f23"), pat.rawColors)
        assertEquals(1.4f, pat.scale, 0.001f)
        assertEquals("left", pat.motionDirection)
        assertEquals(3f, pat.motionPeriodSec, 0.001f)
        assertEquals(listOf(0f, 0f, 160f, 160f), pat.tileViewBox)
        assertEquals(2, pat.tilePaths.size)
        assertEquals("evenodd", pat.tilePaths[0].fillRule)
        assertEquals(0.9f, pat.tilePaths[0].opacity, 0.001f)
        assertEquals(4f, pat.tilePaths[1].strokeWidth ?: -1f, 0.001f)
        assertEquals("round", pat.tilePaths[1].cap)
        assertEquals("bevel", pat.tilePaths[1].join)
        assertEquals(listOf(1f, 0f, 0f, 1f, 20f, -10f), pat.tilePaths[1].transform)
    }

    @Test
    fun parseDocumentJson_v2EffectsParseGlowAndShadowOpacityAndRole() {
        val v2Json = org.json.JSONObject(
            """
            {
              "oim": "2.0.0-draft.1",
              "name": "Effects Test",
              "canvas": { "width": 1080, "height": 1080 },
              "languages": ["es"],
              "reedit": "public",
              "layers": [
                {
                  "id": "sneaker",
                  "type": "image",
                  "box": { "x": 100, "y": 100, "width": 400, "height": 400 },
                  "image": { "src": "data:image/png;base64,iVBORw0KGgo=" },
                  "effects": [{ "kind": "glow", "color": "#D9F99D", "radius": 10 }]
                },
                {
                  "id": "p5-hex-photo",
                  "type": "shape",
                  "geometry": { "kind": "polygon", "sides": 6 },
                  "box": { "x": 500, "y": 200, "width": 300, "height": 300 },
                  "effects": [
                    { "kind": "shadow", "color": { "var": "accent", "fallback": "#00ff88" }, "blur": 40, "opacity": 0.5 },
                    { "kind": "glow", "colorRole": "highlight", "color": "#FCD34D", "radius": 48 }
                  ]
                },
                {
                  "id": "retro-title",
                  "type": "text",
                  "box": { "x": 100, "y": 50, "width": 600, "height": 100 },
                  "text": { "content": { "es": "SOLARIS" } },
                  "effects": [{ "kind": "shadow", "color": "#e76f51", "x": 6, "y": 6, "blur": 0 }]
                }
              ]
            }
            """.trimIndent()
        )
        val doc = OimBinaryCodec.parseDocumentJson(v2Json)
        val sneaker = doc.layers[0]
        assertTrue(sneaker.style.glowEnabled)
        assertEquals("#D9F99D", sneaker.style.glowColorHex)
        assertEquals(10f, sneaker.style.glowRadiusPx, 0.001f)
        assertFalse(sneaker.style.shadowEnabled)

        val hex = doc.layers[1]
        assertEquals("hexagon", hex.style.geoShape)
        assertTrue(hex.style.shadowEnabled)
        assertEquals("#00ff88", hex.style.shadowColorHex)
        assertEquals("accent", hex.style.shadowColorRole)
        assertEquals(40f, hex.style.shadowBlur, 0.001f)
        assertEquals(0.5f, hex.style.shadowOpacity, 0.001f)
        assertTrue(hex.style.glowEnabled)
        assertEquals("highlight", hex.style.glowColorRole)
        assertEquals("#FCD34D", hex.style.glowColorHex)
        assertEquals(48f, hex.style.glowRadiusPx, 0.001f)

        val title = doc.layers[2]
        assertTrue(title.style.shadowEnabled)
        assertEquals("#e76f51", title.style.shadowColorHex)
        assertEquals(6f, title.style.shadowOffsetX, 0.001f)
        assertEquals(6f, title.style.shadowOffsetY, 0.001f)
        assertEquals(0f, title.style.shadowBlur, 0.001f)
        assertEquals(1f, title.style.shadowOpacity, 0.001f)
    }

    /** Reads a file of the spec package in this repository (see oim-sdk/build.gradle.kts). */
    private fun loadVector(path: String): ByteArray =
        java.io.File(checkNotNull(System.getProperty("oim.spec.dir")) { "oim.spec.dir not set" }, path).readBytes()

    private fun buildMinimalValidPng(): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val ihdr = ByteBuffer.allocate(13).order(ByteOrder.BIG_ENDIAN)
            .putInt(1).putInt(1).put(8).put(6).put(0).put(0).put(0).array()
        writePngChunk(out, "IHDR", ihdr)
        val rawScanlines = ByteArray(25) { idx -> if (idx % 5 == 0) 0 else 0x55 }
        val deflater = Deflater()
        deflater.setInput(rawScanlines)
        deflater.finish()
        val idatBuf = ByteArray(128)
        val idatLen = deflater.deflate(idatBuf)
        deflater.end()
        writePngChunk(out, "IDAT", idatBuf.copyOf(idatLen))
        writePngChunk(out, "IEND", ByteArray(0))
        return out.toByteArray()
    }

    private fun writePngChunk(out: ByteArrayOutputStream, type: String, data: ByteArray) {
        val typeBytes = type.toByteArray(Charsets.US_ASCII)
        out.write(ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(data.size).array())
        out.write(typeBytes)
        out.write(data)
        val crc = CRC32().apply {
            update(typeBytes)
            update(data)
        }
        out.write(ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(crc.value.toInt()).array())
    }
}
