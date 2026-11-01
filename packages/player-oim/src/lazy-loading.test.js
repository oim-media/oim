/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The test that was missing.
 *
 * The player has an `IntersectionObserver` with `rootMargin: 200px` written to
 * avoid loading what is not visible. It is never used: `attributeChangedCallback`
 * calls `_initPlayer()` as soon as the `src` is parsed, before
 * `connectedCallback` mounts the observer.
 *
 * Measured in the browser: 12 players, 1 visible, 12 engines.
 * No test saw it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import { REFERENCE_OIM } from "../../core/test/fixtures/index.ts";

const oim = fs.readFileSync(REFERENCE_OIM);

/**
 * An observer that only reports: geometry is the one that decides.
 *
 * Since `_decide` reads `getBoundingClientRect()` instead of trusting the
 * observer's report, "is far away" is a geometric fact and not a property of
 * the double. That is correct: the observer's report can be born before layout
 * and lie, which is exactly the failure that was fixed.
 */
const OBSERVER = class {
  constructor(cb) { this._cb = cb; }
  observe(el) { this._cb([{ target: el }], this); }
  unobserve() {}
  disconnect() {}
};

/** Places the element wherever we want. happy-dom returns zeros for everything. */
function placeAt(el, { top, height = 400 }) {
  el.getBoundingClientRect = () => ({
    top, bottom: top + height, left: 0, right: 800, width: 800, height,
    x: 0, y: top, toJSON() { return this; },
  });
}
const FAR = (el) => placeAt(el, { top: 5000 });
const NEAR = (el) => placeAt(el, { top: 10 });

/** Lets through the frame that `_scheduleDecision` waits for. */
const nextFrame = () => new Promise((r) => setTimeout(r, 60));

function serveFile() {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true, status: 200,
    headers: { get: (h) => h.toLowerCase() === "content-length" ? String(oim.length) : null },
    arrayBuffer: () => Promise.resolve(oim.buffer.slice(oim.byteOffset, oim.byteOffset + oim.byteLength)),
    blob: () => Promise.resolve(new Blob([oim], { type: "image/png" })),
  }));
}

