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
import path from "node:path";

const oim = fs.readFileSync(path.resolve(process.cwd(), "../core/test/fixtures/object_view.oim.png"));

/**
 * An observer that only reports: geometry is the one that decides.
 *
 * Since `_decidir` reads `getBoundingClientRect()` instead of trusting the
 * observer's report, "is far away" is a geometric fact and not a property of
 * the double. That is correct: the observer's report can be born before layout
 * and lie, which is exactly the failure that was fixed.
 */
const OBSERVADOR = class {
  constructor(cb) { this._cb = cb; }
  observe(el) { this._cb([{ target: el }], this); }
  unobserve() {}
  disconnect() {}
};

/** Places the element wherever we want. happy-dom returns zeros for everything. */
function situar(el, { top, height = 400 }) {
  el.getBoundingClientRect = () => ({
    top, bottom: top + height, left: 0, right: 800, width: 800, height,
    x: 0, y: top, toJSON() { return this; },
  });
}
const LEJOS = (el) => situar(el, { top: 5000 });
const CERCA = (el) => situar(el, { top: 10 });

/** Lets through the frame that `_programarDecision` waits for. */
const pasarUnFrame = () => new Promise((r) => setTimeout(r, 60));

function servirElArchivo() {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true, status: 200,
    headers: { get: (h) => h.toLowerCase() === "content-length" ? String(oim.length) : null },
    arrayBuffer: () => Promise.resolve(oim.buffer.slice(oim.byteOffset, oim.byteOffset + oim.byteLength)),
    blob: () => Promise.resolve(new Blob([oim], { type: "image/png" })),
  }));
}

