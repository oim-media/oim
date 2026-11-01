/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That `@oim-media/core` publishes nothing it should not.
 *
 * This package is published so every renderer depends on a VERSION instead
 * of copying files. Copies were the measured cause of divergence: one module
 * reached 546 differing lines between two copies, another 775.
 *
 * Publishing inverts the cost of a mistake. Unpublished, something sensitive
 * in here is fixed by deleting it. Published, it has already been
 * distributed: you can unpublish, you cannot un-copy.
 *
 * The current contents were audited and hold no secrets. These tests guard
 * the future instead: the public surface must not grow unless someone
 * decides it on purpose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import * as core from "./index";

const DIR = join(__dirname);

const PACKAGES = join(DIR, "..", "..");

/**
 * Everything that ends up in a published tarball: the sources of the three
 * code packages (compiled or bundled into `dist/`) and the spec documents.
 */
function publishedSources(): { name: string; text: string }[] {
  const roots = ["core/src", "player-oim/src", "player-ovm/src", "spec"].map((r) => join(PACKAGES, r));
  return roots.flatMap((root) =>
    (readdirSync(root, { recursive: true }) as string[])
      .filter((f) => /\.(ts|js|md)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes("node_modules"))
      .map((f) => ({ name: relative(PACKAGES, join(root, f)), text: readFileSync(join(root, f), "utf8") })),
  );
}

/**
 * The allowed surface, deliberately written by hand.
 *
 * Adding an export forces an edit to this list, and that edit is the conscious
 * decision that publishing requires. If the list were generated from the index
 * itself, it would guard nothing.
 */
