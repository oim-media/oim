/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMaskSilhouetteCanvasD } from "./layerComposition";

/**
 * The player draws every mask silhouette from the shared catalogue in core
 * (maskOutlinePath). A literal copy of the table here drifted once: the editor
 * gained triangle, line, arrow and diamond, the player did not, and a triangular
 * mask came out as a circle. The lookup must never fall back silently.
 */
const FIGURAS_ESPERADAS = [
  "circle",
  "rectangle",
  "triangle",
  "star",
  "line",
  "arrow",
  "diamond",
  "hexagon",
  "heart",
  "blob",
];

const FULL_CANVAS = { width: 100, height: 100 };

function maskOf(style: Record<string, unknown>) {
  return { id: "m", type: "mask", x: 0, y: 0, width: 100, height: 100, style } as any;
}

describe("mask silhouettes come from the shared catalogue", () => {
  it("the player has no literal shape table left", () => {
    const src = readFileSync(join(__dirname, "layerComposition.ts"), "utf8");
    expect(src).not.toMatch(/MASK_SHAPE_PATHS|function scalePath/);
  });

  it("draws every silhouette the editor offers, as a closed path", () => {
    for (const figureItem of FIGURAS_ESPERADAS) {
      const d = getMaskSilhouetteCanvasD(maskOf({ maskShape: figureItem }), FULL_CANVAS);
      expect(d, `falta la silueta "${figureItem}"`).not.toBeNull();
      expect(d!.startsWith("M"), `"${figureItem}" does not start with M`).toBe(true);
    }
  });

  it("an unknown shape has no silhouette: it never falls back to a circle", () => {
    expect(getMaskSilhouetteCanvasD(maskOf({ maskShape: "nope" }), FULL_CANVAS)).toBeNull();
  });
});
