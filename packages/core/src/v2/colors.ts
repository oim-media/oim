/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// How a 2.0 colour becomes paint: the palette a document's variables name, and
// the CSS a renderer writes for a colour. One copy, read by the scene and by the
// 1.x renderer's bridge, so both pick the same colour for the same palette.

import { resolveCssColor, resolvePalette } from "../dynamic-colors.js";
import type { PaintColors } from "./paint-css.js";
import type { Variables } from "./schema.js";

export type PaletteMetadata = { palettes?: Record<string, Record<string, string>>; defaultPalette?: string };

/** The named palettes of a document, read back from its variables: one role → colour map per palette name. */
export function palettesOf(variables: Variables | undefined): Record<string, Record<string, string>> | undefined {
  const names = variables?.modes?.palette;
  if (!variables || !names) return undefined;
  const palettes: Record<string, Record<string, string>> = Object.fromEntries(names.map((name) => [name, {}]));
  for (const [role, byPalette] of Object.entries(variables.values ?? {})) {
    for (const [name, color] of Object.entries(byPalette as Record<string, unknown>)) {
      if (palettes[name] && typeof color === "string") palettes[name][role] = color;
    }
  }
  return palettes;
}

/**
 * How a renderer paints a 2.0 colour: a palette binding stays a `var()` so a
 * mode change needs no repaint; drawn-in paints (patterns) take the default
 * palette's value, since an image cannot hold a `var()`.
 */
export function paintColors(metadata: PaletteMetadata): PaintColors {
  const isVar = (v: unknown): v is { var: string; fallback?: string } => !!v && typeof v === "object" && typeof (v as { var?: unknown }).var === "string";
  return {
    css: (v) => (isVar(v) ? resolveCssColor(v.var, v.fallback) : typeof v === "string" ? resolveCssColor(null, v) : "") || undefined,
    literal: (v) =>
      (isVar(v)
        ? (resolvePalette(metadata)?.colors as Record<string, string> | undefined)?.[v.var] ?? resolveCssColor(null, v.fallback)
        : typeof v === "string" ? resolveCssColor(null, v) : "") || undefined,
  };
}
