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

function mount(geoShape: string, style: any = {}) {
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
  return { motor, node: () => shadow.querySelector('[data-slot-id="figura"]') as HTMLElement };
}

const POLIGONOS = ["triangle", "star", "arrow", "diamond", "hexagon"];
const TRAZADOS = ["circle", "heart", "line"];

describe("the five that used to be published as rectangles", () => {
  for (const forma of ["arrow", "diamond", "hexagon", "heart", "line"]) {
    it(`\`${forma}\` is really drawn`, async () => {
      const { motor, node } = mount(forma);
      await motor.renderSlots();
      expect(node().querySelector("svg"), `${forma} no monto ningun svg`).toBeTruthy();
    });
  }
});

describe("each shape uses the SVG element that suits it", () => {
  for (const forma of POLIGONOS) {
    it(`\`${forma}\` is a <polygon>`, async () => {
      const { motor, node } = mount(forma);
      await motor.renderSlots();
      expect(node().querySelector("polygon")).toBeTruthy();
    });
  }
  for (const forma of TRAZADOS) {
    it(`\`${forma}\` is a <path>`, async () => {
      const { motor, node } = mount(forma);
      await motor.renderSlots();
      expect(node().querySelector("path")).toBeTruthy();
    });
  }
});

describe("the stroke follows the silhouette", () => {
  it("goes on the figure's `stroke`, not on a box `border`", async () => {
    // The original failure: CSS `border` draws the element's rectangle and the
    // `clip-path` is applied afterwards, carrying it away. An exact twin of the
    // shadow failure.
    const { motor, node } = mount("star");
    await motor.renderSlots();
    const figureItem = node().querySelector("polygon")!;
    expect(figureItem.getAttribute("stroke")).toBe("#2563EB");
    expect(figureItem.getAttribute("stroke-width")).toBe("2");
    expect(node().style.border).toBe("");
  });

  it("does not stretch with the layer", async () => {
    // `preserveAspectRatio: none` stretches the viewBox: without this, a wide and
    // short shape would have a thick border at the top and a thin one at the sides.
    const { motor, node } = mount("hexagon");
    await motor.renderSlots();
    expect(node().querySelector("polygon")!.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  it("a rectangle DOES keep its box border", async () => {
    // There the box IS the shape, and the corner radius arrives in real pixels.
    const { motor, node } = mount("rectangle");
    await motor.renderSlots();
    expect(node().querySelector("svg")).toBeNull();
    expect(node().style.border).toContain("2px");
  });
});

describe("the fill", () => {
  it("va en la figura y no en el container", async () => {
    const { motor, node } = mount("diamond");
    await motor.renderSlots();
    expect(node().querySelector("polygon")!.getAttribute("fill")).toBe("#93c5fd");
    // If the container were still painted, the whole box would show behind it.
    expect(node().style.backgroundColor).toBe("transparent");
  });

  it("the line is not filled: it would be a bar", async () => {
    const { motor, node } = mount("line");
    await motor.renderSlots();
    expect(node().querySelector("path")!.getAttribute("fill")).toBe("none");
  });
});

describe("the points are the editor's", () => {
  it("the triangle is inset by 5%, not flush", async () => {
    // The player drew it as `50% 0%, 0% 100%, 100% 100%`.
    const { motor, node } = mount("triangle");
    await motor.renderSlots();
    expect(node().querySelector("polygon")!.getAttribute("points")).toBe("50,5 95,90 5,90");
  });

  it("and no `clip-path` is left at all", async () => {
    const { motor, node } = mount("star");
    await motor.renderSlots();
    expect(node().style.clipPath || "").toBe("");
  });
});
