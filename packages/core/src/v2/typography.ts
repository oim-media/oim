/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The typography of a 2.0 text as CSS, for one language. One copy: the scene
// paints text with it and so does the 1.x renderer's bridge.

import type { Layer } from "./schema.js";

/** A 2.0 scalar resolved for one language: its exception for that mode, else its value. */
function forLanguage(value: unknown, lang: string): number | undefined {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const { value: base, modes } = value as { value: unknown; modes?: Record<string, unknown> };
    const own = modes?.[lang];
    return typeof own === 'number' ? own : typeof base === 'number' ? base : undefined;
  }
  return undefined;
}

/**
 * The CSS typography of a 2.0 text, for one language. Lengths are canvas units,
 * which the overlay paints 1:1 as px. Absent fields are absent: the caller
 * keeps its defaults.
 */
export function typographyCss(layer: Pick<Layer, "text"> | undefined, lang: string): Record<string, string> | undefined {
  const text = layer?.text;
  if (!text) return undefined;
  const css: Record<string, string> = {};
  const size = forLanguage(text.font?.size, lang);
  if (size !== undefined) css.fontSize = `${+size.toFixed(4)}px`;
  const maxWidth = forLanguage(text.maxWidth, lang);
  if (maxWidth !== undefined) css.maxWidth = `${+maxWidth.toFixed(4)}px`;
  if (text.font?.family) css.fontFamily = text.font.family;
  if (text.font?.weight !== undefined) css.fontWeight = String(text.font.weight);
  if (text.font?.italic) css.fontStyle = 'italic';
  if (text.letterSpacing !== undefined) css.letterSpacing = `${text.letterSpacing}px`;
  if (text.transform) css.textTransform = text.transform;
  if (text.decoration) css.textDecoration = text.decoration;
  return css;
}

