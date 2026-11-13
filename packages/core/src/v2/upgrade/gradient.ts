/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// 1.x stores a gradient as a CSS string; 2.0 stores its parts. This reads the
// subset the editor writes and refuses everything else, so a string it does
// not understand is reported instead of half-converted.

export type Gradient = {
  type: "linear" | "radial" | "conic";
  angle?: number;
  stops: { color: string; at?: number }[];
};

const SIDES: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to bottom right": 135,
  "to bottom left": 225,
  "to top left": 315,
};

const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^()]*\)|[a-z]+)$/i;

/** Splits on the commas that are not inside parentheses. */
function splitTopLevel(text: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  parts.push(text.slice(start).trim());
  return parts;
}

function parseStop(text: string): { color: string; at?: number } | null {
  const match = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(text);
  if (!match) return null;
  const color = match[1].trim();
  if (!COLOR.test(color)) return null;
  if (match[2] === undefined) return { color };
  const at = Number(match[2]) / 100;
  return Number.isFinite(at) ? { color, at: Math.min(1, Math.max(0, at)) } : null;
}

export function parseCssGradient(css: unknown): Gradient | null {
  if (typeof css !== "string") return null;
  const match = /^\s*(linear|radial|conic)-gradient\((.*)\)\s*$/is.exec(css);
  if (!match) return null;
  const type = match[1].toLowerCase() as Gradient["type"];
  const parts = splitTopLevel(match[2]);
  if (!parts || parts.some((p) => p === "")) return null;

  let angle: number | undefined;
  const head = parts[0].toLowerCase();
  const degrees = /^(?:from\s+)?(-?[\d.]+)deg$/.exec(head);
  if (degrees) {
    angle = Number(degrees[1]);
    parts.shift();
  } else if (head in SIDES) {
    angle = SIDES[head];
    parts.shift();
  } else if (type === "radial" && /^(circle|ellipse)\b/.test(head)) {
    parts.shift();
  }

  const stops = parts.map(parseStop);
  if (stops.length < 2 || stops.some((s) => s === null)) return null;
  const gradient: Gradient = { type, stops: stops as Gradient["stops"] };
  if (angle !== undefined && Number.isFinite(angle)) gradient.angle = angle;
  return gradient;
}
