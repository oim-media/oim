/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parity between what the editor draws and what the player publishes.
 *
 * The player's tests check that the player does what the player says, and the
 * editor's tests do the same for the editor. The divergence lives BETWEEN the two,
 * which is exactly where there were no tests: the editor chains fallbacks with `||`
 * and the player used conditions that exclude each other, so an artwork could look
 * right when edited and come out different (or invisible) when published.
 *
 * Each case here is copied from the concrete fallback that `CanvasArea.tsx` applies,
 * not invented.
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

/** The official catalogue, to be able to assert that it did NOT fall back to the default. */
const BLOB_DEL_CATALOGO =
  "M 50,10 C 75,10 92,25 90,50 C 88,75 75,90 50,90 C 25,90 10,75 10,50 C 10,25 25,10 50,10 Z";

describe("Editor <-> player parity for geometric shapes", () => {
  let host: HTMLElement;
  let shadow: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  /** Mounts a single slot and returns its already-rendered <path>. */
  const pintarForma = async (style: Record<string, unknown>): Promise<Element | null> => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);

    // A slot as the editor exports it. Without `width_px`/`fillType` the engine
    // discards it before drawing anything (-ImageEngine.ts:1146-), and the test would
    // measure that filter instead of what it is meant to measure.
    motor.metadata = {
      canvas_width: 800,
      canvas_height: 600,
      slots: [{
        id: "forma",
        type: "geo",
        align: "left",
        position: [0.2, 0.2],
        width_px: 120,
        height_px: 120,
        content: { es: "" },
        style: { fillType: "color", ...style },
      }],
    } as any;

    await motor.renderSlots();
    return host.shadowRoot!.querySelector('[data-slot-id="forma"] path');
  };

  describe("fallback chain of the outline", () => {
    // CanvasArea.tsx: d={shape.customBlobPath || shape.svgPath || GEO_SHAPES.blob.d}
    it("a blob with svgPath and without customBlobPath keeps its shape when published", async () => {
      const figureItem = await pintarForma({
        geoShape: "blob",
        svgPath: "M 0,0 L 80,20 L 40,90 Z",
        fillColor: "#38bdf8",
      });

      expect(figureItem?.getAttribute("d")).toBe("M 0,0 L 80,20 L 40,90 Z");
      // What happened before: it fell back to the generic blob in the catalogue.
      expect(figureItem?.getAttribute("d")).not.toBe(BLOB_DEL_CATALOGO);
    });

    it("customBlobPath overrides svgPath, as in the editor", async () => {
      const figureItem = await pintarForma({
        geoShape: "blob",
        customBlobPath: "M 1,1 L 2,2 Z",
        svgPath: "M 9,9 L 8,8 Z",
        fillColor: "#38bdf8",
      });

      expect(figureItem?.getAttribute("d")).toBe("M 1,1 L 2,2 Z");
    });

    it("without either of the two, the blob uses the catalogue", async () => {
      const figureItem = await pintarForma({ geoShape: "blob", fillColor: "#38bdf8" });

      expect(figureItem?.getAttribute("d")).toBe(BLOB_DEL_CATALOGO);
    });

    // The editor does NOT offer svgPath for the doodle: d={customBlobPath || catalogue}
    it("the doodle ignores svgPath, as the editor does", async () => {
      const figureItem = await pintarForma({
        geoShape: "scribble",
        svgPath: "M 0,0 L 80,20 Z",
        strokeColor: "#18181B",
        strokeWidth: 2,
      });

      expect(figureItem?.getAttribute("d")).not.toBe("M 0,0 L 80,20 Z");
      expect(figureItem?.getAttribute("d")).toContain("Q");
    });
  });

  describe("doodle stroke fallbacks", () => {
    // The doodle is `rellenable: false`, so without a stroke NOTHING is
    // visible. The editor covers this with two fallbacks; the player did not have them.

    // CanvasArea.tsx: strokeWidth={shape.strokeWidth > 0 ? shape.strokeWidth : 2}
    it("a doodle without thickness is published with thickness 2, not invisible", async () => {
      const figureItem = await pintarForma({ geoShape: "scribble", strokeColor: "#18181B" });

      expect(figureItem?.getAttribute("stroke-width")).toBe("2");
      expect(figureItem?.getAttribute("stroke")).toBe("#18181B");
    });

    it("a thickness of 0 also falls back, as in the editor", async () => {
      const figureItem = await pintarForma({
        geoShape: "scribble",
        strokeColor: "#18181B",
        strokeWidth: 0,
      });

      expect(figureItem?.getAttribute("stroke-width")).toBe("2");
    });

    // CanvasArea.tsx: stroke={shape.strokeColor || shape.fillColor || "#2563EB"}
    it("a doodle with only a fill colour uses it as the stroke colour", async () => {
      const figureItem = await pintarForma({ geoShape: "scribble", fillColor: "#DC2626" });

      expect(figureItem?.getAttribute("stroke")).toBe("#DC2626");
      expect(figureItem?.getAttribute("stroke-width")).toBe("2");
      // Still no fill: it is an open stroke.
      expect(figureItem?.getAttribute("fill")).toBe("none");
    });

    it("without any colour, the doodle falls back to the editor's blue", async () => {
      const figureItem = await pintarForma({ geoShape: "scribble" });

      expect(figureItem?.getAttribute("stroke")).toBe("#2563EB");
    });

    it("an explicit thickness beats the fallback", async () => {
      const figureItem = await pintarForma({
        geoShape: "scribble",
        strokeColor: "#18181B",
        strokeWidth: 7,
      });

      expect(figureItem?.getAttribute("stroke-width")).toBe("7");
    });
  });

  describe("what must NOT change", () => {
    // The editor paints the line with `strokeWidth ?? 0`: no fallback. If the
    // doodle fix had been applied to every open stroke, this line would be published
    // visible where the editor shows nothing.
    it("a line without thickness stays without a stroke, as in the editor", async () => {
      const figureItem = await pintarForma({ geoShape: "line", strokeColor: "#18181B" });

      expect(figureItem?.getAttribute("stroke-width")).toBeNull();
    });

    it("a circle without a stroke colour stays without a stroke", async () => {
      const figureItem = await pintarForma({
        geoShape: "circle",
        fillColor: "#38bdf8",
        strokeWidth: 3,
      });

      expect(figureItem?.getAttribute("stroke-width")).toBeNull();
      expect(figureItem?.getAttribute("fill")).toBe("#38bdf8");
    });
  });
});
