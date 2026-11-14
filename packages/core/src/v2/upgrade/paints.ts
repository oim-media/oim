/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Every way 1.x paints something -fill, text colour, pattern, background,
// stroke, text outline- becomes one of two lists: `fills` and `strokes`.

import { admits } from "../layer-blocks.js";
import type { Paint, Stroke } from "../schema.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./context.js";
import { parseCssGradient } from "./gradient.js";

export type ColorValue = string | { var: string; fallback?: string };

export const isColor = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && value !== "transparent" && value !== "none";

/**
 * A colour and its role. A known role (a palette's, or one of the dynamic roles
 * a host page can set) becomes a binding that keeps the literal as its fallback,
 * which is what 1.x painted: `var(--oim-color-<role>, <literal>)`.
 */
export function colorOf(ctx: UpgradeContext, owner: V1Object, key: string, roleKey?: string): ColorValue | undefined {
  const literal = ctx.take(owner, key);
  const role = roleKey ? ctx.take(owner, roleKey) : undefined;
  if (typeof role === "string" && ctx.hasRole(role)) return isColor(literal) ? { var: role, fallback: literal } : { var: role };
  return isColor(literal) ? literal : undefined;
}

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === "number") ? (value as number[]) : undefined;

/** The pattern fields that share a prefix: `fillPattern*` on a layer, `backgroundPattern*` on a layer or the canvas. */
function patternOf(ctx: UpgradeContext, owner: V1Object, prefix: string, cssAnimation?: unknown): Paint | undefined {
  const preset = ctx.take(owner, `${prefix}Type`);
  const single = colorOf(ctx, owner, `${prefix}Color`, `${prefix}ColorRole`);
  const bg = colorOf(ctx, owner, `${prefix}BgColor`, `${prefix}BgColorRole`);
  const list = ctx.take(owner, `${prefix}Colors`);
  const scale = ctx.take(owner, `${prefix}Scale`);
  const speed = ctx.take(owner, `${prefix}Speed`);
  const direction = ctx.take(owner, `${prefix}Direction`);
  const svgs = ctx.take(owner, `${prefix}Svgs`);
  const sizes = numbers(ctx.take(owner, `${prefix}Sizes`));
  // The canvas wrote the singular, the layer the plural: the same list.
  const counts = numbers(ctx.take(owner, `${prefix}Counts`)) ?? numbers(ctx.take(owner, `${prefix}Count`));
  const dispersions = numbers(ctx.take(owner, `${prefix}Dispersions`)) ?? numbers(ctx.take(owner, `${prefix}Dispersion`));
  if (typeof preset !== "string" || !preset) return undefined;

  const pattern: Extract<Paint, { kind: "pattern" }>["pattern"] = { preset };
  const colors = Array.isArray(list) ? list.filter(isColor) : [];
  if (colors.length > 0) pattern.colors = colors;
  else if (single !== undefined) pattern.colors = [single];
  if (bg !== undefined) pattern.bg = bg;
  if (typeof scale === "number" && scale !== 1) pattern.scale = scale;
  if (sizes) pattern.sizes = sizes;
  if (counts) pattern.counts = counts;
  if (dispersions) pattern.dispersions = dispersions;
  if (Array.isArray(svgs) && svgs.length > 0) pattern.svgs = svgs.filter((s) => typeof s === "string");

  // 1.x said how the pattern moves twice: in these fields and, on the canvas
  // background, as a CSS animation string. Either one is enough.
  const css = typeof cssAnimation === "string" ? /^background-animation-([a-z-]+)\s+([\d.]+)s\b/.exec(cssAnimation) : null;
  const way = typeof direction === "string" && direction !== "none" ? direction : css?.[1];
  const period = typeof speed === "number" && speed > 0 ? speed : css ? Number(css[2]) : undefined;
  if (way && MOTION.has(way) && period) pattern.motion = { direction: way as never, period };
  return { kind: "pattern", pattern };
}

const MOTION = new Set(["right", "left", "up", "down", "zoom-in", "zoom-out", "pulse"]);

