/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Every value that `getFillCss` produces is a STRING: the fourteen places where it assigns one
 * were checked (colours, `url(...)`, `cover`, `center`,
 * `text`, `transparent`) and none of them is a number.
 *
 * The `| number` that the player's copy carried was slack that nobody used, and
 * every consumer paid for it: in the editor's `rasterize.ts` it forced a check of
 * whether a `backgroundImage` was a number before calling `.startsWith`.
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
   * Which way the pattern of a `pattern` layer moves.
   *
   * The eight values are EXACTLY the suffixes of the `@keyframes
   * background-animation-*` that the player defines in `core/styles.ts`. Not one
   * more: a value without a matching animation would give a still layer without
   * saying why.
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

/** The directions with their own `@keyframes`. See `player-oim/src/core/styles.ts`. */
const DIRECCIONES = new Set([
  "right", "left", "up", "down", "zoom-in", "zoom-out", "pulse",
]);

/**
 * The tile of a pattern, shared by the pattern FILL of any layer and the
 * pattern LAYER: repeat, size and movement. One place, so the two cannot drift.
 */
function patternTileCss(shape: Shape): CSSProperties {
  const scale = shape.fillPatternScale || 1;
  const tile = 160 * scale;
  const uri = generatePatternSVG({
    type: shape.fillPatternType || "clouds",
    bgColor: shape.fillPatternBgColor || "transparent",
    fgColor: shape.fillPatternColor || "#000000",
    scale: scale,
    svgs: shape.fillPatternSvgs,
    colors: shape.fillPatternColors,
    sizes: shape.fillPatternSizes,
    counts: shape.fillPatternCounts,
    dispersions: shape.fillPatternDispersions,
  });
  const css: CSSProperties = {
    backgroundImage: `url("${uri}")`,
    backgroundSize: `${tile}px ${tile}px`,
    backgroundRepeat: "repeat",
    ["--oim-bg-tile" as any]: `${tile}px`,
  };
  const direccion = shape.fillPatternDirection || "right";
  const velocidad = shape.fillPatternSpeed;
  if (velocidad && velocidad > 0 && DIRECCIONES.has(direccion)) {
    css.animation = `background-animation-${direccion} ${velocidad}s linear infinite`;
  }
  return css;
}

/**
 * Translates a layer's fill fields into CSS.
 *
 * This function is the ONLY source of truth for the fill, and the three renderers call it:
 * editor, viewer and static export. Do not duplicate it.
 */
export function getFillCss(shape: Shape): CSSProperties {
  // The type is DEDUCED when it is missing but there is a colour. It was only in the
  // editor's copy: a layer with `fillColor` and no `fillType` was painted there and came
  // out with no fill in the viewer. This version is taken because the other discards a
  // datum that the file does carry.
  const type = shape.fillType || (shape.fillColor ? "color" : "none");
  if (type === "none") return {};
  const isText = shape.type === "text";

  let res: CSSProperties = {};

  if (type === "generative") {
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
  } else if (type === "pattern") {
    if (!shape.fillPatternType) {
      res = shape.fillColor
        ? isText ? { color: shape.fillColor } : { backgroundColor: shape.fillColor }
        : {};
    } else {
      // Tiles and moves, like the pattern layer. It used to stretch
      // ONE tile over the shape and ignore speed and direction.
      res = patternTileCss(shape);
    }
  } else if (type === "gradient") {
    // Foreign data headed for `backgroundImage`, which takes an image list:
    // an unchecked value could smuggle a `url()` past it. See css-gradient.ts.
    res = isSafeCssGradient(shape.fillGradient) ? { backgroundImage: shape.fillGradient! } : {};
  } else if (type === "color" || type === "image") {
    // An image fill keeps its colour underneath: the photo is painted over it by the renderers.
    res = shape.fillColor
      ? isText ? { color: shape.fillColor } : { backgroundColor: shape.fillColor }
      : {};
  }

  // Text with a NON-FLAT fill stops being painted as text: it becomes a mask over a
  // background. Here it used `shape.fillType` while the branches above used the deduced
  // one (in the editor's copy), an inconsistency that did not show because the deduction
  // only ever produces "color".
  if (isText && (type === "gradient" || (type === "generative" && shape.fillGenerative) || (type === "pattern" && shape.fillPatternType))) {
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
 * The CSS of a `pattern` layer: tile, repeat and move.
 *
 * It is the sister of `getFillCss` and lives apart on purpose. The rule that
 * separates them: `type: "pattern"` means "tile and move"; the pattern as a
 * FILL of another type means "adjusts once and stays still".
 * Mixing them in one function with an `if` would be duplication in reverse.
 *
 * The editor and the player both call it, and neither computes this on its own.
 */
export function patternLayerCss(shape: Shape): CSSProperties {
  const css = patternTileCss(shape);
  Object.assign(css, shapeMaskCss(shape.geoShape));
  return css;
}
