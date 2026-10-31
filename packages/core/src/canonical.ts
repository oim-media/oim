/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Serialización canónica conforme a las 7 reglas normativas de la especificación OIM
 * (packages/spec/BINARY_SPEC.md y packages/spec/README.md) y principios de RFC 8785 (JCS).
 *
 * Fuente ÚNICA de verdad compartida entre @oim-media/core, @oim-media/cli y @oim-media/player-oim.
 *
 * Las 7 reglas canónicas:
 * 1. Objeto base de metadatos deserializado.
 * 2. Exclusión estricta en la raíz de: 'signature', 'key_version', 'timestamp', 'creator_user_id'.
 * 3. Normalización numérica: decimales con parte fraccionaria nula a enteros (2.0 -> 2);
 *    resto redondeado a máximo 6 decimales.
 * 4. Ordenación léxica de claves recursiva por punto de código Unicode (codePointAt).
 * 5. Serialización compacta sin espacios entre separadores (',', ':').
 * 6. Caracteres no-ASCII emitidos directamente en UTF-8 sin escapar (sin \uXXXX).
 * 7. Codificación UTF-8 nativa.
 */

const EXCLUDED_ROOT_KEYS = new Set([
  'signature',
  'key_version',
  'timestamp',
  'creator_user_id',
]);

/**
 * Regla 3: enteros float se convierten a int, el resto se redondea a 6 decimales.
 */
export function normalizeCanonicalNumbers(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalNumbers);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      out[key] = normalizeCanonicalNumbers(value[key]);
    }
    return out;
  }
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
    return Number(value.toFixed(6));
  }
  return value;
}

/**
 * Regla 4: ordenación recursiva por punto de código Unicode real (RFC 8785 / JCS).
 */
export function sortKeysByCodePoint(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysByCodePoint);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    const sortedKeys = Object.keys(value).sort((a, b) => {
      const ap = [...a];
      const bp = [...b];
      const minLen = Math.min(ap.length, bp.length);
      for (let i = 0; i < minLen; i++) {
        const diff = (ap[i].codePointAt(0) ?? 0) - (bp[i].codePointAt(0) ?? 0);
        if (diff !== 0) return diff;
      }
      return ap.length - bp.length;
    });

    for (const key of sortedKeys) {
      out[key] = sortKeysByCodePoint(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Ejecuta la serialización canónica completa devolviendo los bytes UTF-8 exactos.
 */
export function serializeCanonical(metadata: Record<string, any>): Uint8Array {
  if (!metadata || typeof metadata !== 'object') {
    return new TextEncoder().encode('{}');
  }

  // Regla 2: Exclusión en raíz
  const kept: Record<string, any> = {};
  for (const key of Object.keys(metadata)) {
    if (!EXCLUDED_ROOT_KEYS.has(key)) {
      kept[key] = metadata[key];
    }
  }

  // Reglas 3, 4, 5, 6 y 7
  const normalized = normalizeCanonicalNumbers(kept);
  const sorted = sortKeysByCodePoint(normalized);
  const jsonStr = JSON.stringify(sorted);

  return new TextEncoder().encode(jsonStr);
}
