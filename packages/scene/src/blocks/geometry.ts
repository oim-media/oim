/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geometryOutline, type Layer, type Outline, type PaintColors } from "@oim-media/core/v2";
import { silhouetteClip, silhouettePath } from "./silhouette-clip.js";
import { drawingElement, drawingLink, drawingSvg, paintedByFillLayer } from "./drawing.js";
import { colorStrokeOf } from "./strokes.js";
import { trimDash } from "@oim-media/core/v2";

const SVG = "http://www.w3.org/2000/svg";

/**
 * The figure of a shape. A box (rectangle, or a shape with no outline yet) is the
 * element itself. Any other figure is an SVG drawn over the box, filled with the
 * colour of the first fill and stroked with the first colour stroke, as the player
 * draws it. The element's own background is then transparent. Returns the outline,
 * so the caller knows whether the figure carries the stroke and rounds the box.
 */
export function applyGeometry(el: HTMLElement, layer: Pick<Layer, "geometry" | "fills" | "strokes" | "box" | "animations">, ctx: { colors: PaintColors }): Outline {
  el.querySelectorAll(":scope > svg[data-oim-figure]").forEach((node) => node.remove());
  // A picture clipped earlier goes back to the layer before the figure is drawn again.
  el.querySelectorAll(":scope > [data-oim-figure-clip]").forEach((box) => box.replaceWith(...box.querySelectorAll(":scope > img")));
  setMask(el, undefined);
  const outline = geometryOutline(layer.geometry, layer.box);
  // A gradient, pattern or generative fill is painted by applyFills on the element: kept, and cut to the figure.
  // A window mask is not: it paints its fill as a frame around the outline (applyWindowMask).
  const rich = paintedByFillLayer(layer as Layer) && !(layer as Layer).mask;
  if (outline.round && !outline.silhouette) el.style.borderRadius = "50%";
  const figure = outline.silhouette;
  if (!figure) {
    // Paths that paint themselves (an icon, an SVG) are no silhouette: each path brings its own colours.
    if (layer.geometry?.kind === "paths" && !outline.path) {
      const link = drawingLink(layer as Layer, ctx.colors.css);
      if (rich) setMask(el, drawingSvg(layer.geometry, { fill: "#000", stroke: "#000" }, true));
      else {
        el.style.backgroundColor = "transparent";
        el.style.backgroundImage = "";
      }
      const svg = drawingElement(el.ownerDocument, layer.geometry, rich ? { ...link, fill: "none" } : link);
      svg.dataset.oimFigure = "";
      el.appendChild(svg);
    }
    return outline;
  }

  const first = layer.fills?.[0];
  const fill = outline.fillable && first && "kind" in first && first.kind === "color" ? ctx.colors.css(first.value) : undefined;
  if (rich) setMask(el, `<svg xmlns="${SVG}" viewBox="${figure.viewBox}" preserveAspectRatio="none"><path d="${silhouettePath(figure).replace(/[^\d\sMmLlHhVvCcSsQqTtAaZzEe.,+-]/g, "")}"/></svg>`);
  else {
    el.style.backgroundColor = "transparent";
    el.style.backgroundImage = "";
  }
  // shortcut: a stroke on a masked figure loses its outer half; give the stroke its own unmasked layer if one shows up.
  const stroke = colorStrokeOf({ strokes: (layer.strokes ?? []).filter((s) => !s.align) }, ctx.colors);

  const svg = el.ownerDocument.createElementNS(SVG, "svg");
  svg.dataset.oimFigure = "";
  svg.setAttribute("viewBox", figure.viewBox);
  svg.setAttribute("preserveAspectRatio", "none");
  Object.assign(svg.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", display: "block", overflow: "visible" });
  const shape = el.ownerDocument.createElementNS(SVG, figure.points ? "polygon" : "path");
  if (figure.points) shape.setAttribute("points", figure.points);
  else shape.setAttribute("d", figure.d!);
  shape.setAttribute("fill", fill ?? "none");
  if (stroke) {
    shape.setAttribute("stroke", stroke.color);
    shape.setAttribute("stroke-width", String(stroke.width));
    shape.setAttribute("vector-effect", "non-scaling-stroke");
    shape.setAttribute("stroke-linejoin", "round");
    shape.setAttribute("stroke-linecap", "round");
    if (stroke.style === "dashed") shape.setAttribute("stroke-dasharray", "6,4");
    else if (stroke.style === "dotted") shape.setAttribute("stroke-dasharray", "2,3");
    // A trim is a dash over an outline of length 1; it replaces a dashed or dotted style.
    // A trim track animates the dash too, so the outline is prepared even when nothing is trimmed at rest.
    const tracksTrim = layer.animations?.some((a) => a.tracks?.some((t) => t.property === "trimStart" || t.property === "trimEnd"));
    const dash = trimDash(layer.geometry?.trim) ?? (tracksTrim ? { dasharray: "1 2", dashoffset: 0 } : undefined);
    if (dash) {
      // Chromium ignores pathLength under non-scaling-stroke, so the stroke scales with the figure instead:
      // its width in viewBox units, the mean of the two scales.
      // shortcut: a figure stretched unevenly draws a slightly uneven stroke; fine until a file shows it.
      shape.removeAttribute("vector-effect");
      const [, , vbW, vbH] = figure.viewBox.trim().split(" ").map(Number);
      const scale = ((vbW / (layer.box.width || vbW)) + (vbH / (layer.box.height || vbH))) / 2;
      shape.setAttribute("stroke-width", String(+(Number(stroke.width) * scale).toFixed(4)));
      shape.setAttribute("pathLength", "1");
      shape.setAttribute("stroke-dasharray", dash.dasharray);
      shape.setAttribute("stroke-dashoffset", String(dash.dashoffset));
    }
  }
  svg.appendChild(shape);
  el.appendChild(svg);
  clipPictures(el, figure);
  return outline;
}

/** The pictures of a figure sit in a box clipped by its silhouette, under the stroke drawing. The crop transform stays on the picture, inside the clip. */
function clipPictures(el: HTMLElement, figure: { d?: string; points?: string; viewBox: string }): void {
  const pictures = el.querySelectorAll<HTMLImageElement>(":scope > img[data-oim-fill]");
  if (!pictures.length) return;
  const { svg, clipPath } = silhouetteClip(el.ownerDocument, { d: silhouettePath(figure), viewBox: figure.viewBox });
  const box = el.ownerDocument.createElement("div");
  box.dataset.oimFigureClip = "";
  Object.assign(box.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none", clipPath });
  box.append(svg, ...pictures);
  el.insertBefore(box, el.firstChild);
}

/** Cuts the element (its painted fills) to an SVG's shape, stretched to the box; undefined removes the cut. */
function setMask(el: HTMLElement, svg: string | undefined): void {
  const image = svg ? `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")` : "";
  for (const prefix of ["", "-webkit-"]) {
    el.style.setProperty(`${prefix}mask-image`, image);
    el.style.setProperty(`${prefix}mask-size`, svg ? "100% 100%" : "");
    el.style.setProperty(`${prefix}mask-repeat`, svg ? "no-repeat" : "");
  }
}
