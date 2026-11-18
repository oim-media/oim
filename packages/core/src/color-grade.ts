/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The color-grade presets as one W3C feColorMatrix each (Filter Effects 1): 20
 * numbers, row by row (R, G, B, A), offsets in 0–1. Flutter's ColorFilter.matrix
 * takes the same numbers with the 5th column times 255.
 */

type M = number[]; // 4×5, row-major

const IDENTITY: M = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const rgb = (r: number[], g: number[], b: number[], offset = [0, 0, 0]): M =>
  [...r, 0, offset[0], ...g, 0, offset[1], ...b, 0, offset[2], 0, 0, 0, 1, 0];

// Filter Effects 1, section 9.6 (saturate, sepia) and the linear transfer of contrast and brightness.
const saturate = (s: number): M =>
  rgb(
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  );
const sepia = (a: number): M =>
  rgb(
    [0.393 + 0.607 * (1 - a), 0.769 - 0.769 * (1 - a), 0.189 - 0.189 * (1 - a)],
    [0.349 - 0.349 * (1 - a), 0.686 + 0.314 * (1 - a), 0.168 - 0.168 * (1 - a)],
    [0.272 - 0.272 * (1 - a), 0.534 - 0.534 * (1 - a), 0.131 + 0.869 * (1 - a)],
  );
const contrast = (c: number): M => rgb([c, 0, 0], [0, c, 0], [0, 0, c], [0.5 - 0.5 * c, 0.5 - 0.5 * c, 0.5 - 0.5 * c]);
const brightness = (b: number): M => rgb([b, 0, 0], [0, b, 0], [0, 0, b]);
const channels = (r: number, g: number, b: number, offset?: number[]): M => rgb([r, 0, 0], [0, g, 0], [0, 0, b], offset);

/** `next` applied after `first`: the product in homogeneous 5×5 form. */
function then(first: M, next: M): M {
  const out: M = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? next[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += next[row * 5 + k] * first[k * 5 + col];
      out.push(sum);
    }
  }
  return out;
}

const chain = (...steps: M[]): M => steps.reduce(then, IDENTITY);

/** The presets, each a chain of primitives applied left to right (spec 2026-11-17). */
const PRESETS: Record<string, M> = {
  "warm-vintage": chain(sepia(0.35), contrast(0.9), brightness(1.05), saturate(1.1)),
  "cool-cinema": chain(channels(0.9, 1, 1.12), contrast(1.1), saturate(0.9)),
  cyberpunk: chain(saturate(1.6), channels(1.1, 0.85, 1.2)),
  "monochrome-contrast": chain(saturate(0), contrast(1.4)),
  "teal-orange": chain(saturate(1.2), rgb([1.1, 0.05, -0.1], [-0.05, 1, 0.05], [-0.1, 0.1, 1.1])),
  "bleach-bypass": chain(saturate(0.35), contrast(1.35), brightness(0.95)),
  "cross-process": chain(channels(1.1, 1.05, 0.75, [-0.05, 0.05, 0.1]), contrast(1.15)),
  sepia: sepia(1),
};

export const COLOR_GRADE_PRESETS = Object.keys(PRESETS);

/** The preset's matrix at an intensity (0–100, linear from the identity); undefined for an unknown preset. */
export function colorGradeMatrix(preset: string, intensity = 100): number[] | undefined {
  if (!Object.hasOwn(PRESETS, preset)) return undefined;
  const t = Math.min(100, Math.max(0, intensity)) / 100;
  return PRESETS[preset].map((v, i) => +(IDENTITY[i] + (v - IDENTITY[i]) * t).toFixed(6));
}
