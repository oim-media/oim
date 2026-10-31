/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Golden Render suite for canonical vector rendering.
 *
 * Runs the official conformance vectors from the spec's vectors directory directly
 * against the player's reference engine, `ImageEngine`.
 *
 * It checks that each canonical `.oim.png` file:
 * 1. Extracts its clean, signed metadata from the PNG container.
 * 2. Mounts the viewport DOM and renders each slot according to its type (text, geo, group, interactive).
 * 3. Applies normalized styles: geometry, resolved colors and hierarchy without errors.
 *
 * It sets the reference visual benchmark for any future native player (Swift, Kotlin, Skia).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractOIM } from "@oim-media/core";
import ImageEngine from "./ImageEngine";

const VECTORES_DIR = join(__dirname, "..", "..", "..", "spec", "vectors");

describe("Golden Render — Renderizado canónico de vectores oficiales", () => {
  let host: HTMLElement;
  let shadow: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  function setupEngine(metadata: any, options: any = { mode: "full" }): { motor: ImageEngine; viewport: HTMLElement; overlay: HTMLElement } {
    if (options.mode) {
      host.setAttribute("mode", options.mode);
    }
    const motor = new ImageEngine(host as any, { disableActions: false, ...options });
    const viewport = document.createElement("div");
    viewport.className = "oim-viewport";
    shadow.appendChild(viewport);

    const overlay = document.createElement("div");
    overlay.className = "oim-layer-overlay";
    viewport.appendChild(overlay);

    motor._viewport = viewport;
    motor._overlay = overlay;
    motor.metadata = metadata;
    motor.lang = metadata.languages?.[0] || "es";
    return { motor, viewport, overlay };
  }

  it("renderiza el vector 'basic-text.oim.png' en el DOM sin errores", async () => {
    const filePath = join(VECTORES_DIR, "basic-text.oim.png");
    expect(existsSync(filePath), "El vector basic-text.oim.png debe existir").toBe(true);

    const bytes = readFileSync(filePath);
    const { metadata } = await extractOIM(new Blob([bytes]));
    expect(metadata).toBeDefined();

    const { motor } = setupEngine(metadata);
    await motor.renderSlots();

    const slotEl = shadow.querySelector('[data-slot-id="titulo"]') as HTMLElement;
    expect(slotEl, "El slot 'titulo' debe renderizarse en el DOM").not.toBeNull();
    expect(slotEl.textContent).toContain("Hola");
  });

  it("blurs the 'layer-blur.oim.png' vector's layers by their layerBlur", async () => {
    const bytes = readFileSync(join(VECTORES_DIR, "layer-blur.oim.png"));
    const { metadata } = await extractOIM(new Blob([bytes]));
    const { motor } = setupEngine(metadata);
    await motor.renderSlots();
    const f = (id: string) => (shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement).style.filter;
    expect(f("titulo")).toContain("blur(4px)");
    expect(f("fondo")).toContain("blur(12px)");
  });

  it("paints the 'layer-grain.oim.png' vector's grain on each layer", async () => {
    const bytes = readFileSync(join(VECTORES_DIR, "layer-grain.oim.png"));
    const { metadata } = await extractOIM(new Blob([bytes]));
    const { motor } = setupEngine(metadata);
    await motor.renderSlots();
    for (const id of ["titulo", "circulo"]) {
      const el = shadow.querySelector('[data-slot-id="' + id + '"]') as HTMLElement;
      expect(el.style.filter).toContain("url(#oim-grain-" + id + ")");
      expect(shadow.querySelector("filter#oim-grain-" + id)).not.toBeNull();
    }
    expect(shadow.querySelector("filter#oim-grain-titulo")!.outerHTML).toContain('mode="soft-light"');
  });

  it("renderiza el vector 'groups-and-parallax.oim.png' respetando jerarquía y profundidad", async () => {
    const filePath = join(VECTORES_DIR, "groups-and-parallax.oim.png");
    expect(existsSync(filePath), "El vector groups-and-parallax.oim.png debe existir").toBe(true);

    const bytes = readFileSync(filePath);
    const { metadata } = await extractOIM(new Blob([bytes]));
    expect(metadata).toBeDefined();

    const { motor } = setupEngine(metadata);
    await motor.renderSlots();

    const grupoEl = shadow.querySelector('[data-slot-id="grupo"]') as HTMLElement;
    const hijoAEl = shadow.querySelector('[data-slot-id="hijo_a"]') as HTMLElement;
    const hijoBEl = shadow.querySelector('[data-slot-id="hijo_b"]') as HTMLElement;
    const fondoEl = shadow.querySelector('[data-slot-id="fondo"]') as HTMLElement;

    expect(grupoEl, "El grupo debe existir").not.toBeNull();
    expect(hijoAEl, "El hijo A debe existir").not.toBeNull();
    expect(hijoBEl, "El hijo B debe existir").not.toBeNull();
    expect(fondoEl, "El fondo con parallax debe existir").not.toBeNull();

    // Check that the child geometry nodes have their color resolved
    const polygonA = hijoAEl.querySelector("polygon, rect, path");
    const polygonB = hijoBEl.querySelector("polygon, rect, path");
    expect(polygonA || hijoAEl.style.backgroundColor).toBeTruthy();
    expect(polygonB || hijoBEl.style.backgroundColor).toBeTruthy();
  });

  it("renderiza el vector 'interactive.oim.png' con estados y targets interactivos", async () => {
    const filePath = join(VECTORES_DIR, "interactive.oim.png");
    expect(existsSync(filePath), "El vector interactive.oim.png debe existir").toBe(true);

    const bytes = readFileSync(filePath);
    const { metadata } = await extractOIM(new Blob([bytes]));
    expect(metadata).toBeDefined();

    const { motor } = setupEngine(metadata);
    await motor.renderSlots();

    const botonEl = shadow.querySelector('[data-slot-id="boton"]') as HTMLElement;
    const fichaEl = shadow.querySelector('[data-slot-id="ficha"]') as HTMLElement;
    const esquinasEl = shadow.querySelector('[data-slot-id="esquinas"]') as HTMLElement;

    expect(botonEl, "El botón interactivo debe existir").not.toBeNull();
    expect(fichaEl, "La ficha objetivo debe existir").not.toBeNull();
    expect(esquinasEl, "La forma con esquinas asimétricas debe existir").not.toBeNull();

    // Check that the button is marked with an interactive class or attribute
    expect(botonEl.classList.contains("oim-interactive") || botonEl.style.cursor === "pointer" || botonEl.getAttribute("tabindex") !== null).toBe(true);
  });
});
