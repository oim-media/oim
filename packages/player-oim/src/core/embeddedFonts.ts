/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Relative import, like the player's other shared modules: '@oim-media/core' pulls
// in the whole index and zod with it (see bundle-size.test.js).
import { EMBEDDED_FONT_NAME, EMBEDDED_FONT_MAX_BYTES } from '../../../core/src/embeddedFonts.js';

/**
 * Fonts shipped inside the .oim (contract 1.3.0).
 *
 * Each family is registered under its own name (`oim-<hash>-Family`), never
 * under the family's real name: a FontFace added to `document` is global, and
 * a subset registered as "Lora" would strip the characters from the host
 * page's own Lora text.
 */

export interface EmbeddedFontEntry {
  family: string;
  name: string;
  weight: number;
  style: 'normal' | 'italic';
  data: string;
}

const MAX_BASE64 = Math.ceil(EMBEDDED_FONT_MAX_BYTES / 3) * 4;

function looksLikeWoff2(base64: string): boolean {
  try {
    return atob(base64.slice(0, 8)).startsWith('wOF2');
  } catch (_) {
    return false;
  }
}

/** The entries of `metadata.fonts` that are safe to register. The rest are dropped. */
export function readEmbeddedFonts(metadata: any): EmbeddedFontEntry[] {
  const list = metadata && Array.isArray(metadata.fonts) ? metadata.fonts : [];
  const out: EmbeddedFontEntry[] = [];
  for (const f of list) {
    if (!f || typeof f !== 'object') continue;
    if (f.format !== 'woff2' || typeof f.family !== 'string' || typeof f.data !== 'string') continue;
    if (typeof f.name !== 'string' || !EMBEDDED_FONT_NAME.test(f.name)) continue;
    if (f.style !== 'normal' && f.style !== 'italic') continue;
    if (typeof f.weight !== 'number' || f.weight < 100 || f.weight > 900) continue;
    if (f.data.length > MAX_BASE64 || !looksLikeWoff2(f.data)) continue;
    out.push({ family: f.family, name: f.name, weight: f.weight, style: f.style, data: f.data });
  }
  return out;
}

type MakeFace = (name: string, source: string, descriptors: FontFaceDescriptors) => FontFace;

/**
 * Registers the fonts and returns family -> internal name. A font that fails
 * to load is left out, so its layers fall back to asking Google.
 */
export async function registerEmbeddedFonts(
  entries: EmbeddedFontEntry[],
  fonts: Pick<FontFaceSet, 'add'> = document.fonts,
  make: MakeFace = (name, source, descriptors) => new FontFace(name, source, descriptors)
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(entries.map(async (e) => {
    try {
      const face = make(e.name, `url(data:font/woff2;base64,${e.data})`, { weight: String(e.weight), style: e.style });
      await face.load();
      fonts.add(face);
      map.set(e.family, e.name);
    } catch (_) {
      // Left out on purpose: the layer keeps its family name and asks Google.
    }
  }));
  return map;
}

/** The CSS font-family of a layer: the embedded name first, the real family as fallback. */
export function embeddedFontFamily(family: string, map: Map<string, string>): string | null {
  const name = map.get(family);
  return name ? `'${name}', '${family}', sans-serif` : null;
}
