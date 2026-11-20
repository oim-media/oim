/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// How much of an outline a stroke draws, as the dash of an outline whose
// `pathLength` is 1. One function for every renderer, so a trim reads the same everywhere.

export type Trim = { start?: number; end?: number };

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** The `stroke-dasharray` and `stroke-dashoffset` of a trim, or undefined when the whole outline is drawn. */
export function trimDash(trim: Trim | undefined): { dasharray: string; dashoffset: number } | undefined {
  const start = clamp(trim?.start ?? 0);
  const end = clamp(trim?.end ?? 1);
  if (start === 0 && end === 1) return undefined;
  // The gap is 2: longer than the outline, so the dash never repeats.
  return { dasharray: `${+Math.max(0, end - start).toFixed(6)} 2`, dashoffset: start === 0 ? 0 : -start };
}
