/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, PaintColors } from "@oim-media/core/v2";
import { getMaskClipPathD, getMaskSilhouetteCanvasD, getWindowMaskCanvasD } from "../runtime/layerComposition.js";
import { maskOutlineStyle } from "./mask-outline-style.js";
import { applyFills } from "./fills.js";
import { silhouetteClip } from "./silhouette-clip.js";
import { colorStrokeOf } from "./strokes.js";

const SVG = "http://www.w3.org/2000/svg";

/**
 * A window mask: a frame over the whole canvas, painted with the layer's fills, with
 * the layer's outline cut out as a hole, and its first colour stroke drawn on the
 * outline. The outline and the hole are the composition's, as the player draws them.
 * The frame is in canvas units inside the layer's box, so it scales with the canvas.
 */
export function applyWindowMask(el: HTMLElement, layer: Layer, ctx: { canvas: { width: number; height: number }; colors: PaintColors }): void {
  const { width: W, height: H } = ctx.canvas;
  const { x = 0, y = 0, width = 0, height = 0 } = layer.box;
  // The layer's own paint moves to the frame: its box shows nothing of its own.
  el.querySelectorAll(":scope > :not([data-oim-mask-frame])").forEach((node) => node.remove());
  el.querySelector(":scope > [data-oim-mask-frame]")?.remove();
  Object.assign(el.style, { backgroundColor: "transparent", backgroundImage: "", border: "", outline: "", boxShadow: "", overflow: "visible" });
  if (!width || !height) return;

  const slot = { id: layer.id, type: "mask", style: maskOutlineStyle(layer.geometry), x, y, width, height };
  const pct = (v: number, of: number) => `${+((v / of) * 100).toFixed(4)}%`;
  const doc = el.ownerDocument;
  const frame = doc.createElement("div");
  frame.dataset.oimMaskFrame = "";
  Object.assign(frame.style, { position: "absolute", left: pct(-x, width), top: pct(-y, height), width: pct(W, width), height: pct(H, height), pointerEvents: "none" });

  const paint = doc.createElement("div");
  paint.dataset.oimMaskPaint = "";
  applyFills(paint, layer, { colors: ctx.colors, isText: false, size: (px) => `${+((px / W) * 100).toFixed(4)}cqw ${+((px / W) * 100).toFixed(4)}cqw` });
  const { svg, clipPath } = silhouetteClip(doc, { d: getWindowMaskCanvasD(slot, ctx.canvas), viewBox: `0 0 ${W} ${H}`, evenodd: true });
  Object.assign(paint.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", clipPath });
  frame.append(svg, paint);

  const stroke = colorStrokeOf(layer, ctx.colors);
  // shortcut: a width bound to a variable is not drawn, as in geometry.ts; resolve it when variables reach strokes.
  if (stroke && Number(stroke.width) > 0) {
    // Not clipped: half the stroke lies over the frame's edge.
    const ring = doc.createElementNS(SVG, "svg");
    ring.dataset.oimMaskOutline = "";
    ring.setAttribute("viewBox", `0 0 ${W} ${H}`);
    ring.setAttribute("preserveAspectRatio", "none");
    Object.assign(ring.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" });
    const path = doc.createElementNS(SVG, "path");
    path.setAttribute("d", getMaskSilhouetteCanvasD(slot, ctx.canvas));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke.color);
    path.setAttribute("stroke-width", String(stroke.width));
    path.setAttribute("stroke-linejoin", "round");
    ring.appendChild(path);
    frame.appendChild(ring);
  }
  el.appendChild(frame);
}

/**
 * A cutout mask: it paints nothing of its own and clips every layer painted
 * before it, as the player does: they show outside the mask's box and inside
 * its figure. The layers are moved into one canvas-sized wrapper so the clip is
 * drawn in canvas units, with the same path the player builds.
 *
 * shortcut: a feathered edge (maskFeather) is drawn hard; add the blurred mask when a file needs it.
 */
export function applyCutoutMask(parent: HTMLElement, layer: Layer, canvas: { width: number; height: number }): HTMLElement | undefined {
  const { x = 0, y = 0, width = 0, height = 0 } = layer.box;
  if (!width || !height || !parent.childElementCount) return undefined;
  const slot = { id: layer.id, type: "mask", style: maskOutlineStyle(layer.geometry), x, y, width, height };
  const doc = parent.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.dataset.oimCutout = layer.id;
  const { svg, clipPath } = silhouetteClip(doc, { d: getMaskClipPathD(slot, canvas), viewBox: `0 0 ${canvas.width} ${canvas.height}`, evenodd: true });
  Object.assign(wrapper.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", clipPath });
  wrapper.append(...parent.children);
  parent.append(svg, wrapper);
  return wrapper;
}

