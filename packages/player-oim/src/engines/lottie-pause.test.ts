/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A Lottie that finishes loading while the player is paused stays still.
 *
 * The Lottie library loads asynchronously, so a card in the library with
 * `activate-on="hover"` was already paused when its Lottie arrived, and the
 * Lottie started with `autoplay` anyway: it moved the first time the library
 * was shown, and stopped only after opening and closing the work, when
 * `pause()` ran again over an instance that now existed (8 Oct 2026).
 */

import { describe, it, expect, vi } from "vitest";

const created: Array<{ options: any; play: any; pause: any; goToAndStop: any; destroy: any }> = [];

vi.mock("../../../scene/src/legacy/lottie-loader.js", () => ({
  loadLottie: () => Promise.resolve({
    loadAnimation(options: any) {
      const anim = { options, play: vi.fn(), pause: vi.fn(), goToAndStop: vi.fn(), destroy: vi.fn() };
      created.push(anim);
      return anim;
    },
  }),
}));

import ImageEngine from "./ImageEngine";

function mount() {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
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
      id: "anim", type: "lottie", align: "center", position: [10, 10],
      content: { es: JSON.stringify({ v: "5.7.0", fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [] }) },
      style: {},
    }],
  };
  return motor;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("a Lottie follows the player's pause, even when it loads late", () => {
  it("loaded while paused: no autoplay, and it does not play", async () => {
    created.length = 0;
    const motor = mount();
    motor.pause();
    await motor.renderSlots();
    await settle();
    expect(created).toHaveLength(1);
    expect(created[0].options.autoplay).toBe(false);
    expect(created[0].play).not.toHaveBeenCalled();
  });

  it("then play() starts it", async () => {
    created.length = 0;
    const motor = mount();
    motor.pause();
    await motor.renderSlots();
    await settle();
    motor.play();
    expect(created[0].play).toHaveBeenCalled();
  });

  it("loaded while playing: it autoplays as before", async () => {
    created.length = 0;
    const motor = mount();
    motor.play();
    await motor.renderSlots();
    await settle();
    expect(created[0].options.autoplay).toBe(true);
  });
});
