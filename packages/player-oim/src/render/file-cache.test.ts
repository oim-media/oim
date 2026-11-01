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

  it("the same URL is downloaded once, even if five requests ask for it at the same time", async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => fileCache.getBlob("/a.oim")));
    expect((global.fetch as any).mock.calls.length).toBe(1);
    expect(fileCache.stats().fetches).toBe(1);
  });

  it("a relative URL and its absolute one are the same file", async () => {
    await fileCache.getBlob("a.oim");
    await fileCache.getBlob(new URL("a.oim", document.baseURI).href);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("is verified once", async () => {
    const run = vi.fn(async () => ({ metadata: { slots: [] }, security: "verified", announce: true }));
    await Promise.all([1, 2, 3].map(() => fileCache.getVerified("/a.oim", run)));
    expect(run).toHaveBeenCalledTimes(1);
    expect(fileCache.stats().verifications).toBe(1);
  });

  it("a rejection (altered file) is stored: everyone receives it and it is not repeated", async () => {
    const run = vi.fn(async () => ({ refused: true as const, security: "tampered", error: "altered" }));
    const r = await Promise.all([1, 2].map(() => fileCache.getVerified("/b.oim", run)));
    expect(r.every((x) => x.refused)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a download that fails is retried the next time", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 } as any));
    await expect(fileCache.getBlob("/c.oim")).rejects.toThrow();
    servir();
    await expect(fileCache.getBlob("/c.oim")).resolves.toBeInstanceOf(Blob);
  });

  it("a verification that fails (not a rejection) is retried", async () => {
    const mala = vi.fn(async () => { throw new Error("boom"); });
    await expect(fileCache.getVerified("/d.oim", mala)).rejects.toThrow("boom");
    const buena = vi.fn(async () => ({ metadata: {}, security: "verified", announce: false }));
    await fileCache.getVerified("/d.oim", buena);
    expect(buena).toHaveBeenCalledTimes(1);
  });

  it("a Blob is stored by identity, and two different Blobs are not mixed", async () => {
    const b1 = blobDe(8), b2 = blobDe(8);
    const run = vi.fn(async () => ({ metadata: {}, security: "verified", announce: false }));
    await fileCache.getVerified(b1, run); await fileCache.getVerified(b1, run); await fileCache.getVerified(b2, run);
    expect(run).toHaveBeenCalledTimes(2);
    expect((global.fetch as any).mock.calls.length).toBe(0);
  });

  it("sniff reads the first 16 bytes of the same download, without asking for anything else", async () => {
    const bytes = await fileCache.sniff("/e.oim");
    expect(bytes?.length).toBe(16);
    await fileCache.getBlob("/e.oim");
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it("if the download fails, sniff returns null and does not hang", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("red")));
    await expect(fileCache.sniff("/f.oim")).resolves.toBeNull();
  });

  it("with more than 20 files it evicts the least used, never a pending one", async () => {
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

  it("also respects the 50 MB cap", async () => {
    servir(30 * 1024 * 1024);
    await fileCache.getBlob("/grande1.oim");
    await fileCache.getBlob("/grande2.oim");
    expect(fileCache.stats().bytes).toBeLessThanOrEqual(50 * 1024 * 1024);
    expect(fileCache.stats().entries).toBe(1);
  });
});
