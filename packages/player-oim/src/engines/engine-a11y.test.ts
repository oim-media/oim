/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Screen-reader reading (contract 1.16.0): a hidden `.oim-a11y` layer in
// visual order, built from the document, never from the painted DOM.

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { readingOrder, a11yNodes, artworkLabel } from "../render/a11y";

function mount(slots: any[], extra: any = {}) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor.lang = "es";
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600, lang: ["es", "en"], ...extra };
  return { host, motor };
}

const textItem = (id: string, x: number, y: number, content: any, style: any = {}) => ({
  id, type: "text", align: "left", position: [x, y], content, style: { fontSize: 20, ...style },
});
const imageItem = (id: string, x: number, y: number, style: any = {}) => ({
  id, type: "image", align: "left", position: [x, y], width_px: 100, height_px: 100,
  content: { "*": "data:image/png;base64,AAAA" }, style,
});

const a11y = (host: HTMLElement) => host.shadowRoot!.querySelector(".oim-a11y") as HTMLElement;
const shape = (motor: any) => motor._viewport as HTMLElement;

describe("reading order", () => {
  it("groups boxes within 8 px of y into one row, left to right", () => {
    expect(readingOrder([{ x: 200, y: 10 }, { x: 10, y: 15 }, { x: 10, y: 100 }]))
      .toEqual([{ x: 10, y: 15 }, { x: 200, y: 10 }, { x: 10, y: 100 }]);
  });
});

describe("screen-reader layer", () => {
  const artwork = () => [
    imageItem("gato", 10, 200, { alt: { es: "Un gato", en: "A cat" } }),
    textItem("titulo", 10, 10, { es: "Título", en: "Title" }),
    imageItem("deco", 10, 300, { alt: { es: "Adorno" }, decorative: true }),
    imageItem("sinalt", 10, 400),
  ];

  it("reads text and described images in visual order, skipping decorative and alt-less", async () => {
    const { host, motor } = mount(artwork());
    await motor.renderSlots();
    const box = a11y(host);
    const kids = Array.from(box.children) as HTMLElement[];
    expect(kids.length).toBe(2);
    expect(kids[0].tagName).toBe("P");
    expect(kids[0].getAttribute("lang")).toBe("es");
    expect(kids[0].textContent).toBe("Título");
    expect(kids[1].getAttribute("role")).toBe("img");
    expect(kids[1].getAttribute("aria-label")).toBe("Un gato");
    expect(box.textContent).not.toContain("Adorno");
    expect(motor._overlay.getAttribute("aria-hidden")).toBe("true");
  });

  it("names the figure from description, else the first text, else Imagen/Image", async () => {
    let m = mount(artwork(), { description: { es: "Un póster", en: "A poster" } });
    await m.motor.renderSlots();
    expect(shape(m.motor).getAttribute("role")).toBe("figure");
    expect(shape(m.motor).getAttribute("aria-label")).toBe("Un póster");

    m = mount(artwork());
    await m.motor.renderSlots();
    expect(shape(m.motor).getAttribute("aria-label")).toBe("Título");

    m = mount([imageItem("sinalt", 0, 0)]);
    await m.motor.renderSlots();
    expect(shape(m.motor).getAttribute("aria-label")).toBe("Imagen");
    m.motor.setLang("en");
    expect(shape(m.motor).getAttribute("aria-label")).toBe("Image");
  });

  it("the base image is silent", async () => {
    const host = document.createElement("div");
    const motor: any = new ImageEngine(host as any);
    try { await motor.load("data:image/png;base64,AAAA"); } catch (e) {}
    const base = host.shadowRoot!.querySelector(".oim-player-base")!;
    expect(base.getAttribute("alt")).toBe("");
    expect(base.getAttribute("aria-hidden")).toBe("true");
  });

  it("an alt with markup is read as literal text", async () => {
    const { host, motor } = mount([
      imageItem("x", 0, 0, { alt: { es: "<img src=x onerror=alert(1)>" } }),
      textItem("y", 0, 50, { es: "<img src=y>" }),
    ]);
    await motor.renderSlots();
    const box = a11y(host);
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("[role=img]")!.getAttribute("aria-label")).toBe("<img src=x onerror=alert(1)>");
    expect(box.querySelector("p")!.textContent).toBe("<img src=y>");
  });

  it("a whitespace alt counts as missing; alt falls back to the primary language", async () => {
    const { host, motor } = mount([imageItem("a", 0, 0, { alt: { es: "  " } }), imageItem("b", 0, 50, { alt: { es: "Perro" } })]);
    await motor.renderSlots();
    motor.setLang("en");
    const kids = Array.from(a11y(host).children);
    expect(kids.length).toBe(1);
    expect(kids[0].getAttribute("aria-label")).toBe("Perro");
  });

  it("rebuilds on language change with the same nodes", async () => {
    const { host, motor } = mount(artwork());
    await motor.renderSlots();
    const before = a11y(host).children.length;
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 0));
    const p = a11y(host).querySelector("p")!;
    expect(p.getAttribute("lang")).toBe("en");
    expect(p.textContent).toBe("Title");
    expect(a11y(host).children.length).toBe(before);
    expect(a11y(host).querySelector("[role=img]")!.getAttribute("aria-label")).toBe("A cat");
  });

  it("an interactive layer is a button; click and Enter run its action", async () => {
    const buttonItem = { ...imageItem("b", 0, 0), interaction: { action_type: "toggle_elements", target: { hide_slots: ["t"] } } };
    const { host, motor } = mount([buttonItem, textItem("t", 0, 100, { es: "Hola" })]);
    motor.disableActions = false;
    const spy = vi.spyOn(motor, "executeToggleState");
    await motor.renderSlots();
    const btn = a11y(host).querySelector("button")!;
    expect(btn.textContent).toBe("Botón");
    btn.click();
    expect(spy).toHaveBeenCalledTimes(1);
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("in image mode (actions off) an interactive layer is not a button", async () => {
    const buttonItem = { ...textItem("b", 0, 0, { es: "Comprar" }), interaction: { action_type: "toggle_elements", target: { hide_slots: ["b"] } } };
    const { host, motor } = mount([buttonItem]);
    motor.disableActions = true;
    await motor.renderSlots();
    expect(a11y(host).querySelector("button")).toBeNull();
    expect(a11y(host).querySelector("p")!.textContent).toBe("Comprar");
  });

  it("a scene loop's duplicated track reads each text once", async () => {
    const trackItem = textItem("track", 0, 0, { es: "Desfile" }, {
      parallax: { enabled: true, speedPxSec: 40, direction: "left" },
    });
    const { host, motor } = mount([trackItem], { sceneLoop: { enabled: true } });
    await motor.renderSlots();
    const ps = Array.from(a11y(host).querySelectorAll("p")).filter((p) => p.textContent === "Desfile");
    expect(ps.length).toBe(1);
  });
});

