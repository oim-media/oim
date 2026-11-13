/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The text block. 1.x writes the typography fields on every layer, whatever
// its type; here they exist only on a text, and elsewhere they are dropped.

import type { TextBlock } from "../schema.js";
import { toCanvasUnits } from "./box.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./context.js";

type Sized = number | { value: number; modes: Record<string, number> };

/**
 * A length with per-language exceptions (`fontSizes`, `maxWidths`). The main
 * language is the value; the others that differ from it are the exceptions.
 */
function sized(ctx: UpgradeContext, style: V1Object, key: string, perLanguageKey: string): Sized | undefined {
  const W = ctx.canvas.width;
  const base = toCanvasUnits(ctx.take(style, key), W);
  const perLanguage = asObject(ctx.take(style, perLanguageKey)) ?? {};
  const value = toCanvasUnits(perLanguage[ctx.language], W) ?? base;
  if (value === undefined) return undefined;
  const modes: Record<string, number> = {};
  for (const [language, raw] of Object.entries(perLanguage)) {
    const converted = toCanvasUnits(raw, W);
    if (language !== ctx.language && converted !== undefined && converted !== value) modes[language] = converted;
  }
  return Object.keys(modes).length > 0 ? { value, modes } : value;
}

const TYPOGRAPHY_KEYS = [
  "fontFamily", "fontSize", "fontSizes", "fontWeight", "fontStyle", "bold", "italic", "underline", "textAlign",
  "lineHeight", "letterSpacing", "textTransform", "textDecoration", "maxWidth", "maxWidths", "marks", "textRuns",
  "textHighlight", "dropCap", "artisticPreset", "curveType", "curveAmount", "extrusionDepth", "extrusionAngle",
  "extrusionColor", "extrusionShading",
];

export function convertText(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { raw, style } = slot;
  const align = ctx.take(style, "textAlign") ?? ctx.take(raw, "align");
  ctx.take(raw, "align");

  if (layer.type !== "text") {
    for (const key of TYPOGRAPHY_KEYS) ctx.take(style, key);
    return;
  }

  const content = ctx.take(raw, "content");
  const text: TextBlock = { content: {} };
  if (typeof content === "string") text.content[ctx.language] = content;
  else for (const [language, value] of Object.entries(asObject(content) ?? {})) if (typeof value === "string") text.content[language] = value;

  const font: NonNullable<TextBlock["font"]> = {};
  const family = ctx.take(style, "fontFamily");
  if (typeof family === "string" && family) font.family = family;
  const size = sized(ctx, style, "fontSize", "fontSizes");
  if (size !== undefined) font.size = size;
  const weight = ctx.take(style, "fontWeight");
  // bold, italic and underline were retired in 1.5.0 and the player ignores them.
  ctx.take(style, "bold");
  if (typeof weight === "number" || (typeof weight === "string" && weight)) {
    if (Number(weight) !== 400) font.weight = Number.isFinite(Number(weight)) ? Number(weight) : weight;
  }
  const fontStyle = ctx.take(style, "fontStyle");
  if (fontStyle === "italic" || fontStyle === "oblique") font.italic = true;
  ctx.take(style, "italic");
  if (Object.keys(font).length > 0) text.font = font;

  if (align === "center" || align === "right" || align === "justify") text.align = align;

  const lineHeight = ctx.take(style, "lineHeight");
  if (typeof lineHeight === "number" || (typeof lineHeight === "string" && lineHeight)) text.lineHeight = lineHeight;
  // 1.x passed letterSpacing to CSS as it came: a bare number was invalid CSS and
  // painted nothing (golden background-pattern-order); a length with its unit did.
  // Artistic text drew its own SVG, where a bare number was a length.
  const rawSpacing = ctx.take(style, "letterSpacing");
  const spacing = typeof rawSpacing === "string" ? toCanvasUnits(rawSpacing, ctx.canvas.width)
    : typeof rawSpacing === "number" && slot.type === "artistic-text" ? rawSpacing : undefined;
  if (spacing !== undefined && spacing !== 0) text.letterSpacing = spacing;
  const transform = ctx.take(style, "textTransform");
  if (transform === "uppercase" || transform === "lowercase" || transform === "capitalize") text.transform = transform;
  const decoration = ctx.take(style, "textDecoration");
  ctx.take(style, "underline");
  if (typeof decoration === "string" && decoration && decoration !== "none") text.decoration = decoration;
  const maxWidth = sized(ctx, style, "maxWidth", "maxWidths");
  if (maxWidth !== undefined) text.maxWidth = maxWidth;

  const marks = asObject(ctx.take(style, "marks"));
  if (marks && Object.keys(marks).length > 0) text.marks = marks as never;
  const runs = asObject(ctx.take(style, "textRuns"));
  if (runs && Object.keys(runs).length > 0) text.runs = runs as never;
  const highlight = asObject(ctx.take(style, "textHighlight"));
  if (highlight && highlight.enabled !== false) text.highlight = highlight as never;
  const dropCap = asObject(ctx.take(style, "dropCap"));
  if (dropCap && dropCap.enabled !== false) text.dropCap = dropCap as never;

  const artistic: NonNullable<TextBlock["artistic"]> = {};
  const preset = ctx.take(style, "artisticPreset");
  if (typeof preset === "string" && preset) artistic.preset = preset;
  const curveType = ctx.take(style, "curveType");
  const curveAmount = ctx.take(style, "curveAmount");
  // 1.x drew an arc when the type was missing.
  const curve = curveType ?? "arc";
  if ((curve === "arc" || curve === "wave" || curve === "arch") && typeof curveAmount === "number" && curveAmount !== 0) {
    artistic.curve = { type: curve, amount: curveAmount };
  }
  const depth = ctx.take(style, "extrusionDepth");
  const angle = ctx.take(style, "extrusionAngle");
  const extrusionColor = ctx.take(style, "extrusionColor");
  const shading = ctx.take(style, "extrusionShading");
  if (typeof depth === "number" && depth > 0) {
    artistic.extrusion = { depth };
    if (typeof angle === "number") artistic.extrusion.angle = angle;
    if (typeof extrusionColor === "string" && extrusionColor) artistic.extrusion.color = extrusionColor;
    if (typeof shading === "boolean") artistic.extrusion.shading = shading;
  }
  if (slot.type === "artistic-text" || Object.keys(artistic).length > 0) text.artistic = artistic;

  layer.text = text;
}