function gradientOf(ctx: UpgradeContext, owner: V1Object, key: string, label: string): Paint | undefined {
  const css = ctx.take(owner, key);
  if (css === undefined || css === null || css === "") return undefined;
  const gradient = parseCssGradient(css);
  if (!gradient) {
    ctx.note(`${label}.${key}: gradient not understood`);
    return undefined;
  }
  return { kind: "gradient", gradient };
}

function imageOf(ctx: UpgradeContext, style: V1Object): Paint | undefined {
  const src = ctx.take(style, "fillImage");
  const crop = asObject(ctx.take(style, "fillImageCrop"));
  const flipX = ctx.take(style, "fillImageFlipX");
  const flipY = ctx.take(style, "fillImageFlipY");
  if (typeof src !== "string" || !src) return undefined;
  const paint: Extract<Paint, { kind: "image" }> = { kind: "image", src };
  if (crop) paint.crop = crop as never;
  if (flipX === true) paint.flipX = true;
  if (flipY === true) paint.flipY = true;
  return paint;
}

const TEXT_GRADIENT_PRESETS = new Set(["metallic-chrome", "sunset-gold", "neon-glow", "linear"]);

function fillOf(ctx: UpgradeContext, slot: V1Slot): Paint | undefined {
  const { style } = slot;
  const fillType = ctx.take(style, "fillType");
  const backgroundType = ctx.take(style, "backgroundType");
  // Everything is taken even when it does not win: 1.x writes the fields of
  // every kind of fill and only `fillType` says which one counts.
  // 1.x painted fillColor under `fillColorRole || colorRole`; `color` itself was
  // retired in 1.5.0 and paints nothing, so it is only taken.
  const roleKey = typeof style.fillColorRole === "string" && style.fillColorRole ? "fillColorRole" : "colorRole";
  const color = colorOf(ctx, style, "fillColor", roleKey);
  ctx.take(style, "fillColorRole");
  ctx.take(style, "colorRole");
  ctx.take(style, "color");
  const gradient = gradientOf(ctx, style, "fillGradient", "style");
  const image = imageOf(ctx, style);
  const cssAnimation = style.cssAnimation;
  const fillPattern = patternOf(ctx, style, "fillPattern", cssAnimation);
  const backgroundPattern = patternOf(ctx, style, "backgroundPattern", cssAnimation);
  const generative = asObject(ctx.take(style, "fillGenerative")) ?? asObject(ctx.take(style, "backgroundGenerative"));
  ctx.take(style, "backgroundFit");
  const textGradient = ctx.take(style, "textGradientType");

  const pattern = fillPattern ?? backgroundPattern;
  if (pattern && typeof cssAnimation === "string" && /^background-animation-/.test(cssAnimation)) ctx.take(style, "cssAnimation");

  const solid = (): Paint | undefined => {
    return color === undefined ? undefined : { kind: "color", value: color };
  };
  const kind = typeof fillType === "string" ? fillType : typeof backgroundType === "string" ? backgroundType : "color";
  if (kind === "none" || kind === "transparent") return undefined;
  if (kind === "gradient") return gradient ?? solid();
  if (kind === "image") return image ?? solid();
  if (kind === "pattern") return pattern ?? solid();
  if (kind === "generative") return generative ? { kind: "generative", generative: generative as never } : solid();
  if ((slot.type === "text" || slot.type === "artistic-text") && typeof textGradient === "string" && TEXT_GRADIENT_PRESETS.has(textGradient) && textGradient !== "linear") {
    return { kind: "gradient", preset: textGradient };
  }
  return solid();
}

function strokeOf(
  ctx: UpgradeContext,
  style: V1Object,
  colorKey: string,
  widthKey: string,
  extra: Partial<Stroke> = {},
  roleKey?: string,
): Stroke | undefined {
  const color = colorOf(ctx, style, colorKey, roleKey);
  const width = ctx.take(style, widthKey);
  // A colour with no width paints nothing: 1.x writes the default colour on every layer.
  if (typeof width !== "number" || !(width > 0) || color === undefined) return undefined;
  return { paint: { kind: "color", value: color }, width, ...extra };
}

