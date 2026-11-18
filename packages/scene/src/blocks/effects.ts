/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { colorGradeMatrix } from "../../../core/src/color-grade.js";
import { mediaFilterCss } from "@oim-media/core";
import type { Effect } from "@oim-media/core/v2";
import { shadowColorCss } from "../legacy/shadow.js";

/**
 * The CSS of a layer's effects. The 2.0 scene and the 1.x renderer both read it
 * here, so a shadow or a glow looks the same in both. The renderer draws what
 * the defs ask for (a grain's SVG filter, a texture's overlay, a duotone).
 */

export type EffectContext = {
  /** A text's shadow and glow follow its glyphs (text-shadow); anything else follows its silhouette (drop-shadow). */
  isText: boolean;
  /** Whether the layer type takes a grain: the 1.x renderer's GRAIN_LAYER_TYPES. */
  grainable: boolean;
  /** The layer's id, which names its grain filter. */
  layerId: string;
  /** The CSS of a colour as the document paints it (a palette variable or a literal). */
  colorCss: (color: unknown) => string | undefined;
};

export type EffectDef =
  | { kind: "grain"; id: string; effect: Extract<Effect, { kind: "grain" }> }
  | { kind: "texture"; effect: Extract<Effect, { kind: "texture" }> }
  | { kind: "duotone" }
  | { kind: "color-grade"; id: string; values: number[] };

export type EffectStyle = {
  /** The CSS filter functions, in the effects' order; "" when none. */
  filter: string;
  /** The text-shadows, comma-separated, on a text only; "" when none. */
  textShadow: string;
  /** The first backdrop's filter; undefined for a duotone, which is a def. */
  backdropFilter: string | undefined;
  /** What the renderer still draws: a grain's SVG filter, a texture's overlay, a duotone. */
  defs: EffectDef[];
};

/** The image filters of a backdrop or a filter, as the media-filter CSS reads them. */
export function filterStyle(filters: Record<string, unknown> | undefined): Record<string, unknown> {
  const f = filters ?? {};
  const percent = (v: unknown) => (typeof v === "number" ? +(v * 100).toFixed(6) : undefined);
  return {
    filterPreset: f.preset,
    filterBlur: f.blur,
    filterBrightness: percent(f.brightness),
    filterContrast: percent(f.contrast),
    filterSaturate: percent(f.saturate),
    filterHueRotate: f.hueRotate,
  };
}

/** A glow with no colour, or one the document cannot resolve, is this amber. */
const GLOW_FALLBACK = "#f59e0b";

export function effectsToStyle(effects: readonly Effect[] | undefined, ctx: EffectContext): EffectStyle {
  const filter: string[] = [];
  const textShadow: string[] = [];
  const defs: EffectDef[] = [];
  for (const fx of effects ?? []) {
    if (fx.kind === "blur") {
      filter.push(`blur(${fx.radius}px)`);
    } else if (fx.kind === "glow") {
      const c = ctx.colorCss(fx.color) || GLOW_FALLBACK;
      const r = fx.radius;
      if (ctx.isText) textShadow.push(`0px 0px ${r * 0.4}px ${c}`, `0px 0px ${r}px ${c}`);
      else filter.push(`drop-shadow(0px 0px ${r * 0.4}px ${c}) drop-shadow(0px 0px ${r}px ${c})`);
    } else if (fx.kind === "shadow") {
      const bound = fx.color && typeof fx.color === "object" ? (fx.color as { var: string; fallback?: string }) : undefined;
      const c = fx.opacity !== undefined
        ? shadowColorCss({ shadowColor: bound ? bound.fallback : (fx.color as string), shadowOpacity: fx.opacity * 100, shadowColorRole: bound?.var })
        : ctx.colorCss(fx.color ?? "#000000") || "#000000";
      const part = `${fx.x || 0}px ${fx.y || 0}px ${fx.blur || 0}px ${c}`;
      if (ctx.isText) textShadow.push(part);
      else filter.push(`drop-shadow(${part})`);
    } else if (fx.kind === "grain") {
      if (!ctx.grainable) continue;
      const id = "oim-grain-" + ctx.layerId.replace(/[^A-Za-z0-9_-]/g, "_");
      defs.push({ kind: "grain", id, effect: fx });
      filter.push(`url(#${id})`);
    } else if (fx.kind === "texture") {
      defs.push({ kind: "texture", effect: fx });
    }
  }

  // The grade is the final colour pass, after every other filter (spec 2026-11-17).
  const grade = effects?.find((fx) => fx.kind === "color-grade") as Extract<Effect, { kind: "color-grade" }> | undefined;
  const values = grade && colorGradeMatrix(grade.preset, grade.intensity);
  if (values) {
    const id = "oim-grade-" + ctx.layerId.replace(/[^A-Za-z0-9_-]/g, "_");
    defs.push({ kind: "color-grade", id, values });
    filter.push(`url(#${id})`);
  }

  // The first backdrop is the one that counts; a duotone is an SVG filter, so the renderer draws it.
  const backdrop = effects?.find((fx) => fx.kind === "backdrop") as Record<string, unknown> | undefined;
  let backdropFilter: string | undefined;
  if (backdrop?.preset === "duotone") defs.push({ kind: "duotone" });
  else backdropFilter = mediaFilterCss(filterStyle(backdrop));

  return { filter: filter.join(" "), textShadow: textShadow.join(", "), backdropFilter, defs };
}
