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
    // La MISMA tabla esta en el editor (`src/shadow.test.ts`). Si alguien
    // cambia un lado, su prueba sigue verde y solo se ve comparando los dos
    // ficheros: es mas debil que el candado del parallax, y esta asumido
    // a proposito porque la regla es una linea.
    expect(dropShadowCss(style)).toBe(esperado);
  });

  it("espacio detras de cada coma, como el editor", () => {
    // `hexToRgba` del motor compone `rgba(236,72,153,0.5)` sin espacios. El
    // formato canonico los lleva.
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
 * Por que camino va la sombra de cada tipo de slot.
 *
 * El fallo que motiva esto, medido el 26/08/2026 sobre un `.oim` real de once
 * capas: el vector no tenia sombra en el visor. Los datos viajaban bien —los
 * seis campos `shadow*` estaban en el archivo y el slot traia
 * `shadowEnabled: true`— pero `ImageEngine` decidia asi:
 *
 *     if (isGeoLike || isImageSlot)  -> drop-shadow
 *     else                           -> text-shadow
 *
 * `isGeoLike` enumera `geo|shape|draw|filter|container` y **no incluye
 * `svg`**, asi que el vector caia por el `else` y recibia un `text-shadow`,
 * que sobre un SVG no pinta nada: no hay glifos que sombrear.
 *
 * La condicion se invierte: solo el TEXTO va por `text-shadow`, porque es el
 * unico caso donde la sombra debe seguir los glifos y no la silueta. Todo lo
 * demas por `drop-shadow`, que sigue el canal alfa y por tanto es correcto
 * para cualquier cosa que se pinte.
 *
 * No se toca `isGeoLike`: se usa en NUEVE sitios mas —geometria, fill,
 * dibujo de formas— y meter `svg` ahi cambiaria todos.
 */
describe('shadowFollowsGlyphs', () => {
  it('solo el text sigue los glifos', () => {
    expect(shadowFollowsGlyphs('text')).toBe(true);
  });

  /** El caso del fallo: el vector tiene que ir por la silueta. */
  it.each(['svg', 'geo', 'shape', 'draw', 'image', 'container', 'filter', 'mask', 'group'])(
    '%s sigue la silueta',
    (tipo) => {
      expect(shadowFollowsGlyphs(tipo)).toBe(false);
    },
  );

  it('un tipo desconocido va por la silueta, no por los glifos', () => {
    // Pecar de drop-shadow es lo seguro: sigue el canal alfa, asi que sale
    // correcto sobre cualquier cosa. Un text-shadow sobre algo sin glifos no
    // pinta NADA, que es justo el fallo que esto arregla.
    expect(shadowFollowsGlyphs('inventado')).toBe(false);
    expect(shadowFollowsGlyphs(undefined)).toBe(false);
    expect(shadowFollowsGlyphs('')).toBe(false);
  });
});
