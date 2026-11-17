/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fileCache } from './file-cache';

const enc = (s: string) => new TextEncoder().encode(s);
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(enc(type), 4);
  out.set(data, 8);
  return out;
}
function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const text = (key: string, value: Uint8Array) => chunk('tEXt', cat(enc(key), new Uint8Array([0]), value));
const head = cat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', new Uint8Array(13)), chunk('IDAT', new Uint8Array([1, 2, 3])));
const seal = text('OIM_Seal', enc(JSON.stringify({ v: 1 })));
const META = new Uint8Array(200_000).fill(7);
const sealed = cat(head, seal, text('OIM_Data', META), chunk('IEND', new Uint8Array(0)));
const unsealed = cat(head, text('OIM_Data', META), chunk('IEND', new Uint8Array(0)));

let sent = 0;
let cancelled = false;
/** A server that streams in 1 KB pieces, counts bytes sent and honours Range. */
function serve(file: Uint8Array, ranges = true) {
  sent = 0;
  cancelled = false;
  global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const range = (init?.headers as any)?.Range as string | undefined;
    const from = ranges && range ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0;
    const body = file.subarray(from);
    let at = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (at >= body.length) return c.close();
        const piece = body.subarray(at, at + 1024);
        at += piece.length;
        sent += piece.length;
        c.enqueue(piece);
      },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { status: from ? 206 : 200 });
  }) as any;
}

beforeEach(() => fileCache.clear());

describe('fileCache.readPoster', () => {
  it('stops after the seal: the metadata is not downloaded', async () => {
    serve(sealed);
    const poster = await fileCache.readPoster('/w.oim');
    expect(poster?.seal).toEqual({ v: 1 });
    expect(sent).toBeLessThan(head.length + seal.length + 2048);
    // A real fetch keeps downloading unless the stream is cancelled.
    expect(cancelled).toBe(true);
  });

  it('the poster PNG is the image without seal or metadata', async () => {
    serve(sealed);
    const poster = await fileCache.readPoster('/w.oim');
    const bytes = new Uint8Array(await poster!.png.arrayBuffer());
    expect(bytes.length).toBe(head.length + 12);
  });

  it('the rest is fetched with Range, and the whole file comes out intact', async () => {
    serve(sealed);
    await fileCache.readPoster('/w.oim');
    const blob = await fileCache.getBlob('/w.oim');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(sealed);
    expect((global.fetch as any).mock.calls[1][1].headers.Range).toMatch(/^bytes=\d+-$/);
  });

  it('a server without Range sends it all again, and that is used as is', async () => {
    serve(sealed, false);
    await fileCache.readPoster('/w.oim');
    const blob = await fileCache.getBlob('/w.oim');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(sealed);
  });

  it('a file without seal is read once, whole, and gives no poster', async () => {
    serve(unsealed);
    expect(await fileCache.readPoster('/old.oim')).toBeNull();
    const blob = await fileCache.getBlob('/old.oim');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(unsealed);
    expect((global.fetch as any).mock.calls.length).toBe(1);
  });

  it('a failed read gives no poster and getBlob still works', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 500 })) as any;
    expect(await fileCache.readPoster('/x.oim')).toBeNull();
    serve(sealed);
    expect((await fileCache.getBlob('/x.oim')).size).toBe(sealed.length);
  });

  it('sniffing the type reuses the partial read: no metadata, no second request', async () => {
    serve(sealed);
    const bytes = await fileCache.sniff('/w.oim');
    expect(Array.from(bytes!.subarray(0, 4))).toEqual([137, 80, 78, 71]);
    expect(await fileCache.readPoster('/w.oim')).not.toBeNull();
    expect((global.fetch as any).mock.calls.length).toBe(1);
    expect(sent).toBeLessThan(head.length + seal.length + 2048);
  });
});

describe('fileCache: the file changes between the two reads', () => {
  it('a cached old head and a new file on the server never get spliced', async () => {
    // The browser answers the first read from its HTTP cache (old file); the Range read reaches the server (new file).
    const old = cat(head, seal, text('OIM_Data', new Uint8Array(300_000).fill(1)), chunk('IEND', new Uint8Array(0)));
    const fresh = cat(head, seal, text('OIM_Data', new Uint8Array(250_000).fill(2)), chunk('IEND', new Uint8Array(0)));
    let call = 0;
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      if (call++ === 0) return new Response(old as BodyInit, { status: 200, headers: { ETag: '"old"' } });
      // A real server only honours Range when If-Range still matches its file.
      if (h.Range && h['If-Range'] === '"fresh"') {
        const from = Number(/bytes=(\d+)-/.exec(h.Range)![1]);
        return new Response(fresh.subarray(from) as BodyInit, { status: 206, headers: { ETag: '"fresh"' } });
      }
      if (h.Range && !h['If-Range']) {
        const from = Number(/bytes=(\d+)-/.exec(h.Range)![1]);
        return new Response(fresh.subarray(from) as BodyInit, { status: 206, headers: { ETag: '"fresh"' } });
      }
      return new Response(fresh as BodyInit, { status: 200, headers: { ETag: '"fresh"' } });
    }) as any;
    await fileCache.readPoster('/c.oim');
    const blob = await fileCache.getBlob('/c.oim');
    const got = new Uint8Array(await blob.arrayBuffer());
    // Compared as a boolean: a failing toEqual on 250 KB arrays exhausts the worker.
    expect(got.length === fresh.length && got.every((b, i) => b === fresh[i])).toBe(true);
  });
});
