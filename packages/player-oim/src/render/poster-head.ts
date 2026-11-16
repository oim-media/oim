/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The start of a .oim, enough to show its poster. Since 15 Nov the backend
 * writes the image, then a small OIM_Seal (the image hash signed on its own),
 * then the metadata. Reading up to the seal is enough to verify and paint the
 * poster; the metadata is fetched only if the work animates.
 */

const SEAL_KEY = 'OIM_Seal';
const DATA_KEYS = ['OIM_Data', 'OIM_JSON_DATA'];
const IEND = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

export type PosterHead =
  | { done: false }
  /** `seal` is null when the file has none before its metadata (older files): read it all. */
  | { done: true; seal: any | null; idat: Uint8Array[]; sealStart: number; end: number };

function keyOf(data: Uint8Array): string {
  const nul = data.indexOf(0);
  return nul === -1 ? '' : new TextDecoder('latin1').decode(data.subarray(0, nul));
}

/** Scans complete chunks of `buf` (the file's first bytes) for the poster seal. */
export function scanPosterHead(buf: Uint8Array): PosterHead {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= buf.length;) {
    const length = view.getUint32(at);
    const end = at + 12 + length;
    if (end > buf.length) return { done: false };
    const type = new TextDecoder('latin1').decode(buf.subarray(at + 4, at + 8));
    const data = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') return { done: true, seal: null, idat, sealStart: at, end };
    else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const key = keyOf(data);
      if (key === SEAL_KEY) {
        let seal: any = null;
        try { seal = JSON.parse(new TextDecoder().decode(data.subarray(key.length + 1))); } catch { seal = null; }
        return { done: true, seal: seal && typeof seal === 'object' ? seal : null, idat, sealStart: at, end };
      }
      if (DATA_KEYS.includes(key)) return { done: true, seal: null, idat, sealStart: at, end };
    }
    at = end;
  }
  return { done: false };
}

/** The poster as a standalone PNG: everything before the seal, then IEND. */
export function posterPng(buf: Uint8Array, sealStart: number): Uint8Array {
  const out = new Uint8Array(sealStart + IEND.length);
  out.set(buf.subarray(0, sealStart), 0);
  out.set(IEND, sealStart);
  return out;
}
