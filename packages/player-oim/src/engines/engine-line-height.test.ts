/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El hueco de siempre: que la regla llegue al DOM.
 *
 * `tipografia.test.ts` fija el NUMERO; esto fija que el motor lo escribe en el
 * elemento, sin unidad y sobre el slot de text. Sin esta prueba, borrar la
 * linea del motor dejaba las 17 de core en verde mientras el valor del archivo
 * volvia a llegar crudo por el volcado generico de `style`, y la capa que no
 * lo trae volvia al `normal` del navegador.
 *
 * El corte medido: el editor pinta a 1.25, el player no leia el campo, y la
 * caja salia mas baja de lo previsto. Con `overflow: hidden` en el slot, los
 * descendentes -«j», «p», «g»- quedaban cortados por abajo.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { DEFAULT_LINE_HEIGHT } from "../core/typography";

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

const text = (style: any = {}) => ({
  id: "t", type: "text", align: "left",
  position: [50, 50], width_px: 300, height_px: 80,
  content: { es: "ejemplo" },
  style: { fontSize: "24px", ...style },
});

async function interlineadoDe(style: any = {}): Promise<string> {
  const { host, motor } = montar([text(style)]);
  await motor.renderSlots();
  const el = host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
  return el.style.lineHeight;
}

describe("el interlineado en el motor", () => {
  it("se escribe en el elemento", async () => {
    expect(await interlineadoDe({ lineHeight: 1.6 })).toBe("1.6");
  });

  /** Lo que traen los .oim publicados: cadena, no numero. */
  it("lee la cadena de los archivos reales", async () => {
    expect(await interlineadoDe({ lineHeight: "1.2" })).toBe("1.2");
  });

  /**
   * Sin este valor el player usaria el `normal` del navegador -que segun la
   * fuente ronda 1.15-1.2 y no es fijo- y volveria a discrepar del editor.
   */
  it("una capa que no lo dice recibe el mismo valor que pinta el editor", async () => {
    expect(await interlineadoDe()).toBe(String(DEFAULT_LINE_HEIGHT));
  });

  /**
   * SIN UNIDAD. Con `px` o `em` el valor se hereda ya calculado, asi que un
   * hijo con otro size de fuente recibiria el alto de linea del padre.
   */
  it("va sin unidad, para que se herede como factor", async () => {
    const valor = await interlineadoDe({ lineHeight: 2 });
    expect(valor).toBe("2");
    expect(valor).not.toMatch(/px|em|rem|%/);
  });

  it("un valor imposible no llega al DOM", async () => {
    expect(await interlineadoDe({ lineHeight: 0 })).toBe(String(DEFAULT_LINE_HEIGHT));
    expect(await interlineadoDe({ lineHeight: "alto" })).toBe(String(DEFAULT_LINE_HEIGHT));
    // Acotado al maximo que ofrece el editor, no descartado.
    expect(await interlineadoDe({ lineHeight: 99 })).toBe("3");
  });
});
