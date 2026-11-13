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

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

type Filters = { preset?: string; blur?: number; brightness?: number; contrast?: number; saturate?: number; hueRotate?: number };

/**
 * The colour-filter fields, shared by the filter layer (a backdrop effect),
 * the image layer and the image fill. 1.x percentages become factors; a value
 * that changes nothing is not written.
 */
export function takeFilters(ctx: UpgradeContext, style: V1Object): Filters | undefined {
  const preset = ctx.take(style, "filterPreset");
  const blur = finite(ctx.take(style, "filterBlur"));
  const brightness = finite(ctx.take(style, "filterBrightness"));
  const contrast = finite(ctx.take(style, "filterContrast"));
  const saturate = finite(ctx.take(style, "filterSaturate"));
  const hueRotate = finite(ctx.take(style, "filterHueRotate"));

  const filters: Filters = {};
  if (typeof preset === "string" && preset && preset !== "none") filters.preset = preset;
  if (blur) filters.blur = blur;
  if (brightness !== undefined && brightness !== 100) filters.brightness = brightness / 100;
  if (contrast !== undefined && contrast !== 100) filters.contrast = contrast / 100;
  if (saturate !== undefined && saturate !== 100) filters.saturate = saturate / 100;
  if (hueRotate) filters.hueRotate = hueRotate;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

function listedEffect(ctx: UpgradeContext, value: unknown): Effect | undefined {
  const fx = asObject(value);
  if (!fx || fx.enabled === false) return undefined;
  const color = typeof fx.colorRole === "string" && ctx.hasRole(fx.colorRole) ? { var: fx.colorRole } : fx.color;
  const tint = typeof color === "string" || asObject(color) ? { color: color as never } : {};
  switch (fx.type) {
    case "drop-shadow": {
      const shadow: Extract<Effect, { kind: "shadow" }> = { kind: "shadow", ...tint };
      for (const key of ["x", "y", "blur", "spread"] as const) {
        const n = finite(fx[key]);
        if (n !== undefined) shadow[key] = key === "blur" ? Math.max(0, n) : n;
      }
      return shadow;
    }
    case "glow": {
      const glow: Extract<Effect, { kind: "glow" }> = { kind: "glow", radius: finite(fx.radius) ?? 16, ...tint };
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

function listedEffects(ctx: UpgradeContext, value: unknown): Effect[] {
  return Array.isArray(value) ? value.map((fx) => listedEffect(ctx, fx)).filter((fx): fx is Effect => !!fx) : [];
}

export function convertEffects(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { style } = slot;
  const effects: Effect[] = [];

  // The six shadow fields travel on every layer; only `shadowEnabled` says they count.
  const enabled = ctx.take(style, "shadowEnabled") === true;
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
    effects.push(shadow);
  }

  effects.push(...listedEffects(ctx, ctx.take(style, "effects")));

  const named = ctx.take(style, "effect");
  const namedColor = colorOf(ctx, style, "effectColor", "effectColorRole");
  const namedRadius = finite(ctx.take(style, "effectRadius"));
  const tint = namedColor === undefined ? {} : { color: namedColor };
  if (named === "neon") effects.push({ kind: "glow", radius: namedRadius ?? 16, ...tint });
  else if (named === "shadow") effects.push({ kind: "shadow", ...(namedRadius ? { blur: namedRadius } : {}), ...tint });

  const layerBlur = finite(ctx.take(style, "layerBlur"));
  if (layerBlur) effects.push({ kind: "blur", radius: layerBlur });

  // On a filter layer the colour filters act on what is behind it. On an
  // image, or a shape filled with one, they belong to the image (see takeFilters
  // in the image and fill converters, which run before this one).
  const filters = takeFilters(ctx, style);
  if (slot.type === "filter") effects.push({ kind: "backdrop", ...filters });
  else if (filters) {
    const paint = layer.fills?.find((p) => "kind" in p && p.kind === "image");
    if (layer.image) layer.image.filters = filters;
    else if (paint && "kind" in paint && paint.kind === "image") paint.filters = filters;
    else ctx.note("style.filter*: colour filters on a layer with no image");
  }

  const grain = ctx.take(style, "grain") === true;
  const intensity = finite(ctx.take(style, "grainIntensity"));
  const size = finite(ctx.take(style, "grainSize"));
  const blend = ctx.take(style, "grainBlend");
  if (grain) {
    const fx: Extract<Effect, { kind: "grain" }> = { kind: "grain" };
    if (intensity !== undefined) fx.intensity = intensity;
    if (size !== undefined) fx.size = size;
    if (typeof blend === "string") fx.blend = blend;
    effects.push(fx);
  }

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
