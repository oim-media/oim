/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quien puede reeditar un `.oim` se delega en `@oim-media/core`.
 *
 * Vivia aqui, y el editor tenia una COPIA en `src/lib/parallax/` -con su
 * fichero de bloqueo `parallax.lock`, que registraba el commit de origen y un
 * hash por fichero, y una guardia que los comparaba-. Toda esa maquinaria
 * existia para mantener iguales dos copies que ya no hacen falta.
 *
 * Se reexporta SOLO lo que el player usa. Un reexporte generoso es una puerta
 * por la que entra lo que hay al otro lado: al mover el motor generativo, un
 * `export` «por comodidad» metio el catalogo entero -1,7 KB- en el bundle del
 * CDN.
 *
 * Se importa el fichero del modulo y no el indice del paquete, para no
 * arrastrar el esquema ni zod.
 */
export { permissionOf, signatureStamp } from '../../../core/src/reeditPermission.js';
