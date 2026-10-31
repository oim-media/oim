/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `auto-rotate-lang` does not run on a paused player.
 *
 * `pause()` stopped it, but the end of loading and a change of the attribute
 * started it again without asking: a library card waiting for the cursor
 * switched language every few seconds, and every switch repaints its layers
 * (audit of 9 Oct 2026). `play()` is where it starts.
 */

import { describe, it, expect, afterEach } from "vitest";
import { OimPlayerElement } from "./index";

function fakePlayer(paused: boolean) {
  const el = document.createElement("div");
  el.setAttribute("auto-rotate-lang", "1000");
  if (paused) el.classList.add("oim-player-paused");
  return Object.assign(el, {
    _startAutoRotateLang: OimPlayerElement._startAutoRotateLang,
    _stopAutoRotateLang: OimPlayerElement._stopAutoRotateLang,
  }) as any;
}

const live: any[] = [];
afterEach(() => { live.forEach((p) => p._stopAutoRotateLang()); live.length = 0; });

describe("auto-rotate-lang and the pause", () => {
  it("does not start on a paused player", () => {
    const p = fakePlayer(true);
    live.push(p);
    p._startAutoRotateLang();
    expect(p._autoRotateIntervalId ?? null).toBeNull();
  });

  it("starts on a playing player", () => {
    const p = fakePlayer(false);
    live.push(p);
    p._startAutoRotateLang();
    expect(p._autoRotateIntervalId ?? null).not.toBeNull();
  });
});