describe("un player que nadie ve no se carga", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    // The element is registered when the built package is imported, as in
    // `oim-player.test.js`. `dist-up-to-date.test.js` checks that it is not stale.
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("fuera del viewport NO crea motor", async () => {
    // happy-dom does not implement IntersectionObserver: a stub is installed that
    // never reports an intersection, which is exactly the "far away" case.
    window.IntersectionObserver = OBSERVADOR;
    const el = document.createElement("oim-player");
    LEJOS(el);
    el.setAttribute("src", "cualquiera.oim");
    document.body.appendChild(el);
    await pasarUnFrame();
    expect(el._engine, "se creo el motor sin que nadie lo viera").toBeFalsy();
  });

  it("y tampoco pide el archivo", async () => {
    window.IntersectionObserver = OBSERVADOR;
    const espia = vi.fn(() => Promise.reject(new Error("no deberia pedirse")));
    const original = global.fetch;
    global.fetch = espia;
    try {
      const el = document.createElement("oim-player");
      LEJOS(el);
      el.setAttribute("src", "cualquiera.oim");
      document.body.appendChild(el);
      await pasarUnFrame();
      expect(espia, "descargo un archivo que nadie ha visto").not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});

describe("el contrato del estado de actividad", () => {
  let fetchOriginal;
  beforeEach(async () => {
    document.body.innerHTML = "";
    fetchOriginal = global.fetch;
    servirElArchivo();
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });
  afterEach(() => { global.fetch = fetchOriginal; });

  const montar = (attrs = {}, donde = CERCA) => {
    const el = document.createElement("oim-player");
    donde(el);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute("src", "cualquiera.oim");
    document.body.appendChild(el);
    return el;
  };

  it("a la vista SI se carga", async () => {
    window.IntersectionObserver = OBSERVADOR;
    const el = montar();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("al desconectarlo no queda ningun listener de mousemove en window", async () => {
    // The ParallaxController adds one to `window` in its constructor and only
    // removes it in `destroy()`. Measured in the browser: 12 players, 1 visible,
    // 12 live listeners.
    window.IntersectionObserver = OBSERVADOR;
    let vivos = 0;
    const add = window.addEventListener.bind(window);
    const rem = window.removeEventListener.bind(window);
    window.addEventListener = (t, f, o) => { if (t === "mousemove") vivos++; return add(t, f, o); };
    window.removeEventListener = (t, f, o) => { if (t === "mousemove") vivos--; return rem(t, f, o); };
    try {
      const el = montar();
      await new Promise((r) => setTimeout(r, 150));
      el.remove();
      await new Promise((r) => setTimeout(r, 50));
      expect(vivos, "quedaron listeners de mousemove tras quitar el player").toBe(0);
    } finally {
      window.addEventListener = add;
      window.removeEventListener = rem;
    }
  });

  it("`getMetadata()` despierta a un player dormido", async () => {
    // Without this, lazy loading would break whoever uses the API: it would
    // return `null` where it used to return data.
    window.IntersectionObserver = OBSERVADOR;
    const el = montar({}, LEJOS);
    await new Promise((r) => setTimeout(r, 50));
    expect(el._engine, "no deberia haberse cargado solo").toBeFalsy();
    el.getMetadata();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "getMetadata no desperto al player").toBeTruthy();
  });

  it("el atributo `lang` NO lo despierta", async () => {
    // `<oim-player src lang="es">` is the normal way to write it, and the
    // attribute went through the public `setLang()`, which wakes the player.
    // All 24 in a list loaded anyway: 23 dormant and 24 with an engine, measured
    // in the browser. An attribute is configuration; a JS call is a request, and
    // only the second justifies a download.
    window.IntersectionObserver = OBSERVADOR;
    const el = document.createElement("oim-player");
    LEJOS(el);
    el.setAttribute("lang", "en");
    el.setAttribute("src", "cualquiera.oim");
    document.body.appendChild(el);
    el.setAttribute("lang", "pt");
    await new Promise((r) => setTimeout(r, 100));
    expect(el._engine, "el atributo lang desperto al player").toBeFalsy();
  });

  it("pero `setLang()` llamado a mano SI", async () => {
    window.IntersectionObserver = OBSERVADOR;
    const el = document.createElement("oim-player");
    LEJOS(el);
    el.setAttribute("src", "cualquiera.oim");
    document.body.appendChild(el);
    await pasarUnFrame();
    el.setLang("en");
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("`play()` tambien lo despierta", async () => {
    window.IntersectionObserver = OBSERVADOR;
    const el = montar({}, LEJOS);
    await new Promise((r) => setTimeout(r, 50));
    el.play();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine).toBeTruthy();
  });

  it("con `activate-on=hover` y sin cursor encima, se carga pero no se anima", async () => {
    window.IntersectionObserver = OBSERVADOR;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = montar({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "deberia estar construido").toBeTruthy();
    expect(el.classList.contains("oim-player-paused"), "no deberia animarse sin cursor").toBe(true);
  });

  it("y al pasar el cursor se anima", async () => {
    window.IntersectionObserver = OBSERVADOR;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = montar({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    el.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
  });

  it("y al salir el cursor vuelve a pausarse", async () => {
    window.IntersectionObserver = OBSERVADOR;
    window.matchMedia = (q) => ({ matches: q.includes("hover: hover"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = montar({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    el.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
    el.dispatchEvent(new MouseEvent("mouseleave"));
    await new Promise((r) => setTimeout(r, 50));
    expect(el.classList.contains("oim-player-paused")).toBe(true);
  });

  it("en tactil, `hover` se comporta como `visible`", async () => {
    // Without a cursor, requiring it would leave the file still forever on a phone.
    window.IntersectionObserver = OBSERVADOR;
    window.matchMedia = (q) => ({ matches: false, media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = montar({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
  });
  // A carousel animates only its centred card; visibility must not restart the
  // cards beside it.
  it("con `activate-on=manual`, visible se carga pero solo se anima con play()", async () => {
    window.IntersectionObserver = OBSERVADOR;
    const el = montar({ "activate-on": "manual" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "deberia estar construido").toBeTruthy();
    expect(el.classList.contains("oim-player-paused")).toBe(true);
    el.play();
    expect(el.classList.contains("oim-player-paused")).toBe(false);
    el.pause();
    el._decidir();
    expect(el.classList.contains("oim-player-paused"), "la visibilidad no lo reanuda").toBe(true);
  });
});

describe("un player sin cargar reserva su hueco", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    const est = document.getElementById("oim-player-hueco");
    if (est) est.remove();
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("inyecta la regla del hueco al conectarse el primero", () => {
    document.body.appendChild(document.createElement("oim-player"));
    const est = document.getElementById("oim-player-hueco");
    expect(est, "no se reservo hueco: en una lista los players se apilan").toBeTruthy();
    expect(est.textContent).toContain("min-height");
  });

  it("la regla se apaga con una señal que SOLO existe tras cargar", () => {
    // It was tried with `.oim-player-host` and it was no good: that class is set
    // in `connectedCallback`, before anything is loaded, so the gap was NEVER
    // reserved. Measured in the browser: 24 players stacked on the same pixel and
    // all 24 downloading. The 358 tests passed with the bug in place.
    const el = document.createElement("oim-player");
    document.body.appendChild(el);
    const regla = document.getElementById("oim-player-hueco").textContent;
    const señal = (regla.match(/:not\(([^)]+)\)/) || [])[1];
    expect(señal, "la regla no se apaga con nada").toBeTruthy();
    expect(
      el.matches(señal),
      `un player recien conectado ya cumple "${señal}", asi que el hueco no se reserva`
    ).toBe(false);
  });

  it("y con especificidad cero, para que el autor mande", () => {
    document.body.appendChild(document.createElement("oim-player"));
    expect(document.getElementById("oim-player-hueco").textContent).toContain(":where(");
  });
});
