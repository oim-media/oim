/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dimensions and user units of the OIM format.
 *
 * In the transition toward a model based on ViewBox and pure user units
 * (platform-independent and free of CSS text strings such as `cqw`), this
 * utility resolves values that can come as:
 *  - a plain number (design user units, e.g. 250 on a 1000 canvas = 25%)
 *  - a numeric percentage or a string with % (e.g. "25%")
 *  - a pre-existing CSS string (e.g. "25cqw", "100px")
 */

const RE_CSS_UNIT = /^[\d.+-]+(cqw|cqh|cqi|cqb|rem|em|ex|ch|vw|vh|vmin|vmax|%|px|pt|pc|cm|mm|in|lh|rlh)$/i;

/**
 * Resolves a dimension (width, height, radius, padding) to a CSS expression usable on the web.
 * If it receives a number and baseDimension > 0, it converts it to a `cqw` percentage relative to baseDimension.
 * If it receives a string with a valid CSS unit, it keeps it (guaranteeing full compatibility with legacy .oim files).
 */
export function resolveDimensionToCss(
  val: number | string | undefined | null,
  baseDimension: number = 800,
  fallback: string = ""
): string {
  if (val === undefined || val === null || val === "") return fallback;

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return fallback;
    if (baseDimension > 0) {
      const pct = (val / baseDimension) * 100;
      return `${parseFloat(pct.toFixed(4))}cqw`;
    }
    return `${val}px`;
  }

  const str = String(val).trim();
  if (!str || str === "undefined" || str === "null") return fallback;

  if (RE_CSS_UNIT.test(str)) {
    return str;
  }

  const parsed = parseFloat(str);
  if (Number.isFinite(parsed)) {
    if (baseDimension > 0) {
      const pct = (parsed / baseDimension) * 100;
      return `${parseFloat(pct.toFixed(4))}cqw`;
    }
    return `${parsed}px`;
  }

  return fallback;
}

/**
 * Extracts the pure numeric value of a dimension given in user units.
 * If it comes as '25cqw' or '25%' and baseDimension is known, it computes its numeric equivalent.
 */
export function resolveNumericDimension(
  val: number | string | undefined | null,
  baseDimension: number = 800
): number | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (str.endsWith("cqw") || str.endsWith("%")) {
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    return (num / 100) * baseDimension;
  }
  if (str.endsWith("px")) {
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : null;
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : null;
}
