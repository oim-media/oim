/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El fill de una capa se delega en `@oim-media/core`.
 *
 * Estaba duplicado con una divergencia REAL, no cosmetica: el editor deducia el
 * tipo desde el color -`fillType || (fillColor ? "color" : "none")`- y el
 * player no. Una capa con `fillColor` y sin `fillType` se pintaba en el editor
 * y salia SIN RELLENO en el visor. Se conservo la deduccion, porque la otra
 * version descarta un dato que el archivo si trae.
 *
 * Se fue de paso `getContainerFillCss`, un alias marcado `@deprecated` con
 * CERO consumidores medidos en los dos repositorios.
 *
 * Se importa el fichero del modulo y no el indice del paquete, para no
 * arrastrar el esquema ni zod al bundle del CDN.
 */
export { getFillCss, patternLayerCss, shapeMaskCss, svgSilhouetteMaskCss } from '../../../core/src/fill.js';
export type { Shape, CSSProperties } from '../../../core/src/fill.js';
