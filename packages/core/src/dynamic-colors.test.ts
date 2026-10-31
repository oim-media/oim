/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { isValidDynamicColorRole, isSafeCssColor, resolveCssColor, resolvePalette, DYNAMIC_COLOR_ROLES } from "./dynamic-colors.js";

describe("dynamic-colors (Core)", () => {
  it("reconoce todos los 12 roles oficiales de la lista blanca", () => {
    expect(DYNAMIC_COLOR_ROLES).toHaveLength(12);
    expect(DYNAMIC_COLOR_ROLES).toContain("text-primary");
    expect(DYNAMIC_COLOR_ROLES).toContain("text-on-accent");
    for (const role of DYNAMIC_COLOR_ROLES) {
      expect(isValidDynamicColorRole(role)).toBe(true);
    }
  });

  it("rechaza roles invalidos o peligrosos", () => {
    expect(isValidDynamicColorRole("malicious-role")).toBe(false);
    expect(isValidDynamicColorRole("")).toBe(false);
    expect(isValidDynamicColorRole(null)).toBe(false);
    expect(isValidDynamicColorRole(undefined)).toBe(false);
    expect(isValidDynamicColorRole(123)).toBe(false);
    expect(isValidDynamicColorRole("var(--danger)")).toBe(false);
  });

  it("resuelve variables CSS cuando el rol es valido y hay fallback", () => {
    expect(resolveCssColor("accent", "#2563EB")).toBe("var(--oim-color-accent, var(--oim-palette-accent, #2563EB))");
    expect(resolveCssColor("primary", "rgba(37, 99, 235, 0.15)")).toBe("var(--oim-color-primary, var(--oim-palette-primary, rgba(37, 99, 235, 0.15)))");
  });

  it("resuelve variables CSS cuando el rol es valido y NO hay fallback", () => {
    expect(resolveCssColor("surface", undefined)).toBe("var(--oim-color-surface, var(--oim-palette-surface))");
    expect(resolveCssColor("outline", "")).toBe("var(--oim-color-outline, var(--oim-palette-outline))");
  });

  it("devuelve el color directo de fallback si el rol no es valido o es undefined", () => {
    expect(resolveCssColor(undefined, "#FF0000")).toBe("#FF0000");
    expect(resolveCssColor("non-existent", "#00FF00")).toBe("#00FF00");
    expect(resolveCssColor(null, "#0000FF")).toBe("#0000FF");
    expect(resolveCssColor(undefined, undefined)).toBe("");
  });
});

describe("isSafeCssColor — lista blanca de colores del archivo", () => {
  // Las CUATRO formas que existen de verdad en los 19 proyectos reales
  // (391 valores medidos): 343 hex de 6, 20 var(), 16 rgb/rgba, 12 transparent.
  it("acepta lo que producen los proyectos reales", () => {
    for (const v of ["#06B6D4", "#FFF", "#18181Bff",
                     "rgba(139, 92, 246, 0.15)", "rgb(37,99,235)",
                     "hsl(210 40% 96%)",
                     "transparent", "currentColor",
                     "var(--primary)", "var(--oim-color-accent)",
                     "var(--oim-color-accent, #2563EB)"]) {
      expect(isSafeCssColor(v), v).toBe(true);
    }
  });

  it("rechaza la inyeccion que abria el visor a un tercero", () => {
    // Esta carga, pegada a un atributo `style`, se parsea como DOS
    // declaraciones y pide un recurso a un servidor ajeno.
    expect(isSafeCssColor("red; background-image: url(https://tercero/baliza)")).toBe(false);
    expect(isSafeCssColor("#fff; background: url(//evil)")).toBe(false);
    expect(isSafeCssColor("url(https://tercero/x)")).toBe(false);
    expect(isSafeCssColor("expression(alert(1))")).toBe(false);
    expect(isSafeCssColor("#fff /* } body{display:none} */")).toBe(false);
    expect(isSafeCssColor('#fff" onload="x')).toBe(false);
  });

  it("valida el respaldo de var() de forma recursiva: ahi vive el peligro", () => {
    expect(isSafeCssColor("var(--x, #2563EB)")).toBe(true);
    expect(isSafeCssColor("var(--x, red; background: url(//evil))")).toBe(false);
    expect(isSafeCssColor("var(--x, var(--y, #fff))")).toBe(true);
    expect(isSafeCssColor("var(--x, var(--y, url(//evil)))")).toBe(false);
  });

  it("corta los var() anidados sin fondo y las cadenas enormes", () => {
    expect(isSafeCssColor("var(--a, ".repeat(9) + "#fff" + ")".repeat(9))).toBe(false);
    expect(isSafeCssColor("#" + "a".repeat(200))).toBe(false);
  });

  it("rechaza lo que no es una cadena", () => {
    for (const v of [null, undefined, 42, {}, [], true]) {
      expect(isSafeCssColor(v as unknown)).toBe(false);
    }
  });
});

