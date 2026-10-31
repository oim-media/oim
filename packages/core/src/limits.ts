/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Los límites del FORMATO. Módulo aparte, y por una razón concreta.
 *
 * `MAX_SLOTS` vivía en `schema.ts` con un comentario que decía que se
 * declaraba ahí «para que el número exista una vez y llegue a los dos sitios
 * sin copiarse». No funcionó: el player lo copió como literal `150` en
 * `security.ts` porque importar de `schema.ts` arrastra zod a su paquete, y el
 * player no quiere zod. La deuda no era del que copió, era del sitio donde
 * estaba la constante.
 *
 * Aquí no hay dependencias. Cualquiera puede importarlo sin arrastrar nada.
 *
 * Y el número es del formato, no del despliegue: el backend podía subirlo con
 * una variable de entorno, lo que le permitía firmar archivos que el player
 * rechaza como corruptos. Un archivo legítimamente firmado que ningún lector
 * muestra. Ahora el backend solo puede BAJARLO.
 */

/**
 * Cuántas capas admite un `.oim`.
 *
 * Lo aplican tres sitios y los tres deben decir lo mismo: el esquema de
 * `@oim-media/core`, la validación del player antes de pintar, y el backend antes
 * de firmar.
 */
export const MAX_SLOTS = 150;

/** Text marks (contract 1.11.0): tag names and how many styles a text may carry. */
export const MARK_NAME = /^[a-z][a-z0-9-]{0,23}$/;
export const MAX_MARKS = 8;
