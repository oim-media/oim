/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * What an uploaded font file says about itself, and whether it may be embedded.
 *
 * Every font in a .oim is embedded (subset), so a font whose OS/2 `fsType`
 * forbids embedding or subsetting cannot be used. One function decides it for
 * the media Worker (upload) and the editor's server (export), so they cannot
 * disagree. Only TTF/OTF: WOFF2 tables are Brotli-compressed and a Worker
 * cannot read them.
 */

export type FontFormat = "ttf" | "otf";

export interface FontInfo {
  format: FontFormat;
  fsType: number | null;
  weightClass: number | null;
  italic: boolean;
  family: string | null;
}

export type EmbeddingRefusal = "not-a-font" | "no-os2" | "restricted" | "preview-only" | "no-subsetting" | "bitmap-only";
export type EmbeddingVerdict = { ok: true; info: FontInfo } | { ok: false; reason: EmbeddingRefusal };

interface Table { offset: number; length: number }

function readFamily(v: DataView, bytes: Uint8Array, name: Table | undefined): string | null {
  if (!name || name.length < 6) return null;
  const count = v.getUint16(name.offset + 2);
  const strings = name.offset + v.getUint16(name.offset + 4);
  let found: { id: number; text: string } | null = null;
  for (let i = 0; i < count; i++) {
    const r = name.offset + 6 + i * 12;
    if (r + 12 > name.offset + name.length) break;
    const platform = v.getUint16(r);
    const id = v.getUint16(r + 6);
    if (id !== 1 && id !== 16) continue;
    const len = v.getUint16(r + 8);
    const start = strings + v.getUint16(r + 10);
    if (start + len > bytes.length) continue;
    let text = "";
    if (platform === 3 || platform === 0) {
      for (let j = 0; j + 1 < len; j += 2) text += String.fromCharCode(v.getUint16(start + j));
    } else if (platform === 1) {
      for (let j = 0; j < len; j++) text += String.fromCharCode(bytes[start + j]);
    } else continue;
    // The typographic family (16) wins over the legacy one (1).
    if (!found || id === 16) found = { id, text };
  }
  return found ? found.text : null;
}

export function readFontInfo(bytes: Uint8Array): FontInfo | null {
  if (bytes.length < 12) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = v.getUint32(0);
  const format: FontFormat | null =
    tag === 0x00010000 || tag === 0x74727565 ? "ttf" : tag === 0x4f54544f ? "otf" : null;
  if (!format) return null;
  const numTables = v.getUint16(4);
  if (12 + numTables * 16 > bytes.length) return null;
  const tables = new Map<string, Table>();
  for (let i = 0; i < numTables; i++) {
    const r = 12 + i * 16;
    const t = String.fromCharCode(bytes[r], bytes[r + 1], bytes[r + 2], bytes[r + 3]);
    const offset = v.getUint32(r + 8);
    const length = v.getUint32(r + 12);
    if (offset + length <= bytes.length) tables.set(t, { offset, length });
  }
  let fsType: number | null = null;
  let weightClass: number | null = null;
  let italic = false;
  const os2 = tables.get("OS/2");
  if (os2 && os2.length >= 10) {
    weightClass = v.getUint16(os2.offset + 4);
    fsType = v.getUint16(os2.offset + 8);
    if (os2.length >= 64) italic = (v.getUint16(os2.offset + 62) & 1) === 1;
  }
  return { format, fsType, weightClass, italic, family: readFamily(v, bytes, tables.get("name")) };
}

export function fontEmbedding(bytes: Uint8Array): EmbeddingVerdict {
  const info = readFontInfo(bytes);
  if (!info) return { ok: false, reason: "not-a-font" };
  if (info.fsType === null) return { ok: false, reason: "no-os2" };
  const f = info.fsType;
  if (f & 0x0100) return { ok: false, reason: "no-subsetting" };
  if (f & 0x0200) return { ok: false, reason: "bitmap-only" };
  // Bits 1-3 are permission levels; when several are set the least restrictive applies.
  const permission = f & 0x000e;
  if (permission === 0 || permission & 0x0008) return { ok: true, info };
  if (permission & 0x0004) return { ok: false, reason: "preview-only" };
  return { ok: false, reason: "restricted" };
}
