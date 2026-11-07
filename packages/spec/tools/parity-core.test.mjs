// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodePng, encodePng, compare } from './parity-core.mjs';

const img = (w, h, fill = [255, 255, 255, 255]) => {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set(fill, i);
  return { width: w, height: h, rgba };
};
const paint = (im, x0, y0, w, h, c = [0, 0, 0, 255]) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) im.rgba.set(c, (y * im.width + x) * 4);
  return im;
};
const roundtrip = (im) => decodePng(encodePng(im));

test('png roundtrip', () => {
  const a = paint(img(7, 5), 1, 1, 2, 2, [10, 20, 30, 200]);
  assert.deepEqual(roundtrip(a), a);
});

test('identical images pass', () => {
  const r = compare(img(100, 100), img(100, 100));
  assert.equal(r.ok, true);
  assert.equal(r.area, 0);
});

test('1px antialias line is ignored', () => {
  const r = compare(img(100, 100), paint(img(100, 100), 0, 50, 100, 1));
  assert.equal(r.ok, true);
});

test('30x30 block fails on blob', () => {
  const r = compare(img(100, 100), paint(img(100, 100), 10, 10, 30, 30));
  assert.equal(r.ok, false);
  assert.ok(r.largestBlob > 576);
});

test('scattered dots fail on area', () => {
  const b = img(200, 200);
  for (let y = 0; y < 196; y += 6) for (let x = 0; x < 196; x += 6) paint(b, x, y, 4, 4);
  const r = compare(img(200, 200), b);
  assert.ok(r.largestBlob <= 576);
  assert.equal(r.ok, false);
});

test('delta 40 is equal, 41 differs', () => {
  const v = (d) => compare(img(10, 10), paint(img(10, 10), 0, 0, 10, 10, [255 - d, 255, 255, 255])).area;
  assert.equal(v(40), 0);
  assert.ok(v(41) > 0);
});

test('size mismatch', () => {
  const r = compare(img(100, 100), img(100, 101));
  assert.equal(r.ok, false);
  assert.match(r.reason, /100x100/);
  assert.match(r.reason, /100x101/);
});

test('transparent equals white', () => {
  assert.equal(compare(img(10, 10), img(10, 10, [0, 0, 0, 0])).area, 0);
});

test('unsupported PNG', () => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 3, 0, 0, 0]);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  assert.throws(() => decodePng(png), /unsupported PNG/);
});
