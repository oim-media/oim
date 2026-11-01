/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isSafeCssColor } from "./dynamic-colors.js";

/**
 * Whether a `fillGradient` from a .oim can be painted without risk.
 *
 * A gradient is foreign data and ends in `style.backgroundImage`. That
 * property takes an image LIST, so "linear-gradient(...), url(https://x)"
 * is valid CSS and the browser fetches the second image: opening a crafted
 * file would ping a third party. Same class of bug as the colour injection
 * closed on 2 Sept 2026, one sink over.
 *
 * WHITE list, shaped on what the OIM editor writes: exactly ONE
 * `linear | radial | conic` gradient (optionally `repeating-`), an optional
 * header of words, numbers and units, and stops that are a colour plus up to
 * two positions. Anything else is dropped, and the shape paints without fill.
 */
const GRADIENT_FN = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(([\s\S]*)\)$/;
// `to right`, `135deg`, `circle 40px at 50% 50%`, `from 45deg at 50% 50%`.
const HEADER = /^[A-Za-z0-9.%\s-]+$/;
// A colour, then zero to two positions. The lazy colour leaves the positions
// to the tail, so `rgba(0, 0, 0, 0.5) 0%` splits at the right place.
const PARADA = /^(.*?)((?:\s+-?\d*\.?\d+(?:%|px|deg|em|rem)?){0,2})$/;
// A bare name (`red`) cannot request anything: only letters, no parenthesis.
const COLOR_NAME = /^[A-Za-z]+$/;

const MAX_GRADIENTE = 2048;

/** Splits on the commas at depth 0; null if the parentheses do not balance. */
function partirNivelCero(body: string): string[] | null {
  const parts: string[] = [];
  let profundidad = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(") profundidad++;
    else if (c === ")") {
      // Closing below zero means the outer function ended early and something
      // follows it: "linear-gradient(a), url(b)" read as one body.
      // REDUNDANT today, checked by mutation: the leftover pieces (`b)`,
      // `url(...`) never pass as stops, so dropping this breaks no test. Kept
      // in case someone widens what a stop accepts.
      if (--profundidad < 0) return null;
    } else if (c === "," && profundidad === 0) {
      parts.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (profundidad !== 0) return null;
  parts.push(body.slice(start).trim());
  return parts;
}

function isStop(part: string): boolean {
  const m = PARADA.exec(part);
  if (!m) return false;
  const color = m[1].trim();
  return COLOR_NAME.test(color) || isSafeCssColor(color);
}

export function isSafeCssGradient(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > MAX_GRADIENTE) return false;
  // Nothing a gradient needs, everything an escape does.
  if (/[;{}<>"'`]/.test(v) || v.includes(String.fromCharCode(92)) || v.includes("/*")) return false;

  const m = GRADIENT_FN.exec(v);
  if (!m) return false;
  const parts = partirNivelCero(m[1]);
  if (!parts || parts.some((p) => !p)) return false;

  // The first part is a header only if it is not already a stop: `red` is
  // both, and reading it as a stop is the stricter choice.
  const [first, ...rest] = parts;
  const stops = isStop(first) ? parts : HEADER.test(first) ? rest : null;
  return !!stops && stops.length > 0 && stops.every(isStop);
}