/** 1.x painted a text stroke black when it had no colour, under `textStrokeColorRole || strokeColorRole`. */
function textStrokeOf(ctx: UpgradeContext, style: V1Object): Stroke | undefined {
  const roleKey = typeof style.textStrokeColorRole === "string" && style.textStrokeColorRole ? "textStrokeColorRole" : "strokeColorRole";
  const width = style.textStrokeWidth;
  const color = colorOf(ctx, style, "textStrokeColor", roleKey);
  ctx.take(style, "textStrokeColorRole");
  ctx.take(style, "textStrokeWidth");
  if (typeof width !== "number" || !(width > 0)) return undefined;
  return { paint: { kind: "color", value: color ?? "#000000" }, width };
}

export function convertPaints(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;

  const fill = fillOf(ctx, slot);
  if (fill && admits(layer.type, "fills")) layer.fills = [fill];

  const strokeStyle = ctx.take(style, "strokeStyle");
  const dashed = strokeStyle === "dashed" || strokeStyle === "dotted" ? { style: strokeStyle as Stroke["style"] } : {};
  // 1.x passed borderColor and borderWidth to CSS without a border-style, so
  // they painted nothing unless the file also carried a visible borderStyle.
  const borderStyle = ctx.take(style, "borderStyle");
  const border = strokeOf(ctx, style, "borderColor", "borderWidth",
    borderStyle === "dashed" || borderStyle === "dotted" ? { style: borderStyle } : {});
  const outline = strokeOf(ctx, style, "strokeColor", "strokeWidth", dashed, "strokeColorRole");
  const glyphs = textStrokeOf(ctx, style);
  // On a text the stroke is the outline of the letters. The box border 1.x drew
  // when a text carried strokeColor has no 2.0 meaning and is dropped.
  const outer = strokeOf(ctx, style, "outerStrokeColor", "outerStrokeWidth", { align: "outside" });
  const inner = strokeOf(ctx, style, "innerStrokeColor", "innerStrokeWidth", { align: "inside" });
  const strokes = (layer.type === "text" ? [glyphs, outer, inner] : [
    outline,
    borderStyle === "solid" || borderStyle === "dashed" || borderStyle === "dotted" ? border : undefined,
    glyphs,
    outer,
    inner,
  ]).filter((s): s is Stroke => s !== undefined);
  if (strokes.length > 0 && admits(layer.type, "strokes")) layer.strokes = strokes;
}

const TEXTURE_KEYS: [spanish: string, english: string][] = [
  ["tipo", "type"],
  ["color", "color"],
  ["angulo", "angle"],
  ["cruzada", "crossed"],
  ["grosor", "thickness"],
  ["tamano", "size"],
];

/** The background of the canvas, which 1.x kept in some twenty undeclared root keys. */
export function canvasFills(ctx: UpgradeContext, meta: V1Object): Paint[] {
  const type = ctx.take(meta, "backgroundType");
  const color = colorOf(ctx, meta, "backgroundColor");
  const gradient = gradientOf(ctx, meta, "backgroundGradient", "root");
  // The gradient string already says all of this.
  for (const key of ["backgroundGradientAngle", "backgroundGradientStart", "backgroundGradientEnd", "backgroundGradientType"]) {
    ctx.take(meta, key);
  }
  const pattern = patternOf(ctx, meta, "backgroundPattern");
  const generative = asObject(ctx.take(meta, "backgroundGenerative"));
  const texture = asObject(ctx.take(meta, "backgroundTexture"));

  const fills: Paint[] = [];
  const solid = color === undefined ? undefined : ({ kind: "color", value: color } as Paint);
  if (type === "gradient") fills.push(...[gradient ?? solid].filter((p): p is Paint => !!p));
  else if (type === "pattern") fills.push(...[pattern ?? solid].filter((p): p is Paint => !!p));
  else if (type === "generative" && generative) fills.push({ kind: "generative", generative: generative as never });
  else if (type !== "transparent" && solid) fills.push(solid);

  if (texture && typeof texture.tipo === "string") {
    const drawn: Record<string, unknown> = {};
    for (const [spanish, english] of TEXTURE_KEYS) if (texture[spanish] !== undefined) drawn[english] = texture[spanish];
    const paint: Paint = { kind: "texture", texture: drawn as never };
    if (typeof texture.opacidad === "number") paint.opacity = Math.min(1, Math.max(0, texture.opacidad));
    fills.push(paint);
  }
  return fills;
}
