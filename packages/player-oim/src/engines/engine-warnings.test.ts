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

function mount() {
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

describe("when the file asks for something this player does not have", () => {
  it("says so on the console", () => {
    const { motor } = mount();
    motor._announceUnsupported({ capabilities: ["physics_2d"] });
    expect(avisos.join(" ")).toContain("physics_2d");
  });

  it("leaves it on the host, for whoever looks at the DOM", () => {
    const { host, motor } = mount();
    motor._announceUnsupported({ capabilities: ["physics_2d", "path_morph"] });
    expect(host.getAttribute("data-oim-sin-soporte")).toBe("path_morph physics_2d");
  });

  it("and emits it, for whoever embeds the player", () => {
    const { host, motor } = mount();
    let recibido: any = null;
    host.addEventListener("oim:incomplete", (e: any) => { recibido = e.detail; });
    motor._announceUnsupported({ min_player: "9.0.0" });
    expect(recibido?.requiredVersion).toBe("9.0.0");
    expect(recibido?.versionTooOld).toBe(true);
  });

  it("marks the version required separately from the capabilities", () => {
    const { host, motor } = mount();
    motor._announceUnsupported({ min_player: "9.0.0" });
    expect(host.getAttribute("data-oim-version-exigida")).toBe("9.0.0");
    expect(host.getAttribute("data-oim-sin-soporte")).toBeNull();
    expect(host.getAttribute("data-oim-requeridas-faltantes")).toBeNull();
  });

  it("marks the missing required capabilities and emits oim:unsupported", () => {
    const { host, motor } = mount();
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

describe("when there is nothing to say", () => {
  it.each([
    ["a file from today, without min_player", { slots: [] }],
    ["a capability that is implemented", { capabilities: ["vector_parallax"] }],
    ["an earlier version", { min_player: "0.9.0" }],
  ])("calla ante %s", (_n, metadata) => {
    const { host, motor } = mount();
    motor._announceUnsupported(metadata);
    expect(avisos).toEqual([]);
    expect(host.getAttribute("data-oim-sin-soporte")).toBeNull();
  });
});

describe("warning can never be what breaks the loading", () => {
  it.each([null, undefined, 7, "text", { capabilities: "no es lista" }])(
    "aguanta unos metadatos %p",
    (metadata) => {
      const { motor } = mount();
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
describe("both loading paths count it", () => {
  it("there is a call in each one", () => {
    const fuente = readFileSync(join(__dirname, "ImageEngine.ts"), "utf8");
    const llamadas = fuente.split("self._announceUnsupported(").length - 1;
    expect(llamadas).toBe(2);
  });
});
