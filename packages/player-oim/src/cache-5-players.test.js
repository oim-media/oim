/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const oim = fs.readFileSync(path.resolve(__dirname, "../../core/test/fixtures/object_view.oim.png"));
const pasar = (ms) => new Promise((r) => setTimeout(r, ms));
window.__OIM_BENCH__ = true;

describe("cinco players del mismo archivo", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    window.IntersectionObserver = class {
      constructor(cb) { this._cb = cb; }
      observe(el) { this._cb([{ target: el, isIntersecting: true, intersectionRatio: 1, boundingClientRect: { bottom: 100, top: 0, left: 0, right: 100 } }], this); }
      unobserve() {} disconnect() {}
    };
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      headers: { get: (h) => (h.toLowerCase() === "content-length" ? String(oim.length) : null) },
      arrayBuffer: () => Promise.resolve(oim.buffer.slice(oim.byteOffset, oim.byteOffset + oim.byteLength)),
      blob: () => Promise.resolve(new Blob([oim], { type: "image/png" })),
    }));
    if (!customElements.get("oim-player")) await import("../dist/oim-player.js");
  });

  it("se descarga una vez, sin HEAD ni Range, y los cinco cargan con sus propios metadatos", async () => {
    const cargados = [];
    const players = [1, 2, 3, 4, 5].map(() => {
      const el = document.createElement("oim-player");
      el.getBoundingClientRect = () => ({ top: 0, bottom: 400, left: 0, right: 800, width: 800, height: 400, x: 0, y: 0, toJSON() { return this; } });
      el.addEventListener("oim:loaded", (e) => cargados.push(e.detail.metadata));
      el.setAttribute("src", "/mismo.oim");
      document.body.appendChild(el);
      return el;
    });
    for (let i = 0; i < 40 && cargados.length < 5; i++) await pasar(50);

    const llamadas = global.fetch.mock.calls;
    expect(llamadas.filter(([, init]) => init && init.method === "HEAD")).toHaveLength(0);
    expect(llamadas.filter(([, init]) => init && init.headers && init.headers.Range)).toHaveLength(0);
    expect(llamadas.filter(([url]) => String(url).endsWith("/mismo.oim"))).toHaveLength(1);
    expect(cargados).toHaveLength(5);
    expect(new Set(cargados).size).toBe(5); // five distinct metadata objects
    cargados[0].__tocado = true;
    expect(cargados[1].__tocado).toBeUndefined();
    expect(players).toHaveLength(5);
    expect(window.__oimCacheStats().verifications).toBe(1);
  });

  it("cinco players con archivo corrupto terminan con securityStatus corrupt y una sola descarga", async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    function buildMockPng(type, data) {
      const totalLen = 8 + 4 + 4 + data.length + 4;
      const buf = new ArrayBuffer(totalLen);
      const view = new DataView(buf);
      const bytes = new Uint8Array(buf);
      bytes.set(pngHeader, 0);
      view.setUint32(8, data.length, false);
      for (let i = 0; i < 4; i++) view.setUint8(12 + i, type.charCodeAt(i));
      bytes.set(data, 16);
      view.setUint32(16 + data.length, 0, false);
      return new Uint8Array(buf);
    }
    const corruptMeta = { slots: "not-an-array" };
    const encoded = btoa(JSON.stringify(corruptMeta));
    const keywordBytes = new TextEncoder().encode("OIM_Data");
    const valueBytes = new TextEncoder().encode(encoded);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(valueBytes, keywordBytes.length + 1);
    const corruptPng = buildMockPng("tEXt", chunkData);

    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      headers: { get: (h) => (h.toLowerCase() === "content-length" ? String(corruptPng.length) : null) },
      arrayBuffer: () => Promise.resolve(corruptPng.buffer.slice(corruptPng.byteOffset, corruptPng.byteOffset + corruptPng.byteLength)),
      blob: () => Promise.resolve(new Blob([corruptPng], { type: "image/png" })),
    }));

    const errores = [];
    const players = [1, 2, 3, 4, 5].map(() => {
      const el = document.createElement("oim-player");
      el.getBoundingClientRect = () => ({ top: 0, bottom: 400, left: 0, right: 800, width: 800, height: 400, x: 0, y: 0, toJSON() { return this; } });
      el.addEventListener("error", (e) => errores.push(e.detail));
      el.setAttribute("src", "/corrupto.oim");
      document.body.appendChild(el);
      return el;
    });

    for (let i = 0; i < 40 && errores.length < 5; i++) await pasar(50);

    const llamadas = global.fetch.mock.calls;
    expect(llamadas.filter(([url]) => String(url).endsWith("/corrupto.oim"))).toHaveLength(1);
    expect(errores).toHaveLength(5);
    for (const p of players) {
      expect(p.getSecurityStatus()).toBe("corrupt");
    }
    expect(window.__oimCacheStats().verifications).toBe(2);
  });
});
