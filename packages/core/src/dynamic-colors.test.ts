/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { isValidDynamicColorRole, isSafeCssColor, resolveCssColor, resolvePalette, DYNAMIC_COLOR_ROLES } from "./dynamic-colors.js";

describe("dynamic-colors (Core)", () => {
  it("recognizes all 12 official roles in the allowlist", () => {
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

  it("resolves CSS variables when the role is valid and there is a fallback", () => {
    expect(resolveCssColor("accent", "#2563EB")).toBe("var(--oim-color-accent, var(--oim-palette-accent, #2563EB))");
    expect(resolveCssColor("primary", "rgba(37, 99, 235, 0.15)")).toBe("var(--oim-color-primary, var(--oim-palette-primary, rgba(37, 99, 235, 0.15)))");
  });

  it("resolves CSS variables when the role is valid and there is NO fallback", () => {
    expect(resolveCssColor("surface", undefined)).toBe("var(--oim-color-surface, var(--oim-palette-surface))");
    expect(resolveCssColor("outline", "")).toBe("var(--oim-color-outline, var(--oim-palette-outline))");
  });

  it("returns the direct fallback color if the role is invalid or undefined", () => {
    expect(resolveCssColor(undefined, "#FF0000")).toBe("#FF0000");
    expect(resolveCssColor("non-existent", "#00FF00")).toBe("#00FF00");
    expect(resolveCssColor(null, "#0000FF")).toBe("#0000FF");
    expect(resolveCssColor(undefined, undefined)).toBe("");
  });
});

describe("isSafeCssColor — allowlist of colors in the file", () => {
  // The FOUR forms that really exist in the 19 real projects
  // (391 measured values): 343 six-digit hex, 20 var(), 16 rgb/rgba, 12 transparent.
  it("accepts what real projects produce", () => {
    for (const v of ["#06B6D4", "#FFF", "#18181Bff",
                     "rgba(139, 92, 246, 0.15)", "rgb(37,99,235)",
                     "hsl(210 40% 96%)",
                     "transparent", "currentColor",
                     "var(--primary)", "var(--oim-color-accent)",
                     "var(--oim-color-accent, #2563EB)"]) {
      expect(isSafeCssColor(v), v).toBe(true);
    }
  });

  it("rejects the injection that would open the viewer to a third party", () => {
    //     // This payload, pasted into a `style` attribute, is parsed as TWO
    //     // declarations and requests a resource from a foreign server.
    expect(isSafeCssColor("red; background-image: url(https://tercero/baliza)")).toBe(false);
    expect(isSafeCssColor("#fff; background: url(//evil)")).toBe(false);
    expect(isSafeCssColor("url(https://tercero/x)")).toBe(false);
    expect(isSafeCssColor("expression(alert(1))")).toBe(false);
    expect(isSafeCssColor("#fff /* } body{display:none} */")).toBe(false);
    expect(isSafeCssColor('#fff" onload="x')).toBe(false);
  });

  it("validates the var() fallback recursively: that is where the danger lives", () => {
    expect(isSafeCssColor("var(--x, #2563EB)")).toBe(true);
    expect(isSafeCssColor("var(--x, red; background: url(//evil))")).toBe(false);
    expect(isSafeCssColor("var(--x, var(--y, #fff))")).toBe(true);
    expect(isSafeCssColor("var(--x, var(--y, url(//evil)))")).toBe(false);
  });

  it("cuts off unbounded nested var() calls and oversized strings", () => {
    expect(isSafeCssColor("var(--a, ".repeat(9) + "#fff" + ")".repeat(9))).toBe(false);
    expect(isSafeCssColor("#" + "a".repeat(200))).toBe(false);
  });

  it("rejects what is not a string", () => {
    for (const v of [null, undefined, 42, {}, [], true]) {
      expect(isSafeCssColor(v as unknown)).toBe(false);
    }
  });
});

describe("resolveCssColor DESCARTA el color invalido", () => {
  it("without a role, a malicious color never reaches the renderer", () => {
    expect(resolveCssColor(undefined, "red; background-image: url(//evil)")).toBe("");
  });

  it("with a valid role, it does not enter the var() fallback either", () => {
    //     // The variable is kept (it is useful) and the poisoned fallback is discarded.
    expect(resolveCssColor("accent", "red; background: url(//evil)"))
      .toBe("var(--oim-color-accent, var(--oim-palette-accent))");
  });

  it("the legitimate path does not change", () => {
    expect(resolveCssColor("accent", "rgba(37, 99, 235, 0.15)"))
      .toBe("var(--oim-color-accent, var(--oim-palette-accent, rgba(37, 99, 235, 0.15)))");
    expect(resolveCssColor(undefined, "#2563EB")).toBe("#2563EB");
  });
});

describe("resolveCssColor with named palettes (1.20.0)", () => {
  it("the text role goes through the palette and then to the fixed color", () => {
    expect(resolveCssColor("text-primary", "#111")).toBe("var(--oim-color-text-primary, var(--oim-palette-text-primary, #111))");
  });

  it("without a fallback, the palette stays as the fallback", () => {
    expect(resolveCssColor("text-muted")).toBe("var(--oim-color-text-muted, var(--oim-palette-text-muted))");
  });

  it("an invalid role still returns only the fixed color", () => {
    expect(resolveCssColor("nope", "#111")).toBe("#111");
  });

  it("the nested result is still a safe color", () => {
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

  it("a requested palette that exists wins", () => {
    expect(resolvePalette(doc, { requested: "dark", prefersDark: false })).toEqual({
      name: "dark",
      colors: { primary: "#0A0A0A", "text-primary": "#FFFFFF" },
    });
  });

  it("a requested palette that does not exist is ignored", () => {
    expect(resolvePalette(doc, { requested: "neon", prefersDark: true })?.name).toBe("dark");
  });

  it("with dark and light, prefersDark chooses which one", () => {
    expect(resolvePalette(doc, { prefersDark: true })?.name).toBe("dark");
    expect(resolvePalette(doc, { prefersDark: false })?.name).toBe("light");
  });

  it("prefersDark only chooses when dark AND light both exist; if one is missing, it falls back to defaultPalette", () => {
    expect(resolvePalette({ palettes: { dark: { primary: "#000" } }, defaultPalette: "light" }, { prefersDark: true })).toBeNull();
  });

  it("without prefersDark, uses defaultPalette", () => {
    expect(resolvePalette(doc)?.name).toBe("light");
    expect(resolvePalette(doc, { prefersDark: undefined })?.name).toBe("light");
  });

  it("a defaultPalette that does not exist gives null", () => {
    expect(resolvePalette({ palettes: { dark: {} }, defaultPalette: "light" })).toBeNull();
  });

  it("without palettes gives null", () => {
    expect(resolvePalette({})).toBeNull();
  });

  it("an invalid color is discarded and the rest of the palette is kept", () => {
    const r = resolvePalette({
      palettes: { bad: { primary: "red; background: url(//evil)", accent: "#2563EB", "no-rol": "#000" } },
      defaultPalette: "bad",
    });
    expect(r?.colors).toEqual({ accent: "#2563EB" });
  });
});