const SUPERFICIE = [
  // text-marks.ts: text marks, contract 1.11.0.
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
  // drop-cap.ts: one drop-cap style for the three renderers.
  // effects/texture-mask.ts: a layer texture goes on its own pixels.
  "layerTextureMask",
  "dropCapStyle",
  "splitDropCap",
  // glitch.ts: the glitch as portable primitives, one definition (contract audit).
  "DEFAULT_GLITCH_SPEED",
  "DEFAULT_GLITCH_DELAY",
  "DEFAULT_GLITCH_INTENSITY",
  "GLITCH_CALM_RATIO",
  "calculateGlitchState",
  "glitchLayers",
  // text-effects.ts: entrance text effects as data.
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
  // binary.ts — extraction of the OIM_Data chunk. Already public in the player.
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
  // canonical.ts — canonical serialization for ECDSA signatures (RFC 8785).
  "serializeCanonical",
  "normalizeCanonicalNumbers",
  "sortKeysByCodePoint",
  // api.ts — public endpoint contract.
  "OIM_BACKEND_URL_DEFAULT",
  "OIM_ENDPOINTS",
  "OIM_PACKAGE_FIELDS",
  "oimEndpoint",
  "resolveBackendUrl",
  // dynamic-colors.ts — semantic color roles and CSS resolution.
  "DYNAMIC_COLOR_ROLES",
  "isSafeCssColor",
  "CSS_COLOR_PATTERN",
  "isValidDynamicColorRole",
  "resolveCssColor",
  // Named palettes (1.20.0): the document picks one, the player paints its roles.
  "resolvePalette",
  "PALETTE_NAME_PATTERN",
  // css-gradient.ts — allowlist of a .oim's gradients.
  "isSafeCssGradient",
  // proceduralNoise.ts — procedural SVG noise generator and blob geometries.
  "buildSvgNoiseFilter",
  // Per-layer grain.
  "GRAIN_BLENDS",
  "GRAIN_LAYER_TYPES",
  "grainFrequency",
  "buildLayerGrainFilter",
  "generateBlobPath",
  "generateScribblePath",
  // artisticTextCurve.ts — the path of curved text, one for both.
  "calculateTextCurvePath",
  "artisticTextLines",
  "calculate3DExtrusionLayers",
  "shadeHexColor",
  // embeddedFonts.ts — fonts embedded in the .oim.
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
  // groups.ts — the membership rule.
  "isGroup",
  "childrenByGroup",
  "slotParent",
  // typography.ts — line spacing and margin for the ink.
  "MAX_FONT_HEIGHT",
  "MAX_LINE_HEIGHT",
  "MIN_LINE_HEIGHT",
  "DEFAULT_LINE_HEIGHT",
  "resolveLineHeight",
  "inkMargin",
  // dimensions.ts — resolution of dimensions into CSS and user units.
  "resolveDimensionToCss",
  "resolveNumericDimension",
  // compatibilidad.ts — a reader saying what it does not understand.
  "PLAYER_CAPABILITIES",
  "BASE_CONTRACT_VERSION",
  "CONTRACT_VERSION",
  "VERSION_BY_CAPABILITY",
  "describeMissing",
  "whatTheReaderCannotDo",
  "minVersionFor",
  // media-filters.ts — CSS for the image filters, contract 1.18.0.
  "FILTER_PRESET_CSS",
  "mediaFilterCss",
  "hasMediaFilter",
  // clipping.ts — who clips and who does not.
  "slotClipping",
  // formasGeo.ts — the geometry of the catalog shapes.
  "GEO_SHAPES",
  "shapeDrawing",
  "pointsToAttribute",
  "isKnownGeoShape",
  // frame-silhouette.ts — the silhouette of the photo frame, contract 1.19.0.
  "FRAME_SHAPES",
  "frameSilhouette",
  "usesFrameShapes",
  // parallaxCss.ts — the parallax CSS and its endless track.
  "TRACK_CLASS",
  "CSS_PARALLAX",
  "ensureParallaxKeyframes",
  "infiniteLayerPlan",
  // permisoDeReedicion.ts — who may re-edit a .oim.
  "DEFAULT_PERMISSION",
  "permissionFields",
  "registryQuery",
  "mustRejectWithoutAsking",
  "permissionOf",
  "canReedit",
  "signatureStamp",
  // oversize.ts — how much parallax enlarges a layer at the edge.
  "MAX_SCALE",
  "maxOffset",
  "oversizeScale",
  // fill.ts — a layer's fill, and the pattern engine it uses.
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
  // schema.ts — shape of the metadata, derivable from any .oim.
  "MAX_SLOTS",
  "OIMOrOVMMetadata",
  "OimMetadataSchema",
  "OvmMetadataSchema",
  "grainConfigSchema",
  "contentSchema",
  "interactionSchema",
  // Interactivity, now declared: it travelled in the file but not in the
  // contract, so a reader in another language had to infer it from the player.
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
  // Canonical stack of effects and textures.
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

describe("public surface of @oim-media/core", () => {
  it("exports exactly what is declared, not one thing more", () => {
    expect(Object.keys(core).sort()).toEqual(SUPERFICIE);
  });
});

describe("nothing sensitive travels in the package", () => {
  /**
   * Cryptographic material. The private signing key lives in the backend and
   * must never cross into a package installed on third-party machines.
   */
  it("does not include private keys or service tokens", () => {
    const prohibido = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /service_role/i,
      /SUPABASE_SERVICE_ROLE/i,
      /\bsk_live_/,
      /\bsk_test_/,
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, // a literal JWT
      /eawltbnmonimtmtqslmk/, // Supabase project id
      /apps\/(backend|studio|workers)/, // private monorepo paths
      /OIM-Studio/, // private repository name
    ];
    for (const { name, text } of publishedSources()) {
      for (const pattern of prohibido) {
        expect(pattern.test(text), `${name} contiene ${pattern}`).toBe(false);
      }
    }
  });

  /**
   * The failure that already happened, documented in the header of `api.ts`:
   * two plugins shipped pointing to `http://localhost:8000` by default, which
   * means that published ones called the machine of whoever used them. With the
   * package published, that error spreads by itself.
   */
  it("does not set localhost as the default target", () => {
    for (const { name, text } of publishedSources()) {
      const defaults = text.match(/^\s*export const \w*(?:URL|HOST)\w*\s*=\s*["'][^"']*["']/gm) ?? [];
      for (const line of defaults) {
        expect(/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(line), `${name}: ${line}`).toBe(false);
      }
    }
  });

  /**
   * `files: ["dist"]` is what keeps the source code, the tests and any loose
   * file in the directory from ending up in the tarball. Without it,
   * `npm publish` packages the WHOLE package directory. NOTICE travels too:
   * Apache-2.0 asks for it to accompany redistributions.
   */
  it("the manifest limits the tarball to dist/", () => {
    const pkg = JSON.parse(readFileSync(join(DIR, "..", "package.json"), "utf8"));
    expect(pkg.files).toEqual(["dist", "NOTICE"]);
  });
});
