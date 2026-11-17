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
/** The poster read from the start of the file, before its metadata (spec 15 Nov). */
export interface PosterRead { png: Blob; seal: any; imageHash: string; }

interface Entry {
  blob?: Promise<Blob>; verified?: Promise<VerifyResult>; poster?: Promise<PosterRead | null>;
  /** Bytes already read by readPoster: getBlob asks only for what follows. */
  head?: Uint8Array;
  /** ETag or Last-Modified of the response the head came from: sent as If-Range. */
  validator?: string;
  bytes: number; lastUsed: number; pending: number;
}

function joined(parts: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

async function sha256Hex(parts: Uint8Array[]): Promise<string> {
  const all = joined(parts, parts.reduce((n, p) => n + p.length, 0));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reads the file until its poster seal. Without one, reads it all and caches it as the blob. */
async function readHead(src: string, e: Entry): Promise<PosterRead | null> {
  const res = await fetch(src);
  if (!res.ok) return null;
  if (!res.body) {
    // No streaming here: this response is the one download, so keep it as the file.
    const blob = await res.blob();
    e.bytes = blob.size;
    e.blob = Promise.resolve(blob);
    return null;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) { parts.push(value); total += value.length; }
    const buf = joined(parts, total);
    const head = done ? { done: true as const, seal: null } : scanPosterHead(buf);
    if (head.done && head.seal && 'idat' in head) {
      await reader.cancel().catch(() => {});
      e.head = buf;
      e.validator = res.headers.get("ETag") ?? res.headers.get("Last-Modified") ?? undefined;
      return { png: new Blob([posterPng(buf, head.sealStart) as Uint8Array<ArrayBuffer>], { type: 'image/png' }), seal: head.seal, imageHash: await sha256Hex(head.idat) };
    }
    if (done || head.done) {
      // No seal: this is the one download, so the rest is read and kept as the file.
      while (!done) {
        const next = await reader.read();
        if (next.done) break;
        parts.push(next.value); total += next.value.length;
      }
      const blob = new Blob([joined(parts, total) as Uint8Array<ArrayBuffer>]);
      e.bytes = blob.size;
      e.blob = Promise.resolve(blob);
      return null;
    }
  }
}

import { scanPosterHead, posterPng } from './poster-head.js';

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
      const head = e.head;
      const validator = e.validator;
      e.head = undefined;
      e.validator = undefined;
      // The head may have come from the HTTP cache: If-Range makes a changed file come back whole (200), never spliced.
      // shortcut: a server with neither ETag nor Last-Modified still gets a bare Range, as before.
      const rangeHeaders: Record<string, string> = { Range: "bytes=" + (head?.length ?? 0) + "-" };
      if (validator) rangeHeaders["If-Range"] = validator;
      e.blob = (head
        ? fetch(src, { headers: rangeHeaders }).then(async (res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          // 200: the server ignored Range and sent it all.
          return res.status === 206 ? new Blob([head as Uint8Array<ArrayBuffer>, await res.blob()]) : res.blob();
        })
        : fetch(src).then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.blob(); }))
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

  /** The verified-later poster from a partial read; null when the file has no seal or the read fails. */
  readPoster(src: string): Promise<PosterRead | null> {
    const e = entryFor(src);
    // Already downloaded whole: no partial read to make.
    if (!e.poster && e.blob) return Promise.resolve(null);
    if (!e.poster) {
      e.pending++;
      e.poster = readHead(src, e)
        .catch(() => null)
        .finally(() => { e.pending--; });
    }
    return e.poster;
  },

  /** The first 16 bytes, from the partial read when there is one: never a second download. */
  sniff(src: string | Blob): Promise<Uint8Array | null> {
    const fromBlob = (b: Promise<Blob>) => b.then((x) => x.slice(0, 16).arrayBuffer()).then((buf) => new Uint8Array(buf));
    if (typeof src !== "string") return fromBlob(Promise.resolve(src)).catch(() => null);
    return fileCache.readPoster(src)
      .then(() => {
        const e = entryFor(src);
        if (e.head) return e.head.slice(0, 16);
        return fromBlob(fileCache.getBlob(src));
      })
      .catch(() => null);
  },

  stats() { return { fetches, verifications, entries: byUrl.size, bytes: totalBytes() }; },

  clear(): void { byUrl.clear(); fetches = 0; verifications = 0; tick = 0; },
};

if (typeof window !== "undefined" && (window as any).__OIM_BENCH__ === true) {
  (window as any).__oimCacheStats = () => fileCache.stats();
}
