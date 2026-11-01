/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The gap that the plan took for granted.
 *
 * `sombra.test.ts` pins the CHAIN; this pins that the engine places it where it should:
 * in `filter`, last, and only on the layers that are not text. Without this, moving
 * the `drop-shadow` to the start of the chain would break nothing, and that order is
 * half of the fix (a later colour preset would tint the shadow).
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
    // Filters apply in order: at the front, a later colour preset would tint the
    // shadow and the chosen colour would not be the one that is seen.
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
    // The editor interprets the stroke as the outline of the SVG paths; the player
    // drew `slotEl.style.border`, a rectangle around the icon that the editor never
    // showed. Icons inserted before the fix carry strokeWidth: 2, which is one of the
    // shape's defects.
    const { host, motor } = montar([{
      id: "icono", type: "svg", align: "left",
      position: [50, 50], width_px: 120, height_px: 120,
      // The SVG travels in `content`, which is where the editor puts it: checked by
      // decompressing a real .oim.
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
    // Before the fix, library icons were created as `geo`. Checking only the type
    // would leave them out.
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
  // A public one and one with authorship are equally intact (the signature protects the
  // content), but they are not equally reliable as ORIGINAL: anyone can take a public
  // one, change a figure and re-sign it. With the same green seal, the label would
  // stop meaning anything.
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
    // `signatureStamp(permissionOf({}))` -> 'verified'. The rule is checked, which is
    // what the engine consults.
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({}))).toBe("verified");
    expect(motor.securityStatus).toBe("unsigned");
  });

  it("un publico pide su propio sello", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "publico" }))).toBe("verified_sin_autoria");
  });

  it("y un valor raro NO consigue el sello de publico", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "libre" }))).toBe("verified");
  });
});
