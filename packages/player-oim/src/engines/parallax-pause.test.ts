/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A still or paused player does no parallax work.
 *
 * Every card with a mouse parallax built a ParallaxController that listens to
 * `pointermove` on the whole window and measures its card on each event. In a
 * mobile gallery, scrolling with the finger fired those events, and every card
 * measured itself on every one of them: twenty cards, twenty forced layouts per
 * event, and the scroll stuttered. Cards with keyframes or a Lottie did not,
 * because nothing of theirs listens to the window (9 Oct 2026).
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { ParallaxController } from "../core/ParallaxController";

function mount(attrs: Record<string, string> = {}) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = {
    width: 800,
    height: 600,
    slots: [{
      id: "sky", type: "text", align: "center", position: [10, 10],
      content: { es: "Cielo" },
      parallax: { enabled: true, mode: "mouse", depth: 0.5 },
      style: {},
    }],
  };
  return motor;
}

describe("a still card has no parallax controller", () => {
  it("with disable-animations, nothing listens to the window", async () => {
    const motor = mount({ "disable-animations": "true" });
    await motor.renderSlots();
    expect(motor._parallaxController).toBeNull();
  });

  it("a card that moves still gets its controller", async () => {
    const motor = mount();
    await motor.renderSlots();
    expect(motor._parallaxController).toBeInstanceOf(ParallaxController);
  });
});

describe("a controller created while the player is paused is born paused", () => {
  it("no frame loop running after the render", async () => {
    const motor = mount();
    motor.pause();
    await motor.renderSlots();
    const ctrl: any = motor._parallaxController;
    expect(ctrl).toBeInstanceOf(ParallaxController);
    expect(ctrl.isPaused).toBe(true);
    expect(ctrl.rafId).toBeNull();
  });
});

describe("a paused controller ignores the pointer", () => {
  it("does not measure its card on pointermove", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const measure = vi.spyOn(container, "getBoundingClientRect");
    const ctrl = new ParallaxController(container);
    ctrl.pause();
    measure.mockClear();

    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10, pointerType: "touch" }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));

    expect(measure).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it("measures again once it plays", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const measure = vi.spyOn(container, "getBoundingClientRect");
    const ctrl = new ParallaxController(container);
    ctrl.pause();
    ctrl.play();
    measure.mockClear();

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));

    expect(measure).toHaveBeenCalled();
    ctrl.destroy();
  });
});
