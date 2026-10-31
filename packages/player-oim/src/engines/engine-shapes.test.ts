/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The eight catalogue shapes, mounted.
 *
 * Reproduces a real file with all eight in which FIVE (heart, diamond,
 * hexagon, arrow and line) rendered as coloured rectangles and two more had a
 * different silhouette than in the editor.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(geoShape: string, style: any = {}) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._overlay = document.createElement("div");
  shadow.appendChild(motor._overlay);
  motor.metadata = {
    canvas_width: 800, canvas_height: 600,
    slots: [{
      id: "figura", type: "geo", align: "left",
      position: [0.2, 0.2], width_px: 120, height_px: 120,
      content: { es: "" },
      style: { geoShape, fillColor: "#93c5fd", fillType: "color",
               strokeColor: "#2563EB", strokeWidth: 2, ...style },
    }],
  };
  return { motor, nodo: () => shadow.querySelector('[data-slot-id="figura"]') as HTMLElement };
}

const POLIGONOS = ["triangle", "star", "arrow", "diamond", "hexagon"];
const TRAZADOS = ["circle", "heart", "line"];

describe("las cinco que se publicaban como rectangulos", () => {
  for (const forma of ["arrow", "diamond", "hexagon", "heart", "line"]) {
    it(`\`${forma}\` se dibuja de verdad`, async () => {
      const { motor, nodo } = montar(forma);
      await motor.renderSlots();
      expect(nodo().querySelector("svg"), `${forma} no monto ningun svg`).toBeTruthy();
    });
  }
});

describe("cada forma usa el elemento SVG que le toca", () => {
  for (const forma of POLIGONOS) {
    it(`\`${forma}\` es un <polygon>`, async () => {
      const { motor, nodo } = montar(forma);
      await motor.renderSlots();
      expect(nodo().querySelector("polygon")).toBeTruthy();
    });
  }
  for (const forma of TRAZADOS) {
    it(`\`${forma}\` es un <path>`, async () => {
      const { motor, nodo } = montar(forma);
      await motor.renderSlots();
      expect(nodo().querySelector("path")).toBeTruthy();
    });
  }
});

describe("el trazo sigue la silueta", () => {
  it("va en el `stroke` de la figura, no en un `border` de caja", async () => {
    // El fallo original: `border` de CSS dibuja el rectangulo del elemento y el
    // `clip-path` se aplica despues, llevandoselo por delante. Gemelo exacto
    // del fallo de la sombra.
    const { motor, nodo } = montar("star");
    await motor.renderSlots();
    const figura = nodo().querySelector("polygon")!;
    expect(figura.getAttribute("stroke")).toBe("#2563EB");
    expect(figura.getAttribute("stroke-width")).toBe("2");
    expect(nodo().style.border).toBe("");
  });

  it("no se estira con la capa", async () => {
    // `preserveAspectRatio: none` estira el viewBox: sin esto, una forma ancha
    // y baja tendria el borde grueso arriba y fino a los lados.
    const { motor, nodo } = montar("hexagon");
    await motor.renderSlots();
    expect(nodo().querySelector("polygon")!.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  it("un rectangulo SI conserva su borde de caja", async () => {
    // Ahi la caja ES la figura, y el radio de esquina llega en pixeles reales.
    const { motor, nodo } = montar("rectangle");
    await motor.renderSlots();
    expect(nodo().querySelector("svg")).toBeNull();
    expect(nodo().style.border).toContain("2px");
  });
});

describe("el fill", () => {
  it("va en la figura y no en el container", async () => {
    const { motor, nodo } = montar("diamond");
    await motor.renderSlots();
    expect(nodo().querySelector("polygon")!.getAttribute("fill")).toBe("#93c5fd");
    // Si el container siguiera pintado, se veria la caja entera por detras.
    expect(nodo().style.backgroundColor).toBe("transparent");
  });

  it("la linea no se rellena: seria una barra", async () => {
    const { motor, nodo } = montar("line");
    await motor.renderSlots();
    expect(nodo().querySelector("path")!.getAttribute("fill")).toBe("none");
  });
});

describe("los puntos son los del editor", () => {
  it("el triangulo va metido un 5%, no a sangre", async () => {
    // El player lo dibujaba `50% 0%, 0% 100%, 100% 100%`.
    const { motor, nodo } = montar("triangle");
    await motor.renderSlots();
    expect(nodo().querySelector("polygon")!.getAttribute("points")).toBe("50,5 95,90 5,90");
  });

  it("y ya no queda ningun `clip-path`", async () => {
    const { motor, nodo } = montar("star");
    await motor.renderSlots();
    expect(nodo().style.clipPath || "").toBe("");
  });
});
