/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dimensiones y unidades de usuario del formato OIM.
 *
 * En la transicion hacia un modelo basado en ViewBox y unidades de usuario puras
 * (independientes de la plataforma y de cadenas de texto CSS como `cqw`),
 * esta utilidad permite resolver valores que pueden venir como:
 *  - numero puro (unidades de usuario de diseño, ej. 250 sobre un lienzo de 1000 = 25%)
 *  - porcentaje numerico o string con % (ej. "25%")
 *  - cadena CSS preexistente (ej. "25cqw", "100px")
 */

const RE_CSS_UNIT = /^[\d.+-]+(cqw|cqh|cqi|cqb|rem|em|ex|ch|vw|vh|vmin|vmax|%|px|pt|pc|cm|mm|in|lh|rlh)$/i;

/**
 * Resuelve una dimension (ancho, alto, radio, padding) a una expresion CSS utilizable en web.
 * Si recibe un numero y un baseDimension > 0, lo convierte a porcentaje `cqw` respecto a baseDimension.
 * Si recibe una cadena con unidad CSS valida, la conserva (garantizando compatibilidad total con .oim legacy).
 */
export function resolveDimensionToCss(
  val: number | string | undefined | null,
  baseDimension: number = 800,
  fallback: string = ""
): string {
  if (val === undefined || val === null || val === "") return fallback;

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return fallback;
    if (baseDimension > 0) {
      const pct = (val / baseDimension) * 100;
      return `${parseFloat(pct.toFixed(4))}cqw`;
    }
    return `${val}px`;
  }

  const str = String(val).trim();
  if (!str || str === "undefined" || str === "null") return fallback;

  if (RE_CSS_UNIT.test(str)) {
    return str;
  }

  const parsed = parseFloat(str);
  if (Number.isFinite(parsed)) {
    if (baseDimension > 0) {
      const pct = (parsed / baseDimension) * 100;
      return `${parseFloat(pct.toFixed(4))}cqw`;
    }
    return `${parsed}px`;
  }

  return fallback;
}

/**
 * Extrae el valor numerico puro de una dimension dada en unidades de usuario.
 * Si viene como '25cqw' o '25%' y se conoce baseDimension, calcula su equivalente numerico.
 */
export function resolveNumericDimension(
  val: number | string | undefined | null,
  baseDimension: number = 800
): number | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (str.endsWith("cqw") || str.endsWith("%")) {
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    return (num / 100) * baseDimension;
  }
  if (str.endsWith("px")) {
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : null;
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : null;
}
