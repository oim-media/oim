/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typewriter and glitch text follow the player's pause.
 *
 * Both run on a JavaScript timer, which the `oim-player-paused` class (CSS
 * `animation-play-state`) does not reach. A paused library card with a glitch
 * kept writing styles 30 times a second (found in an audit).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

beforeEach(() => { vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] }); });
afterEach(() => { vi.useRealTimers(); });

function mount(textAnimationType: string) {
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
      id: "t", type: "text", align: "center", position: [10, 10],
      content: { es: "Hola mundo, esto es una prueba larga" },
      style: { textAnimationType, textAnimationSpeed: 10, textAnimationIntensity: 100 },
    }],
  };
  return { motor, shadow };
}

/** Text and inline styles of every element in the shadow tree. */
function snapshot(shadow: ShadowRoot): string {
  return Array.from(shadow.querySelectorAll("*"))
    .map((el) => (el.textContent || "") + "|" + ((el as HTMLElement).getAttribute("style") || ""))
    .join("\n");
}

describe.each(["typewriter", "glitch-cyberpunk"])("%s follows the player's pause", (type) => {
  it("nothing changes while paused", async () => {
    const { motor, shadow } = mount(type);
    await motor.renderSlots();
    vi.advanceTimersByTime(300);
    motor.pause();
    const before = snapshot(shadow);
    vi.advanceTimersByTime(2000);
    expect(snapshot(shadow)).toBe(before);
  });

  it("is born paused when the player is already paused", async () => {
    const { motor, shadow } = mount(type);
    motor.pause();
    await motor.renderSlots();
    const before = snapshot(shadow);
    vi.advanceTimersByTime(2000);
    expect(snapshot(shadow)).toBe(before);
  });
});

describe("typewriter resumes where it was", () => {
  it("play() continues instead of jumping over the paused time", async () => {
    const { motor, shadow } = mount("typewriter");
    await motor.renderSlots();
    vi.advanceTimersByTime(200);
    motor.pause();
    const paused = snapshot(shadow);
    vi.advanceTimersByTime(5000);
    motor.play();
    vi.advanceTimersByTime(45);
    // At 10 chars/s, 45 ms more reveals at most one character, not the
    // fifty the 5 s pause would have; and it does not start over either.
    const grown = snapshot(shadow).length - paused.length;
    expect(grown).toBeLessThanOrEqual(2);
    expect(grown).toBeGreaterThanOrEqual(0);
  });
});
