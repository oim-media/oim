/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * play() does not wake what `disable-animations` froze.
 *
 * A player with animations off builds its Lottie frozen on frame 0. But a card
 * scrolled into view becomes "active" and gets play(), which resumed the Lottie
 * anyway: measured on a Galaxy S24 Ultra on 9 Oct 2026, scrolling the mobile
 * library spent 231 ms in lottie_light and 353 ms in animation frames on cards
 * that were meant to be still.
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

function mount(attrs: Record<string, string>) {
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
      id: "anim", type: "lottie", align: "center", position: [10, 10],
      content: { es: JSON.stringify({ v: "5.7.0", fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [] }) },
      style: {},
    }],
  };
  return motor;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("play() respects disable-animations", () => {
  it("a frozen Lottie stays frozen when the card becomes active", async () => {
    created.length = 0;
    const motor = mount({ "disable-animations": "true" });
    await motor.renderSlots();
    await settle();
    expect(created).toHaveLength(1);
    expect(created[0].goToAndStop).toHaveBeenCalledWith(0, true);

    motor.play();
    expect(created[0].play).not.toHaveBeenCalled();
  });

  it("with animations on, play() still starts the Lottie", async () => {
    created.length = 0;
    const motor = mount({});
    motor.pause();
    await motor.renderSlots();
    await settle();
    motor.play();
    expect(created[0].play).toHaveBeenCalled();
  });
});