describe("hidden layers", () => {
  it("a layer with isVisible false is not read", () => {
    const slots: any[] = [
      { id: "a", type: "text", position: [10, 10], content: { es: "Visible" }, style: {} },
      { id: "b", type: "text", position: [10, 50], content: { es: "Oculto" }, style: { isVisible: false } },
    ];
    expect(a11yNodes(slots, "es", "es")).toEqual([{ type: "text", lang: "es", text: "Visible" }]);
  });
});

describe("toggle actions", () => {
  it("a slot hidden or shown by an action changes what is read", () => {
    const { host, motor } = mount([
      textItem("t1", 10, 10, { es: "Antes" }),
      textItem("t2", 10, 50, { es: "Después" }, { isVisible: false }),
    ]);
    motor._buildA11y();
    expect(a11y(host).textContent).toBe("Antes");
    motor.executeToggleState({ hide_slots: ["t1"], show_slots: ["t2"] });
    expect(a11y(host).textContent).toBe("Después");
    motor.executeToggleState({ hide_slots: ["t2"], show_slots: ["t1"] });
    expect(a11y(host).textContent).toBe("Antes");
  });
});

describe("artworkLabel", () => {
  it("falls back to the principal language's description", () => {
    expect(artworkLabel({ description: { es: "Un faro" } }, [], "en", "es")).toBe("Un faro");
  });
  it("prefers the reader's language when it exists", () => {
    expect(artworkLabel({ description: { es: "Un faro", en: "A lighthouse" } }, [], "en", "es")).toBe("A lighthouse");
  });
});
