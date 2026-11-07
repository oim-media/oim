// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Visual conformance metric (CANONICAL_SPEC.md, "Visual conformance"). Zero dependencies.
import zlib from 'node:zlib';

export const CHANNEL_TOLERANCE = 40;
export const MAX_AREA = 0.005;
export const MAX_BLOB = 24 * 24;

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG to RGBA. */
export const decodePng = (buf) => {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('unsupported PNG: bad signature');
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || (type !== 2 && type !== 6) || data[12] !== 0)
        throw new Error(`unsupported PNG: bit depth ${data[8]}, colour type ${type}, interlace ${data[12]}`);
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[row + i - bpp] : 0, b = y ? out[row - stride + i] : 0;
      const c = i >= bpp && y ? out[row - stride + i - bpp] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : NaN;
      if (Number.isNaN(pred)) throw new Error(`unsupported PNG: filter ${f}`);
      out[row + i] = (raw[src + i] + pred) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    rgba[p * 4] = out[p * bpp]; rgba[p * 4 + 1] = out[p * bpp + 1]; rgba[p * 4 + 2] = out[p * bpp + 2];
    rgba[p * 4 + 3] = bpp === 4 ? out[p * bpp + 3] : 255;
  }
  return { width, height, rgba };
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (kind, data) => {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length); head.write(kind, 4, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
};

/** Encodes RGBA as an 8-bit RGBA PNG (filter 0). */
export const encodePng = ({ width, height, rgba }) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

// Composite over white: a transparent render is a blank page, not black.
const onWhite = (rgba, i) => {
  const a = rgba[i + 3] / 255;
  return [0, 1, 2].map((k) => rgba[i + k] * a + 255 * (1 - a));
};

/** Compares a render against a golden under the visual conformance metric. */
export const compare = (golden, render) => {
  const { width: w, height: h } = golden;
  if (w !== render.width || h !== render.height)
    return { ok: false, reason: `size ${render.width}x${render.height}, expected ${w}x${h}`, area: 1, largestBlob: 0, mask: new Uint8Array(0) };
  const diff = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const g = onWhite(golden.rgba, p * 4), r = onWhite(render.rgba, p * 4);
    diff[p] = g.some((v, k) => Math.abs(Math.round(v) - Math.round(r[k])) > CHANNEL_TOLERANCE) ? 1 : 0;
  }
  // 3x3 erosion: antialiasing and hinting leave 1-2 px lines; a defect is an area.
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let all = 1;
      for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1 && all; dx++) all = diff[(y + dy) * w + x + dx];
      if (all) { mask[y * w + x] = 1; count++; }
    }
  let largestBlob = 0;
  const seen = new Uint8Array(w * h), stack = [];
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || seen[p]) continue;
    let size = 0;
    stack.push(p); seen[p] = 1;
    while (stack.length) {
      const q = stack.pop(), x = q % w;
      size++;
      for (const n of [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1])
        if (n >= 0 && n < w * h && mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
    largestBlob = Math.max(largestBlob, size);
  }
  const area = count / (w * h);
  const ok = area <= MAX_AREA && largestBlob <= MAX_BLOB;
  return { ok, reason: ok ? undefined : `area ${(area * 100).toFixed(3)}%, largest blob ${largestBlob}px`, area, largestBlob, mask };
};
