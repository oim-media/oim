/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A text with a texture is painted with background-clip: text, like a clipped
// fill, so it needs the same ink margin: at line height 1 the descender of a
// «p» was left unfilled while its stroke still showed.
import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { inkMargin } from "../core/typography.js";

function mount(style: any) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.lang = "es";
  motor.metadata = { width: 800, height: 600, slots: [{ id: "t", type: "text", align: "center", position: [10, 10], content: { es: "palabras" }, style }] };
  return { motor, shadow };
}

describe("text texture keeps the descenders filled", () => {
  it("adds the ink margin at a tight line height", async () => {
    const { motor, shadow } = mount({ lineHeight: 1, fillColor: "#3F3F46", effects: [{ type: "texture", preset: "film-grain-35mm", intensity: 30, blend: "overlay", enabled: true }] });
    await motor.renderSlots();
    const slot = [...shadow.querySelectorAll("*")].find((e: any) => (e.style.backgroundClip || e.style.webkitBackgroundClip) === "text") as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.style.getPropertyValue("padding-bottom")).toBe(inkMargin(1) + "em");
  });
});
