/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The contract surface is FROZEN: every key declares which concept it covers,
 * and two keys cannot cover the same one without saying so.
 *
 * ## Why it exists
 *
 * The contract accumulated eight repeated names for things that already had a
 * name -`size` and `fontSize`, `font` and `fontFamily`, `color` and `fillColor`-
 * and nothing stopped it, because adding a new key has never cost anything.
 * While that debt is being paid, this keeps it from growing: to add a key you
 * must say which concept it covers, and if another key already covers that
 * concept, the test turns red and forces a choice.
 *
 * It is not a list of forbidden keys. It is a mandatory question.
 *
 * ## The two kinds of repetition, which are not the same
 *
 *   PURE DUPLICATE  two ways of saying exactly the same thing. One is redundant.
 *                   `size`/`fontSize`, `font`/`fontFamily`,
 *                   `color`/`fillColor`, `fontSizes`/`fontSizeOverrides`.
 *
 *   SHORTCUT        a boolean that summarizes a more expressive key and LOSES
 *                   information: `italic: true` cannot say `oblique`, and
 *                   `bold` cannot say `fontWeight: 600`. The full key wins;
 *                   the shortcut survives as a read-only alias.
 *
 * And what is NOT repetition, although it may look like it:
 *
 *   `fontSize` (a string) and `fontSizes` (a per-language map) are different
 *   things, just as `maxWidth` and `maxWidths` are. A text DOES change size
 *   depending on the language -a German word does not take up the space a
 *   Spanish one does-, so the per-language map is drawing data and stays.
 *   `grain` switches it on and `grainIntensity` sets its amount. Confusing them
 *   would cost real capability.
 *
 * ## Why `fontSizeOverrides` IS an alias, even though the name promises more
 *
 * Its name promises to distinguish which sizes the person chose from those that
 * came from the default. That information exists in the editor and **is lost on
 * export**: `backend-stage.ts` writes the SAME value into `fontSizes` and into
 * `fontSizeOverrides`. It is worse than a duplicate -it is a field that appears
 * to carry intent and does not.
 *
 * Decision: **the file carries the resolved size, nothing more**. A `.oim` is
 * a DRAWING artifact; it needs to know what to paint, not why. What is lost
 * (when re-editing someone else's file you cannot tell which sizes were
 * deliberate) is accepted in exchange for a smaller, portable format. If
 * authoring intent is ever needed, it goes in ITS OWN space, like glTF
 * `extras`, never mixed with drawing data.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { styleSchema } from "./schema";

/**
 * Which concept each `style` key covers.
 *
 * Adding a key to the schema without adding it here turns the test red. That is
 * the point of the exercise: the decision is made when the key is written, not
 * months later when someone measures.
 */
