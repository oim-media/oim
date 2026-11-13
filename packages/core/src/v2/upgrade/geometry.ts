/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What a layer is made of: the figure of a shape, the corners, the source of
// an image. Also where `content` goes when the layer is not a text.

import { admits } from "../layer-blocks.js";
import type { Geometry } from "../schema.js";
import { toCanvasUnits } from "./box.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./context.js";
import { svgToPaths, type PathEntry } from "./svg-paths.js";

/** The 1.x name of a figure and the 2.0 geometry that has its own kind. */
const BASIC: Record<string, Geometry> = {
  rectangle: { kind: "rect" },
  circle: { kind: "ellipse" },
  line: { kind: "line" },
};

const viewBoxOf = (value: unknown): number[] => {
  const numbers = typeof value === "string" ? value.trim().split(/[\s,]+/).map(Number) : [];
  return numbers.length === 4 && numbers.every(Number.isFinite) ? numbers : [0, 0, 24, 24];
};

/** `content` of a layer that is not a text: one value for every language, under "*" or the main one. */
export function mediaOf(ctx: UpgradeContext, slot: V1Slot): string | undefined {
  const content = ctx.take(slot.raw, "content");
  if (typeof content === "string") return content || undefined;
  const map = asObject(content) ?? {};
  const value = map["*"] ?? map[ctx.language] ?? Object.values(map).find((v) => typeof v === "string" && v !== "");
  return typeof value === "string" && value !== "" ? value : undefined;
}

function pathsFromLayers(ctx: UpgradeContext, layers: unknown[], viewBox: number[]): Geometry | undefined {
  const paths: PathEntry[] = [];
  for (const item of layers) {
    const part = asObject(item);
    if (!part || typeof part.d !== "string" || !part.d) continue;
    const entry: PathEntry = { d: part.d };
    if (typeof part.fill === "string" && part.fill !== "none") entry.fill = part.fill;
    if (typeof part.stroke === "string" && part.stroke !== "none") {
      entry.stroke = part.stroke;
      entry.strokeWidth = typeof part.strokeWidth === "number" ? part.strokeWidth : 1;
    }
    if (typeof part.animationType === "string" && part.animationType !== "none") {
      ctx.note(`style.svgLayers: per-path animation "${part.animationType}"`);
    }
    paths.push(entry);
  }
  return paths.length > 0 ? { kind: "paths", viewBox, paths } : undefined;
}

function shapeGeometry(ctx: UpgradeContext, slot: V1Slot, media: string | undefined): Geometry {
  const { style } = slot;
  const name = ctx.take(style, "geoShape") ?? ctx.take(style, "geoType");
  ctx.take(style, "geoType");
  const path = ctx.take(style, "svgPath");
  const blob = ctx.take(style, "customBlobPath");
  const viewBox = viewBoxOf(ctx.take(style, "svgViewBox"));
  const rawXml = ctx.take(style, "svgRawXml");
  const layers = ctx.take(style, "svgLayers");

  // The decomposed layers carry the colours the author edited; the raw XML is the original.
  if (Array.isArray(layers) && layers.length > 0) {
    const fromLayers = pathsFromLayers(ctx, layers, viewBox);
    if (fromLayers) return fromLayers;
  }
  const xml = typeof rawXml === "string" && rawXml ? rawXml : slot.type === "svg" ? media : undefined;
  if (xml) {
    const parsed = svgToPaths(xml);
    if (parsed.ok) return { kind: "paths", ...parsed.value };
    ctx.note(`style.svgRawXml: ${parsed.reason}`);
    return { kind: "rect" };
  }
  const d = typeof path === "string" && path ? path : typeof blob === "string" && blob ? blob : undefined;
  if (d && (name === undefined || name === "custom" || name === "blob")) return { kind: "paths", viewBox, paths: [{ d }] };
  if (typeof name === "string" && name) return BASIC[name] ?? { kind: "preset", name };
  return { kind: "rect" };
}

const CORNER_KEYS = [
  ["borderRadiusTL", "borderTopLeftRadius"],
  ["borderRadiusTR", "borderTopRightRadius"],
  ["borderRadiusBR", "borderBottomRightRadius"],
  ["borderRadiusBL", "borderBottomLeftRadius"],
];

function cornersOf(ctx: UpgradeContext, style: V1Object): number | number[] | undefined {
  const all = toCanvasUnits(ctx.take(style, "borderRadius"), ctx.canvas.width) ?? 0;
  const each = CORNER_KEYS.map((keys) => {
    const values = keys.map((key) => toCanvasUnits(ctx.take(style, key), ctx.canvas.width));
    return values.find((v) => v !== undefined);
  });
  if (each.some((v) => v !== undefined)) {
    const four = each.map((v) => Math.max(0, v ?? all));
    return four.every((v) => v === four[0]) ? four[0] || undefined : four;
  }
  return all > 0 ? all : undefined;
}

export function convertGeometry(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;
  const media = layer.type === "text" ? undefined : mediaOf(ctx, slot);

  if (layer.type === "shape") layer.geometry = shapeGeometry(ctx, slot, media);
  else for (const key of ["geoShape", "geoType", "svgPath", "customBlobPath", "svgViewBox", "svgRawXml", "svgLayers"]) ctx.take(style, key);

  const corners = cornersOf(ctx, style);
  if (corners !== undefined && admits(layer.type, "corners")) layer.corners = corners;

  const fit = ctx.take(style, "objectFit");
  const crop = asObject(ctx.take(style, "imageCrop"));
  if (layer.type === "image") {
    // An image layer with no source of its own was baked into the PNG of the file.
    layer.image = { src: media ?? "oim:base" };
    if (typeof fit === "string" && fit !== "cover") layer.image.fit = fit as never;
    if (crop) layer.image.crop = crop as never;
  }
  if (layer.type === "lottie" && media) layer.lottie = { src: media };

  if (ctx.take(style, "flipX") === true) layer.box.flipX = true;
  if (ctx.take(style, "flipY") === true) layer.box.flipY = true;

  const alt = asObject(ctx.take(style, "alt"));
  const decorative = ctx.take(style, "decorative") === true;
  if (admits(layer.type, "a11y") && ((alt && Object.keys(alt).length > 0) || decorative)) {
    layer.a11y = {};
    if (alt && Object.keys(alt).length > 0) layer.a11y.alt = alt as Record<string, string>;
    if (decorative) layer.a11y.decorative = true;
  }
}