describe("a player nobody sees does not load", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    // The element is registered when the built package is imported, as in
    // `oim-player.test.js`. `dist-up-to-date.test.js` checks that it is not stale.
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("outside the viewport it does NOT create an engine", async () => {
    // happy-dom does not implement IntersectionObserver: a stub is installed that
    // never reports an intersection, which is exactly the "far away" case.
    window.IntersectionObserver = OBSERVER;
    const el = document.createElement("oim-player");
    FAR(el);
    el.setAttribute("src", "anything.oim");
    document.body.appendChild(el);
    await nextFrame();
    expect(el._engine, "the engine was created although nobody saw it").toBeFalsy();
  });

  it("and it does not fetch the file either", async () => {
    window.IntersectionObserver = OBSERVER;
    const spy = vi.fn(() => Promise.reject(new Error("should not be requested")));
    const original = global.fetch;
    global.fetch = spy;
    try {
      const el = document.createElement("oim-player");
      FAR(el);
      el.setAttribute("src", "anything.oim");
      document.body.appendChild(el);
      await nextFrame();
      expect(spy, "downloaded a file nobody has seen").not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});

describe("the activity state contract", () => {
  let fetchOriginal;
  beforeEach(async () => {
    document.body.innerHTML = "";
    fetchOriginal = global.fetch;
    serveFile();
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });
  afterEach(() => { global.fetch = fetchOriginal; });

  const mount = (attrs = {}, where = NEAR) => {
    const el = document.createElement("oim-player");
    where(el);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute("src", "anything.oim");
    document.body.appendChild(el);
    return el;
  };

  it("in view it DOES load", async () => {
    window.IntersectionObserver = OBSERVER;
    const el = mount();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("disconnecting it leaves no mousemove listener on window", async () => {
    // The ParallaxController adds one to `window` in its constructor and only
    // removes it in `destroy()`. Measured in the browser: 12 players, 1 visible,
    // 12 live listeners.
    window.IntersectionObserver = OBSERVER;
    let live = 0;
    const add = window.addEventListener.bind(window);
    const rem = window.removeEventListener.bind(window);
    window.addEventListener = (t, f, o) => { if (t === "mousemove") live++; return add(t, f, o); };
    window.removeEventListener = (t, f, o) => { if (t === "mousemove") live--; return rem(t, f, o); };
    try {
      const el = mount();
      await new Promise((r) => setTimeout(r, 150));
      el.remove();
      await new Promise((r) => setTimeout(r, 50));
      expect(live, "mousemove listeners remain after removing the player").toBe(0);
    } finally {
      window.addEventListener = add;
      window.removeEventListener = rem;
    }
  });

  it("`getMetadata()` wakes a dormant player", async () => {
    // Without this, lazy loading would break whoever uses the API: it would
    // return `null` where it used to return data.
    window.IntersectionObserver = OBSERVER;
    const el = mount({}, FAR);
    await new Promise((r) => setTimeout(r, 50));
    expect(el._engine, "it should not have loaded by itself").toBeFalsy();
    el.getMetadata();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "getMetadata did not wake the player").toBeTruthy();
  });

  it("the `lang` attribute does NOT wake it", async () => {
    // `<oim-player src lang="es">` is the normal way to write it, and the
    // attribute went through the public `setLang()`, which wakes the player.
    // All 24 in a list loaded anyway: 23 dormant and 24 with an engine, measured
    // in the browser. An attribute is configuration; a JS call is a request, and
    // only the second justifies a download.
    window.IntersectionObserver = OBSERVER;
    const el = document.createElement("oim-player");
    FAR(el);
    el.setAttribute("lang", "en");
    el.setAttribute("src", "anything.oim");
    document.body.appendChild(el);
    el.setAttribute("lang", "pt");
    await new Promise((r) => setTimeout(r, 100));
    expect(el._engine, "the lang attribute woke the player").toBeFalsy();
  });

  it("but a manual `setLang()` DOES", async () => {
    window.IntersectionObserver = OBSERVER;
    const el = document.createElement("oim-player");
    FAR(el);
    el.setAttribute("src", "anything.oim");
    document.body.appendChild(el);
    await nextFrame();
    el.setLang("en");
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("`play()` also wakes it", async () => {
    window.IntersectionObserver = OBSERVER;
    const el = mount({}, FAR);
    await new Promise((r) => setTimeout(r, 50));
    el.play();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("with `activate-on=hover` and no cursor over it, it loads but does not animate", async () => {
    window.IntersectionObserver = OBSERVER;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = mount({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "it should be built").toBeTruthy();
    expect(el.classList.contains("oim-player-paused"), "it should not animate without a cursor").toBe(true);
  });

  it("and when the cursor hovers it animates", async () => {
    window.IntersectionObserver = OBSERVER;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = mount({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    el.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
  });

  it("and when the cursor leaves it pauses again", async () => {
    window.IntersectionObserver = OBSERVER;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = mount({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    el.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
    el.dispatchEvent(new MouseEvent("mouseleave"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(true);
  });

  it("on touch, `hover` behaves like `visible`", async () => {
    // Without a cursor, requiring it would leave the file still forever on a phone.
    window.IntersectionObserver = OBSERVER;
    window.matchMedia = (q) => ({ matches: false, media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = mount({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
  });
  // A carousel animates only its centred card; visibility must not restart the
  // cards beside it.
  it("with `activate-on=manual`, visible loads but only animates with play()", async () => {
    window.IntersectionObserver = OBSERVER;
    const el = mount({ "activate-on": "manual" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "it should be built").toBeTruthy();
    expect(el.classList.contains("oim-player-paused")).toBe(true);
    el.play();
    expect(el.classList.contains("oim-player-paused")).toBe(false);
    el.pause();
    el._decide();
    expect(el.classList.contains("oim-player-paused"), "visibility does not resume it").toBe(true);
  });
});

describe("a dormant player reserves its gap", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    const est = document.getElementById("oim-player-gap");
    if (est) est.remove();
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("injects the gap rule when the first player connects", () => {
    document.body.appendChild(document.createElement("oim-player"));
    const est = document.getElementById("oim-player-gap");
    expect(est, "no gap was reserved: in a list the players stack up").toBeTruthy();
    expect(est.textContent).toContain("min-height");
  });

  it("the rule is switched off by a signal that ONLY exists after loading", () => {
    // It was tried with `.oim-player-host` and it was no good: that class is set
    // in `connectedCallback`, before anything is loaded, so the gap was NEVER
    // reserved. Measured in the browser: 24 players stacked on the same pixel and
    // all 24 downloading. The 358 tests passed with the bug in place.
    const el = document.createElement("oim-player");
    document.body.appendChild(el);
    const rule = document.getElementById("oim-player-gap").textContent;
    const signal = (rule.match(/:not\(([^)]+)\)/) || [])[1];
    expect(signal, "the rule is not switched off by anything").toBeTruthy();
    expect(
      el.matches(signal),
      `a freshly connected player already matches "${signal}", so the gap is not reserved`
    ).toBe(false);
  });

  it("and with zero specificity, so the author wins", () => {
    document.body.appendChild(document.createElement("oim-player"));
    expect(document.getElementById("oim-player-gap").textContent).toContain(":where(");
  });
});
