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
 * `shadow.test.ts` pins the CHAIN; this pins that the engine places it where it should:
 * in `filter`, last, and only on the layers that are not text. Without this, moving
 * the `drop-shadow` to the start of the chain would break nothing, and that order is
 * half of the fix (a later colour preset would tint the shadow).
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slots: any[]) {
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

describe("the shadow in the engine", () => {
  let host: HTMLElement, motor: any;
  const node = () => host.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;

  beforeEach(() => { ({ host, motor } = mount([conSombra()])); });

  it("va en `filter`, no en `boxShadow`", async () => {
    await motor.renderSlots();
    expect(node().style.filter).toContain("drop-shadow(4px 8px 12px rgba(236, 72, 153, 0.5))");
    expect(node().style.boxShadow).toBe("");
  });

  it("and it goes LAST in the chain, behind the blur", async () => {
    // Filters apply in order: at the front, a later colour preset would tint the
    // shadow and the chosen colour would not be the one that is seen.
    const { host: h2, motor: m2 } = mount([conSombra({ blur: 4 })]);
    await m2.renderSlots();
    const filtro = (h2.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement).style.filter;
    expect(filtro).toContain("blur(");
    expect(filtro.indexOf("drop-shadow")).toBeGreaterThan(filtro.indexOf("blur("));
  });

  it("a TEXT layer keeps textShadow and does not gain a filter", async () => {
    const { host: h3, motor: m3 } = mount([{
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

  it("without the shadow enabled nothing is added", async () => {
    const { host: h4, motor: m4 } = mount([conSombra({ shadowEnabled: false })]);
    await m4.renderSlots();
    const el = h4.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;
    expect(el.style.filter || "").not.toContain("drop-shadow");
    expect(el.style.boxShadow).toBe("");
  });
});

describe("a vector layer does not carry a box border", () => {
  it("an icon with an inherited strokeWidth does not gain a rectangle around it", async () => {
    // The editor interprets the stroke as the outline of the SVG paths; the player
    // drew `slotEl.style.border`, a rectangle around the icon that the editor never
    // showed. Icons inserted before the fix carry strokeWidth: 2, which is one of the
    // shape's defects.
    const { host, motor } = mount([{
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

  it("a rectangular shape DOES carry one: there the box is the figure", async () => {
    const { host, motor } = mount([{
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

describe("and the OLD icons, created as geo, neither", () => {
  it("a `geo` with the SVG inside the content does not gain a box border", async () => {
    // Before the fix, library icons were created as `geo`. Checking only the type
    // would leave them out.
    const { host, motor } = mount([{
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

describe("the seal depends on whether the file has authorship", () => {
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

  it("a .oim without the field keeps the usual seal", async () => {
    const { motor } = conPermiso();
    // `signatureStamp(permissionOf({}))` -> 'verified'. The rule is checked, which is
    // what the engine consults.
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({}))).toBe("verified");
    expect(motor.securityStatus).toBe("unsigned");
  });

  it("a public one asks for its own seal", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "publico" }))).toBe("verified_authorless");
  });

  it("and a strange value does NOT get the public seal", async () => {
    const { permissionOf, signatureStamp } = await import("../../../core/src/reeditPermission.js");
    expect(signatureStamp(permissionOf({ reedicion: "libre" }))).toBe("verified");
  });
});
