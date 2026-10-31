/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que `@oim-media/core` no publique nada que no deba salir del repositorio.
 *
 * Este paquete deja de ser `private: true` para que OIM-Studio pueda
 * depender de una VERSION en vez de copiar los ficheros. Esa copy es la
 * causa medida de la divergencia: `grupos.ts` llego a 546 lineas distintas
 * entre los dos repositorios, y `layerComposition.ts` a 775.
 *
 * Pero publicar invierte el sentido del error. Hoy, meter algo sensible en
 * este paquete es un fallo que se arregla borrandolo. Publicado, es un fallo
 * que ya se distribuyo: se puede despublicar, no se puede des-copiar.
 *
 * El contenido actual se audito y no tiene secretos —el parser binario ya es
 * publico dentro del player del CDN, y los endpoints son los de
 * `api.oim.media`—. Lo que estas pruebas vigilan no es el hoy: es que la
 * superficie no crezca sin que alguien lo decida a proposito.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as core from "./index";

const DIR = join(__dirname);

/** Los ficheros que `tsc` compila a `dist/`, que es lo unico que se publica. */
function fuentesPublicadas(): { nombre: string; texto: string }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((nombre) => ({ nombre, texto: readFileSync(join(DIR, nombre), "utf8") }));
}

/**
 * La superficie permitida, a proposito escrita a mano.
 *
 * Anadir una exportacion obliga a editar esta lista, y esa edicion es la
 * decision consciente que la publicacion exige. Si la lista se generara sola
 * del propio indice, no vigilaria nada.
 */
