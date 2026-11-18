/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flipScale } from "@oim-media/core";
import { cropCss, mediaFilterCss } from "@oim-media/core";
import { filterStyle } from "./effects.js";
import { paintCss, patternStyle, type Layer, type Paint, type PaintColors, type PaintTarget } from "@oim-media/core/v2";
import { patternTileUri } from "../../../core/src/patterns.js";
import { drawingLink, drawingSvg } from "../legacy/v2-layers.js";

export type PaintContext = {
  colors: PaintColors;
  resources?: Record<string, Paint>;
  isText: boolean;
  /** A square tile of `px` canvas units as this element's background-size; without it the core's px size is kept. */
  size?: (px: number) => string;
  /** The element's size in canvas units: a generative fill is drawn for it, as the player draws it for the slot. */
  width?: number;
  height?: number;
};

/** Set by applyFills on the element; cleared before every new paint so an update never stacks old fills. */
const FILL_PROPS = ["backgroundColor", "backgroundImage", "backgroundSize", "backgroundClip", "WebkitBackgroundClip", "color"] as const;

/**
 * The fills of a layer. They are painted bottom to top: the first paint is the
 * bottom one. A colour under everything is the background colour; gradients and
 * other colours stack as background layers, the top one first. An image paint is
 * a picture node above the background. On text the colour is the letters' colour,
 * and a gradient clips to the glyphs.
 */
export function applyFills(el: HTMLElement, layer: Pick<Layer, "fills">, ctx: PaintContext): void {
  const style = el.style as unknown as Record<string, string>;
  for (const prop of FILL_PROPS) style[prop] = "";
  el.querySelectorAll(":scope > [data-oim-fill]").forEach((node) => node.remove());

  const target: PaintTarget = { colors: ctx.colors, isText: ctx.isText, resources: ctx.resources, width: ctx.width, height: ctx.height };
  let base: string | undefined;
  const backgrounds: string[] = [];
  const sizes: string[] = [];
  const pictures: Extract<Paint, { kind: "image" }>[] = [];
  for (const paint of layer.fills ?? []) {
    if ("kind" in paint && paint.kind === "image") {
      if (!ctx.isText) pictures.push(paint);
      continue;
    }
    const css = (tileCss(paint, ctx.colors) ?? paintCss(paint, target)) as Record<string, string | undefined>;
    if (css.color) el.style.color = css.color;
    if (css.backgroundClip) Object.assign(el.style, { backgroundClip: "text", WebkitBackgroundClip: "text" });
    if (css.backgroundColor) {
      // The lowest colour is the background colour itself; a colour above a layer is a layer of its own.
      if (base === undefined && backgrounds.length === 0) base = css.backgroundColor;
      else {
        backgrounds.unshift(`linear-gradient(${css.backgroundColor}, ${css.backgroundColor})`);
        sizes.unshift("auto");
      }
    }
    if (css.backgroundImage) {
      backgrounds.unshift(css.backgroundImage);
      // A pattern's tile is a size in canvas units (160 × its scale): kept, so the tiles match the player's.
      const tile = /^([\d.]+)px [\d.]+px$/.exec(css.backgroundSize ?? "");
      sizes.unshift(tile && ctx.size ? ctx.size(+tile[1]) : (css.backgroundSize ?? "auto"));
    }
  }
  if (base) el.style.backgroundColor = base;
  if (backgrounds.length) el.style.backgroundImage = backgrounds.join(", ");
  if (sizes.some((v) => v !== "auto")) el.style.backgroundSize = sizes.join(", ");
  for (const paint of pictures) el.appendChild(pictureNode(el, paint));
}

/** A picture as a node covering its layer: fit, crop, flip and opacity as 2.0 states them. Shared by image paints and image layers. */
export type Picture = Omit<Extract<Paint, { kind: "image" }>, "kind">;

export function pictureNode(el: HTMLElement, paint: Picture): HTMLImageElement {
  const img = el.ownerDocument.createElement("img");
  img.dataset.oimFill = "";
  // Only a picture that travels inside the file is painted: a network URL would be a tracking pixel.
  if (paint.src.startsWith("data:image/")) img.src = paint.src;
  img.alt = "";
  img.draggable = false;
  Object.assign(img.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none", objectFit: paint.fit ?? "cover" });
  const transforms: string[] = [];
  if (paint.crop) {
    // The zoom spills past the layer: the layer clips it, as the player does for an image layer.
    el.style.overflow = "hidden";
    const crop = cropCss(paint.crop);
    Object.assign(img.style, { objectFit: crop.objectFit, objectPosition: crop.objectPosition, transformOrigin: crop.transformOrigin });
    transforms.push(crop.transform);
  }
  const flip = flipScale(paint.flipX, paint.flipY);
  if (flip) transforms.push(`scale(${flip[0]}, ${flip[1]})`);
  if (transforms.length) img.style.transform = transforms.join(" ");
  if (paint.opacity !== undefined && paint.opacity !== 1) img.style.opacity = String(paint.opacity);
  const filter = paint.filters && mediaFilterCss(filterStyle(paint.filters));
  // The blur stays inside the picture's box, as the player draws it; clip-path is applied after the filter.
  if (filter) Object.assign(img.style, { filter, clipPath: "inset(0)" });
  return img;
}

/** A pattern whose tile is a drawing: the drawing, recoloured as the player does, 160 × scale canvas units a side. */
function tileCss(paint: Paint, colors: PaintColors): { backgroundImage: string; backgroundSize: string } | undefined {
  if (!("kind" in paint) || paint.kind !== "pattern" || !paint.pattern.tile) return undefined;
  const p = paint.pattern;
  const svg = drawingSvg({ kind: "paths", ...p.tile! } as never, drawingLink({} as Layer, colors.literal), true);
  const uri = patternTileUri(patternStyle(p, colors) as never, svg, colors.literal(p.bg) ?? "transparent", colors.literal(p.colors?.[0]) ?? "#000000");
  const side = 160 * (p.scale || 1);
  return uri ? { backgroundImage: `url("${uri}")`, backgroundSize: `${side}px ${side}px` } : undefined;
}
