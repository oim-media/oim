/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La capa `pattern` en el player: tesela y se repite, con el CSS que calcula
 * el core. El player no calcula nada por su cuenta -lo unico que hace es
 * aplicar `patternLayerCss` tal cual-, y una capa de patron NO es el fondo
 * del lienzo: si heredara ese trato saltaria a ocupar el 100% del visor en
 * vez de quedarse en su posicion y tamano declarados.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { patternLayerCss } from "../core/fill.js";

// Arnes copiado de `text-fill.test.ts`: mismo `attachShadow`, mismos
// `_viewport` y `_overlay`.
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

// `content` no vacio A PROPOSITO: con `{}` la rama que decide el tamano
// (`ImageEngine.ts`, condicion de `slotEl.style.width/height`) ya cae en
// `!rawText` ANTES de llegar a `slotType === 'pattern'`, y la mutante que
// quita esa condicion seguiria pasando la prueba. Con texto real, `rawText`
// deja de estar vacio y solo la condicion propia del patron mantiene el
// tamano declarado -sin ella caeria al 'max-content'/'auto' del ultimo
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

  // La capa NO es el fondo: si heredara esa marca, saltaria a ocupar la
  // escena. La aseveracion es POSITIVA -el tamano exacto que declara el
  // slot, 200x200 sobre un lienzo de 800 da "25.0000cqw"- y no "no es 100%":
  // esa ultima pasaria igual con un estilo vacio, sin comprobar nada.
  //
  // No se puede leer `el.style.width` de vuelta: happy-dom rechaza `cqw`
  // como unidad invalida y el setter se convierte en no-op silencioso -se
  // comprobo aparte, con `div.style.width = '25cqw'` fuera del motor, que
  // el valor se queda en ''-. La unica forma de ver que valor INTENTO poner
  // el motor es espiar el setter de `CSSStyleDeclaration` antes de rendear.
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

