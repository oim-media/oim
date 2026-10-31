/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveCssColor } from './dynamicColors.js';

/**
 * La sombra como `drop-shadow`, que sigue la SILUETA y no la caja.
 *
 * `box-shadow` dibuja el rectangulo del elemento: una sombra sobre un circulo
 * salia cuadrada.
 *
 * **La cadena tiene que ser identica a la del editor**
 * (its shadow module), con espacio detras de cada coma del `rgba`. La
 * misma tabla de casos esta en las pruebas de los dos repositorios.
 *
 * No reutiliza `hexToRgba` de `ImageEngine` a proposito: aquel compone sin
 * espacios y se usa en otro sitio, asi que cambiarlo seria tocar algo ajeno.
 */
export function dropShadowCss(style: {
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowColorRole?: string;
}): string {
  const x = style.shadowOffsetX || 0;
  const y = style.shadowOffsetY || 0;
  const blur = style.shadowBlur || 0;

  return 'drop-shadow(' + x + 'px ' + y + 'px ' + blur + 'px ' + shadowColorCss(style) + ')';
}

/**
 * Si la sombra de este slot debe seguir los GLIFOS en vez de la silueta.
 *
 * Solo el text. Es el unico caso donde `text-shadow` es lo correcto, porque
 * sigue cada letra en vez del rectangulo que las contiene.
 *
 * Todo lo demas va por `drop-shadow`, que sigue el canal alfa y por tanto sale
 * bien sobre cualquier cosa que se pinte: una forma, una imagen o un SVG.
 *
 * **Un tipo desconocido va por la silueta**, a proposito. Pecar de
 * `drop-shadow` es lo seguro: un `text-shadow` sobre algo sin glifos no pinta
 * NADA, y ese silencio es exactamente el fallo que esta funcion arregla — el
 * vector de un `.oim` real llegaba con sus seis campos `shadow*` y
 * `shadowEnabled: true`, y en el visor no se veia nada.
 *
 * No se amplia `isGeoLike` de `ImageEngine`: se usa en nueve sitios mas
 * -geometria, fill, dibujo de formas- y meter `svg` ahi los cambiaria
 * todos.
 */
export function shadowFollowsGlyphs(slotType: string | undefined | null): boolean {
  return slotType === 'text';
}

/** The shadow colour with its opacity, for drop-shadow and text-shadow alike. */
export function shadowColorCss(style: { shadowColor?: string; shadowOpacity?: number; shadowColorRole?: string }): string {
  const alpha = style.shadowOpacity !== undefined
    ? Math.max(0, Math.min(100, style.shadowOpacity)) / 100
    : 1;
  const sanitized = (style.shadowColor || '#000000').replace('#', '');
  const complete = sanitized.length === 3
    ? sanitized.split('').map(function (c) { return c + c; }).join('')
    : sanitized;
  const r = parseInt(complete.substring(0, 2), 16) || 0;
  const g = parseInt(complete.substring(2, 4), 16) || 0;
  const b = parseInt(complete.substring(4, 6), 16) || 0;

  const baseColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  // A role swaps the whole colour, alpha included: put the opacity back on top.
  const colorStr = style.shadowColorRole
    ? (alpha < 1
        ? 'color-mix(in srgb, ' + resolveCssColor(style.shadowColorRole, baseColor) + ' ' + Math.round(alpha * 100) + '%, transparent)'
        : resolveCssColor(style.shadowColorRole, baseColor))
    : baseColor;

  return colorStr;
}
