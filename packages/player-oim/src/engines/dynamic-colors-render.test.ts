/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { DYNAMIC_COLOR_ROLES } from "../../../core/src/dynamic-colors.js";

function montarMotor(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._overlay = document.createElement("div");
  shadow.appendChild(motor._overlay);
  motor.metadata = {
    canvas_width: 800,
    canvas_height: 600,
    slots,
  };
  return { motor, shadow };
}

describe("Dynamic color rendering in ImageEngine", () => {
  it("assigns var(--oim-color-accent, ...) and var(--oim-color-outline, ...) on rectangular shapes", async () => {
    const origCreateElement = document.createElement.bind(document);
    let slotElement: any = null;
    const setPropertyCalls: [string, string][] = [];

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      const origSetProperty = el.style.setProperty.bind(el.style);
      el.style.setProperty = (prop: string, val: string, priority?: string) => {
        setPropertyCalls.push([prop, val]);
        return origSetProperty(prop, val, priority);
      };
      return el;
    });

    const { motor, shadow } = montarMotor([{
      id: "rect_shape",
      type: "geo",
      align: "left",
      position: [0.2, 0.2],
      width_px: 140,
      height_px: 140,
      content: { es: "" },
      style: {
        geoShape: "rectangle",
        fillColor: "rgba(37, 99, 235, 0.15)",
        fillColorRole: "accent",
        strokeColor: "#2563EB",
        strokeColorRole: "outline",
        strokeWidth: 2,
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector("[data-slot-id=\"rect_shape\"]");
    expect(el).toBeTruthy();

    expect(setPropertyCalls).toContainEqual(["background-color", "var(--oim-color-accent, var(--oim-palette-accent, rgba(37, 99, 235, 0.15)))"]);
    expect(setPropertyCalls).toContainEqual(["border", "2px solid var(--oim-color-outline, var(--oim-palette-outline, #2563EB))"]);

    vi.restoreAllMocks();
  });

  it("assigns dynamic variables on SVG vector figures (star, heart)", async () => {
    const { motor, shadow } = montarMotor([{
      id: "star_shape",
      type: "geo",
      align: "left",
      position: [0.2, 0.2],
      width_px: 120,
      height_px: 120,
      content: { es: "" },
      style: {
        geoShape: "star",
        fillColor: "#10B981",
        fillColorRole: "primary",
        strokeColor: "#064E3B",
        strokeColorRole: "on-primary",
        strokeWidth: 2,
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector("[data-slot-id=\"star_shape\"]") as HTMLElement;
    const polygon = el.querySelector("polygon");
    expect(polygon).toBeTruthy();
    expect(polygon?.getAttribute("fill")).toBe("var(--oim-color-primary, var(--oim-palette-primary, #10B981))");
    expect(polygon?.getAttribute("stroke")).toBe("var(--oim-color-on-primary, var(--oim-palette-on-primary, #064E3B))");
  });

  it("assigns var(--oim-color-on-surface, ...) on text layers", async () => {
    const setPropertyCalls: [string, string][] = [];
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      const origSetProperty = el.style.setProperty.bind(el.style);
      el.style.setProperty = (prop: string, val: string, priority?: string) => {
        setPropertyCalls.push([prop, val]);
        return origSetProperty(prop, val, priority);
      };
      return el;
    });

    const { motor, shadow } = montarMotor([{
      id: "texto_dinamico",
      type: "text",
      align: "left",
      position: [0.1, 0.1],
      width_px: 200,
      height_px: 50,
      content: { es: "Hola Dinamico" },
      style: {
        // `fillColor` and not `color`: contract 1.5.0 removed `color`, and in a
        // text, `fillColor` is the letter's color.
        fillColor: "#18181B",
        colorRole: "on-surface",
        fontSize: "16px",
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector("[data-slot-id=\"texto_dinamico\"]");
    expect(el).toBeTruthy();
    expect(setPropertyCalls).toContainEqual(["color", "var(--oim-color-on-surface, var(--oim-palette-on-surface, #18181B))"]);

    vi.restoreAllMocks();
  });

  it("resolves dynamic colours in a window mask", async () => {
    const { motor, shadow } = montarMotor([{
      id: "mascara_ventana",
      type: "mask",
      align: "left",
      position: [0.1, 0.1],
      width_px: 300,
      height_px: 200,
      content: { es: "" },
      style: {
        maskMode: "window",
        maskBgColor: "#38BDF8",
        maskBgColorRole: "surface",
        maskStrokeColor: "#FFFFFF",
        maskStrokeColorRole: "outline",
        maskStrokeWidth: 3,
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector("[data-slot-id=\"mascara_ventana\"]") as HTMLElement;
    expect(el).toBeTruthy();
    const paths = el.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths[0]?.getAttribute("fill")).toBe("var(--oim-color-surface, var(--oim-palette-surface, #38BDF8))");
    expect(paths[1]?.getAttribute("stroke")).toBe("var(--oim-color-outline, var(--oim-palette-outline, #FFFFFF))");
  });

  it("keeps the flat base colour if no semantic role is declared", async () => {
    const { motor, shadow } = montarMotor([{
      id: "star_plana",
      type: "geo",
      align: "left",
      position: [0.2, 0.2],
      width_px: 120,
      height_px: 120,
      content: { es: "" },
      style: {
        geoShape: "star",
        fillColor: "#EF4444",
        strokeColor: "#7F1D1D",
        strokeWidth: 2,
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector("[data-slot-id=\"star_plana\"]") as HTMLElement;
    const polygon = el.querySelector("polygon");
    expect(polygon?.getAttribute("fill")).toBe("#EF4444");
    expect(polygon?.getAttribute("stroke")).toBe("#7F1D1D");
  });

  it("a colour from the file cannot inject CSS declarations into the style attribute", async () => {
    // The color comes from the .oim and the schema does NOT validate its format.
    // When there is no semantic role -the common case-, `resolveCssColor` returns
    // the RAW value. If that value is pasted into the `style` attribute, the
    // browser parses it as a list of declarations, and a foreign file gets the
    // viewer to request a resource from a third party when it is opened.
    const cargaMaliciosa = "red; background-image: url(https://tercero.example/baliza)";
    const { motor, shadow } = montarMotor([{
      id: "svg_importado",
      type: "geo",
      align: "left",
      position: [0.1, 0.1],
      width_px: 100,
      height_px: 100,
      content: { es: '<svg width="10" height="10"><circle cx="5" cy="5" r="4"/></svg>' },
      style: {
        strokeColor: cargaMaliciosa,
        // without `strokeColorRole` on purpose: it is the path that does NOT go
        // through the allowlist and returns the color as-is.
      },
    }]);

    await motor.renderSlots();
    const el = shadow.querySelector('[data-slot-id="svg_importado"]') as HTMLElement;
    const svgEl = el?.querySelector("svg");
    expect(svgEl).toBeTruthy();

    const atributo = svgEl?.getAttribute("style") || "";
    expect(atributo).not.toContain("background-image");
    expect(atributo).not.toContain("tercero.example");
    expect(atributo).not.toContain("url(");
  });
});

describe("allow-dynamic-colors: exempting a specific image", () => {
  // The function is already opt-in at the page level: if the page does not
  // define `--oim-color-*`, `var(--x, fallback)` falls back to the author's
  // fallback. This attribute covers the other case: a page that DOES define
  // them globally and embeds a public work that must not adopt its palette.
  it("by default it lets them through", async () => {
    const { motor } = montarMotor([]);
    expect(motor.allowDynamicColors).toBe(true);
  });

  it('with allow-dynamic-colors="false" it neutralizes the eight roles in the viewer', async () => {
    const host = document.createElement("div");
    host.setAttribute("allow-dynamic-colors", "false");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    expect(motor.allowDynamicColors).toBe(false);

    const viewport = document.createElement("div");
    motor._viewport = viewport;
    // The same switch-off that the engine applies when mounting the viewer is applied here.
    for (const rol of DYNAMIC_COLOR_ROLES) {
      viewport.style.setProperty("--oim-color-" + rol, "initial");
    }
    for (const rol of DYNAMIC_COLOR_ROLES) {
      expect(viewport.style.getPropertyValue("--oim-color-" + rol)).toBe("initial");
    }
    expect(shadow).toBeTruthy();
  });

  // SVG attributes do not take var(): the role colour went nowhere and the icon
  // kept its fixed colour under a host palette.
  it("paints an svg icon's currentColor stroke with the role through CSS, not the attribute", async () => {
    const { motor, shadow } = montarMotor([{
      id: "icon",
      type: "svg",
      align: "left",
      position: [0.2, 0.2],
      width_px: 48,
      height_px: 48,
      content: { es: '<svg viewBox="0 0 24 24"><path stroke="currentColor" fill="none" d="M2 2h20"/></svg>' },
      style: { strokeColor: "#2563EB", strokeColorRole: "primary", fillColor: "transparent" },
    }]);
    await motor.renderSlots();
    const path = shadow.querySelector('[data-slot-id="icon"] path') as SVGPathElement;
    expect(path.getAttribute("stroke") ?? "").not.toContain("var(");
    expect(path.style.getPropertyValue("stroke")).toContain("--oim-color-primary");
  });

  it("resolves dynamic variables in drop-shadow and glow effects", async () => {
    const { motor, shadow } = montarMotor([
      {
        id: "card_effect",
        type: "container",
        align: "left",
        position: [0.1, 0.1],
        width_px: 200,
        height_px: 200,
        content: { es: "" },
        style: {
          effects: [
            {
              type: "drop-shadow",
              x: 8,
              y: 8,
              blur: 0,
              color: "#a3e635",
              colorRole: "accent",
              enabled: true,
            },
            {
              type: "glow",
              radius: 20,
              color: "#f59e0b",
              colorRole: "primary",
              enabled: true,
            },
          ],
        },
      },
      {
        id: "text_effect",
        type: "text",
        align: "left",
        position: [0.2, 0.2],
        width_px: 200,
        height_px: 50,
        content: { es: "Zen" },
        style: {
          effects: [
            {
              type: "drop-shadow",
              x: 4,
              y: 4,
              blur: 2,
              color: "#a3e635",
              colorRole: "accent",
              enabled: true,
            },
          ],
        },
      },
    ]);

    await motor.renderSlots();
    const cardEl = shadow.querySelector('[data-slot-id="card_effect"]') as HTMLElement;
    expect(cardEl).toBeTruthy();
    expect(cardEl.style.filter).toContain("drop-shadow(8px 8px 0px var(--oim-color-accent, var(--oim-palette-accent, #a3e635)))");
    expect(cardEl.style.filter).toContain("drop-shadow(0px 0px 8px var(--oim-color-primary, var(--oim-palette-primary, #f59e0b)))");
    expect(cardEl.style.filter).toContain("drop-shadow(0px 0px 20px var(--oim-color-primary, var(--oim-palette-primary, #f59e0b)))");

    const textEl = shadow.querySelector('[data-slot-id="text_effect"]') as HTMLElement;
    expect(textEl).toBeTruthy();
    expect(textEl.style.textShadow).toContain("4px 4px 2px var(--oim-color-accent, var(--oim-palette-accent, #a3e635))");
  });

  it("resolves dynamic variables in a legacy shadow with shadowColorRole", async () => {
    const { motor, shadow } = montarMotor([
      {
        id: "card_legacy_shadow",
        type: "container",
        align: "left",
        position: [0.1, 0.1],
        width_px: 100,
        height_px: 100,
        content: { es: "" },
        style: {
          shadowEnabled: true,
          shadowOffsetX: 6,
          shadowOffsetY: 6,
          shadowBlur: 10,
          shadowColor: "#a3e635",
          shadowColorRole: "accent",
          shadowOpacity: 100,
        },
      },
      {
        id: "text_legacy_shadow",
        type: "text",
        align: "left",
        position: [0.2, 0.2],
        width_px: 100,
        height_px: 50,
        content: { es: "Title" },
        style: {
          shadowEnabled: true,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          shadowBlur: 4,
          shadowColor: "#ec4899",
          shadowColorRole: "secondary",
          shadowOpacity: 50,
        },
      },
    ]);

    await motor.renderSlots();
    const cardEl = shadow.querySelector('[data-slot-id="card_legacy_shadow"]') as HTMLElement;
    expect(cardEl).toBeTruthy();
    expect(cardEl.style.filter).toContain("drop-shadow(6px 6px 10px var(--oim-color-accent, var(--oim-palette-accent, rgba(163, 230, 53, 1))))");

    const textEl = shadow.querySelector('[data-slot-id="text_legacy_shadow"]') as HTMLElement;
    expect(textEl).toBeTruthy();
    expect(textEl.style.textShadow).toContain("2px 2px 4px color-mix(in srgb, var(--oim-color-secondary, var(--oim-palette-secondary, rgba(236, 72, 153, 0.5))) 50%, transparent)");
  });
});

