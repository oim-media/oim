/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La regla de compatibilidad se delega en `@oim-media/core`, igual que `binary.ts`,
 * `grupos.ts`, `tipografia.ts` y `recorte.ts`.
 *
 * Aqui importa especialmente que sea compartida: el numero que el editor
 * ESCRIBE en `min_player` y el que el player COMPARA tienen que salir del
 * mismo sitio, o el actionEvent mentiria en una direccion u otra -callando cuando
 * deberia hablar, o gritando con archivos correctos-.
 *
 * Se importa el fichero del modulo y no el indice del paquete, para no
 * arrastrar el esquema ni zod al paquete que sirve el CDN.
 */
export {
  whatTheReaderCannotDo,
  describeMissing,
  CONTRACT_VERSION,
  PLAYER_CAPABILITIES,
} from '../../../core/src/compatibility.js';
export type { Reader, MissingSupport } from '../../../core/src/compatibility.js';
