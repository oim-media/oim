/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// CRC32 para chunks PNG (polinomio estándar IEEE 802.3)
const crcTable: Int32Array = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Crea el chunk de metadatos OIM: un `zTXt` estándar (keyword 'OIM_Data' + 0x00 +
 * método 0 + flujo zlib). Binario, sin base64: el mismo contenedor que escribe el backend.
 */
export async function createOimPngChunk(metadata: any): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(new TextEncoder().encode(JSON.stringify(metadata)) as any);
  writer.close();
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  const keyword = new TextEncoder().encode('OIM_Data');
  const chunkData = new Uint8Array(keyword.length + 2 + compressed.length);
  chunkData.set(keyword, 0);
  // bytes keyword.length and keyword.length + 1 stay 0: NUL separator and compression method 0
  chunkData.set(compressed, keyword.length + 2);

  const chunkTypeAndData = new Uint8Array(4 + chunkData.length);
  chunkTypeAndData.set(new TextEncoder().encode('zTXt'), 0);
  chunkTypeAndData.set(chunkData, 4);

  const fullChunk = new Uint8Array(4 + 4 + chunkData.length + 4);
  const view = new DataView(fullChunk.buffer);
  view.setUint32(0, chunkData.length, false);
  fullChunk.set(chunkTypeAndData, 4);
  view.setUint32(4 + 4 + chunkData.length, crc32(chunkTypeAndData), false);
  return fullChunk;
}

/**
 * Inyecta un chunk de metadatos OIM en un búfer PNG inmediatamente después del chunk IHDR.
 */
export async function insertOimChunk(
  pngBuffer: ArrayBuffer,
  metadata: any
): Promise<Uint8Array> {
  const oimChunk = await createOimPngChunk(metadata);
  const view = new DataView(pngBuffer);
  let offset = 8;
  const chunks: Uint8Array[] = [new Uint8Array(pngBuffer, 0, 8)];

  while (offset < pngBuffer.byteLength) {
    const length = view.getUint32(offset, false);
    const typeOffset = offset + 4;
    const typeStr = String.fromCharCode(
      view.getUint8(typeOffset),
      view.getUint8(typeOffset + 1),
      view.getUint8(typeOffset + 2),
      view.getUint8(typeOffset + 3)
    );
    const totalChunkSize = 12 + length;

    // Saltar cualquier chunk OIM existente para evitar duplicados
    if (typeStr === 'tEXt' || typeStr === 'zTXt' || typeStr === 'iTXt') {
      const dataBytes = new Uint8Array(pngBuffer, typeOffset + 4, length);
      const nullIdx = dataBytes.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder().decode(dataBytes.slice(0, nullIdx));
        if (keyword === 'OIM_Data' || keyword === 'OIM_JSON_DATA' || keyword === 'OIM_Seal') {
          offset += totalChunkSize;
          continue;
        }
      }
    }

    chunks.push(new Uint8Array(pngBuffer, offset, totalChunkSize));
    if (typeStr === 'IHDR') {
      chunks.push(oimChunk);
    }
    offset += totalChunkSize;
  }

  let totalLength = 0;
  for (const c of chunks) totalLength += c.length;
  const result = new Uint8Array(totalLength);
  let cur = 0;
  for (const c of chunks) {
    result.set(c, cur);
    cur += c.length;
  }
  return result;
}
