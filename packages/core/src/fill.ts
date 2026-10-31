/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Todos los valores que produce `getFillCss` son CADENAS: se comprobaron los
 * catorce sitios donde asigna uno -colores, `url(...)`, `cover`, `center`,
 * `text`, `transparent`- y ninguno es un numero.
 *
 * El `| number` que traia la copy del player era holgura que nadie usaba, y
 * la pagaba cada consumidor: en `rasterize.ts` del editor obligaba a comprobar
 * si un `backgroundImage` era un numero antes de llamar a `.startsWith`.
 */
export type CSSProperties = Record<string, string>;
import { renderGenerativeSVG } from "./generative/index.js";
import { generatePatternSVG } from "./patterns.js";
import { GEO_SHAPES, pointsToAttribute } from "./geoShapes.js";
import { isSafeCssGradient } from "./css-gradient.js";

export interface Shape {
  width?: number;
  height?: number;
  type?: string;
  geoShape?: string;
  fillType?: 'none' | 'color' | 'gradient' | 'pattern' | 'generative' | 'image';
  fillColor?: string;
  fillGenerative?: any;
  fillGradient?: string;
  fillPatternType?: string;
  fillPatternColor?: string;
  fillPatternBgColor?: string;
  fillPatternSpeed?: number;
  fillPatternScale?: number;
  /**
   * Hacia donde se desplaza el patron de una capa `pattern`.
   *
   * Los ocho valores son EXACTAMENTE los sufijos de los `@keyframes
   * background-animation-*` que el player define en `core/styles.ts`. Ni uno
   * mas: un valor sin animacion correspondiente daria una capa quieta sin
   * decir por que.
   */
  fillPatternDirection?:
    | "right" | "left" | "up" | "down"
    | "zoom-in" | "zoom-out" | "pulse" | "none";
  fillPatternSvgs?: string[];
  fillPatternColors?: string[];
  fillPatternSizes?: number[];
  fillPatternCounts?: number[];
  fillPatternDispersions?: number[];
  [key: string]: any;
}

/** Las direcciones con `@keyframes` propios. Ver `player-oim/src/core/styles.ts`. */
const DIRECCIONES = new Set([
  "right", "left", "up", "down", "zoom-in", "zoom-out", "pulse",
]);

/**
 * The tile of a pattern, shared by the pattern FILL of any layer and the
 * pattern LAYER: repeat, size and movement. One place, so the two cannot drift.
 */
function patternTileCss(shape: Shape): CSSProperties {
  const escala = shape.fillPatternScale || 1;
  const tesela = 160 * escala;
  const uri = generatePatternSVG({
    type: shape.fillPatternType || "clouds",
    bgColor: shape.fillPatternBgColor || "transparent",
    fgColor: shape.fillPatternColor || "#000000",
    scale: escala,
    svgs: shape.fillPatternSvgs,
    colors: shape.fillPatternColors,
    sizes: shape.fillPatternSizes,
    counts: shape.fillPatternCounts,
    dispersions: shape.fillPatternDispersions,
  });
  const css: CSSProperties = {
    backgroundImage: `url("${uri}")`,
    backgroundSize: `${tesela}px ${tesela}px`,
    backgroundRepeat: "repeat",
    ["--oim-bg-tile" as any]: `${tesela}px`,
  };
  const direccion = shape.fillPatternDirection || "right";
  const velocidad = shape.fillPatternSpeed;
  if (velocidad && velocidad > 0 && DIRECCIONES.has(direccion)) {
    css.animation = `background-animation-${direccion} ${velocidad}s linear infinite`;
  }
  return css;
}

/**
 * Traduce los campos de relleno de una capa a CSS.
 *
 * Esta función es la ÚNICA fuente de verdad del relleno y la llaman los tres
 * renderizadores: editor, visor y exportación estática. No la dupliques.
 */
