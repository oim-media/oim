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
export function embeddedFontName(family: string, sha256Hex: string): string {
  return `oim-${sha256Hex.slice(0, 8)}-${family}`;
}
