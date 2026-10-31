/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El interlineado se delega en `@oim-media/core`, fuente unica para el player y el
 * editor. El fallo que esto cierra ERA que cada uno tenia el suyo: el editor
 * pintaba a 1.25 y el player dejaba el `normal` del navegador a la capa que no
 * traia el campo, asi que la caja salia mas baja de lo previsto. Los descendentes -«j»,
 * «p», «g»- quedaban cortados por el `overflow: hidden` del slot.
 *
 * Se importa el fichero del modulo y no el indice del paquete, igual que en
 * `binary.ts` y `grupos.ts`, para no arrastrar el esquema ni zod.
 */
export {
  resolveLineHeight,
  inkMargin,
  MAX_FONT_HEIGHT,
  DEFAULT_LINE_HEIGHT,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
} from '../../../core/src/typography.js';
