/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Canonical serialization conforming to the 7 normative rules of the OIM specification
 * (the BINARY_SPEC and README of the spec package) and the principles of RFC 8785 (JCS).
 *
 * SINGLE source of truth shared by @oim-media/core, @oim-media/cli and @oim-media/player-oim.
 *
 * The 7 canonical rules:
 * 1. Deserialized base metadata object.
 * 2. Strict exclusion at the root of: 'signature', 'key_version', 'timestamp', 'creator_user_id'.
 * 3. Numeric normalization: decimals with a null fractional part become integers (2.0 -> 2);
 *    the rest is rounded to at most 6 decimals.
 * 4. Recursive lexical key ordering by Unicode code point (codePointAt).
 * 5. Compact serialization without spaces between separators (',', ':').
 * 6. Non-ASCII characters emitted directly in UTF-8 without escaping (no \uXXXX).
 * 7. Native UTF-8 encoding.
 */

const EXCLUDED_ROOT_KEYS = new Set([
  'signature',
  'key_version',
  'timestamp',
  'creator_user_id',
]);

/**
 * Rule 3: integer floats are converted to int; the rest is rounded to 6 decimals.
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
 * Rule 4: recursive ordering by real Unicode code point (RFC 8785 / JCS).
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
 * Runs the full canonical serialization, returning the exact UTF-8 bytes.
 */
export function serializeCanonical(metadata: Record<string, any>): Uint8Array {
  if (!metadata || typeof metadata !== 'object') {
    return new TextEncoder().encode('{}');
  }

  // Rule 2: Exclusion at the root
  const kept: Record<string, any> = {};
  for (const key of Object.keys(metadata)) {
    if (!EXCLUDED_ROOT_KEYS.has(key)) {
      kept[key] = metadata[key];
    }
  }

  // Rules 3, 4, 5, 6 and 7
  const normalized = normalizeCanonicalNumbers(kept);
  const sorted = sortKeysByCodePoint(normalized);
  const jsonStr = JSON.stringify(sorted);

  return new TextEncoder().encode(jsonStr);
}
