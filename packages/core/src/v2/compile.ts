/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A pure port of the backend's `/v1/oim/compile` (apps/backend/src/routers/media.py and core/canonizar.py).
// Clients used to POST raw pixel slots there and get 1.x back; now they build the document themselves.

type Json = Record<string, unknown>;

// Pure duplicates: two names, one meaning.
const RENAMES: Record<string, string> = { size: "fontSize", font: "fontFamily", color: "fillColor" };

// Boolean shortcuts and the full key they stand for: [key, when true, when false].
const SHORTCUTS: Record<string, [string, unknown, unknown]> = {
  bold: ["fontWeight", 700, 400],
  italic: ["fontStyle", "italic", "normal"],
  underline: ["textDecoration", "underline", "none"],
};

/**
 * The style with one name per concept. Does not mutate its input.
 * When both forms arrive the full one wins: it can say anything the shortcut can, never the reverse.
 */
export function canonizeStyle(style: Json | null | undefined): Json {
  if (!style) return {};
  const out: Json = { ...style };

  for (const [alias, canonical] of Object.entries(RENAMES)) {
    if (alias in out) {
      const value = out[alias];
      delete out[alias];
      if (!(canonical in out)) out[canonical] = value;
    }
  }
  for (const [alias, [canonical, yes, no]] of Object.entries(SHORTCUTS)) {
    if (alias in out) {
      const value = out[alias];
      delete out[alias];
      if (!(canonical in out)) out[canonical] = value ? yes : no;
    }
  }
  if ("fontSizeOverrides" in out) {
    const overrides = out.fontSizeOverrides;
    delete out.fontSizeOverrides;
    if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
      out.fontSizes = { ...(overrides as Json), ...((out.fontSizes as Json | undefined) ?? {}) };
    }
  }
  return out;
}
