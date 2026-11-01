import { describe, it, expect } from "vitest";
import { MASK_SHAPE_PATHS } from "./layerComposition";

/**
 * The player's mask silhouette table is a literal copy of the editor's, where
 * the polygons are derived from the shared shape table.
 *
 * That copy already drifted once: the editor gained triangle, line, arrow and
 * diamond and the player did not, so a triangular mask was a triangle while
 * designing and a CIRCLE when played. The lookup silently falls back to
 * `circle` for an unknown name, so the bug only showed in the output.
 *
 * These tests cannot compare against the editor (they are separate repos), but they
 * do pin the contract: if someone adds a shape there and forgets this table, this
 * list must be updated too, and that step forces a look here.
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

describe("MASK_SHAPE_PATHS", () => {
  it("knows all the silhouettes the editor offers", () => {
    for (const figureItem of FIGURAS_ESPERADAS) {
      expect(MASK_SHAPE_PATHS[figureItem], `falta la silueta "${figureItem}"`).toBeTruthy();
    }
  });

  it("has no extra silhouettes that the editor cannot produce", () => {
    // A silhouette that exists only here cannot be chosen from the editor:
    // it is dead code that looks like an option.
    expect(Object.keys(MASK_SHAPE_PATHS).sort()).toEqual([...FIGURAS_ESPERADAS].sort());
  });

  it("each silhouette is a closed path and not an arbitrary string", () => {
    for (const [figureItem, d] of Object.entries(MASK_SHAPE_PATHS)) {
      expect(d.startsWith("M"), `"${figureItem}" does not start with M`).toBe(true);
      expect(d.trim().endsWith("Z"), `"${figureItem}" does not close with Z`).toBe(true);
    }
  });
});
