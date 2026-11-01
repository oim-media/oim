/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An engine created while the player is paused is born paused.
 *
 * `_moveTo('ready')` calls `_initPlayer()` and then `pause()`, but
 * `_initPlayer` builds the engine asynchronously: `pause()` found no engine and
 * only set the CSS class. The engine then started unpaused, and its Lottie and
 * keyframe animations played on a library card with `activate-on="hover"`
 * until the cursor came and went (8 Oct 2026).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const oim = fs.readFileSync(path.resolve(process.cwd(), "../core/test/fixtures/object_view.oim.png"));

const OBSERVER = class {
  constructor(cb) { this._cb = cb; }
  observe(el) { this._cb([{ target: el }], this); }
  unobserve() {}
  disconnect() {}
};

function placeNear(el) {
  el.getBoundingClientRect = () => ({
    top: 10, bottom: 410, left: 0, right: 800, width: 800, height: 400,
    x: 0, y: 10, toJSON() { return this; },
  });
}

const waitFor = async (cond) => {
  for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe("an engine created while the player is paused is born paused", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    window.IntersectionObserver = OBSERVER;
    // A desktop with a mouse: `activate-on="hover"` waits for the cursor.
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      headers: { get: (h) => h.toLowerCase() === "content-length" ? String(oim.length) : null },
      arrayBuffer: () => Promise.resolve(oim.buffer.slice(oim.byteOffset, oim.byteOffset + oim.byteLength)),
      blob: () => Promise.resolve(new Blob([oim], { type: "image/png" })),
    }));
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("a card waiting for the cursor gets a paused engine", async () => {
    const el = document.createElement("oim-player");
    placeNear(el);
    el.setAttribute("activate-on", "hover");
    el.setAttribute("src", "card.oim");
    document.body.appendChild(el);

    await waitFor(() => el._engine);
    expect(el._engine).toBeTruthy();
    expect(el.classList.contains("oim-player-paused")).toBe(true);
    expect(el._engine._paused).toBe(true);
  });

  it("a player that is playing gets an engine that plays", async () => {
    const el = document.createElement("oim-player");
    placeNear(el);
    el.setAttribute("src", "card.oim");
    document.body.appendChild(el);

    await waitFor(() => el._engine);
    expect(el._engine).toBeTruthy();
    expect(el._engine._paused).toBe(false);
  });
});
