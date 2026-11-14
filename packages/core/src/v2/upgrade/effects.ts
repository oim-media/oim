/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Shadow, glow, blur, backdrop filters and grain: three systems in 1.x
// (`shadow*`, `effects[]`, `effect*`) plus the filter layer, one list in 2.0.

import type { Effect } from "../schema.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./context.js";
import { colorOf } from "./paints.js";
import { FILTER_PRESET_CSS } from "../../media-filters.js";

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

type Filters = { preset?: string; blur?: number; brightness?: number; contrast?: number; saturate?: number; hueRotate?: number };

/**
 * The colour-filter fields, shared by the filter layer (a backdrop effect),
 * the image layer and the image fill. 1.x percentages become factors; a value
 * that changes nothing is not written.
 */
export function takeFilters(ctx: UpgradeContext, style: V1Object, backdrop = false): Filters | undefined {
  // `fp` is the short name the filter layer was also read by.
  const named = ctx.take(style, "filterPreset");
  const short = ctx.take(style, "fp");
  const preset = backdrop ? named || short : named;
  const blur = finite(ctx.take(style, "filterBlur"));
  const brightness = finite(ctx.take(style, "filterBrightness"));
  const contrast = finite(ctx.take(style, "filterContrast"));
  const saturate = finite(ctx.take(style, "filterSaturate"));
  const hueRotate = finite(ctx.take(style, "filterHueRotate"));

  const filters: Filters = {};
  // Only a preset the 1.x table knew was painted; duotone, only behind a filter layer.
  if (typeof preset === "string" && (Object.hasOwn(FILTER_PRESET_CSS, preset) || (backdrop && preset === "duotone"))) filters.preset = preset;
  if (blur) filters.blur = blur;
  if (brightness !== undefined && brightness !== 100) filters.brightness = brightness / 100;
  if (contrast !== undefined && contrast !== 100) filters.contrast = contrast / 100;
  if (saturate !== undefined && saturate !== 100) filters.saturate = saturate / 100;
  if (hueRotate) filters.hueRotate = hueRotate;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** Where a listed effect takes what the 1.x player filled in when it was missing. */
type ListDefaults = { shadowRole?: unknown; glowRole?: unknown; glyphsInSvg?: boolean };

function listedEffect(ctx: UpgradeContext, value: unknown, defaults: ListDefaults = {}): Effect | undefined {
  const fx = asObject(value);
  if (!fx || fx.enabled === false) return undefined;
  const tintOf = (fallbackColor: string | undefined, fallbackRole: unknown) => {
    const role = fx.colorRole || fallbackRole;
    const literal = typeof fx.color === "string" && fx.color ? fx.color : fallbackColor;
    const color = typeof role === "string" && ctx.hasRole(role) ? (literal ? { var: role, fallback: literal } : { var: role }) : literal;
    return color === undefined ? {} : { color: color as never };
  };
  const tint = tintOf(undefined, undefined);
  switch (fx.type) {
    case "drop-shadow": {
      // An artistic text is an SVG: the text-shadow 1.x gave it painted nothing.
      if (defaults.glyphsInSvg) return undefined;
      // 1.x drew a listed shadow 4px down, 12px soft and translucent black when unsaid.
      const shadow: Extract<Effect, { kind: "shadow" }> = { kind: "shadow", y: 4, blur: 12, ...tintOf("rgba(0, 0, 0, 0.35)", defaults.shadowRole) };
      for (const key of ["x", "y", "blur", "spread"] as const) {
        const n = finite(fx[key]);
        if (n !== undefined) shadow[key] = key === "blur" ? Math.max(0, n) : n;
      }
      if (!shadow.x) delete shadow.x;
      return shadow;
    }
    case "glow": {
      if (defaults.glyphsInSvg) return undefined;
      const glow: Extract<Effect, { kind: "glow" }> = { kind: "glow", radius: finite(fx.radius) || 16, ...tintOf("#f59e0b", defaults.glowRole) };
      const intensity = finite(fx.intensity);
      if (intensity !== undefined) glow.intensity = intensity;
      return glow;
    }
    case "blur":
      return { kind: "blur", radius: finite(fx.radius) ?? 8 };
    case "color-grade": {
      if (typeof fx.preset !== "string") return undefined;
      const intensity = finite(fx.intensity);
      return { kind: "color-grade", preset: fx.preset, ...(intensity === undefined ? {} : { intensity }) };
    }
    case "texture": {
      if (typeof fx.preset !== "string") return undefined;
      const texture: Extract<Effect, { kind: "texture" }> = { kind: "texture", preset: fx.preset, ...tint };
      const intensity = finite(fx.intensity);
      const scale = finite(fx.scale);
      if (intensity !== undefined) texture.intensity = intensity;
      if (typeof fx.blend === "string") texture.blend = fx.blend;
      if (scale !== undefined && scale !== 1) texture.scale = scale;
      return texture;
    }
    default:
      ctx.note(`style.effects: unknown effect type "${String(fx.type)}"`);
      return undefined;
  }
}

function listedEffects(ctx: UpgradeContext, value: unknown, defaults?: ListDefaults): Effect[] {
  return Array.isArray(value) ? value.map((fx) => listedEffect(ctx, fx, defaults)).filter((fx): fx is Effect => !!fx) : [];
}

export function convertEffects(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;
  const effects: Effect[] = [];

  // What the 1.x player painted, in its order: the neon first; then, when the
  // layer has an effects list, that list alone; otherwise blur, grain, shadow.
  const named = ctx.take(style, "effect");
  const namedColor = colorOf(ctx, style, "effectColor", "effectColorRole");
  const namedRadius = finite(ctx.take(style, "effectRadius"));
  // Only the neon was ever drawn; the named "shadow" painted nothing.
  if (named === "neon") effects.push({ kind: "glow", radius: namedRadius ?? 16, color: namedColor ?? "#f59e0b" });

  const list = ctx.take(style, "effects");
  const hasList = Array.isArray(list) && list.length > 0;

  // The six shadow fields travel on every layer; only `shadowEnabled` says they count.
  const enabled = ctx.take(style, "shadowEnabled") === true && !hasList;
  let enabledShadow: Effect | undefined;
  const shadowColor = colorOf(ctx, style, "shadowColor", "shadowColorRole");
  const blur = finite(ctx.take(style, "shadowBlur"));
  const x = finite(ctx.take(style, "shadowOffsetX"));
  const y = finite(ctx.take(style, "shadowOffsetY"));
  const opacity = finite(ctx.take(style, "shadowOpacity"));
  if (enabled) {
    const shadow: Extract<Effect, { kind: "shadow" }> = { kind: "shadow" };
    if (x) shadow.x = x;
    if (y) shadow.y = y;
    if (blur) shadow.blur = blur;
    if (shadowColor !== undefined) shadow.color = shadowColor;
    if (opacity !== undefined && opacity < 100) shadow.opacity = Math.max(0, opacity) / 100;
    enabledShadow = shadow;
  }

  const legacyBlur = finite(ctx.take(style, "layerBlur")) ?? finite(ctx.take(style, "blur"));
  ctx.take(style, "blur");
  if (hasList) {
    effects.push(...listedEffects(ctx, list, {
      shadowRole: style.shadowColorRole,
      glowRole: style.effectColorRole,
      glyphsInSvg: slot.type === "artistic-text",
    }));
  } else if (legacyBlur && legacyBlur > 0) effects.push({ kind: "blur", radius: legacyBlur });

  // On a filter layer the colour filters act on what is behind it. On an
  // image, or a shape filled with one, they belong to the image. On anything
  // else 1.x painted nothing, so nothing is written.
  const filters = takeFilters(ctx, style, slot.type === "filter");
  if (slot.type === "filter") effects.push({ kind: "backdrop", ...filters });
  else if (filters) {
    const paint = layer.fills?.find((p) => "kind" in p && p.kind === "image");
    if (layer.image) layer.image.filters = filters;
    else if (paint && "kind" in paint && paint.kind === "image") paint.filters = filters;
  }

  const grain = ctx.take(style, "grain") === true;
  const intensity = finite(ctx.take(style, "grainIntensity"));
  const size = finite(ctx.take(style, "grainSize"));
  const blend = ctx.take(style, "grainBlend");
  if (grain && !hasList) {
    const fx: Extract<Effect, { kind: "grain" }> = { kind: "grain" };
    if (intensity !== undefined) fx.intensity = intensity;
    if (size !== undefined) fx.size = size;
    if (typeof blend === "string") fx.blend = blend;
    effects.push(fx);
  }
  if (enabledShadow) effects.push(enabledShadow);

  if (effects.length > 0) layer.effects = effects;
}

/** Grain and effects declared for the whole canvas. */
export function canvasEffects(ctx: UpgradeContext, meta: V1Object): Effect[] {
  const effects = listedEffects(ctx, ctx.take(meta, "effects"));
  const grain = asObject(ctx.take(meta, "grain"));
  if (grain && grain.enabled !== false) {
    const fx: Extract<Effect, { kind: "grain" }> = { kind: "grain" };
    const intensity = finite(grain.intensity);
    const frequency = finite(grain.baseFrequency);
    if (intensity !== undefined) fx.intensity = intensity;
    if (frequency !== undefined) fx.size = frequency;
    if (typeof grain.blendMode === "string") fx.blend = grain.blendMode;
    if (typeof grain.color === "string") fx.color = grain.color;
    effects.push(fx);
  }
  return effects;
}
