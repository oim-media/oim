/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { patternTileUri, isMultiColorPattern, resolvePatternColors } from '../../../core/src/patterns.js';
import { resolveCssColor } from './dynamicColors.js';

/**
 * Paints a pattern (canvas background or pattern layer) that uses colour roles.
 *
 * A one-colour pattern is tinted in CSS: the tile becomes an alpha mask on a
 * `::before` whose background is `var(--oim-palette-*, var(--oim-color-*, raw))`.
 * The browser repaints it the moment a variable changes, wherever on the page
 * it is set, as it does for every other layer. A tile baked into a data URI
 * only changes when the player re-encodes it, which it cannot see coming.
 *
 * Only the first colour of a pattern has a role. With several colours the
 * fixed others stay baked in `background-image`, under the tinted mask, so the
 * part that changes is still CSS. Without a foreground role the tile is baked
 * whole; its background stays out of it when that has a role.
 */
export function paintPattern(
  el: HTMLElement,
  style: Record<string, any>,
  tileSvg: string,
): void {
  const fgRole = style.backgroundPatternColorRole || style.fillPatternColorRole;
  const bgRole = style.backgroundPatternBgColorRole || style.fillPatternBgColorRole;
  const raw = resolvePatternColors(style, null);
  el.style.backgroundColor = bgRole ? resolveCssColor(bgRole, raw.bgColor) : raw.bgColor;

  if (fgRole) {
    const mask = patternTileUri(style, tileSvg, 'transparent', '#000000', 'transparent');
    if (mask) {
      el.classList.add('oim-pat-dyn');
      el.style.setProperty('--oim-pat-fg', resolveCssColor(fgRole, raw.fgColor));
      el.style.setProperty('--oim-pat-mask', 'url("' + mask + '")');
      el.style.backgroundImage = isMultiColorPattern(style)
        ? 'url("' + patternTileUri(style, tileSvg, 'transparent', 'transparent') + '")'
        : 'none';
      return;
    }
  }

  el.classList.remove('oim-pat-dyn');
  // Without a foreground role nothing in the tile changes but its background.
  const bg = bgRole ? 'transparent' : raw.bgColor;
  const key = raw.fgColor + '|' + bg;
  if (el.dataset.oimPat === key) return;
  const uri = patternTileUri(style, tileSvg, bg, raw.fgColor);
  if (uri) el.style.backgroundImage = 'url("' + uri + '")';
  el.dataset.oimPat = key;
}
