/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { dropShadowCss, shadowColorCss, shadowFollowsGlyphs } from "./shadow";

describe("dropShadowCss", () => {
  const casos: Array<[string, Record<string, unknown>, string]> = [
    ["todo a cero",
      { shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0, shadowColor: "#000000", shadowOpacity: 100 },
      "drop-shadow(0px 0px 0px rgba(0, 0, 0, 1))"],
    ["los valores por defecto, que es el caso comun",
      { shadowOffsetY: 4, shadowBlur: 8, shadowOpacity: 30 },
      "drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.3))"],
    ["color y opacidad propios",
      { shadowOffsetX: 4, shadowOffsetY: 8, shadowBlur: 12, shadowColor: "#EC4899", shadowOpacity: 50 },
      "drop-shadow(4px 8px 12px rgba(236, 72, 153, 0.5))"],
    ["desplazamientos negativos y opacidad cero",
      { shadowOffsetX: -6, shadowOffsetY: -2, shadowBlur: 50, shadowColor: "#F43F5E", shadowOpacity: 0 },
      "drop-shadow(-6px -2px 50px rgba(244, 63, 94, 0))"],
    ["color hex de 3 digitos",
      { shadowOffsetY: 4, shadowBlur: 8, shadowColor: "#abc", shadowOpacity: 33 },
      "drop-shadow(0px 4px 8px rgba(170, 187, 204, 0.33))"],
    ["opacidad decimal",
      { shadowOffsetY: 4, shadowBlur: 8, shadowColor: "#000000", shadowOpacity: 12.5 },
      "drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.125))"],
  ];

  it.each(casos)("%s", (_nombre, style, esperado) => {
    // The SAME table is in the editor (its own shadow test). If someone
    // changes one side, its test stays green and this only shows when the two
    // files are compared: it is weaker than the parallax lock, and this is accepted
    // on purpose because the rule is a single line.
    expect(dropShadowCss(style)).toBe(esperado);
  });

  it("espacio detras de cada coma, como el editor", () => {
    // `hexToRgba` in the engine composes `rgba(236,72,153,0.5)` without spaces. The
    // canonical format includes them.
    expect(dropShadowCss({ shadowColor: "#EC4899", shadowOpacity: 50 }))
      .toContain("rgba(236, 72, 153,");
  });

  it("una opacidad fuera de rango se acota", () => {
    expect(dropShadowCss({ shadowOpacity: 500 })).toContain(", 1))");
    expect(dropShadowCss({ shadowOpacity: -20 })).toContain(", 0))");
  });

  it("sin color, negro", () => {
    expect(dropShadowCss({ shadowOpacity: 100 })).toContain("rgba(0, 0, 0, 1)");
  });

  it("resuelve shadowColorRole con variable CSS", () => {
    expect(
      dropShadowCss({
        shadowOffsetX: 8,
        shadowOffsetY: 8,
        shadowBlur: 0,
        shadowColor: "#a3e635",
        shadowColorRole: "accent",
        shadowOpacity: 100,
      })
    ).toBe("drop-shadow(8px 8px 0px var(--oim-color-accent, var(--oim-palette-accent, rgba(163, 230, 53, 1))))");
  });

  it("keeps the opacity when a role replaces the colour", () => {
    expect(shadowColorCss({ shadowColor: "#000000", shadowColorRole: "accent", shadowOpacity: 30 })).toBe(
      "color-mix(in srgb, var(--oim-color-accent, var(--oim-palette-accent, rgba(0, 0, 0, 0.3))) 30%, transparent)"
    );
  });
});

/**
 * Which path the shadow of each slot type takes.
 *
 * The failure that motivated this, measured on a real eleven-layer `.oim`: the vector
 * had no shadow in the viewer. The data travelled fine (the six `shadow*` fields were
 * in the file and the slot had `shadowEnabled: true`), but `ImageEngine` decided
 * like this:
 *
 *     if (isGeoLike || isImageSlot)  -> drop-shadow
 *     else                           -> text-shadow
 *
 * `isGeoLike` lists `geo|shape|draw|filter|container` and **does not include
 * `svg`**, so the vector fell through to the `else` and received a `text-shadow`,
 * which paints nothing on an SVG: there are no glyphs to shadow.
 *
 * The condition is inverted: only TEXT goes through `text-shadow`, because it is the
 * only case where the shadow must follow the glyphs and not the silhouette. Everything
 * else goes through `drop-shadow`, which follows the alpha channel and is therefore correct
 * for anything that is painted.
 *
 * `isGeoLike` is not touched: it is used in NINE other places (geometry, fill,
 * shape drawing), and putting `svg` there would change all of them.
 */
describe('shadowFollowsGlyphs', () => {
  it('solo el text sigue los glifos', () => {
    expect(shadowFollowsGlyphs('text')).toBe(true);
  });

  /** The failure case: the vector has to go through the silhouette. */
  it.each(['svg', 'geo', 'shape', 'draw', 'image', 'container', 'filter', 'mask', 'group'])(
    '%s sigue la silueta',
    (tipo) => {
      expect(shadowFollowsGlyphs(tipo)).toBe(false);
    },
  );

  it('un tipo desconocido va por la silueta, no por los glifos', () => {
    // Erring toward drop-shadow is the safe choice: it follows the alpha channel, so it comes
    // out correct on anything. A text-shadow on something without glyphs paints
    // NOTHING, which is exactly the bug this fixes.
    expect(shadowFollowsGlyphs('inventado')).toBe(false);
    expect(shadowFollowsGlyphs(undefined)).toBe(false);
    expect(shadowFollowsGlyphs('')).toBe(false);
  });
});
