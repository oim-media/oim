/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveNumericDimension } from "../../dimensions.js";
import type { DraftLayer, UpgradeContext, V1Slot } from "./context.js";

const BLEND_MODES = new Set(["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference"]);

/** A 1.x length (number, "92.5cqw", "120px", "50%") in canvas units; undefined when it says nothing. */
export function toCanvasUnits(value: unknown, canvasWidth: number): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const resolved = resolveNumericDimension(value, canvasWidth);
  return resolved !== null && Number.isFinite(resolved) ? resolved : undefined;
}

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

// The layer types the player sizes as a shape (`isGeoLike` in the 1.x engine).
const SHAPE_TYPES = new Set(["geo", "shape", "draw", "filter", "container", "mask", "artistic-text"]);
const DEFAULT_SIDE = 0.1; // 10cqw, what the player gives a shape or an image with no size

/**
 * A 1.x style length as the player painted it, in canvas units. Every length is
 * painted against the canvas width (cqw) except a percentage, which CSS takes
 * from the container's own axis. Undefined for what the player does not size.
 */
function paintedLength(value: unknown, axis: number, W: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) && axis > 0 ? (value / axis) * W : undefined;
  const text = String(value).trim();
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return undefined;
  if (text.endsWith("cqw")) return (n / 100) * W;
  if (text.endsWith("%")) return (n / 100) * axis;
  if (text.endsWith("px")) return n;
  return /^-?[\d.]+$/.test(text) && axis > 0 ? (n / axis) * W : undefined;
}

const hasContent = (content: unknown): boolean =>
  typeof content === "string" ? content !== "" : !!content && typeof content === "object" && Object.values(content).some((v) => typeof v === "string" && v !== "");

/** Position, size, rotation, opacity, visibility and blend. Defaults are not written. */
export function convertBox(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { raw, style } = slot;
  const { width: W, height: H } = ctx.canvas;

  // The player reads a position as a fraction when neither axis passes 1.
  const position = ctx.take(raw, "position");
  const [px, py] = Array.isArray(position) ? position : [];
  let fx = finite(px) ?? 0;
  let fy = finite(py) ?? 0;
  if (fx > 1 || fy > 1) {
    fx /= 100;
    fy /= 100;
  }

  const widthPx = finite(ctx.take(raw, "width_px"));
  const heightPx = finite(ctx.take(raw, "height_px"));
  const widthPercent = finite(ctx.take(raw, "widthPercent"));
  const heightPercent = finite(ctx.take(raw, "heightPercent"));
  const styleWidth = ctx.take(style, "width");
  const styleHeight = ctx.take(style, "height");

  // The reference box the player centres on: measured against each axis.
  const ref = (px: number | undefined, percent: number | undefined, value: unknown, axis: number) =>
    px ?? (percent !== undefined ? (percent / 100) * axis : (toCanvasUnits(value, axis) ?? 0));
  const wRef = ref(widthPx, widthPercent, styleWidth, W);
  const hRef = ref(heightPx, heightPercent, styleHeight, H);

  // The box it painted: the branches of the player's sizing, in its order.
  const type = String(raw.type ?? "text");
  const isShape = SHAPE_TYPES.has(type) && !(type === "mask" && style.maskMode === "cutout");
  const isBackground = raw.is_background_pattern === true || raw.id === "background-pattern-slot";
  const content = hasContent(raw.content);
  const fromStyle = [paintedLength(styleWidth, W, W), paintedLength(styleHeight, H, W)];
  const fromFields = [
    widthPx ?? (widthPercent !== undefined ? (widthPercent / 100) * W : undefined),
    heightPx !== undefined ? (heightPx / W) * W : heightPercent !== undefined ? (heightPercent / 100) * W : undefined,
  ];
  let size: (number | undefined)[];
  if (fromStyle[0] !== undefined && fromStyle[1] !== undefined) size = fromStyle;
  else if (fromFields[0] !== undefined && fromFields[1] !== undefined && (isShape || type === "image" || !content)) size = fromFields;
  else if (type === "image" || (isShape && !content) || isBackground || type === "pattern") {
    size = [0, 1].map((i) => fromFields[i] ?? fromStyle[i] ?? DEFAULT_SIDE * W);
  } else size = [undefined, undefined];

  const align = style.textAlign ?? raw.align ?? "left";
  const pull = (span: number) => (align === "center" ? span / 2 : align === "right" ? span : 0);
  const anchorX = fx * W + pull(wRef);
  const anchorY = fy * H + hRef / 2;
  const [width, height] = size;

  if (width === undefined || height === undefined) {
    if (type !== "text" && !content) {
      // Nothing to fit (a group): keep the reference box its wrapper is built from.
      layer.box = { x: fx * W, y: fy * H, width: Math.max(0, wRef), height: Math.max(0, hRef) };
    } else {
      // Fitted to its content in 1.x: the point it was pinned at, and the
      // reference width when it had one (an endless loop measures by it).
      layer.box = { x: anchorX, y: anchorY, anchor: align === "center" ? "center" : align === "right" ? "right" : "left" };
      if (wRef > 0) layer.box.width = wRef;
    }
  } else {
    layer.box = { x: anchorX - pull(width), y: anchorY - height / 2, width: Math.max(0, width), height: Math.max(0, height) };
  }

  const rotation = finite(ctx.take(style, "rotation"));
  if (rotation) layer.box.rotation = rotation;

  const opacity = finite(ctx.take(style, "opacity"));
  if (opacity !== undefined && opacity < 100) layer.opacity = Math.max(0, opacity) / 100;

  // 1.x hid the layer when either the style or the slot itself said so.
  const hiddenSlot = ctx.take(raw, "isVisible") === false;
  if (ctx.take(style, "isVisible") === false || hiddenSlot) layer.visible = false;

  const blend = ctx.take(style, "blendMode");
  if (typeof blend === "string" && BLEND_MODES.has(blend)) layer.blend = blend as DraftLayer["blend"];
}
