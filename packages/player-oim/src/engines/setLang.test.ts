/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  motor._viewport.className = "oim-viewport";
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._overlay.className = "oim-layer-overlay";
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 } as any;
  return { host, motor };
}

const proyecto = () => ([
  { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: { fontSize: "16px" } },
  { id: "quieto", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
  { id: "grande", type: "text", content: { es: "Precio", en: "Precio" }, position: [50, 80], style: { fontSize: "16px", fontSizes: { en: "13px" } } },
]);

describe("setLang quirurgico", () => {
  let host: HTMLElement, motor: any;
  beforeEach(async () => {
    ({ host, motor } = mount(proyecto()));
    motor.lang = "es";
    await motor.renderSlots();
  });

  const nodeItem = (id: string) => host.shadowRoot!.querySelector('[data-slot-id="' + id + '"]');

  it("a layer with the same text in both languages keeps its node", async () => {
    const beforeItem = nodeItem("quieto");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodeItem("quieto")).toBe(beforeItem);
  });

  it("the layer whose text changes is rebuilt", async () => {
    const beforeItem = nodeItem("titulo");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodeItem("titulo")).not.toBe(beforeItem);
    expect(nodeItem("titulo")!.textContent).toContain("Hello");
  });

  it("a change of ONLY size writes the property without rebuilding", async () => {
    // The editor case: adjusting the German size must not restart the
    // animation of the layer you are looking at.
    const beforeItem = nodeItem("grande");
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(nodeItem("grande")).toBe(beforeItem);
    expect((nodeItem("grande") as HTMLElement).style.fontSize).toBe("13px");
  });

  it("switching back to the original language returns the inherited size", async () => {
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    motor.setLang("es");
    await new Promise((r) => setTimeout(r, 250));
    expect((nodeItem("grande") as HTMLElement).style.fontSize).toBe("16px");
  });

  it("emits oim:langchange only once", async () => {
    let veces = 0;
    host.addEventListener("oim:langchange", () => { veces++; });
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));
    expect(veces).toBe(1);
  });
});

describe("the infinite parallax loop survives the language change", () => {
  it("the track of a layer that does not change is still the SAME node", async () => {
    // This is the reason for this whole task: before, switching language rebuilt
    // the entire canvas and sent all the tracks back to position 0. The jump
    // that was closed earlier had a back door here.
    const { host, motor } = mount([
      { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: {} },
      {
        id: "sky", type: "image",
        content: { es: "data:image/png;base64,AAA", en: "data:image/png;base64,AAA" },
        position: [50, 50], width_px: 400,
        style: { parallax: { enabled: true, mode: "infinite_horizontal", infinite: { enabled: true, speedPxSec: 20 } } },
      },
    ]);
    motor.lang = "es";
    await motor.renderSlots();

    const pistaAntes = host.shadowRoot!.querySelector(".oim-parallax-track");
    expect(pistaAntes).toBeTruthy();

    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));

    // The same node, not an equivalent one: a new node is a CSS animation that
    // starts again, which is exactly what was seen as a jump.
    expect(host.shadowRoot!.querySelector(".oim-parallax-track")).toBe(pistaAntes);
    // And the title did change, so the test does not pass by doing nothing.
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')!.textContent).toContain("Hello");
  });
});

