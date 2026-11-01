/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The fitting factor and a shape's scale must NOT share a name.
 *
 * The fault, measured on a real `.oim`: a shape declared at 140 px was painted
 * at 90 instead of 112. Every slot came out 20% smaller. The positions were
 * correct -only the size was wrong.
 *
 * `--oim-scale` meant two things at once:
 *
 *   - in `ImageEngine` line 766, the document's **fitting factor** to the
 *     host box, set on the viewer;
 *   - in line 2272, a shape's own **scale**, set on its element.
 *
 * And here is the CSS quirk that makes it invisible:
 * `var(--x, 1)` does **not** mean "1 if nobody gave this box a value", but
 * "1 if that variable does not exist anywhere in the chain". Since the viewer
 * defined it three levels up, every slot inherited the fitting factor and
 * applied it in its own transform -on top of the one the overlay already applied.
 * Twice 0.8 = 0.64.
 *
 * A default value that inheritance can steal. That is why the rule is not
 * "put `--oim-scale: 1` in more places" -which hides the inheritance case by
 * case- but that the two concepts have different names.
 */

import { describe, it, expect } from "vitest";
import { getStylesText } from "./styles";

const css = getStylesText();

/**
 * The full rule for a selector, so that it can be read whole.
 *
 * It anchors at the START of the rule, not at any occurrence of the selector:
 * `.oim-slot {` also appears inside
 * `.oim-player-viewport:not(.oim-viewport--ready) .oim-slot { … }`, and
 * searching for the substring returned that one. It is the same mistake that
 * the rule these tests guard against makes, committed in the tests themselves.
 */
function regla(selector: string): string {
  // Split on `}` and compare the WHOLE selector, not as a substring.
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
   * The check that bites. If the overlay went back to using `--oim-scale`, the
   * value would travel by inheritance to every `.oim-slot` and be applied twice.
   * That is exactly the fault this closes.
   */
  it("el overlay NO define ni consume --oim-scale", () => {
    expect(regla(".oim-layer-overlay")).not.toContain("--oim-scale");
  });

  it("el slot scale con --oim-scale, que es la scale de la forma", () => {
    expect(regla(".oim-slot")).toContain("scale(var(--oim-scale, 1))");
  });

  it("el slot NO consume el factor de ajuste", () => {
    // If it consumed it, it would multiply again by what the overlay already applied.
    expect(regla(".oim-slot")).not.toContain("--oim-fit");
  });

  it("las variantes del slot mantienen la misma separacion", () => {
    // `:hover` composes over the shape's scale; if the fitting factor slipped
    // in, the slot would jump in size when the pointer passes over it. (The
    // per-layer entry that was also checked here no longer exists: the veil is
    // the only entry.)
    for (const sel of [".oim-slot:hover"]) {
      expect(regla(sel)).toContain("--oim-scale");
      expect(regla(sel)).not.toContain("--oim-fit");
    }
    expect(css).not.toContain("oimSlotFadeIn");
  });
});

/**
 * The overlay does not promise changes it will not make.
 *
 * It carried `will-change: transform`, and the transform is NOT animated: the
 * engine itself says so in `ImageEngine.ts`, next to the call that should not be
 * made -"`--oim-fit` only needs updating when the container/viewport dimensions
 * change"-. It changes on resize and nothing else. The only transition declared
 * on the overlay is the one for `opacity`.
 *
 * `will-change` is not a free optimization: it asks the browser to keep the
 * element in its own compositor layer PERMANENTLY. The overlay measures the
 * entire canvas -1080x1920 by default-, which is roughly 8 MB of GPU memory per
 * player, and the player is embedded in third-party pages that did not choose
 * to pay for it.
 *
 * What this does NOT fix, and it is worth writing down so as not to suspect this
 * place again: the pixelation of letters with a gradient fill. It was compared
 * by hand -gradient with and without `will-change`, and flat color with
 * `will-change`- and the one that looks clean is the FLAT COLOR one, which has
 * `will-change` set. The cause is in `fill.ts`: a text with a gradient, generative
 * or pattern fill is painted with `background-clip: text`, that is, like a mask,
 * and a mask is rasterized without knowing that its edges are letter outlines.
 */
describe("el overlay no pide capa de compositor permanente", () => {
  it("no declara will-change", () => {
    expect(regla(".oim-layer-overlay")).not.toContain("will-change");
  });

  it("y sigue escalando con el factor de ajuste", () => {
    // Removing `will-change` must not take the transform away with it.
    expect(regla(".oim-layer-overlay")).toContain("scale(var(--oim-fit");
  });
});
