/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import { GENERATOR_CATALOG } from "./catalog.js";
import { renderGenerativeSVG } from "./index.js";
import type { GenerativeConfig } from "./types.js";

describe("Catalog & Engine Router (catalog.ts, index.ts)", () => {
  it("renders all entries in the generator catalog without throwing", () => {
    const canvas = { width: 900, height: 600 };

    for (const spec of GENERATOR_CATALOG) {
      const config: GenerativeConfig = {
        generatorId: spec.id,
        seed: 42,
        colors: {
          mode: "monochrome",
          stops: ["#3b82f6", "#0f172a"]
        }
      };
      const svg = renderGenerativeSVG(config, canvas);

      expect(svg).toContain("data:image/svg+xml");
      const decoded = decodeURIComponent(svg);
      expect(decoded).toContain('viewBox="0 0 900 601"'); // 600 + 1 bleed
    }
  });

  it("handles unknown generatorId with single console.warn and default fallback", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config: GenerativeConfig = {
      generatorId: "invalid-unknown-generator-id",
      seed: 42,
      colors: {
        mode: "monochrome",
        stops: ["#3b82f6", "#0f172a"]
      }
    };

    const svg1 = renderGenerativeSVG(config, { width: 800, height: 600 });
    const svg2 = renderGenerativeSVG(config, { width: 800, height: 600 });

    expect(svg1).toContain("data:image/svg+xml");
    expect(svg2).toContain("data:image/svg+xml");
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it.each(GENERATOR_CATALOG.map((g) => g.id))("%s se renderiza y produce contenido", (id) => {
    const svg = renderGenerativeSVG({ generatorId: id, seed: 7 }, { width: 400, height: 300 });
    expect(svg).toContain("data:image/svg+xml");
    // Un SVG "vacio" es el fallo silencioso de esta familia: no lanza, no pinta.
    expect(svg.length).toBeGreaterThan(400);
  });

  it("todos los ids son ASCII en kebab-case", () => {
    // El id se PERSISTE y se compara con `===` en getGeneratorSpec. Un caracter
    // acentuado tiene dos formas Unicode distintas -"retícula" ocupa 9 bytes en
    // NFC y 10 en NFD, y no son iguales como cadena-, asi que una capa que
    // normalice diferente convierte la busqueda en undefined y el motor cae al
    // fondo por defecto con un console.warn. Un fondo que cambia solo, sin error
    // visible: justo el fallo que este trabajo existe para eliminar.
    for (const g of GENERATOR_CATALOG) {
      expect(g.id, `id no valido: "${g.id}"`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("no hay ids repetidos", () => {
    // getGeneratorSpec devuelve el primero; un duplicado deja al segundo
    // inalcanzable y visible en la galeria.
    const ids = GENERATOR_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
