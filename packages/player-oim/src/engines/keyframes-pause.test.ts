/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A paused player stops its keyframe animations too.
 *
 * Keyframe animations run through the Web Animations API (`element.animate`),
 * and the `oim-player-paused` class only stops CSS animations: a card in the
 * library with `activate-on="hover"` kept moving its keyframes with the cursor
 * away, while its Lottie did stop (8 Oct 2026).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

function fakeAnimation() {
  return { pause: vi.fn(), play: vi.fn(), cancel: vi.fn() };
}

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
      id: "moving", type: "text", align: "center", position: [10, 10],
      content: { es: "Hola" },
      style: {
        animation: {
          duration: 2,
          keyframes: [
            { offset: 0, opacity: 1 },
            { offset: 1, opacity: 0.2 },
          ],
        },
      },
    }],
  };
  return motor;
}

const animate = HTMLElement.prototype.animate;
afterEach(() => { HTMLElement.prototype.animate = animate; });

function stubAnimate() {
  const created: ReturnType<typeof fakeAnimation>[] = [];
  HTMLElement.prototype.animate = vi.fn(function () {
    const a = fakeAnimation();
    created.push(a);
    return a;
  }) as any;
  return created;
}

describe("keyframe animations follow the player's pause", () => {
  it("pause() pauses them and play() resumes them", async () => {
    const created = stubAnimate();
    const motor = mount();
    await motor.renderSlots();
    expect(created).toHaveLength(1);

    motor.pause();
    expect(created[0].pause).toHaveBeenCalled();

    motor.play();
    expect(created[0].play).toHaveBeenCalled();
  });

  it("one created while the player is paused is born paused", async () => {
    const created = stubAnimate();
    const motor = mount();
    motor.pause();
    await motor.renderSlots();
    expect(created).toHaveLength(1);
    expect(created[0].pause).toHaveBeenCalled();
  });

  it("one created while the player plays is left playing", async () => {
    const created = stubAnimate();
    const motor = mount();
    motor.play();
    await motor.renderSlots();
    expect(created[0].pause).not.toHaveBeenCalled();
  });
});
