/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El hueco que el plan daba por conocido.
 *
 * `sombra.test.ts` fija la CADENA; esto fija que el motor la pone donde toca:
 * en `filter`, la ultima, y solo en las capas que no son text. Sin esto, mover
 * el `drop-shadow` al principio de la cadena no tumbaba nada, y ese orden es la
 * mitad del arreglo —un preset de color posterior teñiria la sombra—.
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

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

const conSombra = (extra: any = {}) => ({
  id: "caja", type: "geo", align: "left",
  position: [50, 50], width_px: 200, height_px: 200,
  content: { es: "" },
  style: {
    geoShape: "circle", fillColor: "#7ec8f0", fillType: "color",
    shadowEnabled: true, shadowColor: "#EC4899",
    shadowOffsetX: 4, shadowOffsetY: 8, shadowBlur: 12, shadowOpacity: 50,
    ...extra,
  },
});

describe("la sombra en el motor", () => {
  let host: HTMLElement, motor: any;
  const nodo = () => host.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;

  beforeEach(() => { ({ host, motor } = montar([conSombra()])); });

  it("va en `filter`, no en `boxShadow`", async () => {
    await motor.renderSlots();
    expect(nodo().style.filter).toContain("drop-shadow(4px 8px 12px rgba(236, 72, 153, 0.5))");
    expect(nodo().style.boxShadow).toBe("");
  });

  it("y va LA ULTIMA de la cadena, detras del desenfoque", async () => {
    // Los filtros se aplican en orden: delante, un preset de color posterior
    // teñiria la sombra y el color elegido no seria el que se ve.
    const { host: h2, motor: m2 } = montar([conSombra({ blur: 4 })]);
    await m2.renderSlots();
    const filtro = (h2.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement).style.filter;
    expect(filtro).toContain("blur(");
    expect(filtro.indexOf("drop-shadow")).toBeGreaterThan(filtro.indexOf("blur("));
  });

  it("una capa de TEXTO sigue con textShadow y no gana un filter", async () => {
    const { host: h3, motor: m3 } = montar([{
      id: "text", type: "text", align: "center",
      position: [50, 50], width_px: 300, height_px: 40,
      content: { es: "Hola" },
      style: {
        shadowEnabled: true, shadowColor: "#000000",
        shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 8, shadowOpacity: 30,
      },
    }]);
    await m3.renderSlots();
    const el = h3.shadowRoot!.querySelector('[data-slot-id="text"]') as HTMLElement;
    expect(el.style.textShadow).toContain("0px 4px 8px");
    expect(el.style.filter).not.toContain("drop-shadow");
  });

  it("sin la sombra activada no se añade nada", async () => {
    const { host: h4, motor: m4 } = montar([conSombra({ shadowEnabled: false })]);
    await m4.renderSlots();
    const el = h4.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;
    expect(el.style.filter || "").not.toContain("drop-shadow");
    expect(el.style.boxShadow).toBe("");
  });
});

describe("una capa de vector no lleva borde de caja", () => {
  it("un icono con strokeWidth heredado no gana un rectangulo alrededor", async () => {
    // El editor interpreta el trazo como el contorno de los caminos del SVG;
    // el player dibujaba `slotEl.style.border`, un rectangulo alrededor del
    // icono que el editor nunca enseño. Los iconos insertados antes del 21 de
    // agosto arrastran strokeWidth: 2 de los defectos de una forma.
    const { host, motor } = montar([{
      id: "icono", type: "svg", align: "left",
      position: [50, 50], width_px: 120, height_px: 120,
      // El SVG viaja en `content`, que es donde lo pone el editor: comprobado
      // descomprimiendo un .oim real.
      content: { es: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>' },
      style: { strokeColor: "#2563EB", strokeWidth: 2 },
    }]);
    await motor.renderSlots();
    const el = host.shadowRoot!.querySelector('[data-slot-id="icono"]') as HTMLElement;
    expect(el.style.border).toBe("");
  });

  it("una forma rectangular SI lo lleva: ahi la caja es la figura", async () => {
    const { host, motor } = montar([{
      id: "caja", type: "geo", align: "left",
      position: [50, 50], width_px: 120, height_px: 120,
      content: { es: "" },
      style: { geoShape: "rect", fillColor: "#eee", fillType: "color",
               strokeColor: "#2563EB", strokeWidth: 2 },
    }]);
    await motor.renderSlots();
    const el = host.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;
    expect(el.style.border).toContain("2px");
    expect(el.style.border).toContain("solid");
  });
});

describe("y los iconos VIEJOS, creados como geo, tampoco", () => {
  it("un `geo` con el SVG dentro del content no gana borde de caja", async () => {
    // Antes del 21 de agosto los iconos de la biblioteca se creaban como `geo`.
    // Mirar solo el tipo los dejaria fuera.
    const { host, motor } = montar([{
      id: "viejo", type: "geo", align: "left",
      position: [50, 50], width_px: 120, height_px: 120,
      content: { es: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>' },
      style: { strokeColor: "#2563EB", strokeWidth: 2 },
    }]);
    await motor.renderSlots();
    const el = host.shadowRoot!.querySelector('[data-slot-id="viejo"]') as HTMLElement;
    expect(el.style.border).toBe("");
  });
});

describe("el sello depende de si el archivo tiene autoria", () => {
  // Un publico y uno con autoria son igual de integros -la firma protege el
  // content-, pero no son igual de fiables como ORIGINAL: cualquiera puede
  // coger un publico, cambiar una cifra y re-firmarlo. Con el mismo sello
  // verde, la etiqueta dejaria de significar algo.
  const conPermiso = (permiso?: string) => {
    const host = document.createElement("div");
    (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor: any = new ImageEngine(host as any);
    motor._overlay = document.createElement("div");
    host.shadowRoot!.appendChild(motor._overlay);
    return { motor, meta: permiso === undefined ? {} : { reedicion: permiso } };
  };

  it("un .oim sin el campo conserva el sello de siempre", async () => {
    const { motor } = conPermiso();
    // `signatureStamp(permissionOf({}))` -> 'verified'. Se comprueba la regla, que
    // es lo que el motor consulta.
    const { permissionOf, signatureStamp } = await import("../core/reeditPermission");
    expect(signatureStamp(permissionOf({}))).toBe("verified");
    expect(motor.securityStatus).toBe("unsigned");
  });

  it("un publico pide su propio sello", async () => {
    const { permissionOf, signatureStamp } = await import("../core/reeditPermission");
    expect(signatureStamp(permissionOf({ reedicion: "publico" }))).toBe("verified_sin_autoria");
  });

  it("y un valor raro NO consigue el sello de publico", async () => {
    const { permissionOf, signatureStamp } = await import("../core/reeditPermission");
    expect(signatureStamp(permissionOf({ reedicion: "libre" }))).toBe("verified");
  });
});
