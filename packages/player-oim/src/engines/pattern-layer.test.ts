/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The `pattern` layer in the player: it tiles and repeats, with the CSS that
 * the core computes. The player calculates nothing on its own -all it does is
 * apply `patternLayerCss` as-is-, and a pattern layer is NOT the canvas
 * background: if it inherited that treatment, it would jump to fill 100% of the
 * viewer instead of staying at its declared position and size.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { patternLayerCss } from "../core/fill.js";

// Harness copied from `text-fill.test.ts`: same `attachShadow`, same
// `_viewport` and `_overlay`.
function montar(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

// `content` is deliberately non-empty: with `{}` the branch that decides the size
// (`ImageEngine.ts`, the `slotEl.style.width/height` condition) already falls
// into `!rawText` BEFORE reaching `slotType === 'pattern'`, and the mutant that
// removes that condition would still pass the test. With real text, `rawText`
// stops being empty and only the pattern's own condition keeps the declared
// size -without it, it would fall back to 'max-content'/'auto' in the last
// `else`-.
const slotPatron = {
  id: "p", type: "pattern", align: "left",
  position: [10, 10], width_px: 200, height_px: 200,
  content: { es: "no deberia pintarse: una capa de patron no usa texto" },
  style: {
    fillType: "pattern", fillPatternType: "clouds",
    fillPatternColor: "#18181B", fillPatternBgColor: "transparent",
    fillPatternSpeed: 8, fillPatternScale: 1, fillPatternDirection: "right",
  },
};

async function slotDe(style: any): Promise<HTMLElement> {
  const { host, motor } = montar([style]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="' + style.id + '"]') as HTMLElement;
}

describe("la capa de patron en el player", () => {
  it("tesela y se repite", async () => {
    const el = await slotDe(slotPatron);
    expect(el.style.backgroundRepeat).toBe("repeat");
    expect(el.style.backgroundSize).toBe("160px 160px");
  });

  it("usa EXACTAMENTE lo que devuelve el core", async () => {
    const el = await slotDe(slotPatron);
    const esperado = patternLayerCss(slotPatron.style as any) as any;
    expect(el.style.animation).toBe(esperado.animation);
    expect(el.style.backgroundSize).toBe(esperado.backgroundSize);
  });

  // The layer is NOT the background: if it inherited that mark, it would jump
  // to fill the scene. The assertion is POSITIVE -the exact size the slot
  // declares, 200x200 on an 800 canvas gives "25.0000cqw"- and not "is not
  // 100%": that latter one would pass just the same with an empty style, without
  // checking anything.
  //
  // You cannot read `el.style.width` back: happy-dom rejects `cqw` as an invalid
  // unit and the setter becomes a silent no-op -it was checked separately, with
  // `div.style.width = '25cqw'` outside the engine, and the value stays ''-. The
  // only way to see which value the engine TRIED to set is to spy on the setter
  // of `CSSStyleDeclaration` before rendering.
  it("no se estira al 100% del visor: mide lo que declara el slot", async () => {
    const setWidth = vi.spyOn(CSSStyleDeclaration.prototype, "width", "set");
    const setHeight = vi.spyOn(CSSStyleDeclaration.prototype, "height", "set");
    try {
      const el = await slotDe(slotPatron);
      expect(el.getAttribute("data-slot-id")).toBe("p");
      expect(setWidth).toHaveBeenCalledWith("25.0000cqw");
      expect(setHeight).toHaveBeenCalledWith("25.0000cqw");
    } finally {
      setWidth.mockRestore();
      setHeight.mockRestore();
    }
  });

  it("una capa de patron con forma de circulo lleva la mascara del core", async () => {
    const conForma = { ...slotPatron, id: "pc", style: { ...slotPatron.style, geoShape: "circle" } };
    const el = await slotDe(conForma);
    const esperado = patternLayerCss(conForma.style as any) as any;
    expect(esperado.maskImage).toBeTruthy();
    expect((el.style as any).maskImage || (el.style as any).webkitMaskImage).toBe(esperado.maskImage);
  });
});