describe("resolveCssColor DESCARTA el color invalido", () => {
  it("sin rol, un color malicioso no sale al renderizador", () => {
    expect(resolveCssColor(undefined, "red; background-image: url(//evil)")).toBe("");
  });

  it("con rol valido, tampoco entra en el respaldo del var()", () => {
    // Se conserva la variable -util- y se tira el respaldo envenenado.
    expect(resolveCssColor("accent", "red; background: url(//evil)"))
      .toBe("var(--oim-color-accent, var(--oim-palette-accent))");
  });

  it("el camino legitimo no cambia", () => {
    expect(resolveCssColor("accent", "rgba(37, 99, 235, 0.15)"))
      .toBe("var(--oim-color-accent, var(--oim-palette-accent, rgba(37, 99, 235, 0.15)))");
    expect(resolveCssColor(undefined, "#2563EB")).toBe("#2563EB");
  });
});

describe("resolveCssColor con paletas con nombre (1.20.0)", () => {
  it("el rol de texto pasa por la paleta y luego al fijo", () => {
    expect(resolveCssColor("text-primary", "#111")).toBe("var(--oim-color-text-primary, var(--oim-palette-text-primary, #111))");
  });

  it("sin fallback, la paleta se queda como respaldo", () => {
    expect(resolveCssColor("text-muted")).toBe("var(--oim-color-text-muted, var(--oim-palette-text-muted))");
  });

  it("un rol invalido sigue devolviendo solo el fijo", () => {
    expect(resolveCssColor("nope", "#111")).toBe("#111");
  });

  it("el resultado anidado sigue siendo un color seguro", () => {
    expect(isSafeCssColor(resolveCssColor("text-primary", "#111"))).toBe(true);
    expect(isSafeCssColor(resolveCssColor("text-primary"))).toBe(true);
  });
});

describe("resolvePalette", () => {
  const doc = {
    palettes: {
      dark: { primary: "#0A0A0A", "text-primary": "#FFFFFF" },
      light: { primary: "#FFFFFF", "text-primary": "#111111" },
    },
    defaultPalette: "light",
  };

  it("una paleta pedida y existente gana", () => {
    expect(resolvePalette(doc, { requested: "dark", prefersDark: false })).toEqual({
      name: "dark",
      colors: { primary: "#0A0A0A", "text-primary": "#FFFFFF" },
    });
  });

  it("una paleta pedida inexistente se ignora", () => {
    expect(resolvePalette(doc, { requested: "neon", prefersDark: true })?.name).toBe("dark");
  });

  it("con dark y light, prefersDark elige cual", () => {
    expect(resolvePalette(doc, { prefersDark: true })?.name).toBe("dark");
    expect(resolvePalette(doc, { prefersDark: false })?.name).toBe("light");
  });

  it("prefersDark solo elige si existen dark Y light; si falta una, cae a defaultPalette", () => {
    expect(resolvePalette({ palettes: { dark: { primary: "#000" } }, defaultPalette: "light" }, { prefersDark: true })).toBeNull();
  });

  it("sin prefersDark, usa defaultPalette", () => {
    expect(resolvePalette(doc)?.name).toBe("light");
    expect(resolvePalette(doc, { prefersDark: undefined })?.name).toBe("light");
  });

  it("defaultPalette que no existe da null", () => {
    expect(resolvePalette({ palettes: { dark: {} }, defaultPalette: "light" })).toBeNull();
  });

  it("sin paletas da null", () => {
    expect(resolvePalette({})).toBeNull();
  });

  it("un color invalido se descarta y el resto de la paleta se mantiene", () => {
    const r = resolvePalette({
      palettes: { mala: { primary: "red; background: url(//evil)", accent: "#2563EB", "no-rol": "#000" } },
      defaultPalette: "mala",
    });
    expect(r?.colors).toEqual({ accent: "#2563EB" });
  });
});
