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
import { isColor, type ColorValue } from "./paints.js";

const SHAPES: Record<string, Geometry> = { rectangle: { kind: "rect" }, circle: { kind: "ellipse" }, line: { kind: "line" } };

export function convertMask(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;
  const mode = ctx.take(style, "maskMode");
  const feather = ctx.take(style, "maskFeather");
  const coverage = ctx.take(style, "maskCoverage");
  const shape = ctx.take(style, "maskShape");
  const path = ctx.take(style, "maskSvgPath");
  const cuts = ctx.take(style, "cuts");
  const bgLiteral = ctx.take(style, "maskBgColor");
  const bgRole = ctx.take(style, "maskBgColorRole");
  const strokeLiteral = ctx.take(style, "maskStrokeColor");
  const strokeRole = ctx.take(style, "maskStrokeColorRole");
  const strokeWidth = ctx.take(style, "maskStrokeWidth");

  // `maskCoverage: "canvas"` and `maskInvert: false` travel on every layer of
  // 1.x; they only mean something on a mask.
  // The player never drew an inverted mask, on a mask or anywhere else.
  ctx.take(style, "maskInvert");
  if (slot.type !== "mask") return;

  // Ruling (13 Nov): what the 1.x player drew wins.
  const mask: Mask = {};
  const cutout = mode === "cutout";
  if (cutout) mask.mode = "cutout";
  if (typeof feather === "number" && feather > 0) mask.feather = feather;
  // It covered the whole canvas unless told to stay in its own box.
  if (coverage === "container") mask.scope = "group";
  layer.mask = mask;

  // The figure: a drawn path only when no named shape says otherwise; a circle when nothing does.
  const name = typeof shape === "string" && shape ? shape : typeof style.geoShape === "string" ? style.geoShape : undefined;
  const d = typeof path === "string" && path ? path : typeof style.svgPath === "string" && style.svgPath ? style.svgPath : undefined;
  if (d && (!name || name === "custom")) layer.geometry = { kind: "paths", viewBox: [0, 0, 100, 100], paths: [{ d }] };
  else if (name && name !== "custom") layer.geometry = SHAPES[name] ?? { kind: "preset", name };
  else layer.geometry = { kind: "ellipse" };

  // Extra holes cut in the mask, each with its own box.
  if (Array.isArray(cuts) && cuts.length > 0) {
    layer.extensions = { ...layer.extensions, studio: { ...asObject(layer.extensions?.studio), maskCuts: cuts } };
  }

  // Only a window paints: its frame, and an outline over the silhouette, each with the player's own default colour.
  if (cutout) return;
  const color = (role: unknown, literal: unknown, fallback: string): ColorValue => {
    const value = isColor(literal) ? literal : fallback;
    return typeof role === "string" && ctx.hasRole(role) ? { var: role, fallback: value } : value;
  };
  layer.fills = [{ kind: "color", value: color(bgRole || style.fillColorRole, bgLiteral, "#38BDF8") }];
  delete layer.strokes;
  if (typeof strokeWidth === "number" && strokeWidth > 0) {
    layer.strokes = [{ paint: { kind: "color", value: color(strokeRole || style.strokeColorRole, strokeLiteral, "#FFFFFF") }, width: strokeWidth }];
  }
}