const SUPERFICIE = [
  // text-marks.ts: text marks, contract 1.11.0 (spec 2026-10-10-marcas-de-texto, approved by Josué).
  "MARK_NAME",
  "MAX_MARKS",
  "parseMarks",
  "validateMarks",
  "escapeMarks",
  "plainText",
  "marksSequence",
  "toRanges",
  "fromRanges",
  "withoutMark",
  "markStyle",
  "textMarkSchema",
  // drop-cap.ts: one drop-cap style for the three renderers (spec 2026-10-10-retirar-resaltado-y-capitular, approved by Josué).
  // effects/texture-mask.ts: a layer texture goes on its own pixels (Josué, 10 Oct 2026).
  "layerTextureMask",
  "dropCapStyle",
  "splitDropCap",
  // glitch.ts: the glitch as portable primitives, one definition (contract audit, 10 Oct 2026).
  "DEFAULT_GLITCH_SPEED",
  "DEFAULT_GLITCH_DELAY",
  "DEFAULT_GLITCH_INTENSITY",
  "GLITCH_CALM_RATIO",
  "calculateGlitchState",
  "glitchLayers",
  // text-effects.ts: entrance text effects as data (spec 2026-10-10-efectos-de-texto, approved by Josué).
  "ENTRANCE_EFFECTS",
  "ENTRANCE_SECONDS",
  "DEFAULT_ENTRANCE_STAGGER",
  "isEntranceEffect",
  "entranceUnits",
  "entranceStart",
  "entranceFrame",
  "entranceFrameAt",
  "entranceKeyframes",
  "entranceClips",
  // binary.ts — extraccion del chunk OIM_Data. Ya publico en el player.
  "compressAndEncodeJSON",
  "decodeAndDecompressJSON",
  "decompressBytes",
  "extractOIM",
  "flipScale",
  "cropPlacement",
  "cropCss",
  "extractOIMMetadataFromStream",
  "fetchMetadataTail",
  "imageDataHash",
  // canonical.ts — serialización canónica para firmas ECDSA (RFC 8785).
  "serializeCanonical",
  "normalizeCanonicalNumbers",
  "sortKeysByCodePoint",
  // api.ts — contrato de endpoints publicos.
  "OIM_BACKEND_URL_DEFAULT",
  "OIM_ENDPOINTS",
  "OIM_PACKAGE_FIELDS",
  "oimEndpoint",
  "resolveBackendUrl",
  // dynamic-colors.ts — roles semanticos de color y resolucion CSS.
  "DYNAMIC_COLOR_ROLES",
  "isSafeCssColor",
  "CSS_COLOR_PATTERN",
  "isValidDynamicColorRole",
  "resolveCssColor",
  // Named palettes (1.20.0): the document picks one, the player paints its roles.
  "resolvePalette",
  "PALETTE_NAME_PATTERN",
  // css-gradient.ts — lista blanca de gradientes de un .oim.
  "isSafeCssGradient",
  // proceduralNoise.ts — generador de ruido procedural SVG y geometrias de blob.
  "buildSvgNoiseFilter",
  // Per-layer grain (spec 2026-09-29-grano-por-capa, approved by Josué).
  "GRAIN_BLENDS",
  "GRAIN_LAYER_TYPES",
  "grainFrequency",
  "buildLayerGrainFilter",
  "generateBlobPath",
  "generateScribblePath",
  // artisticTextCurve.ts — el trazado del texto curvado, uno para los dos.
  "calculateTextCurvePath",
  "artisticTextLines",
  "calculate3DExtrusionLayers",
  "shadeHexColor",
  // embeddedFonts.ts — fuentes incrustadas en el .oim.
  "EMBEDDED_FONT_NAME",
  "EMBEDDED_FONT_MAX_BYTES",
  "EMBEDDED_FONTS_MAX_TOTAL_BYTES",
  "EMBEDDED_FONTS_MAX_ENTRIES",
  "embeddedFontName",
  "embeddedFontSchema",
  "cssColorSchema",
  "CSS_GRADIENT_PATTERN",
  "generativeFillSchema",
  "maskCutSchema",
  // fontFile.ts — whether an uploaded font may be embedded.
  "readFontInfo",
  "fontEmbedding",
  // grupos.ts — la regla de pertenencia.
  "isGroup",
  "childrenByGroup",
  "slotParent",
  // tipografia.ts — interlineado y margen para la tinta.
  "MAX_FONT_HEIGHT",
  "MAX_LINE_HEIGHT",
  "MIN_LINE_HEIGHT",
  "DEFAULT_LINE_HEIGHT",
  "resolveLineHeight",
  "inkMargin",
  // dimensions.ts — resolución de dimensiones hacia CSS y unidades de usuario.
  "resolveDimensionToCss",
  "resolveNumericDimension",
  // compatibilidad.ts — que un lector diga lo que no entiende.
  "PLAYER_CAPABILITIES",
  "BASE_CONTRACT_VERSION",
  "CONTRACT_VERSION",
  "VERSION_BY_CAPABILITY",
  "describeMissing",
  "whatTheReaderCannotDo",
  "minVersionFor",
  // media-filters.ts — CSS de los filtros de imagen, contrato 1.18.0.
  "FILTER_PRESET_CSS",
  "mediaFilterCss",
  "hasMediaFilter",
  // recorte.ts — quien recorta y quien no.
  "slotClipping",
  // formasGeo.ts — la geometria de las formas del catalogo.
  "GEO_SHAPES",
  "shapeDrawing",
  "pointsToAttribute",
  "isKnownGeoShape",
  // frame-silhouette.ts — la silueta del marco con foto, contrato 1.19.0.
  "FRAME_SHAPES",
  "frameSilhouette",
  "usesFrameShapes",
  // parallaxCss.ts — el CSS del parallax y su pista infinita.
  "TRACK_CLASS",
  "CSS_PARALLAX",
  "ensureParallaxKeyframes",
  "infiniteLayerPlan",
  // permisoDeReedicion.ts — quien puede reeditar un .oim.
  "DEFAULT_PERMISSION",
  "permissionFields",
  "registryQuery",
  "mustRejectWithoutAsking",
  "permissionOf",
  "canReedit",
  "signatureStamp",
  // sobredimensionado.ts — cuanto agranda el parallax una capa al borde.
  "MAX_SCALE",
  "maxOffset",
  "oversizeScale",
  // fill.ts — el relleno de una capa, y el motor de patrones que usa.
  "PATTERN_PRESET_SVGS",
  "PATTERN_SHAPES",
  "generatePatternSVG",
  "recolorPatternSvg",
  "patternTileUri",
  "isMultiColorPattern",
  "resolvePatternColors",
  "getFillCss",
  "patternShapeMask",
  "shapeMaskCss",
  "svgSilhouetteMaskCss",
  // schema.ts — forma de los metadatos, deducible de cualquier .oim.
  "MAX_SLOTS",
  "OIMOrOVMMetadata",
  "OimMetadataSchema",
  "OvmMetadataSchema",
  "grainConfigSchema",
  "contentSchema",
  "interactionSchema",
  // La interactividad, declarada desde el 29 de agosto: viajaba en el archivo
  // pero no en el contrato, asi que un lector en otro lenguaje tenia que
  // deducirla del player.
  "interactiveStateSchema",
  "slotStatesSchema",
  "stateActionSchema",
  "keyframeSchema",
  "keyframeEasingSchema",
  "revealSchema",
  "REVEAL_DEFAULT",
  "easingToCss",
  "revealFrames",
  "revealTiming",
  "parallaxInfiniteSchema",
  "parallaxSchema",
  "patternLayerCss",
  "positionSchema",
  "slotSchema",
  "styleSchema",
  "textHighlightSchema",
  "dropCapSchema",
  "textLineSchema",
  "textRunByLangSchema",
  "textRunsSchema",
  "trackingKeyframeSchema",
  "zoneSchema",
  // Stack canónico de efectos y texturas (Spec 2026-10-07)
  "EFFECT_BLENDS",
  "TEXTURE_CATALOG",
  "TEXTURE_PRESETS",
  "normalizeSlotEffects",
  "oimBlurEffectSchema",
  "oimColorGradeEffectSchema",
  "oimDropShadowEffectSchema",
  "oimEffectSchema",
  "oimGlowEffectSchema",
  "oimTextureEffectSchema",
].sort();

