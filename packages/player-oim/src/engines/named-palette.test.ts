/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

const PALETTES = {
  dark: { primary: "#111111", "text-primary": "#eeeeee" },
  light: { primary: "#fafafa", "text-primary": "#222222" },
};

function motorCon(metadata: any, attrs: Record<string, string> = {}) {
  const host = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  motor.metadata = metadata;
  return { motor, viewport: motor._viewport as HTMLElement };
}

function simularOscuro(oscuro: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: oscuro, addEventListener() {}, removeEventListener() {} })));
}

afterEach(() => vi.unstubAllGlobals());

describe("paleta nombrada en el visor", () => {
  it("el atributo palette escribe --oim-palette-* con la paleta pedida", () => {
    simularOscuro(true);
    const { motor, viewport } = motorCon({ palettes: PALETTES }, { palette: "light" });
    motor.aplicarPaleta();
    expect(viewport.style.getPropertyValue("--oim-palette-primary")).toBe("#fafafa");
    expect(viewport.style.getPropertyValue("--oim-palette-text-primary")).toBe("#222222");
  });

  it("cambiar el atributo palette y reaplicar actualiza el visor", () => {
    simularOscuro(false);
    const { motor, viewport } = motorCon({ palettes: PALETTES }, { palette: "light" });
    motor.aplicarPaleta();
    motor.host.setAttribute("palette", "dark");
    motor.aplicarPaleta();
    expect(viewport.style.getPropertyValue("--oim-palette-primary")).toBe("#111111");
  });

  it("sin atributo, prefers-color-scheme oscuro elige dark", () => {
    simularOscuro(true);
    const { motor, viewport } = motorCon({ palettes: PALETTES });
    motor.aplicarPaleta();
    expect(viewport.style.getPropertyValue("--oim-palette-primary")).toBe("#111111");
  });

  it("sin atributo y con tema claro elige light", () => {
    simularOscuro(false);
    const { motor, viewport } = motorCon({ palettes: PALETTES });
    motor.aplicarPaleta();
    expect(viewport.style.getPropertyValue("--oim-palette-primary")).toBe("#fafafa");
  });

  it("allow-dynamic-colors=\"false\" no escribe ninguna --oim-palette-*", () => {
    simularOscuro(true);
    const { motor, viewport } = motorCon({ palettes: PALETTES }, { palette: "light", "allow-dynamic-colors": "false" });
    motor.allowDynamicColors = false;
    motor.aplicarPaleta();
    expect(viewport.getAttribute("style") ?? "").not.toContain("--oim-palette-");
  });

  it("un .oim sin palettes no escribe ninguna --oim-palette-*", () => {
    simularOscuro(true);
    const { motor, viewport } = motorCon({ slots: [] }, { palette: "dark" });
    motor.aplicarPaleta();
    expect(viewport.getAttribute("style") ?? "").not.toContain("--oim-palette-");
  });
});

describe("el elemento escucha prefers-color-scheme y lo suelta al desconectarse", () => {
  it("añade y retira el listener change", async () => {
    await import("../index");
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: add, removeEventListener: remove })));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    const el = document.createElement("oim-player");
    document.body.appendChild(el);
    expect(add).toHaveBeenCalledWith("change", expect.any(Function));
    const listener = add.mock.calls[0][1];
    el.remove();
    expect(remove).toHaveBeenCalledWith("change", listener);
  });
});

describe("la paleta por el elemento <oim-player> montado", () => {
  function montar(oscuroInicial: boolean) {
    const estado = { oscuro: oscuroInicial, listener: null as any };
    const mq = {
      get matches() { return estado.oscuro; },
      addEventListener: vi.fn((_t: string, f: any) => { estado.listener = f; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => mq));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    return { estado, mq };
  }

  async function elementoConMotor(oscuroInicial: boolean) {
    await import("../index");
    const { estado, mq } = montar(oscuroInicial);
    const el: any = document.createElement("oim-player");
    document.body.appendChild(el);
    const motor: any = new ImageEngine(el);
    motor._viewport = document.createElement("div");
    motor.metadata = { palettes: PALETTES };
    el._engine = motor;
    return { el, motor, estado, mq, color: () => motor._viewport.style.getPropertyValue("--oim-palette-primary") };
  }

  it("cambiar el atributo palette en el elemento actualiza el visor", async () => {
    const { el, color } = await elementoConMotor(false);
    el.setAttribute("palette", "light");
    expect(color()).toBe("#fafafa");
    el.setAttribute("palette", "dark");
    expect(color()).toBe("#111111");
    el.remove();
  });

  it("el listener de prefers-color-scheme cambia dark y light en vivo", async () => {
    const { el, estado, mq, color, motor } = await elementoConMotor(true);
    motor.aplicarPaleta();
    expect(color()).toBe("#111111");
    estado.oscuro = false;
    mq.addEventListener.mock.calls[0][1]();
    expect(color()).toBe("#fafafa");
    estado.oscuro = true;
    estado.listener();
    expect(color()).toBe("#111111");
    el.remove();
  });

  it("al desconectar el elemento se retira el mismo listener", async () => {
    const { el, mq } = await elementoConMotor(false);
    const listener = mq.addEventListener.mock.calls[0][1];
    el.remove();
    expect(mq.removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