describe("the language-change transition", () => {
  const visorDe = (m: any) => m._viewport as HTMLElement;

  it("if no layer changes there is no transition", () => {
    // Blurring to show the same image is a flicker that lies.
    const { motor } = mount([
      { id: "solo", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
    ]);
    motor.lang = "es";
    motor.setLang("en");
    expect(visorDe(motor).style.filter).not.toContain("blur");
  });

  it("blurs the WHOLE canvas to 14px, not the loose layer", async () => {
    // A language switch should read as "another image". A small blur on just
    // the changing layer does the opposite: you watch it being modified.
    const { motor } = mount(proyecto());
    motor.lang = "es";
    await motor.renderSlots();
    motor.setLang("en");
    expect(visorDe(motor).style.filter).toBe("blur(14px)");
  });

  it("the change is applied at the PEAK, not during the ramp", async () => {
    const { host, motor } = mount(proyecto());
    motor.lang = "es";
    await motor.renderSlots();
    const beforeItem = host.shadowRoot!.querySelector('[data-slot-id="titulo"]');

    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 60));
    // At 60ms it is still blurring: the canvas has not changed yet.
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')).toBe(beforeItem);

    await new Promise((r) => setTimeout(r, 400));
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')).not.toBe(beforeItem);
  });

  /**
   * CAREFUL when measuring opacity: the engine mounts ALL layers at `opacity: 0`
   * and fades them in on entry (ImageEngine:1331), and it settles around 100ms.
   * Measuring before that measures ITS fade, not ours, and the test passes even
   * if ours does not exist. Here it always waits for it to settle.
   */
  const conMenosMovimiento = async (fn: (h: HTMLElement, m: any) => Promise<void>) => {
    const previo = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q.includes("reduce"), media: q,
      addEventListener() {}, removeEventListener() {},
    });
    try {
      const { host, motor } = mount([
        { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" },
          position: [50, 20], style: { fontSize: "16px", opacity: 40 } },
        // It changes ONLY the size: it is not rebuilt, so the only opacity visible
        // at the end is the one the fade restores. If the content changed, the
        // new node would bring its own entry and would cover the bug.
        { id: "translucida", type: "text", content: { es: "Precio", en: "Precio" },
          position: [50, 65], style: { fontSize: "16px", fontSizes: { en: "13px" }, opacity: 40 } },
        { id: "pulsante", type: "text", content: { es: "Ya", en: "Yes" }, position: [50, 35], style: {} },
        { id: "quieto", type: "text", content: { es: "OIM", en: "OIM" }, position: [50, 50], style: {} },
      ]);
      motor.lang = "es";
      await motor.renderSlots();
      // The engine's entry pass rewrites the opacity of ALL layers and takes
      // longer the more there are. It waits until the translucent one reaches its
      // real value: measuring before that measures its fade, not ours.
      const traslucida = () =>
        (host.shadowRoot!.querySelector('[data-slot-id="translucida"]') as HTMLElement).style.opacity;
      for (let i = 0; i < 40 && traslucida() !== "0.4"; i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(traslucida()).toBe("0.4"); // the entry has already finished
      await fn(host, motor);
    } finally {
      (window as any).matchMedia = previo;
    }
  };

  const op = (h: HTMLElement, id: string) =>
    (h.shadowRoot!.querySelector('[data-slot-id="' + id + '"]') as HTMLElement).style.opacity;

  it("with reduced-motion it does not blur the canvas, but DOES fade what changes", async () => {
    // Removing the transition altogether would leave a dry jump right where the
    // eye is looking. An opacity fade displaces nothing: it meets the request.
    await conMenosMovimiento(async (host, motor) => {
      expect(op(host, "titulo")).toBe("0.4"); // settled
      motor.setLang("en");
      expect((motor._viewport as HTMLElement).style.filter).not.toContain("blur");
      expect(op(host, "titulo")).toBe("0");   // on its way out
    });
  });

  it("the fade returns the layer to ITS opacity, not to 1", async () => {
    await conMenosMovimiento(async (host, motor) => {
      motor.setLang("en");
      // At 150ms our fade has already restored (120ms), and the `animationend`
      // that the engine's entry leaves registered has not fired yet. That one also
      // rewrites the opacity (ImageEngine:1994). Both end at the same value, so in
      // production it converges; measuring later only measures the other one.
      await new Promise((r) => setTimeout(r, 150));
      // A layer at 40% cannot end up opaque by switching language.
      expect(op(host, "translucida")).toBe("0.4");
      expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')!.textContent).toContain("Hello");
    });
  });

  it("a layer with its own opacity animation changes without a fade", async () => {
    // The two fades would fight each other and a flicker would appear that
    // nobody could explain. A dry change is better than two animations arguing.
    await conMenosMovimiento(async (host, motor) => {
      const el = host.shadowRoot!.querySelector('[data-slot-id="pulsante"]') as HTMLElement;
      el.style.animationName = "oim-latido-opacity";
      const beforeItem = el.style.opacity;
      motor.setLang("en");
      expect(op(host, "pulsante")).toBe(beforeItem);
    });
  });

  it("a layer that does not change does not fade", async () => {
    await conMenosMovimiento(async (host, motor) => {
      motor.setLang("en");
      // "quieto" says the same in both languages: it has no reason to flicker.
      expect(op(host, "quieto")).toBe("1");
    });
  });
});
