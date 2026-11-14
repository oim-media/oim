/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument, Paint } from "./schema.js";

// Paints live in three places: `canvas.fills`, each layer's `fills`, and each
// stroke's `paint`. A `{ ref }` in any of them points at `document.resources`.
// A stroke whose ref is missing is dropped, since a stroke has no paint without it.

/** A copy of the document with every `{ ref }` paint replaced by its resource. */
export function resolveRefs(document: OimDocument): { document: OimDocument; missing: string[] } {
  const out = structuredClone(document);
  const missing: string[] = [];
  const resources = document.resources ?? {};

  const one = (paint: Paint): Paint | undefined => {
    if (!("ref" in paint)) return paint;
    if (Object.prototype.hasOwnProperty.call(resources, paint.ref)) return structuredClone(resources[paint.ref]);
    if (!missing.includes(paint.ref)) missing.push(paint.ref);
    return undefined;
  };
  const list = (paints: Paint[]): Paint[] => paints.flatMap((paint) => one(paint) ?? []);

  const walk = (layers: Layer[]): void => {
    for (const layer of layers) {
      if (layer.fills) layer.fills = list(layer.fills);
      if (layer.strokes) {
        layer.strokes = layer.strokes.flatMap((stroke) => {
          const paint = one(stroke.paint);
          return paint ? [{ ...stroke, paint }] : [];
        });
      }
      if (layer.children) walk(layer.children);
    }
  };

  if (out.canvas.fills) out.canvas.fills = list(out.canvas.fills);
  walk(out.layers);
  return { document: out, missing };
}
