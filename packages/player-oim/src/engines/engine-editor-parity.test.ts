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

describe("Paridad editor <-> player en las formas geometricas", () => {
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

  describe("cadena de respaldos del trazado", () => {
    // CanvasArea.tsx: d={shape.customBlobPath || shape.svgPath || GEO_SHAPES.blob.d}
    it("un blob con svgPath y sin customBlobPath conserva su forma al publicarse", async () => {
      const figura = await pintarForma({
        geoShape: "blob",
        svgPath: "M 0,0 L 80,20 L 40,90 Z",
        fillColor: "#38bdf8",
      });

      expect(figura?.getAttribute("d")).toBe("M 0,0 L 80,20 L 40,90 Z");
      // What happened before: it fell back to the generic blob in the catalogue.
      expect(figura?.getAttribute("d")).not.toBe(BLOB_DEL_CATALOGO);
    });

    it("customBlobPath manda sobre svgPath, como en el editor", async () => {
      const figura = await pintarForma({
        geoShape: "blob",
        customBlobPath: "M 1,1 L 2,2 Z",
        svgPath: "M 9,9 L 8,8 Z",
        fillColor: "#38bdf8",
      });

      expect(figura?.getAttribute("d")).toBe("M 1,1 L 2,2 Z");
    });

    it("sin ninguno de los dos, el blob usa el catalogo", async () => {
      const figura = await pintarForma({ geoShape: "blob", fillColor: "#38bdf8" });

      expect(figura?.getAttribute("d")).toBe(BLOB_DEL_CATALOGO);
    });

    // The editor does NOT offer svgPath for the doodle: d={customBlobPath || catalogue}
    it("el garabato ignora svgPath, igual que el editor", async () => {
      const figura = await pintarForma({
        geoShape: "scribble",
        svgPath: "M 0,0 L 80,20 Z",
        strokeColor: "#18181B",
        strokeWidth: 2,
      });

      expect(figura?.getAttribute("d")).not.toBe("M 0,0 L 80,20 Z");
      expect(figura?.getAttribute("d")).toContain("Q");
    });
  });

  describe("respaldos de trazo del garabato", () => {
    // The doodle is `rellenable: false`, so without a stroke NOTHING is
    // visible. The editor covers this with two fallbacks; the player did not have them.

    // CanvasArea.tsx: strokeWidth={shape.strokeWidth > 0 ? shape.strokeWidth : 2}
    it("un garabato sin grosor se publica con grosor 2, no invisible", async () => {
      const figura = await pintarForma({ geoShape: "scribble", strokeColor: "#18181B" });

      expect(figura?.getAttribute("stroke-width")).toBe("2");
      expect(figura?.getAttribute("stroke")).toBe("#18181B");
    });

    it("un grosor de 0 tambien cae al respaldo, como en el editor", async () => {
      const figura = await pintarForma({
        geoShape: "scribble",
        strokeColor: "#18181B",
        strokeWidth: 0,
      });

      expect(figura?.getAttribute("stroke-width")).toBe("2");
    });

    // CanvasArea.tsx: stroke={shape.strokeColor || shape.fillColor || "#2563EB"}
    it("un garabato con solo color de relleno lo usa como color de trazo", async () => {
      const figura = await pintarForma({ geoShape: "scribble", fillColor: "#DC2626" });

      expect(figura?.getAttribute("stroke")).toBe("#DC2626");
      expect(figura?.getAttribute("stroke-width")).toBe("2");
      // Still no fill: it is an open stroke.
      expect(figura?.getAttribute("fill")).toBe("none");
    });

    it("sin ningun color, el garabato cae al azul del editor", async () => {
      const figura = await pintarForma({ geoShape: "scribble" });

      expect(figura?.getAttribute("stroke")).toBe("#2563EB");
    });

    it("un grosor explicito gana al respaldo", async () => {
      const figura = await pintarForma({
        geoShape: "scribble",
        strokeColor: "#18181B",
        strokeWidth: 7,
      });

      expect(figura?.getAttribute("stroke-width")).toBe("7");
    });
  });

  describe("lo que NO debe cambiar", () => {
    // The editor paints the line with `strokeWidth ?? 0`: no fallback. If the
    // doodle fix had been applied to every open stroke, this line would be published
    // visible where the editor shows nothing.
    it("una linea sin grosor sigue sin trazo, como en el editor", async () => {
      const figura = await pintarForma({ geoShape: "line", strokeColor: "#18181B" });

      expect(figura?.getAttribute("stroke-width")).toBeNull();
    });

    it("un circulo sin color de trazo sigue sin trazo", async () => {
      const figura = await pintarForma({
        geoShape: "circle",
        fillColor: "#38bdf8",
        strokeWidth: 3,
      });

      expect(figura?.getAttribute("stroke-width")).toBeNull();
      expect(figura?.getAttribute("fill")).toBe("#38bdf8");
    });
  });
});
