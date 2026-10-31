/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La prueba que faltaba.
 *
 * El player tiene un `IntersectionObserver` con `rootMargin: 200px` escrito
 * para no cargar lo que no se ve. No se usa nunca: `attributeChangedCallback`
 * llama a `_initPlayer()` en cuanto se parsea el `src`, antes de que
 * `connectedCallback` monte el observador.
 *
 * Medido en el navegador el 21 de agosto: 12 players, 1 visible, 12 motores.
 * Ninguna prueba lo veia.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const oim = fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/object_view.oim.png"));

/**
 * Un observador que solo avisa: quien decide es la geometria.
 *
 * Desde que `_decidir` lee `getBoundingClientRect()` en vez de fiarse del
 * informe del observador, "esta lejos" es un hecho geometrico y no una
 * propiedad del doble. Es lo correcto: el informe del observador puede nacer
 * antes de la maquetacion y mentir, que es justo el fallo que se arreglo.
 */
const OBSERVADOR = class {
  constructor(cb) { this._cb = cb; }
  observe(el) { this._cb([{ target: el }], this); }
  unobserve() {}
  disconnect() {}
};

/** Coloca el elemento donde queramos. happy-dom devuelve ceros para todo. */
function situar(el, { top, height = 400 }) {
  el.getBoundingClientRect = () => ({
    top, bottom: top + height, left: 0, right: 800, width: 800, height,
    x: 0, y: top, toJSON() { return this; },
  });
}
const LEJOS = (el) => situar(el, { top: 5000 });
const CERCA = (el) => situar(el, { top: 10 });

/** Deja pasar el frame que `_programarDecision` espera. */
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
    // El elemento se registra al importar el paquete construido, igual que en
    // `oim-player.test.js`. `dist-up-to-date.test.js` vigila que no sea viejo.
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("fuera del viewport NO crea motor", async () => {
    // happy-dom no implementa IntersectionObserver: se pone uno que nunca
    // reporta interseccion, que es justo el caso "esta lejos".
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
    // El ParallaxController mete uno en `window` en su constructor y solo lo
    // quita en `destroy()`. Medido en el navegador: 12 players, 1 visible, 12
    // listeners vivos.
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
    // Sin esto, la carga perezosa romperia a quien use la API: devolveria
    // `null` donde antes devolvia datos.
    window.IntersectionObserver = OBSERVADOR;
    const el = montar({}, LEJOS);
    await new Promise((r) => setTimeout(r, 50));
    expect(el._engine, "no deberia haberse cargado solo").toBeFalsy();
    el.getMetadata();
    await new Promise((r) => setTimeout(r, 150));
    expect(el._engine, "getMetadata no desperto al player").toBeTruthy();
  });

  it("el atributo `lang` NO lo despierta", async () => {
    // `<oim-player src lang="es">` es la forma normal de escribirlo, y el
    // atributo pasaba por `setLang()` publico, que despierta. Los 24 de una
    // lista se cargaban igual: 23 dormidos y 24 con motor, medido en el
    // navegador. Un atributo es configuracion; una llamada de JS es una
    // peticion, y solo la segunda justifica una descarga.
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
    // Sin cursor, exigirlo dejaria el archivo quieto para siempre en un movil.
    window.IntersectionObserver = OBSERVADOR;
    window.matchMedia = (q) => ({ matches: false, media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const el = montar({ "activate-on": "hover" });
    await new Promise((r) => setTimeout(r, 150));
    expect(el.classList.contains("oim-player-paused")).toBe(false);
  });
  // 11 Oct 2026: a carousel animates only its centred card; visibility must
  // not restart the cards beside it.
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
    // Se probo con `.oim-player-host` y no valia: esa clase se pone en
    // `connectedCallback`, antes de cargar nada, asi que el hueco no se
    // reservaba NUNCA. Medido en el navegador: 24 players apilados en el mismo
    // pixel y los 24 descargandose. Las 358 pruebas pasaban con el fallo.
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
