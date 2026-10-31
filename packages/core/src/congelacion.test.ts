/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La superficie del contrato esta CONGELADA: cada clave declara que concepto
 * cubre, y dos claves no pueden cubrir el mismo sin decirlo.
 *
 * ## Por que existe
 *
 * El contrato acumulo ocho nombres repetidos para cosas que ya tenian nombre
 * -`size` y `fontSize`, `font` y `fontFamily`, `color` y `fillColor`- y nada
 * lo impidio, porque anadir una clave nueva nunca ha costado nada. Mientras se
 * paga esa deuda, esto evita que crezca: para anadir una clave hay que decir
 * que concepto cubre, y si ese concepto ya lo cubre otra, la prueba se pone
 * roja y obliga a elegir.
 *
 * No es una lista de claves prohibidas. Es una pregunta obligatoria.
 *
 * ## Los dos tipos de repeticion, que no son lo mismo
 *
 *   DUPLICADO PURO  dos formas de decir exactamente lo mismo. Sobra una.
 *                   `size`/`fontSize`, `font`/`fontFamily`,
 *                   `color`/`fillColor`, `fontSizes`/`fontSizeOverrides`.
 *
 *   ATAJO           un booleano que resume una clave mas expresiva y PIERDE
 *                   informacion: `italic: true` no puede decir `oblique`, y
 *                   `bold` no puede decir `fontWeight: 600`. Gana el completo;
 *                   el atajo sobrevive como alias de solo lectura.
 *
 * Y lo que NO es repeticion, aunque lo parezca:
 *
 *   `fontSize` (una cadena) y `fontSizes` (un mapa por idioma) son cosas
 *   distintas, igual que `maxWidth` y `maxWidths`. Un texto SI cambia de
 *   tamano segun el idioma -una palabra alemana no ocupa lo que una
 *   espanola-, asi que el mapa por idioma es dato de dibujo y se queda.
 *   `grain` enciende y `grainIntensity` gradua. Confundirlos costaria
 *   capacidad real.
 *
 * ## Por que `fontSizeOverrides` SI es alias, aunque el nombre prometa mas
 *
 * Su nombre promete distinguir que tamanos eligio la persona de los que
 * salieron del default. Esa informacion existe en el editor y **se pierde al
 * exportar**: `backend-stage.ts` escribe el MISMO valor en `fontSizes` y en
 * `fontSizeOverrides`. Es peor que un duplicado — es un campo que aparenta
 * llevar intencion y no la lleva.
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
 * Que concepto cubre cada clave de `style`.
 *
 * Añadir una clave al esquema sin añadirla aqui pone la prueba en rojo. Es el
 * punto del ejercicio: la decision se toma al escribirla, no tres meses
 * despues cuando alguien mide.
 */
const CONCEPTO: Record<string, string> = {
  // -- tipografia
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

  // -- caja
  width: "box-width",
  height: "box-height",
  maxWidth: "box-max-width",
  maxWidths: "box-max-width-per-language",
  borderRadius: "corner-radius",
  objectFit: "content-fit",

  // -- pintura
  fillColor: "fill-color",
  strokeStyle: "stroke-style",
  textStrokeColor: "text-stroke-color",
  outline: "outline",
  blendMode: "blend-mode",
  layerBlur: "layer-blur",

  // -- sombra: no son duplicados, son las componentes de un mismo efecto
  shadowEnabled: "shadow-enabled",
  shadowColor: "shadow-color",
  shadowBlur: "shadow-blur",
  shadowOffsetX: "shadow-offset-x",
  shadowOffsetY: "shadow-offset-y",
  shadowOpacity: "shadow-opacity",

  // -- grano: `grain` enciende, `grainIntensity` gradua
  grain: "grain-enabled",
  grainIntensity: "grain-intensity",
  grainSize: "grain-size",
  grainBlend: "grain-blend",

  // -- efecto heredado (resplandor y similares)
  effect: "effect-kind",
  effectColor: "effect-color",
  effectRadius: "effect-radius",

  // -- stack canónico de efectos modulares (Spec 2026-10-07)
  effects: "unified-effects-stack",

  // -- mascara
  maskCoverage: "mask-coverage",
  maskInvert: "mask-invert",
  maskMode: "mask-mode",
  maskShape: "mask-shape",
  maskBgColor: "mask-bg-color",
  maskStrokeColor: "mask-stroke-color",
  maskStrokeWidth: "mask-stroke-width",

  // -- trazos y siluetas
  strokeColor: "stroke-color",
  strokeWidth: "stroke-width",
  textStrokeWidth: "text-stroke-width",
  geoShape: "geometric-shape-type",
  // 1.19.0: a frame's own outline, distinct from the blob's `customBlobPath`.
  svgPath: "custom-svg-path",
  svgViewBox: "custom-svg-view-box",
  svgRawXml: "svg-raw-xml",

  // -- texto vectorial y relieve 3d (artistic-text)
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

  // -- filtros y animacion css
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

  // -- formas organicas y mascaras avanzadas
  customBlobPath: "custom-blob-path",
  maskFeather: "mask-feather",
  maskSvgPath: "mask-svg-path",

  // -- recorte de video/tiempo
  cuts: "video-cuts",
  trimStart: "video-trim-start",
  trimEnd: "video-trim-end",
  trimDuration: "video-trim-duration",

  // -- transformacion, visibilidad y jerarquia
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

  // -- fondos, gradientes y roles de color
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

  // -- fondo y rellenos
  backgroundType: "background-type",
  backgroundPatternColor: "background-pattern-color",
  backgroundPatternColorRole: "background-pattern-color-role",
  backgroundPatternBgColor: "background-pattern-bg-color",
  backgroundPatternBgColorRole: "background-pattern-bg-color-role",
  backgroundPatternColors: "background-pattern-colors",
  fillType: "fill-type",

  // -- movimiento e interaccion
  animation: "animation",
  reveal: "reveal",
  states: "interactive-states",
  isInteractive: "interactive-enabled",
  shader_fx: "shader-effects",
};

/** Las claves que hoy son alias. Documentadas, no toleradas en silencio. */
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
    // El corazon de la congelacion. Un concepto puede tener UNA canonica y los
    // alias que haga falta; dos canonicas es la deuda que estamos pagando.
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
    // El compilador ya no los emite -`canonizar_estilo` los traduce-, asi que
    // el contrato dejaria de describir algo que nadie escribe.
    //
    // Este cero es el que hay que defender: si vuelve a subir, alguien esta
    // creando un segundo nombre para un concepto que ya lo tenia.
    expect(ALIAS).toEqual([]);
  });
});
