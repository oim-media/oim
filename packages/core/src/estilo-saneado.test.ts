/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The style contract since 1.8.0: what it admits, and that its portable
 * patterns never admit more than the player paints safely.
 *
 * The runtime checks (`isSafeCssColor`, `isSafeCssGradient`) are functions;
 * JSON Schema can only carry a regex. Two definitions of the same rule drift
 * -it is what this repo keeps measuring-, so these tests hold the one
 * direction that matters: everything the contract accepts, the player accepts.
 */

import { describe, it, expect } from "vitest";
import { isSafeCssColor, CSS_COLOR_PATTERN } from "./dynamic-colors";
import { isSafeCssGradient } from "./css-gradient";
import { styleSchema, CSS_GRADIENT_PATTERN } from "./schema";

const COLOR = new RegExp(CSS_COLOR_PATTERN);
const GRADIENT = new RegExp(CSS_GRADIENT_PATTERN);

// Measured on 24 Sept 2026 over the real .oim files on disk, plus the shapes
// `resolveCssColor` writes for dynamic colours.
const COLORES_REALES = [
  "#f59e0b", "#FFF", "#00000080", "rgb(0, 0, 0)", "rgba(255,255,255,0.5)",
  "hsl(210 40% 50%)", "transparent", "none", "currentColor",
  "var(--primary)", "var(--text)", "var(--oim-color-accent, #f59e0b)",
  "var(--oim-color-accent, var(--brand))",
  "var(--a, var(--b, #000))",
];

const COLORES_HOSTILES = [
  "red; background-image: url(https://tercero.example/b)",
  "url(https://tercero.example/b)",
  "var(--x, url(https://tercero.example/b))",
  "rgb(0,0,0) /* x */",
  "expression(alert(1))",
  "#ggg",
  "var(x)",
  "",
];

const GRADIENTES_REALES = [
  "linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%)",
  "radial-gradient(circle 40px at 50% 50%, #000 0%, #fff 100%)",
  "radial-gradient(circle closest-side at 30% 70%, rgba(0, 0, 0, 0.5) 0%, transparent 100%)",
  "conic-gradient(from 45deg at 50% 50%, #ff0000 0%, #00ff00 50%, #0000ff 100%)",
  "linear-gradient(90deg, var(--oim-color-accent, #f59e0b) 0%, #000 100%)",
];

const GRADIENTES_HOSTILES = [
  "linear-gradient(red, blue), url(https://tercero.example/baliza)",
  "linear-gradient(red, url(https://tercero.example/b))",
  "linear-gradient(90deg, image-set(1x) 0%, #000 100%)",
  "url(https://tercero.example/b)",
  "linear-gradient(red, blue); color: red",
];

describe("colores del contrato 1.8.0", () => {
  it.each(COLORES_REALES)("el contrato y el player aceptan %s", (c) => {
    expect(COLOR.test(c)).toBe(true);
    expect(isSafeCssColor(c)).toBe(true);
  });

  it.each(COLORES_HOSTILES)("el contrato rechaza %s", (c) => {
    expect(COLOR.test(c)).toBe(false);
  });

  it("nada que acepte el contrato lo rechaza el player", () => {
    for (const c of [...COLORES_REALES, ...COLORES_HOSTILES]) {
      if (COLOR.test(c)) expect(isSafeCssColor(c), c).toBe(true);
    }
  });
});

describe("gradientes del contrato 1.8.0", () => {
  it.each(GRADIENTES_REALES)("el contrato y el player aceptan %s", (g) => {
    expect(GRADIENT.test(g)).toBe(true);
    expect(isSafeCssGradient(g)).toBe(true);
  });

  it.each(GRADIENTES_HOSTILES)("el contrato rechaza %s", (g) => {
    expect(GRADIENT.test(g)).toBe(false);
  });
});

describe("styleSchema 1.8.0 con valores del editor", () => {
  it("acepta un relleno completo tal como lo escribe el editor", () => {
    const r = styleSchema.safeParse({
      fillType: "generative",
      fillColor: "none",
      strokeColor: "var(--primary)",
      fillColorRole: "accent",
      fillGradient: "linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%)",
      fillGenerative: {
        generatorId: "blurry-gradient", seed: 7, params: { angle: 135 },
        colors: {
          mode: "palette", stops: ["#f59e0b", "#ec4899", "#7c3aed"],
          direction: "forward", background: "#0b1020", backgroundVisible: true,
        },
      },
      fillPatternType: "stars",
      fillPatternDirection: "right",
      fillPatternColors: ["#fff", "var(--oim-color-accent, #f59e0b)"],
      textGradientType: "none",
      textAnimationType: "wave-chars",
      cuts: [{ id: "c1", x: 0, y: 0, width: 10, height: 10, shape: "heart" }],
    });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it.each([
    ["un color con inyeccion", { strokeColor: "red; background: url(x)" }],
    ["un rol que el player no conoce", { fillColorRole: "brand" }],
    ["un patron que no existe", { fillPatternType: "kittens" }],
    ["la direccion del parallax en el patron", { fillPatternDirection: "left_to_right" }],
    ["un gradiente con segunda imagen", { fillGradient: "linear-gradient(red, blue), url(x)" }],
    ["un generativo sin forma", { fillGenerative: "blurry-gradient" }],
    ["un recorte sin silueta", { cuts: [{ id: "c", x: 0, y: 0, width: 1, height: 1 }] }],
  ])("rechaza %s", (_nombre, estilo) => {
    expect(styleSchema.safeParse(estilo).success).toBe(false);
  });
});

describe("styleSchema 1.9.0: sin CSS en crudo", () => {
  it("acepta el cssAnimation que escribe el editor", () => {
    for (const v of ["background-animation-right 8s linear infinite", "background-animation-zoom-in 2.5s linear infinite"]) {
      expect(styleSchema.safeParse({ cssAnimation: v }).success, v).toBe(true);
    }
  });

  it.each([
    "background-animation-right 8s linear infinite; background: url(https://x)",
    "spin 1s infinite",
    "background-animation-right 8s linear infinite, k 1s",
  ])("rechaza cssAnimation %s", (v) => {
    expect(styleSchema.safeParse({ cssAnimation: v }).success).toBe(false);
  });
});
