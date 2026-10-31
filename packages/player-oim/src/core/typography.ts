/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The line height is delegated to `@oim-media/core`, the single source for the player and the
 * editor. The failure this closes WAS that each had its own: the editor
 * painted at 1.25, and the player left the browser's `normal` to the layer that did not
 * carry the field, so the box came out lower than expected. The descenders ("j",
 * "p", "g") were cut off by the slot's `overflow: hidden`.
 *
 * The module file is imported, not the package index, as in `binary.ts` and
 * `grupos.ts`, so as not to drag in the schema or zod.
 */
export {
  resolveLineHeight,
  inkMargin,
  MAX_FONT_HEIGHT,
  DEFAULT_LINE_HEIGHT,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
} from '../../../core/src/typography.js';
