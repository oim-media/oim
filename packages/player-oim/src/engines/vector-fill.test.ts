/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pattern and generative fills of vector layers (icons). Until 27 Sept the
 * player ignored them, and the editor painted them as a box behind the icon.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

// Harness copied from `geo-fill.test.ts`, with the SVG as the slot content.
async function slotDe(style: any, svg: string): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots: [{ id: "v", type: "svg", position: [10, 10], width_px: 100, height_px: 100, content: { default: svg }, style }], width: 800, height: 600 };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="v"]') as HTMLElement;
}

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20z" fill="none" stroke="#000" stroke-width="2"/></svg>`;
const GEN = { generatorId: "stacked-waves", seed: 1, params: {}, colors: { mode: "palette", stops: ["#f59e0b", "#7c3aed"], direction: "forward", background: "#000000", backgroundVisible: true } };
const capa = (el: HTMLElement) => el.querySelector(".oim-fill-layer") as HTMLElement | null;
const mascara = (c: HTMLElement) => (c.style as any).maskImage || (c.style as any).webkitMaskImage;

describe("relleno de patron o generativo en un vector", () => {
  it("generativo: capa de relleno recortada con la silueta del icono", async () => {
    const el = await slotDe({ fillType: "generative", fillGenerative: GEN }, ICON);
    const c = capa(el)!;
    expect(c).not.toBeNull();
    expect(c.style.backgroundImage).toMatch(/^url\("data:image\/svg\+xml/);
    // Built from the SVG as the player draws it (it normalises size and viewBox).
    const svg = decodeURIComponent(mascara(c));
    expect(svg).toContain('d="M2 2h20v20z"');
    expect(svg).toContain('fill="#000"');
  });

  it("patron: tambien, y el dibujo queda por encima de la capa", async () => {
    const el = await slotDe({ fillType: "pattern", fillPatternType: "clouds", fillPatternColor: "#ffffff", fillPatternBgColor: "#000000" }, ICON);
    const c = capa(el)!;
    expect(mascara(c)).toMatch(/^url\("data:image\/svg\+xml/);
    const dibujo = [...el.children].find((n) => n !== c && n.querySelector("svg")) as HTMLElement;
    expect(dibujo.style.position).toBe("relative");
  });

  it("un degradado no crea capa: viaja dentro del SVG", async () => {
    const el = await slotDe({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #000 0%, #fff 100%)" }, ICON);
    expect(capa(el)).toBeNull();
  });
});
