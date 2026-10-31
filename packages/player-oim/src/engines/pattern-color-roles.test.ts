/**
 * @vitest-environment jsdom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine.js";
import { getStylesText } from "../core/styles.js";

function montar(slots: any[]) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 1000, height: 1000 };
  return { host, motor, shadow };
}

describe("pattern color roles in ImageEngine", () => {
  it("aplica variable CSS semántica de fondo y SVG dual-color cuando background-pattern-slot declara roles", async () => {
    const slot = {
      id: "background-pattern-slot",
      name: "Fondo Animado",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundPatternType: "dots",
        backgroundPatternColor: "#a3e635",
        backgroundPatternColorRole: "accent",
        backgroundPatternBgColor: "#111315",
        backgroundPatternBgColorRole: "primary",
        backgroundPatternSpeed: 2,
        backgroundPatternDirection: "up",
        svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="100%" height="100%" fill="#111315"/><circle cx="10" cy="10" r="4" fill="#a3e635"/></svg>'
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    // Checks that background-color uses resolveCssColor for the background role (NOT the foreground icon role!)
    expect(slotEl.style.backgroundColor).toContain("var(--oim-color-primary");
    // The foreground is tinted in CSS on ::before, so it follows the variable at once.
    expect(slotEl.classList.contains("oim-pat-dyn")).toBe(true);
    expect(slotEl.style.getPropertyValue("--oim-pat-fg")).toContain("var(--oim-color-accent");
    expect(slotEl.style.getPropertyValue("--oim-pat-mask")).toContain("url(");
    expect(slotEl.style.backgroundImage).toBe("none");
    expect(slotEl.style.animation).toBe("background-animation-up 2s linear infinite");
  });

  it("usa backgroundImage sin máscara cuando no hay rol semántico", async () => {
    const slot = {
      id: "background-pattern-slot",
      name: "Fondo Fijo",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundPatternType: "dots",
        backgroundPatternColor: "#a3e635",
        backgroundPatternBgColor: "#111315",
        backgroundPatternSpeed: 3,
        backgroundPatternDirection: "right",
        svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="4" fill="#a3e635"/></svg>'
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.backgroundImage).toContain("url(");
    expect(slotEl.style.webkitMaskImage || (slotEl.style as any).maskImage || "").toBe("");
    expect(slotEl.style.animation).toBe("background-animation-right 3s linear infinite");
  });

  it("soporta fillPatternColorRole y fillPatternBgColorRole como alias en background-pattern-slot", async () => {
    const slot = {
      id: "background-pattern-slot",
      name: "Fondo Animado",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        fillPatternColor: "#f59e0b",
        fillPatternColorRole: "accent",
        fillPatternBgColor: "#0f172a",
        fillPatternBgColorRole: "primary",
        backgroundPatternSpeed: 5,
        backgroundPatternDirection: "left",
        svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#0f172a"/><rect width="10" height="10" fill="#f59e0b"/></svg>'
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.backgroundColor).toContain("var(--oim-color-primary");
    expect(slotEl.style.getPropertyValue("--oim-pat-fg")).toContain("var(--oim-color-accent");
  });

  it("aplica cover al fondo cuando fitMode es cover", async () => {
    const slot = {
      id: "background-pattern-slot",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundFit: "cover",
        backgroundPatternColorRole: "secondary",
        backgroundPatternColor: "#ec4899",
        svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0h20v20H0z"/></svg>'
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.backgroundSize).toBe("cover");
    expect(slotEl.style.backgroundRepeat).toBe("no-repeat");
  });

  it("las animaciones de fondo animan tanto background-position como mask-position", () => {
    const css = getStylesText();
    expect(css).toContain("@keyframes background-animation-right");
    expect(css).toContain("-webkit-mask-position");
    expect(css).toContain("mask-position");
    expect(css).toContain("-webkit-mask-size");
    expect(css).toContain("mask-size");
  });

  it("actualiza backgroundImage y backgroundColor al cambiar de paleta con aplicarPaleta", async () => {
    const slot = {
      id: "background-pattern-slot",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundPatternType: "dots",
        backgroundPatternColor: "#111111",
        backgroundPatternColorRole: "accent",
        backgroundPatternBgColor: "#222222",
        backgroundPatternBgColorRole: "primary",
        svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="100%" height="100%" fill="#222222"/><circle cx="10" cy="10" r="4" fill="#111111"/></svg>'
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    motor.metadata = {
      slots: [slot],
      width: 1000,
      height: 1000,
      palettes: {
        noche: { primary: "#000000", accent: "#00ff00" }
      },
      defaultPalette: "noche"
    };
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    // The palette reaches the pattern through the variables aplicarPaleta writes.
    motor.aplicarPaleta();
    expect(motor._viewport.style.getPropertyValue("--oim-palette-accent")).toBe("#00ff00");
    expect(slotEl.style.getPropertyValue("--oim-pat-fg")).toContain("--oim-palette-accent");
    expect(slotEl.style.backgroundColor).toContain("--oim-palette-primary");
  });

  it("preserva la geometría exacta de svgRawXml (como rejilla 4x4 de puntos) sin re-aleatorizar", async () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#18181b"/><g transform="translate(20, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g><g transform="translate(60, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g><g transform="translate(100, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g><g transform="translate(140, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g></svg>';
    const slot = {
      id: "background-pattern-slot",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundPatternType: "dots",
        backgroundPatternColor: "#a3e635",
        backgroundPatternColorRole: "secondary",
        backgroundPatternBgColor: "#18181b",
        backgroundPatternBgColorRole: "primary",
        svgRawXml: rawSvg
      },
      is_background_pattern: true
    };

    const { host, motor, shadow } = montar([slot]);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    const decodedBg = decodeURIComponent(slotEl.style.getPropertyValue("--oim-pat-mask"));
    // The mask keeps the background out: only the shapes are opaque.
    expect(decodedBg).toContain('fill="transparent"');
    expect(decodedBg).not.toContain("#18181b");
    // Preserves the exact 4 dots coordinates and circles
    expect(decodedBg).toContain('translate(20, 20)');
    expect(decodedBg).toContain('translate(60, 20)');
    expect(decodedBg).toContain('translate(100, 20)');
    expect(decodedBg).toContain('translate(140, 20)');
    expect(decodedBg).toContain('cx="12" cy="12" r="6"');
  });

  it("tints the role colour of a multi-colour pattern in CSS and bakes only the fixed ones", async () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#18181b"/><g transform="translate(20, 20)" fill="#a3e635"><circle cx="12" cy="12" r="6"/></g><circle fill="#38bdf8"/></svg>';
    const slot = {
      id: "background-pattern-slot",
      type: "geo",
      position: [0, 0],
      style: {
        backgroundType: "pattern",
        backgroundPatternType: "dots",
        backgroundPatternColor: "#a3e635",
        backgroundPatternColorRole: "secondary",
        backgroundPatternColors: ["#a3e635", "#38bdf8"],
        backgroundPatternBgColor: "#18181b",
        svgRawXml: rawSvg
      },
      is_background_pattern: true
    };

    const m = montar([slot]);
    await m.motor.renderSlots();

    const slotEl = m.shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
    expect(slotEl.classList.contains("oim-pat-dyn")).toBe(true);
    expect(slotEl.style.getPropertyValue("--oim-pat-fg")).toContain("var(--oim-color-secondary");
    const mask = decodeURIComponent(slotEl.style.getPropertyValue("--oim-pat-mask"));
    expect(mask).toContain('translate(20, 20)');
    expect(mask).not.toContain('#38bdf8');
    const baked = decodeURIComponent(slotEl.style.backgroundImage);
    expect(baked).toContain('#38bdf8');
    expect(baked).not.toContain('#a3e635');
  });

  it("tints a pattern layer's colour role in CSS too", async () => {
    const slot = {
      id: "p1",
      type: "pattern",
      position: [10, 10],
      width_px: 200,
      height_px: 200,
      style: { fillPatternType: "dots", fillPatternColor: "#a3e635", fillPatternColorRole: "accent" }
    };
    const { motor, shadow } = montar([slot]);
    await motor.renderSlots();
    const el = shadow.querySelector('[data-slot-id="p1"]') as HTMLElement;
    expect(el.classList.contains("oim-pat-dyn")).toBe(true);
    expect(el.style.getPropertyValue("--oim-pat-fg")).toContain("var(--oim-color-accent");
  });
});
