/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fileCache } from "./file-cache";

const blobDe = (n: number) => new Blob([new Uint8Array(n).fill(7)]);
function servir(tam = 32) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(blobDe(tam)) } as any));
}

describe("file-cache", () => {
  beforeEach(() => { fileCache.clear(); servir(); });

  it("la misma URL se descarga una sola vez, aunque la pidan cinco a la vez", async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => fileCache.getBlob("/a.oim")));
    expect((global.fetch as any).mock.calls.length).toBe(1);
    expect(fileCache.stats().fetches).toBe(1);
  });

  it("una URL relativa y su absoluta son el mismo archivo", async () => {
    await fileCache.getBlob("a.oim");
    await fileCache.getBlob(new URL("a.oim", document.baseURI).href);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("se verifica una sola vez", async () => {
    const run = vi.fn(async () => ({ metadata: { slots: [] }, security: "verified", announce: true }));
    await Promise.all([1, 2, 3].map(() => fileCache.getVerified("/a.oim", run)));
    expect(run).toHaveBeenCalledTimes(1);
    expect(fileCache.stats().verifications).toBe(1);
  });

  it("un rechazo (archivo alterado) se guarda: todos lo reciben y no se repite", async () => {
    const run = vi.fn(async () => ({ refused: true as const, security: "tampered", error: "altered" }));
    const r = await Promise.all([1, 2].map(() => fileCache.getVerified("/b.oim", run)));
    expect(r.every((x) => x.refused)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("una descarga que falla se reintenta la proxima vez", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 } as any));
    await expect(fileCache.getBlob("/c.oim")).rejects.toThrow();
    servir();
    await expect(fileCache.getBlob("/c.oim")).resolves.toBeInstanceOf(Blob);
  });

  it("una verificacion que falla (no un rechazo) se reintenta", async () => {
    const mala = vi.fn(async () => { throw new Error("boom"); });
    await expect(fileCache.getVerified("/d.oim", mala)).rejects.toThrow("boom");
    const buena = vi.fn(async () => ({ metadata: {}, security: "verified", announce: false }));
    await fileCache.getVerified("/d.oim", buena);
    expect(buena).toHaveBeenCalledTimes(1);
  });

  it("un Blob se guarda por identidad, y dos Blobs distintos no se mezclan", async () => {
    const b1 = blobDe(8), b2 = blobDe(8);
    const run = vi.fn(async () => ({ metadata: {}, security: "verified", announce: false }));
    await fileCache.getVerified(b1, run); await fileCache.getVerified(b1, run); await fileCache.getVerified(b2, run);
    expect(run).toHaveBeenCalledTimes(2);
    expect((global.fetch as any).mock.calls.length).toBe(0);
  });

  it("sniff lee los 16 primeros bytes de la misma descarga, sin pedir nada mas", async () => {
    const bytes = await fileCache.sniff("/e.oim");
    expect(bytes?.length).toBe(16);
    await fileCache.getBlob("/e.oim");
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("si la descarga falla, sniff devuelve null y no se cuelga", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("red")));
    await expect(fileCache.sniff("/f.oim")).resolves.toBeNull();
  });

  it("con mas de 20 archivos saca el menos usado, nunca uno pendiente", async () => {
    for (let i = 0; i < 20; i++) await fileCache.getBlob("/n" + i + ".oim");
    await fileCache.getBlob("/n0.oim"); // n0 becomes the most recently used
    let liberar: (v: any) => void = () => {};
    global.fetch = vi.fn(() => new Promise((r) => { liberar = r; })) as any; // a pending download
    const pendiente = fileCache.getBlob("/pendiente.oim");
    expect(fileCache.stats().entries).toBe(20); // n1 (least recently used) was evicted, not the pending one
    liberar({ ok: true, status: 200, blob: () => Promise.resolve(blobDe(4)) });
    await pendiente;
    servir();
    await fileCache.getBlob("/n0.oim");
    await fileCache.getBlob("/n1.oim");
    expect((global.fetch as any).mock.calls.length).toBe(1); // only n1 was downloaded again
  });

  it("tambien respeta el tope de 50 MB", async () => {
    servir(30 * 1024 * 1024);
    await fileCache.getBlob("/grande1.oim");
    await fileCache.getBlob("/grande2.oim");
    expect(fileCache.stats().bytes).toBeLessThanOrEqual(50 * 1024 * 1024);
    expect(fileCache.stats().entries).toBe(1);
  });
});
