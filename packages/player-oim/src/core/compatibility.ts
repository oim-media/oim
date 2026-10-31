/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The compatibility rule is delegated to `@oim-media/core`, like `binary.ts`,
 * `grupos.ts`, `tipografia.ts` and `recorte.ts`.
 *
 * Sharing matters especially here: the number the editor WRITES into `min_player` and
 * the one the player COMPARES must come from the same place, or actionEvent would lie in
 * one direction or the other: staying silent when it should speak, or shouting about
 * correct files.
 *
 * The module file is imported, not the package index, so that the schema and zod are not
 * dragged into the bundle that serves the CDN.
 */
export {
  whatTheReaderCannotDo,
  describeMissing,
  CONTRACT_VERSION,
  PLAYER_CAPABILITIES,
} from '../../../core/src/compatibility.js';
export type { Reader, MissingSupport } from '../../../core/src/compatibility.js';
