/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The drop cap's style: the first letter, `lines` lines tall. One function
 * for the editor canvas, the player and the static export, so the three draw
 * the same letter (known trap 2: two copies drift apart).
 */

import { toRanges, fromRanges } from "./text-marks.js";

export interface DropCapInput {
  enabled?: boolean;
  lines?: 2 | 3;
  marginRight?: number;
  color?: string;
  fontFamily?: string;
}

export interface DropCapStyle {
  /** Size of the letter as a multiple of the text's font size. */
  scale: number;
  lineHeight: number;
  /** Gap between the letter and the text, in px. */
  marginRight: number;
  fontWeight: 700;
  color?: string;
  fontFamily?: string;
}

export function dropCapStyle(dc: DropCapInput): DropCapStyle {
  const out: DropCapStyle = {
    scale: dc.lines === 3 ? 3.2 : 2.2,
    lineHeight: 0.85,
    marginRight: dc.marginRight ?? 8,
    fontWeight: 700,
  };
  if (dc.color) out.color = dc.color;
  if (dc.fontFamily) out.fontFamily = dc.fontFamily;
  return out;
}

/**
 * The drop cap's letter and the text after it, with its marks (contract
 * 1.11.0). `text` is the stored text (tags and escapes); `rest` is stored text
 * too, so a renderer draws it like any marked text. Without this, a text with
 * a drop cap lost its marks: the three renderers drew the plain text.
 */
export function splitDropCap(text: string, known: readonly string[]): { letter: string; rest: string } {
  const { plain, ranges } = toRanges(text, known);
  if (!plain) return { letter: "", rest: "" };
  // A range left empty (a mark on the first letter only) is dropped by fromRanges.
  const shifted = ranges.map((r) => ({ ...r, from: Math.max(0, r.from - 1), to: r.to - 1 }));
  return { letter: plain[0], rest: fromRanges(plain.slice(1), shifted) };
}
