/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { scanPosterHead, posterPng } from './poster-head';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
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
const seal = { v: 1, alg: 'sha256-idat', image_hash: 'ab', key_version: 'v1', signature: 's' };
const text = (key: string, value: string) => chunk('tEXt', cat(enc(key), new Uint8Array([0]), enc(value)));
const file = cat(
  new Uint8Array(SIG),
  chunk('IHDR', new Uint8Array(13)),
  chunk('IDAT', new Uint8Array([1, 2])),
  chunk('IDAT', new Uint8Array([3])),
  text('OIM_Seal', JSON.stringify(seal)),
  chunk('zTXt', cat(enc('OIM_Data'), new Uint8Array([0, 0, 9, 9]))),
  chunk('IEND', new Uint8Array(0)),
);
const sealEnd = 8 + 25 + 14 + 13 + 12 + 'OIM_Seal'.length + 1 + JSON.stringify(seal).length;

describe('scanPosterHead', () => {
  it('needs more bytes until the seal is complete', () => {
    expect(scanPosterHead(file.subarray(0, sealEnd - 1)).done).toBe(false);
  });

  it('stops right after the seal, with the seal and the image data', () => {
    const head = scanPosterHead(file.subarray(0, sealEnd));
    expect(head).toMatchObject({ done: true, seal, end: sealEnd });
    if (!head.done) return;
    expect(Array.from(cat(...head.idat))).toEqual([1, 2, 3]);
  });

  it('reports no seal when the metadata comes first (older files)', () => {
    const old = cat(new Uint8Array(SIG), chunk('IHDR', new Uint8Array(13)), text('OIM_Data', 'x'), chunk('IDAT', new Uint8Array([1])));
    expect(scanPosterHead(old)).toMatchObject({ done: true, seal: null });
  });

  it('reports no seal when the file ends without one', () => {
    const bare = cat(new Uint8Array(SIG), chunk('IHDR', new Uint8Array(13)), chunk('IDAT', new Uint8Array([1])), chunk('IEND', new Uint8Array(0)));
    expect(scanPosterHead(bare)).toMatchObject({ done: true, seal: null });
  });

  it('a seal that is not JSON counts as no seal', () => {
    const bad = cat(new Uint8Array(SIG), chunk('IHDR', new Uint8Array(13)), chunk('IDAT', new Uint8Array([1])), text('OIM_Seal', '{'));
    expect(scanPosterHead(bad)).toMatchObject({ done: true, seal: null });
  });
});

describe('posterPng', () => {
  it('is the image part plus IEND, without seal or metadata', () => {
    const head = scanPosterHead(file);
    if (!head.done) throw new Error('not done');
    const png = posterPng(file, head.sealStart);
    const types: string[] = [];
    for (let i = 8; i < png.length;) {
      const n = new DataView(png.buffer, png.byteOffset).getUint32(i);
      types.push(new TextDecoder().decode(png.subarray(i + 4, i + 8)));
      i += 12 + n;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IDAT', 'IEND']);
  });
});