describe("superficie publica de @oim-media/core", () => {
  it("exporta exactamente lo declarado, ni una cosa mas", () => {
    expect(Object.keys(core).sort()).toEqual(SUPERFICIE);
  });
});

describe("nada sensible viaja en el paquete", () => {
  /**
   * Material criptografico. La clave privada de firma vive en el backend y
   * jamas debe cruzar a un paquete que se instala en maquinas ajenas.
   */
  it("no incluye claves privadas ni tokens de servicio", () => {
    const prohibido = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /service_role/i,
      /SUPABASE_SERVICE_ROLE/i,
      /\bsk_live_/,
      /\bsk_test_/,
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, // un JWT literal
    ];
    for (const { nombre, texto } of fuentesPublicadas()) {
      for (const patron of prohibido) {
        expect(patron.test(texto), `${nombre} contiene ${patron}`).toBe(false);
      }
    }
  });

  /**
   * El fallo que ya ocurrio, documentado en la cabecera de `api.ts`: dos
   * plugins salieron apuntando a `http://localhost:8000` por defecto, o sea
   * que publicados llamaban a la maquina de quien los usaba. Con el paquete
   * publicado ese error se reparte solo.
   */
  it("no fija localhost como destino por defecto", () => {
    for (const { nombre, texto } of fuentesPublicadas()) {
      const defectos = texto.match(/^\s*export const \w*(?:URL|HOST)\w*\s*=\s*["'][^"']*["']/gm) ?? [];
      for (const linea of defectos) {
        expect(/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(linea), `${nombre}: ${linea}`).toBe(false);
      }
    }
  });

  /**
   * `files: ["dist"]` es lo que impide que el codigo fuente, los tests y
   * cualquier fichero suelto del directorio acaben en el tarball. Sin el,
   * `npm publish` empaqueta TODO el directorio del paquete.
   */
  it("el manifiesto limita el tarball a dist/", () => {
    const pkg = JSON.parse(readFileSync(join(DIR, "..", "package.json"), "utf8"));
    expect(pkg.files).toEqual(["dist"]);
  });
});