const CONCEPTO: Record<string, string> = {
  // -- typography
  fontFamily: "typeface",
  fontSize: "font-size",
  fontSizes: "font-size-per-language",
  fontWeight: "font-weight",
  fontStyle: "font-slant",
  textDecoration: "text-decoration",
  lineHeight: "line-height",
  textTransform: "text-transform",
  textAlign: "text-align",
  verticalAlign: "vertical-align",
  textRuns: "precomputed-text-runs-per-language",

  // -- box
  width: "box-width",
  height: "box-height",
  maxWidth: "box-max-width",
  maxWidths: "box-max-width-per-language",
  borderRadius: "corner-radius",
  objectFit: "content-fit",

  // -- paint
  fillColor: "fill-color",
  strokeStyle: "stroke-style",
  textStrokeColor: "text-stroke-color",
  outline: "outline",
  blendMode: "blend-mode",
  layerBlur: "layer-blur",

  // -- shadow: not duplicates, they are the components of a single effect
  shadowEnabled: "shadow-enabled",
  shadowColor: "shadow-color",
  shadowBlur: "shadow-blur",
  shadowOffsetX: "shadow-offset-x",
  shadowOffsetY: "shadow-offset-y",
  shadowOpacity: "shadow-opacity",

  // -- grain: `grain` switches it on, `grainIntensity` sets the amount
  grain: "grain-enabled",
  grainIntensity: "grain-intensity",
  grainSize: "grain-size",
  grainBlend: "grain-blend",

  // -- inherited effect (glow and similar)
  effect: "effect-kind",
  effectColor: "effect-color",
  effectRadius: "effect-radius",

  // -- canonical stack of modular effects
  effects: "unified-effects-stack",

  // -- mask
  maskCoverage: "mask-coverage",
  maskInvert: "mask-invert",
  maskMode: "mask-mode",
  maskShape: "mask-shape",
  maskBgColor: "mask-bg-color",
  maskStrokeColor: "mask-stroke-color",
  maskStrokeWidth: "mask-stroke-width",

  // -- strokes and silhouettes
  strokeColor: "stroke-color",
  strokeWidth: "stroke-width",
  textStrokeWidth: "text-stroke-width",
  geoShape: "geometric-shape-type",
  // 1.19.0: a frame's own outline, distinct from the blob's `customBlobPath`.
  svgPath: "custom-svg-path",
  svgViewBox: "custom-svg-view-box",
  svgRawXml: "svg-raw-xml",

  // -- vector text and 3D relief (artistic-text)
  artisticPreset: "artistic-text-preset",
  curveAmount: "artistic-text-curve-amount",
  curveType: "artistic-text-curve-type",
  extrusionDepth: "artistic-text-extrusion-depth",
  extrusionAngle: "artistic-text-extrusion-angle",
  extrusionColor: "artistic-text-extrusion-color",
  extrusionShading: "artistic-text-extrusion-shading",
  outerStrokeColor: "artistic-text-outer-stroke-color",
  outerStrokeWidth: "artistic-text-outer-stroke-width",
  innerStrokeColor: "artistic-text-inner-stroke-color",
  innerStrokeWidth: "artistic-text-inner-stroke-width",

  // -- filters and CSS animation
  filterPreset: "filter-preset",
  filterBlur: "filter-blur",
  filterBrightness: "filter-brightness",
  filterContrast: "filter-contrast",
  filterSaturate: "filter-saturate",
  filterHueRotate: "filter-hue-rotate",
  cssAnimation: "css-animation",
  textAnimationType: "text-animation-type",
  textAnimationSpeed: "text-animation-speed",
  textAnimationDelay: "text-animation-delay",
  textAnimationIntensity: "text-animation-intensity",
  typewriterCursor: "typewriter-cursor",
  textHighlight: "text-highlight",
  marks: "text-marks",
  dropCap: "drop-cap",

  // -- organic shapes and advanced masks
  customBlobPath: "custom-blob-path",
  maskFeather: "mask-feather",
  maskSvgPath: "mask-svg-path",

  // -- video/time clipping
  cuts: "video-cuts",
  trimStart: "video-trim-start",
  trimEnd: "video-trim-end",
  trimDuration: "video-trim-duration",

  // -- transform, visibility and hierarchy
  groupId: "group-id",
  rotation: "rotation",
  flipX: "flip-horizontal",
  flipY: "flip-vertical",
  imageCrop: "image-crop",
  fillImage: "fill-image",
  fillImageCrop: "fill-image-crop",
  // 1.19.0: the photo mirrored inside a frame. Not `flip-horizontal`: that flips the whole layer.
  fillImageFlipX: "fill-image-flip-x",
  fillImageFlipY: "fill-image-flip-y",
  alt: "alt-text",
  decorative: "decorative",
  opacity: "opacity",
  isVisible: "is-visible",

  // -- backgrounds, gradients and color roles
  textGradientType: "text-gradient-type",
  fillColorRole: "fill-color-role",
  strokeColorRole: "stroke-color-role",
  colorRole: "color-role",
  shadowColorRole: "shadow-color-role",
  textStrokeColorRole: "text-stroke-color-role",
  effectColorRole: "effect-color-role",
  maskBgColorRole: "mask-bg-color-role",
  maskStrokeColorRole: "mask-stroke-color-role",
  fillGenerative: "fill-generative",
  fillGradient: "fill-gradient",
  fillPatternType: "fill-pattern-type",
  fillPatternColor: "fill-pattern-color",
  fillPatternColorRole: "fill-pattern-color-role",
  fillPatternBgColor: "fill-pattern-bg-color",
  fillPatternBgColorRole: "fill-pattern-bg-color-role",
  fillPatternSpeed: "fill-pattern-speed",
  fillPatternScale: "fill-pattern-scale",
  fillPatternDirection: "fill-pattern-direction",
  fillPatternSvgs: "fill-pattern-svgs",
  fillPatternColors: "fill-pattern-colors",
  fillPatternSizes: "fill-pattern-sizes",
  fillPatternCounts: "fill-pattern-counts",
  fillPatternDispersions: "fill-pattern-dispersions",

  // -- background and fills
  backgroundType: "background-type",
  backgroundPatternColor: "background-pattern-color",
  backgroundPatternColorRole: "background-pattern-color-role",
  backgroundPatternBgColor: "background-pattern-bg-color",
  backgroundPatternBgColorRole: "background-pattern-bg-color-role",
  backgroundPatternColors: "background-pattern-colors",
  fillType: "fill-type",

  // -- motion and interaction
  animation: "animation",
  reveal: "reveal",
  states: "interactive-states",
  isInteractive: "interactive-enabled",
  shader_fx: "shader-effects",
};

