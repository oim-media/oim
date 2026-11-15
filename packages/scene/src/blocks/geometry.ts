/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geometryOutline, type Layer, type Outline, type PaintColors } from "@oim-media/core/v2";
import { colorStrokeOf } from "./strokes.js";

const SVG = "http://www.w3.org/2000/svg";

/**
 * The figure of a shape. A box (rectangle, or a shape with no outline yet) is the
 * element itself. Any other figure is an SVG drawn over the box, filled with the
 * colour of the first fill and stroked with the first colour stroke, as the player
 * draws it. The element's own background is then transparent. Returns the outline,
 * so the caller knows whether the figure carries the stroke and rounds the box.
 */
export function applyGeometry(el: HTMLElement, layer: Pick<Layer, "geometry" | "fills" | "strokes">, ctx: { colors: PaintColors }): Outline {
  el.querySelectorAll(":scope > svg[data-oim-figure]").forEach((node) => node.remove());
  const outline = geometryOutline(layer.geometry);
  if (outline.round && !outline.silhouette) el.style.borderRadius = "50%";
  const figure = outline.silhouette;
  if (!figure) return outline;

  const first = layer.fills?.[0];
  const fill = outline.fillable && first && "kind" in first && first.kind === "color" ? ctx.colors.css(first.value) : undefined;
  el.style.backgroundColor = "transparent";
  el.style.backgroundImage = "";
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
  }
  svg.appendChild(shape);
  el.appendChild(svg);
  return outline;
}
