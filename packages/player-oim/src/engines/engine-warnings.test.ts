/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Whether the actionEvent comes out, and whether it does NOT come out when it should not.
 *
 * `compatibilidad.test.ts` pins the decision; this pins that the engine reports it,
 * across the three places and without breaking anything.
 *
 * Silence is checked with the same care as the actionEvent. Every `.oim` published to date
 * lacks `min_player`: if the actionEvent fired with them, it would be background noise from
 * day one and nobody would read it when it mattered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function montar() {
  const host = document.createElement("div");
  (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  return { host, motor: new ImageEngine(host as any) as any };
}

let avisos: string[];
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, "warn").mockImplementation((m: any) => { avisos.push(String(m)); });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("cuando el archivo pide algo que este player no tiene", () => {
  it("lo dice por consola", () => {
    const { motor } = montar();
    motor._announceUnsupported({ capabilities: ["physics_2d"] });
    expect(avisos.join(" ")).toContain("physics_2d");
  });

  it("lo deja en el anfitrion, para quien mira el DOM", () => {
    const { host, motor } = montar();
    motor._announceUnsupported({ capabilities: ["physics_2d", "path_morph"] });
    expect(host.getAttribute("data-oim-sin-soporte")).toBe("path_morph physics_2d");
  });

  it("y lo emite, para quien incrusta el player", () => {
    const { host, motor } = montar();
    let recibido: any = null;
    host.addEventListener("oim:incomplete", (e: any) => { recibido = e.detail; });
    motor._announceUnsupported({ min_player: "9.0.0" });
    expect(recibido?.requiredVersion).toBe("9.0.0");
    expect(recibido?.versionTooOld).toBe(true);
  });

  it("marca la version exigida por separado de las capabilities", () => {
    const { host, motor } = montar();
    motor._announceUnsupported({ min_player: "9.0.0" });
    expect(host.getAttribute("data-oim-version-exigida")).toBe("9.0.0");
    expect(host.getAttribute("data-oim-sin-soporte")).toBeNull();
    expect(host.getAttribute("data-oim-requeridas-faltantes")).toBeNull();
  });

  it("marca las capacidades requeridas faltantes y emite oim:unsupported", () => {
    const { host, motor } = montar();
    let unsupportedEvent: any = null;
    let incompleteEvent: any = null;
    host.addEventListener("oim:unsupported", (e: any) => { unsupportedEvent = e.detail; });
    host.addEventListener("oim:incomplete", (e: any) => { incompleteEvent = e.detail; });

    motor._announceUnsupported({
      capabilities: ["vector_parallax"],
      capabilities_required: ["physics_2d"],
    });

    expect(host.getAttribute("data-oim-requeridas-faltantes")).toBe("physics_2d");
    expect(host.getAttribute("data-oim-sin-soporte")).toBeNull();
    expect(incompleteEvent).not.toBeNull();
    expect(unsupportedEvent?.cannotRender).toBe(true);
    expect(unsupportedEvent?.missingRequiredCapabilities).toEqual(["physics_2d"]);
  });
});

describe("cuando no hay nada que decir", () => {
  it.each([
    ["un archivo de los de hoy, sin min_player", { slots: [] }],
    ["una capacidad que si se implementa", { capabilities: ["vector_parallax"] }],
    ["una version anterior", { min_player: "0.9.0" }],
  ])("calla ante %s", (_n, metadata) => {
    const { host, motor } = montar();
    motor._announceUnsupported(metadata);
    expect(avisos).toEqual([]);
    expect(host.getAttribute("data-oim-sin-soporte")).toBeNull();
  });
});

describe("avisar nunca puede ser lo que rompa la carga", () => {
  it.each([null, undefined, 7, "text", { capabilities: "no es lista" }])(
    "aguanta unos metadatos %p",
    (metadata) => {
      const { motor } = montar();
      expect(() => motor._announceUnsupported(metadata)).not.toThrow();
    },
  );
});

/**
 * STRUCTURAL check, and it says so so as not to exaggerate what it proves.
 *
 * There are two load paths (one through a worker and one on the main thread), and which
 * one is taken is decided by the browser. An actionEvent wired into only one of them
 * appears or not depending on where the file is opened, which is worse than not having it:
 * the problem seems to come and go. Mounting both paths here would require a worker and a
 * signed `.oim`; this at least pins that neither is left without it.
 */
describe("los dos caminos de carga lo cuentan", () => {
  it("hay una llamada en cada uno", () => {
    const fuente = readFileSync(join(__dirname, "ImageEngine.ts"), "utf8");
    const llamadas = fuente.split("self._announceUnsupported(").length - 1;
    expect(llamadas).toBe(2);
  });
});
