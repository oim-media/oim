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

/** Position, size, rotation, opacity, visibility and blend. Defaults are not written. */
export function convertBox(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { raw, style } = slot;
  const { width: W, height: H } = ctx.canvas;

  // The anchor is taken as the layer's top-left corner; the visual gate of the
  // renderer phase confirms it against the goldens.
  const position = ctx.take(raw, "position");
  const [px, py] = Array.isArray(position) ? position : [];
  const x = ((finite(px) ?? 0) / 100) * W;
  const y = ((finite(py) ?? 0) / 100) * H;

  const widthPx = finite(ctx.take(raw, "width_px"));
  const heightPx = finite(ctx.take(raw, "height_px"));
  const width = toCanvasUnits(ctx.take(style, "width"), W) ?? widthPx ?? 0;
  const height = toCanvasUnits(ctx.take(style, "height"), W) ?? heightPx ?? 0;

  layer.box = { x, y, width: Math.max(0, width), height: Math.max(0, height) };

  const rotation = finite(ctx.take(style, "rotation"));
  if (rotation) layer.box.rotation = rotation;

  const opacity = finite(ctx.take(style, "opacity"));
  if (opacity !== undefined && opacity < 100) layer.opacity = Math.max(0, opacity) / 100;

  if (ctx.take(style, "isVisible") === false) layer.visible = false;

  const blend = ctx.take(style, "blendMode");
  if (typeof blend === "string" && BLEND_MODES.has(blend)) layer.blend = blend as DraftLayer["blend"];
}
