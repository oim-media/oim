/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paridad entre lo que dibuja el editor y lo que publica el player.
 *
 * Las pruebas del player comprueban que el player hace lo que el player dice,
 * y las del editor lo mismo. La divergencia vive ENTRE los dos, que es justo
 * donde no habia ninguna prueba: el editor encadena respaldos con `||` y el
 * player usaba condiciones que excluyen, asi que una obra podia verse bien al
 * editarla y salir distinta -o invisible- al publicarla.
 *
 * Cada caso de aqui esta copiado del respaldo concreto que aplica
 * `CanvasArea.tsx`, no inventado.
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

/** El catalogo oficial, para poder afirmar que NO se cayo en el por defecto. */
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

  /** Monta un unico slot y devuelve su <path> ya renderizado. */
  const pintarForma = async (style: Record<string, unknown>): Promise<Element | null> => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);

    // Un slot como lo exporta el editor. Sin `width_px`/`fillType` el motor lo
    // descarta antes de dibujar nada -ImageEngine.ts:1146-, y la prueba mediria
    // esa criba en vez de lo que viene a medir.
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
      // Lo que pasaba antes: se caia al blob generico del catalogo.
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

    // El editor NO ofrece svgPath en el garabato: d={customBlobPath || catalogo}
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
    // El garabato es `rellenable: false`, asi que sin trazo no queda NADA
    // visible. El editor lo tapa con dos respaldos; el player no los tenia.

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
      // Sigue sin relleno: es un trazo abierto.
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
    // El editor pinta la linea con `strokeWidth ?? 0`: sin respaldo. Si el
    // arreglo del garabato se hubiera aplicado a todo trazo abierto, esta
    // linea se publicaria visible donde el editor no enseña nada.
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
