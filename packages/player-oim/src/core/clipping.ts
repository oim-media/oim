/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The clipping rule is delegated to `@oim-media/core`. It has been shared since
 * it has TWO consumers: the editor carried the same bug -its inner wrapper of the
 * content has `overflow: hidden` and clips the text- and two implementations of
 * this would disagree the same way the line spacing did.
 *
 * The module file is imported, not the package index, as in `binary.ts`,
 * `grupos.ts` and `tipografia.ts`, to avoid pulling in zod.
 */
export { slotClipping } from '../../../core/src/clipping.js';
export type { Clipping, WhoClips } from '../../../core/src/clipping.js';
