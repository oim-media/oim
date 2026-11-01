/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reads the Spanish keys of files signed before contract 1.23.0 as their English
 * equivalents. Writers emit only the English keys; this is the one place that knows
 * the old ones.
 *
 * Pure: it returns a copy and never touches the object it was given. Call it AFTER
 * the signature has been verified over the original bytes, never before: the
 * signature covers the keys as they were written.
 */

const LEGACY_PERMISSIONS = new Map<string, string>([
  ["publico", "public"],
  ["solo_autor", "author_only"],
  ["sellado", "sealed"],
]);

const ENGLISH_PERMISSIONS = new Set<string>(["public", "author_only", "sealed"]);

/**
 * `reedit` already present wins over `reedicion`. Unknown values in either key become
 * `author_only`, never `public`: a corrupt or tampered value must not loosen a permission.
 */
export function normalizeLegacyKeys<T extends Record<string, unknown>>(meta: T): T {
  const out: Record<string, unknown> = { ...meta };

  if (out.reedit === undefined && "reedicion" in out) {
    const legacy = out.reedicion;
    out.reedit = typeof legacy === "string" ? LEGACY_PERMISSIONS.get(legacy) ?? "author_only" : "author_only";
  }
  if (out.reedit !== undefined && !(typeof out.reedit === "string" && ENGLISH_PERMISSIONS.has(out.reedit))) {
    out.reedit = "author_only";
  }
  delete out.reedicion;

  return out as T;
}
