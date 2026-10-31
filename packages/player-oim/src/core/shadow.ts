/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveCssColor } from './dynamicColors.js';

/**
 * The shadow as `drop-shadow`, which follows the SILHOUETTE and not the box.
 *
 * `box-shadow` draws the element's rectangle: a shadow on a circle
 * came out square.
 *
 * **The chain must be identical to the editor's**
 * (its shadow module), with a space after each comma in the `rgba`. The
 * same table of cases is in the tests of both repositories.
 *
 * It does not reuse `hexToRgba` from `ImageEngine` on purpose: that one composes without
 * spaces and is used elsewhere, so changing it would touch something that is not ours.
 */
export function dropShadowCss(style: {
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowColorRole?: string;
}): string {
  const x = style.shadowOffsetX || 0;
  const y = style.shadowOffsetY || 0;
  const blur = style.shadowBlur || 0;

  return 'drop-shadow(' + x + 'px ' + y + 'px ' + blur + 'px ' + shadowColorCss(style) + ')';
}

/**
 * Whether this slot's shadow must follow the GLYPHS instead of the silhouette.
 *
 * Text only. It is the only case where `text-shadow` is correct, because it
 * follows each letter instead of the rectangle that contains them.
 *
 * Everything else goes through `drop-shadow`, which follows the alpha channel and so comes
 * out right over anything that is painted: a shape, an image or an SVG.
 *
 * **An unknown type goes by the silhouette**, on purpose. Erring towards
 * `drop-shadow` is the safe choice: a `text-shadow` over something without glyphs paints
 * NOTHING, and that silence is exactly the failure this function fixes: the vector of a
 * real `.oim` arrived with its six `shadow*` fields and `shadowEnabled: true`, and nothing
 * was seen in the viewer.
 *
 * `isGeoLike` of `ImageEngine` is not widened: it is used in nine other places
 * (geometry, fill, shape drawing), and putting `svg` there would change
 * all of them.
 */
export function shadowFollowsGlyphs(slotType: string | undefined | null): boolean {
  return slotType === 'text';
}

/** The shadow colour with its opacity, for drop-shadow and text-shadow alike. */
export function shadowColorCss(style: { shadowColor?: string; shadowOpacity?: number; shadowColorRole?: string }): string {
  const alpha = style.shadowOpacity !== undefined
    ? Math.max(0, Math.min(100, style.shadowOpacity)) / 100
    : 1;
  const sanitized = (style.shadowColor || '#000000').replace('#', '');
  const complete = sanitized.length === 3
    ? sanitized.split('').map(function (c) { return c + c; }).join('')
    : sanitized;
  const r = parseInt(complete.substring(0, 2), 16) || 0;
  const g = parseInt(complete.substring(2, 4), 16) || 0;
  const b = parseInt(complete.substring(4, 6), 16) || 0;

  const baseColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  // A role swaps the whole colour, alpha included: put the opacity back on top.
  const colorStr = style.shadowColorRole
    ? (alpha < 1
        ? 'color-mix(in srgb, ' + resolveCssColor(style.shadowColorRole, baseColor) + ' ' + Math.round(alpha * 100) + '%, transparent)'
        : resolveCssColor(style.shadowColorRole, baseColor))
    : baseColor;

  return colorStr;
}
