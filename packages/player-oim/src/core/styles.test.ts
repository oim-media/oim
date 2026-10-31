/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el factor de ajuste y la scale de una forma NO compartan nombre.
 *
 * El fallo, medido el 26/08/2026 sobre un `.oim` real: una forma declarada de
 * 140 px se pintaba a 90 en vez de a 112. Todos los slots salian un 20 % mas
 * pequenos. Las posiciones eran correctas — solo el size.
 *
 * `--oim-scale` significaba dos cosas a la vez:
 *
 *   - en `ImageEngine` linea 766, el **factor de ajuste** del documento a la
 *     caja del anfitrion, puesto sobre el visor;
 *   - en la linea 2272, la **scale propia** de una forma, puesta sobre su
 *     elemento.
 *
 * Y aqui entra la particularidad de CSS que lo vuelve invisible:
 * `var(--x, 1)` **no** significa «1 si nadie le dio valor a esta caja», sino
 * «1 si esa variable no existe en toda la cadena». Como el visor la definia
 * tres niveles mas arriba, cada slot heredaba el factor de ajuste y lo
 * aplicaba en su propia transformada — encima del que ya aplicaba el overlay.
 * Dos veces 0,8 = 0,64.
 *
 * Un valor por defecto que la herencia puede robar. Por eso la regla no es
 * «poner `--oim-scale: 1` en mas sitios» —eso tapa la herencia caso por
 * caso— sino que los dos conceptos tengan nombres distintos.
 */

import { describe, it, expect } from "vitest";
import { getStylesText } from "./styles";

const css = getStylesText();

/**
 * La regla completa de un selector, para poder mirarla entera.
 *
 * Ancla en el PRINCIPIO de la regla, no en cualquier aparicion del selector:
 * `.oim-slot {` tambien esta dentro de
 * `.oim-player-viewport:not(.oim-viewport--ready) .oim-slot { … }`, y buscar
 * la subcadena devolvia esa. Es el mismo fallo que la regla que estas pruebas
 * vigilan, cometido en las pruebas.
 */
function regla(selector: string): string {
  // Se parte por `}` y se compara el selector ENTERO, no como subcadena.
  const encontrada = css
    .split("}")
    .map((trozo) => trozo + "}")
    .find((trozo) => {
      const llave = trozo.indexOf("{");
      return llave > -1 && trozo.slice(0, llave).trim() === selector;
    });
  expect(encontrada, `no encuentro la regla de ${selector}`).toBeTruthy();
  return encontrada as string;
}

describe("los dos escalados no comparten nombre", () => {
  it("el overlay scale con --oim-fit, que es el factor de ajuste", () => {
    const r = regla(".oim-layer-overlay");
    expect(r).toContain("scale(var(--oim-fit");
  });

  /**
   * La comprobacion que muerde. Si el overlay volviera a usar `--oim-scale`,
   * el valor viajaria por herencia hasta cada `.oim-slot` y se aplicaria dos
   * veces. Es exactamente el fallo que esto cierra.
   */
  it("el overlay NO define ni consume --oim-scale", () => {
    expect(regla(".oim-layer-overlay")).not.toContain("--oim-scale");
  });

  it("el slot scale con --oim-scale, que es la scale de la forma", () => {
    expect(regla(".oim-slot")).toContain("scale(var(--oim-scale, 1))");
  });

  it("el slot NO consume el factor de ajuste", () => {
    // Si lo consumiera volveria a multiplicar por lo que ya aplico el overlay.
    expect(regla(".oim-slot")).not.toContain("--oim-fit");
  });

  it("las variantes del slot mantienen la misma separacion", () => {
    // `:hover` compone sobre la scale de la forma; si colara el factor de
    // ajuste, el slot saltaria de size al pasar el raton. (La entrada por capa
    // que tambien se comprobaba aqui ya no existe: el velo es la unica entrada.)
    for (const sel of [".oim-slot:hover"]) {
      expect(regla(sel)).toContain("--oim-scale");
      expect(regla(sel)).not.toContain("--oim-fit");
    }
    expect(css).not.toContain("oimSlotFadeIn");
  });
});

/**
 * El overlay no promete cambios que no va a hacer.
 *
 * Llevaba `will-change: transform`, y la transformada NO se anima: lo dice el
 * propio motor en `ImageEngine.ts`, junto a la llamada que no hay que hacer
 * -«`--oim-fit` only needs updating when the container/viewport dimensions
 * change»-. Cambia al redimensionar y nada mas. La unica transicion declarada
 * sobre el overlay es la de `opacity`.
 *
 * `will-change` no es una optimizacion gratis: le pide al navegador que
 * mantenga el elemento en su propia capa de compositor de forma PERMANENTE.
 * El overlay mide el lienzo entero -1080x1920 por defecto-, o sea unos 8 MB de
 * memoria de GPU por reproductor, y el player se incrusta en paginas de
 * terceros que no eligieron pagarlo.
 *
 * Lo que esto NO arregla, y conviene dejarlo escrito para no volver a
 * sospechar de aqui: el pixelado de las letras con fill degradado. Se
 * comparo a mano -degradado con y sin `will-change`, y color plano con
 * `will-change`- y el que se ve limpio es el de COLOR PLANO, que lleva
 * `will-change` puesto. La causa esta en `fill.ts`: un text con fill
 * degradado, generativo o de patron se pinta con `background-clip: text`, o
 * sea como una mascara, y una mascara se rasteriza sin saber que sus bordes
 * son contornos de letra.
 */
describe("el overlay no pide capa de compositor permanente", () => {
  it("no declara will-change", () => {
    expect(regla(".oim-layer-overlay")).not.toContain("will-change");
  });

  it("y sigue escalando con el factor de ajuste", () => {
    // Que quitar `will-change` no se lleve por delante la transformada.
    expect(regla(".oim-layer-overlay")).toContain("scale(var(--oim-fit");
  });
});
