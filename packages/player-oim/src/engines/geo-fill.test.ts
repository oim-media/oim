/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Complex fills of shapes. Before the fix, the player painted a geo slot with a
 * gradient, pattern or generative fill as its flat `fillColor`: the editor
 * showed the fill and the published file did not.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { shapeMaskCss } from "../../../core/src/fill.js";

// Harness copied from `pattern-layer.test.ts`.
async function slotDe(type: string, style: any): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots: [{ id: "g", type, position: [10, 10], width_px: 200, height_px: 100, content: {}, style }], width: 800, height: 600 };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="g"]') as HTMLElement;
}

const GRAD = "linear-gradient(90deg, #f59e0b 0%, #7c3aed 100%)";
const capaDeRelleno = (el: HTMLElement) => el.querySelector(".oim-fill-layer") as HTMLElement | null;

describe("the complex fills of a shape reach the player", () => {
  it("rectangle with gradient: the fill layer carries the gradient and the slot paints no flat colour", async () => {
    const el = await slotDe("geo", { fillType: "gradient", fillGradient: GRAD, fillColor: "#f59e0b", geoShape: "rectangle" });
    expect(capaDeRelleno(el)?.style.backgroundImage).toBe(GRAD);
    expect(el.style.backgroundColor).not.toBe("#f59e0b");
  });

  it("circle with gradient: gradient with the circle's mask, and the outline only draws the border", async () => {
    const el = await slotDe("geo", { fillType: "gradient", fillGradient: GRAD, fillColor: "#f59e0b", geoShape: "circle", strokeWidth: 3, strokeColor: "#111111" });
    const layerItem = capaDeRelleno(el)!;
    expect(layerItem.style.backgroundImage).toBe(GRAD);
    const mascara = (layerItem.style as any).maskImage || (layerItem.style as any).webkitMaskImage;
    expect(mascara).toBe((shapeMaskCss("circle") as any).maskImage);
    const figureItem = el.querySelector("path, polygon")!;
    expect(figureItem.getAttribute("fill")).toBe("none");
    expect(figureItem.getAttribute("stroke")).toBe("#111111");
  });

  it("a shape with a photo and an old palette role does not paint the role's colour behind the photo", async () => {
    // The editor paints a photo fill and ignores a stale fillColorRole. The player
    // must not set the role's palette colour as the slot background behind the photo.
    // happy-dom drops var() values, so the calls to setProperty are what is checked.
    const calls: [string, string][] = [];
    const origSet = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (this: CSSStyleDeclaration, prop: string, val: string, prio?: string) {
      calls.push([prop, val]);
      return origSet.call(this, prop, val, prio);
    };
    try {
      await slotDe("geo", { fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgo=", fillColorRole: "primary", fillColor: "#111111", geoShape: "rectangle" });
    } finally {
      CSSStyleDeclaration.prototype.setProperty = origSet;
    }
    expect(calls.filter(([p, v]) => p === "background-color" && v.includes("--oim-palette-"))).toEqual([]);
  });

  it("the fill layer goes BELOW the shape drawing", async () => {
    const el = await slotDe("geo", { fillType: "gradient", fillGradient: GRAD, geoShape: "star" });
    expect(el.firstElementChild?.classList.contains("oim-fill-layer")).toBe(true);
  });

  it("rectangle with pattern: tiles and moves", async () => {
    const el = await slotDe("geo", { fillType: "pattern", fillPatternType: "clouds", fillPatternColor: "#ffffff", fillPatternBgColor: "#000000", fillPatternSpeed: 5, fillPatternDirection: "right", geoShape: "rectangle" });
    const layerItem = capaDeRelleno(el)!;
    expect(layerItem.style.backgroundRepeat).toBe("repeat");
    expect(layerItem.style.animation).toContain("background-animation-right");
  });

  it("generative rectangle: the fill layer carries its image", async () => {
    const el = await slotDe("geo", { fillType: "generative", fillGenerative: { generatorId: "stacked-waves", seed: 1, params: {}, colors: { mode: "palette", stops: ["#f59e0b", "#7c3aed"], direction: "forward", background: "#000000", backgroundVisible: true } }, geoShape: "rectangle" });
    expect(capaDeRelleno(el)?.style.backgroundImage).toMatch(/^url\("data:image\/svg\+xml/);
  });

  it("a flat colour still works as always: no fill layer", async () => {
    const el = await slotDe("geo", { fillType: "color", fillColor: "#f59e0b", geoShape: "rectangle" });
    expect(capaDeRelleno(el)).toBeNull();
    expect(el.style.backgroundColor).toBe("#f59e0b");
  });

  it("a container still works as always: the fill on the slot itself", async () => {
    const el = await slotDe("container", { fillType: "gradient", fillGradient: GRAD });
    expect(capaDeRelleno(el)).toBeNull();
    expect(el.style.backgroundImage).toBe(GRAD);
  });
});

describe("the shape's drawing matches its fill layer", () => {
  // The SVG was a flex child placed after the empty `oim-slot-loop-wrap`, so it
  // sat a line lower than the slot box while the fill layer sat at the box: the
  // stroke ring and the gradient drifted apart (seen in the player).
  it("the border SVG is anchored to the slot's box, like the fill layer", async () => {
    const el = await slotDe("geo", { fillType: "gradient", fillGradient: GRAD, geoShape: "circle", strokeWidth: 3, strokeColor: "#111111" });
    const svg = el.querySelector("svg") as SVGSVGElement;
    expect(svg.style.position).toBe("absolute");
    expect(svg.style.top).toBe("0px");
    expect(svg.style.left).toBe("0px");
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
  });

  it("and also with a flat colour: the shape does not drop relative to the editor", async () => {
    const el = await slotDe("geo", { fillType: "color", fillColor: "#f59e0b", geoShape: "star" });
    expect((el.querySelector("svg") as SVGSVGElement).style.position).toBe("absolute");
  });
});

describe("phase B: the player's pattern fill carries its figures", () => {
  it("a shape with figures paints them in its fill layer", async () => {
    const el = await slotDe("geo", { fillType: "pattern", fillPatternType: "stars", fillPatternSvgs: ["🔥"], fillPatternColors: ["#FF0000"], fillPatternCounts: [1], fillPatternDispersions: [0], geoShape: "rectangle" });
    const bg = capaDeRelleno(el)!.style.backgroundImage;
    expect(decodeURIComponent(bg)).toContain("🔥");
  });
});
