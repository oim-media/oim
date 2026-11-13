/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A mask stops being a layer type: it is a shape that takes the role of
// masking its siblings. Its figure, background and outline are the shape's own
// geometry, fill and stroke.

import type { Geometry, Mask } from "../schema.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Slot } from "./context.js";
import { colorOf } from "./paints.js";

const SHAPES: Record<string, Geometry> = { rectangle: { kind: "rect" }, circle: { kind: "ellipse" }, line: { kind: "line" } };

export function convertMask(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;
  const mode = ctx.take(style, "maskMode");
  const invert = ctx.take(style, "maskInvert") === true;
  const feather = ctx.take(style, "maskFeather");
  const coverage = ctx.take(style, "maskCoverage");
  const shape = ctx.take(style, "maskShape");
  const path = ctx.take(style, "maskSvgPath");
  const cuts = ctx.take(style, "cuts");
  const background = colorOf(ctx, style, "maskBgColor", "maskBgColorRole");
  const stroke = colorOf(ctx, style, "maskStrokeColor", "maskStrokeColorRole");
  const strokeWidth = ctx.take(style, "maskStrokeWidth");

  // `maskCoverage: "canvas"` and `maskInvert: false` travel on every layer of
  // 1.x; they only mean something on a mask.
  if (slot.type !== "mask") return;

  const mask: Mask = {};
  if (mode === "cutout") mask.mode = "cutout";
  if (invert) mask.invert = true;
  if (typeof feather === "number" && feather > 0) mask.feather = feather;
  if (coverage === "canvas") mask.scope = "canvas";
  layer.mask = mask;

  if (typeof path === "string" && path) layer.geometry = { kind: "paths", viewBox: [0, 0, 100, 100], paths: [{ d: path }] };
  else if (typeof shape === "string" && shape) layer.geometry = SHAPES[shape] ?? { kind: "preset", name: shape };

  if (background !== undefined) layer.fills = [{ kind: "color", value: background }];
  if (stroke !== undefined && typeof strokeWidth === "number" && strokeWidth > 0) {
    layer.strokes = [{ paint: { kind: "color", value: stroke }, width: strokeWidth }];
  }
  // Extra holes cut in the mask, each with its own box: kept for the editor
  // until the renderer phase decides how a mask with several figures is drawn.
  if (Array.isArray(cuts) && cuts.length > 0) {
    layer.extensions = { ...layer.extensions, studio: { ...asObject(layer.extensions?.studio), maskCuts: cuts } };
  }
}
