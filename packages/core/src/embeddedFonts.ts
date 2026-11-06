/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fonts shipped inside a .oim.
 *
 * A .oim used to carry only the NAME of its font, so every viewer asked
 * Google for it on open: a third-party request that reveals who is looking
 * (against the 1.1.0 rule), a different font whenever Google fails, and no
 * font offline. The editor now subsets the fonts a work uses and embeds them.
 *
 * Each family is registered under its own name, derived from its content, so
 * a subset never replaces the same family on the page hosting the work, nor
 * the one of another .oim on that page.
 */

/** `oim-` + 8 hex of the SHA-256 of the family's variants + `-` + family. */
export const EMBEDDED_FONT_NAME = /^oim-[0-9a-f]{8}-[A-Za-z0-9 ]{1,64}$/;

/** Per entry, once decoded. The editor aims lower (300 KB); this is the ceiling readers accept. */
export const EMBEDDED_FONT_MAX_BYTES = 400 * 1024;

/** All entries of one file, once decoded. */
export const EMBEDDED_FONTS_MAX_TOTAL_BYTES = 3 * 1024 * 1024;

export const EMBEDDED_FONTS_MAX_ENTRIES = 32;

/**
 * The internal name of an embedded family. `sha256Hex` is the hash of all its
 * variants, ordered by weight and then style (normal before italic), so every
 * variant of a family shares one name, which is how CSS picks bold and italic.
 */
/** 1.27.0: the formats an entry may declare. Writers emit "woff"; "woff2" is read forever. */
export const EMBEDDED_FONT_FORMATS = ["woff", "woff2"] as const;

const MAGIC: Record<string, string> = { woff: "wOFF", woff2: "wOF2" };

/** Tables that make a font variable. A "woff" entry is a static instance (1.27.0). */
const VARIATION_TABLES = new Set(["fvar", "gvar", "avar", "HVAR", "MVAR", "STAT"]);

/**
 * Why an entry's bytes break the contract, or null. Checks the magic of its
 * format and, for WOFF, that no variation table is listed: readers outside the
 * browser paint a variable font's default instance, so bold would show regular.
 * WOFF2 is not inspected (its directory is compressed); it is legacy, read only.
 */
export function embeddedFontProblem(format: string, bytes: Uint8Array): "format" | "magic" | "variable" | null {
  const magic = MAGIC[format];
  if (!magic) return "format";
  if (bytes.length < 4 || String.fromCharCode(...bytes.subarray(0, 4)) !== magic) return "magic";
  if (format === "woff2") return null;
  if (bytes.length < 44) return "magic";
  const tables = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(12);
  if (bytes.length < 44 + tables * 20) return "magic";
  for (let i = 0; i < tables; i++) {
    const at = 44 + i * 20;
    if (VARIATION_TABLES.has(String.fromCharCode(...bytes.subarray(at, at + 4)))) return "variable";
  }
  return null;
}

export function embeddedFontName(family: string, sha256Hex: string): string {
  return `oim-${sha256Hex.slice(0, 8)}-${family}`;
}
