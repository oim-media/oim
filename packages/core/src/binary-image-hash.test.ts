/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The image hash that the player compares with the signed seal.
 *
 * It is the SHA-256 of the data of the concatenated `IDAT` chunks, the same as the
 * backend computes when packaging. Text chunks (including the `OIM_Data` itself) are
 * not included: the seal lives inside them.
 */

import { describe, it, expect } from "vitest";
import { extractOIM, imageDataHash } from "./binary";

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  return out; // CRC zeroed: the player does not check it and it does not affect the hash
}

function png(...parts: Uint8Array[]): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const all = [sig, chunk("IHDR", new Uint8Array(13)), ...parts, chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const A = new Uint8Array([1, 2, 3]);
const B = new Uint8Array([4, 5]);
const textChunk = chunk("tEXt", new TextEncoder().encode("Comment\0hola"));

describe("imageDataHash", () => {
  it("is the SHA-256 of all IDAT chunks concatenated", async () => {
    const file = png(chunk("IDAT", A), chunk("IDAT", B));
    expect(await imageDataHash(file.buffer)).toBe(await sha256Hex(new Uint8Array([1, 2, 3, 4, 5])));
  });

  it("text chunks do not count", async () => {
    expect(await imageDataHash(png(textChunk, chunk("IDAT", A)).buffer))
      .toBe(await imageDataHash(png(chunk("IDAT", A)).buffer));
  });

  it("other pixels, other hash", async () => {
    expect(await imageDataHash(png(chunk("IDAT", A)).buffer))
      .not.toBe(await imageDataHash(png(chunk("IDAT", B)).buffer));
  });

  it("without IDAT there is no hash", async () => {
    expect(await imageDataHash(png(textChunk).buffer)).toBeNull();
  });
});

describe("extractOIM", () => {
  it("returns the image hash alongside the metadata", async () => {
    const file = png(chunk("IDAT", A));
    const res = await extractOIM(new Blob([file]));
    expect(res.imageHash).toBe(await sha256Hex(A));
  });
});