/** The keys that are aliases today. Documented, not silently tolerated. */
const ALIAS = Object.entries(CONCEPTO)
  .filter(([, c]) => c.endsWith("/alias"))
  .map(([k]) => k);

function clavesDeclaradas(): string[] {
  const j = z.toJSONSchema(styleSchema, { io: "input" }) as any;
  return Object.keys(j.properties ?? {});
}

describe("la superficie de `style` esta congelada", () => {
  it("toda clave declarada dice que concepto cubre", () => {
    const sinMapear = clavesDeclaradas().filter((k) => !(k in CONCEPTO));
    expect(
      sinMapear,
      "Hay claves en el esquema que no dicen que concepto cubren. Añadelas a " +
        "CONCEPTO en esta prueba: si el concepto ya existe, estas creando un " +
        "segundo nombre para algo que ya lo tenia y hay que elegir uno.",
    ).toEqual([]);
  });

  it("el mapa no habla de claves que ya no existen", () => {
    const declaradas = new Set(clavesDeclaradas());
    const fantasmas = Object.keys(CONCEPTO).filter((k) => !declaradas.has(k));
    expect(fantasmas, "sobran en CONCEPTO: se retiraron del esquema").toEqual([]);
  });

  it("ningun concepto tiene dos claves canonicas", () => {
    // The heart of the freeze. A concept may have ONE canonical key plus whatever
    // aliases are needed; two canonical keys is the debt we are paying down.
    const porConcepto = new Map<string, string[]>();
    for (const [clave, concepto] of Object.entries(CONCEPTO)) {
      if (concepto.endsWith("/alias")) continue;
      porConcepto.set(concepto, [...(porConcepto.get(concepto) ?? []), clave]);
    }
    const repetidos = [...porConcepto.entries()].filter(([, ks]) => ks.length > 1);
    expect(
      repetidos,
      "Dos claves canonicas para un mismo concepto. Una de las dos tiene que " +
        "pasar a alias.",
    ).toEqual([]);
  });

  it("todo alias apunta a un concepto que existe de verdad", () => {
    const canonicos = new Set(
      Object.values(CONCEPTO).filter((c) => !c.endsWith("/alias")),
    );
    const huerfanos = ALIAS.filter((a) => !canonicos.has(CONCEPTO[a].replace("/alias", "")));
    expect(huerfanos, "alias sin clave canonica que los acoja").toEqual([]);
  });

  it("ya no queda ningun alias", () => {
    // All seven were removed before 1.0 with no deprecation phase: no
    // production .oim files existed yet, so there was no compatibility to keep.
    //
    // The compiler no longer emits them -`canonizar_estilo` translates them-, so
    // the contract would stop describing something nobody writes.
    //
    // This zero is the one to defend: if it rises again, someone is creating a
    // second name for a concept that already had one.
    expect(ALIAS).toEqual([]);
  });
});
