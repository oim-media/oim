/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** Which optional parts of the player a document needs, read from the document itself. */
export type Features = { generative: boolean; patterns: boolean };

const PATTERN_KEY = /^(fill|background)Pattern/;

export function featuresOf(doc: unknown): Features {
  const found: Features = { generative: false, patterns: false };
  const seen = new Set<unknown>();
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object' || seen.has(v) || (found.generative && found.patterns)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Record<string, unknown>;
    if (o.kind === 'generative' || o.fillType === 'generative' || o.fillGenerative) found.generative = true;
    // A drawing on the canvas background is painted as a pattern tile.
    if (o.kind === 'pattern' || o.fillType === 'pattern' || 'drawing' in o) found.patterns = true;
    for (const k in o) {
      if (PATTERN_KEY.test(k) && o[k] != null) found.patterns = true;
      walk(o[k]);
    }
  };
  walk(doc);
  return found;
}
