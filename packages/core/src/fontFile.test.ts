/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFontInfo, fontEmbedding } from "./fontFile";

/** A minimal sfnt in memory: header, OS/2 (78 bytes) and a name table. No font file in the repo. */
function sfnt(o: { tag?: number; fsType?: number; weight?: number; italic?: boolean; family?: string; os2?: boolean } = {}): Uint8Array {
  const { tag = 0x00010000, fsType = 0, weight = 400, italic = false, family = "Test Sans", os2 = true } = o;
  const os2Len = 78;
  const utf16 = Array.from(family).flatMap((c) => [0, c.charCodeAt(0)]);
  const nameLen = 6 + 12 + utf16.length;
  const tables = os2 ? 2 : 1;
  const dirLen = 12 + tables * 16;
  const total = dirLen + (os2 ? os2Len : 0) + nameLen;
  const b = new Uint8Array(total);
  const v = new DataView(b.buffer);
  v.setUint32(0, tag);
  v.setUint16(4, tables);
  let rec = 12;
  let at = dirLen;
  const record = (t: string, len: number) => {
    for (let i = 0; i < 4; i++) b[rec + i] = t.charCodeAt(i);
    v.setUint32(rec + 8, at);
    v.setUint32(rec + 12, len);
    rec += 16;
    const start = at;
    at += len;
    return start;
  };
  if (os2) {
    const s = record("OS/2", os2Len);
    v.setUint16(s + 4, weight);
    v.setUint16(s + 8, fsType);
    v.setUint16(s + 62, italic ? 1 : 0);
  }
  const n = record("name", nameLen);
  v.setUint16(n, 0);           // format
  v.setUint16(n + 2, 1);       // count
  v.setUint16(n + 4, 6 + 12);  // stringOffset
  v.setUint16(n + 6, 3);       // platform: Windows
  v.setUint16(n + 8, 1);       // encoding: Unicode BMP
  v.setUint16(n + 10, 0x409);  // language
  v.setUint16(n + 12, 1);      // nameID: family
  v.setUint16(n + 14, utf16.length);
  v.setUint16(n + 16, 0);
  b.set(utf16, n + 18);
  return b;
}

describe("readFontInfo", () => {
  it("reads format, weight, italic and family", () => {
    expect(readFontInfo(sfnt({ weight: 700, italic: true, family: "Mi Fuente" }))).toEqual({
      format: "ttf", fsType: 0, weightClass: 700, italic: true, family: "Mi Fuente",
    });
  });
  it("recognises OTF and the 'true' TTF tag", () => {
    expect(readFontInfo(sfnt({ tag: 0x4f54544f }))?.format).toBe("otf");
    expect(readFontInfo(sfnt({ tag: 0x74727565 }))?.format).toBe("ttf");
  });
  it("is null for something that is not a font (also WOFF2)", () => {
    expect(readFontInfo(new TextEncoder().encode("wOF2...."))).toBeNull();
    expect(readFontInfo(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it("a truncated table directory is null, not a crash", () => {
    expect(readFontInfo(sfnt().subarray(0, 20))).toBeNull();
  });
});

describe("fontEmbedding", () => {
  const verdict = (fsType: number) => fontEmbedding(sfnt({ fsType }));
  it("installable (0) and editable (0x0008) are allowed", () => {
    expect(verdict(0).ok).toBe(true);
    expect(verdict(0x0008).ok).toBe(true);
  });
  it("the least restrictive permission wins (OpenType rule)", () => {
    expect(verdict(0x0002 | 0x0008).ok).toBe(true);
    expect(verdict(0x0004 | 0x0008).ok).toBe(true);
    expect(verdict(0x0002 | 0x0004)).toEqual({ ok: false, reason: "preview-only" });
  });
  it("restricted and preview-only are refused", () => {
    expect(verdict(0x0002)).toEqual({ ok: false, reason: "restricted" });
    expect(verdict(0x0004)).toEqual({ ok: false, reason: "preview-only" });
  });
  it("no-subsetting and bitmap-only are refused even if editable", () => {
    expect(verdict(0x0008 | 0x0100)).toEqual({ ok: false, reason: "no-subsetting" });
    expect(verdict(0x0008 | 0x0200)).toEqual({ ok: false, reason: "bitmap-only" });
  });
  it("without OS/2, or not a font, it is refused", () => {
    expect(fontEmbedding(sfnt({ os2: false }))).toEqual({ ok: false, reason: "no-os2" });
    expect(fontEmbedding(new Uint8Array([0, 0, 0, 0]))).toEqual({ ok: false, reason: "not-a-font" });
  });
});
