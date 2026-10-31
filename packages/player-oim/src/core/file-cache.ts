/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One download and one verification per file per page (13 Sept).
 *
 * Every <oim-player> used to fetch, parse and verify its file on its own, plus
 * a HEAD and a 16-byte Range request just to sniff the type: 5 players of the
 * same file meant up to 20 requests and 5 identical verifications. The verdict
 * depends on the page's origin, the same for every player here, so sharing it
 * is correct. Page memory only; nothing survives a reload.
 */

export interface VerifiedFile { refused?: false; metadata: any; security: string; announce: boolean; }
export interface RefusedFile { refused: true; security: string; error: string; }
export type VerifyResult = VerifiedFile | RefusedFile;

interface Entry { blob?: Promise<Blob>; verified?: Promise<VerifyResult>; bytes: number; lastUsed: number; pending: number; }

const MAX_ENTRIES = 20;
const MAX_BYTES = 50 * 1024 * 1024;

const byUrl = new Map<string, Entry>();
const byBlob = new WeakMap<Blob, Entry>();
let fetches = 0;
let verifications = 0;
let tick = 0;

function keyOf(src: string): string {
  try { return new URL(src, typeof document !== "undefined" ? document.baseURI : undefined).href; } catch { return src; }
}

function entryFor(src: string | Blob): Entry {
  if (typeof src !== "string") {
    let e = byBlob.get(src);
    if (!e) { e = { bytes: 0, lastUsed: 0, pending: 0 }; byBlob.set(src, e); }
    e.lastUsed = ++tick;
    return e;
  }
  const key = keyOf(src);
  let e = byUrl.get(key);
  if (!e) {
    e = { bytes: 0, lastUsed: 0, pending: 0 };
    byUrl.set(key, e);
  } else {
    e.lastUsed = ++tick;
  }
  return e;
}

function totalBytes(): number { let t = 0; byUrl.forEach((e) => { t += e.bytes; }); return t; }

/** Drops the least recently used idle entries until both limits hold. Never a pending one. */
function evict(): void {
  while (byUrl.size > MAX_ENTRIES || totalBytes() > MAX_BYTES) {
    let victim: string | null = null;
    let oldest = Infinity;
    byUrl.forEach((e, k) => { if (e.pending === 0 && e.lastUsed < oldest) { oldest = e.lastUsed; victim = k; } });
    if (victim === null) return;
    byUrl.delete(victim);
  }
}

function dropUrl(src: string | Blob, which: "blob" | "verified"): void {
  const e = typeof src === "string" ? byUrl.get(keyOf(src)) : byBlob.get(src);
  if (e) delete e[which];
}

export const fileCache = {
  getBlob(src: string | Blob): Promise<Blob> {
    if (typeof src !== "string") return Promise.resolve(src);
    const e = entryFor(src);
    if (!e.blob) {
      fetches++;
      e.pending++;
      evict();
      e.blob = fetch(src)
        .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.blob(); })
        .then((b) => { e.bytes = b.size; e.lastUsed = ++tick; evict(); return b; })
        .catch((err) => { dropUrl(src, "blob"); throw err; })
        .finally(() => { e.pending--; });
    }
    return e.blob;
  },

  getVerified(src: string | Blob, run: (blob: Blob) => Promise<VerifyResult>): Promise<VerifyResult> {
    const e = entryFor(src);
    if (!e.verified) {
      verifications++;
      e.pending++;
      e.verified = fileCache.getBlob(src)
        .then(run)
        .catch((err) => { dropUrl(src, "verified"); throw err; })
        .finally(() => { e.pending--; });
    }
    return e.verified;
  },

  sniff(src: string | Blob): Promise<Uint8Array | null> {
    return fileCache.getBlob(src)
      .then((b) => b.slice(0, 16).arrayBuffer())
      .then((buf) => new Uint8Array(buf))
      .catch(() => null);
  },

  stats() { return { fetches, verifications, entries: byUrl.size, bytes: totalBytes() }; },

  clear(): void { byUrl.clear(); fetches = 0; verifications = 0; tick = 0; },
};

if (typeof window !== "undefined" && (window as any).__OIM_BENCH__ === true) {
  (window as any).__oimCacheStats = () => fileCache.stats();
}