export function getFillCss(shape: Shape): CSSProperties {
  // El tipo se DEDUCE cuando falta pero hay color. Estaba solo en la copy del
  // editor: una capa con `fillColor` y sin `fillType` se pintaba alli y salia
  // sin relleno en el visor. Se toma esta version porque la otra descarta un
  // dato que el archivo si trae.
  const tipo = shape.fillType || (shape.fillColor ? "color" : "none");
  if (tipo === "none") return {};
  const isText = shape.type === "text";

  let res: CSSProperties = {};

  if (tipo === "generative") {
    if (!shape.fillGenerative) {
      res = shape.fillColor
        ? isText ? { color: shape.fillColor } : { backgroundColor: shape.fillColor }
        : {};
    } else {
      const uri = renderGenerativeSVG(shape.fillGenerative, {
        width: shape.width || 100,
        height: shape.height || 100
      });
      res = {
        backgroundImage: `url("${uri}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      };
    }
  } else if (tipo === "pattern") {
    if (!shape.fillPatternType) {
      res = shape.fillColor
        ? isText ? { color: shape.fillColor } : { backgroundColor: shape.fillColor }
        : {};
    } else {
      // Tiles and moves, like the pattern layer (12 Sept). It used to stretch
      // ONE tile over the shape and ignore speed and direction.
      res = patternTileCss(shape);
    }
  } else if (tipo === "gradient") {
    // Foreign data headed for `backgroundImage`, which takes an image list:
    // an unchecked value could smuggle a `url()` past it. See css-gradient.ts.
    res = isSafeCssGradient(shape.fillGradient) ? { backgroundImage: shape.fillGradient! } : {};
  } else if (tipo === "color" || tipo === "image") {
    // An image fill keeps its colour underneath: the photo is painted over it by the renderers.
    res = shape.fillColor
      ? isText ? { color: shape.fillColor } : { backgroundColor: shape.fillColor }
      : {};
  }

  // El texto con relleno NO PLANO deja de pintarse como texto: pasa a ser una
  // mascara sobre un fondo. Aqui usaba `shape.fillType` mientras las ramas de
  // arriba usaban el deducido -en la copy del editor-, una incoherencia que no
  // se notaba porque la deduccion solo produce "color".
  if (isText && (tipo === "gradient" || (tipo === "generative" && shape.fillGenerative) || (tipo === "pattern" && shape.fillPatternType))) {
    return {
      ...res,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent"
    };
  }

  return res;
}

/**
 * The shapes a pattern layer can take. Open strokes (line, scribble) are out:
 * they cannot hold a tile. The editor's picker reads this list.
 */
export const PATTERN_SHAPES = ["rectangle", "circle", "triangle", "star", "diamond", "hexagon", "heart", "arrow", "blob"] as const;

/**
 * The shape of a closed geometry as a CSS mask: an SVG of the canonical geometry,
 * stretched to the layer's box. The rectangle has no mask; it is cut by its
 * corner radius, as always. Used for pattern layers and complex fills of shapes.
 */
export function shapeMaskCss(geoShape?: string): CSSProperties {
  if (!geoShape || geoShape === "rectangle") return {};
  // Every closed catalogue shape, not a fixed list: shapes added later (arch,
  // cloud...) painted their fill colour over the whole box.
  const drawing = GEO_SHAPES[geoShape];
  if (!drawing || (drawing.tipo === "path" && !drawing.rellenable)) return {};
  const body = drawing.tipo === "polygon"
    ? `<polygon points="${pointsToAttribute(drawing.puntos)}" fill="black"/>`
    : `<path d="${drawing.d}" fill="black"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return {
    maskImage: uri, WebkitMaskImage: uri,
    maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
  } as CSSProperties;
}

/**
 * The silhouette of a drawn SVG (an icon) as a CSS mask, so a pattern or
 * generative fill follows the drawing instead of painting the layer's box.
 *
 * Every fill becomes black, `none` included: a gradient fill on an icon paints
 * every shape (editor `applyGradientFill`), and a pattern must cover the same
 * area. Painted strokes become black and `none` strokes stay `none`, so the
 * fill reaches under the stroke's edge. Attributes and inline styles alike.
 * Works on strings: core runs where there is no DOMParser. Callers pass the
 * markup they actually draw.
 */
export function svgSilhouetteMaskCss(svgXml: string): CSSProperties {
  if (!/<svg\b/i.test(svgXml)) return {};
  let svg = svgXml
    .replace(/\bfill="[^"]*"/g, 'fill="#000"')
    .replace(/\bstroke="(?!none")[^"]*"/g, 'stroke="#000"')
    .replace(/([;"'\s{])fill\s*:\s*[^;"'}]+/g, "$1fill:#000")
    .replace(/([;"'\s{])stroke\s*:\s*(?!none\b)[^;"'}]+/g, "$1stroke:#000");
  if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return {
    maskImage: uri, WebkitMaskImage: uri,
    maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
    maskPosition: "center", WebkitMaskPosition: "center",
  } as CSSProperties;
}

/** Older name, kept so code built against the previous core still compiles. */
export const patternShapeMask = shapeMaskCss;

/**
 * El CSS de una capa `pattern`: tesela, se repite y se mueve.
 *
 * Es la hermana de `getFillCss` y vive aparte a proposito. La regla que las
 * separa: `type: "pattern"` significa «tesela y se mueve»; el patron como
 * RELLENO de otro tipo significa «se ajusta una vez y se queda quieto».
 * Mezclarlas en una funcion con un `if` seria la duplicacion al reves.
 *
 * La llaman el editor y el player, y ninguno calcula esto por su cuenta.
 */
export function patternLayerCss(shape: Shape): CSSProperties {
  const css = patternTileCss(shape);
  Object.assign(css, shapeMaskCss(shape.geoShape));
  return css;
}
