/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La regla de recorte se delega en `@oim-media/core`. Vive compartida desde que
 * tiene DOS consumidores: el editor arrastraba el mismo fallo -su wrapper
 * interior del content lleva `overflow: hidden` y recorta el text- y dos
 * implementaciones de esto discreparian igual que discrepaba el interlineado.
 *
 * Se importa el fichero del modulo y no el indice del paquete, igual que en
 * `binary.ts`, `grupos.ts` y `tipografia.ts`, para no arrastrar zod.
 */
export { slotClipping } from '../../../core/src/clipping.js';
export type { Clipping, WhoClips } from '../../../core/src/clipping.js';
