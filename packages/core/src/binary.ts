/**
 * Binary packing, unpacking, compression (deflate), and base64 logic.
 * Handles extracting and embedding metadata chunks in PNG and OVM files.
 */

const MAX_DECOMPRESSED_METADATA_BYTES = 10 * 1024 * 1024; // 10MB (matches the backend limit in utils.py)

export async function decodeAndDecompressJSON(
  base64Str: string,
  maxBytes: number = MAX_DECOMPRESSED_METADATA_BYTES
): Promise<any> {
  const cleanB64 = base64Str.replace(/\s+/g, '');

  // Plain (uncompressed) base64 JSON
  try {
    const rawText = atob(cleanB64);
    if (rawText.trim().startsWith('{')) {
      if (rawText.length > maxBytes) {
        throw new Error(`Metadata exceeds the limit of ${maxBytes / (1024 * 1024)}MB (zip bomb detected)`);
      }
      return JSON.parse(rawText);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('zip bomb detected')) {
      throw err;
    }
  }

  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // zlib deflate first, then raw deflate (the OIM backend compresses with wbits=-15)
  try {
    return JSON.parse(await decompressBytes(bytes, 'deflate', maxBytes));
  } catch (e1: any) {
    if (e1.message && e1.message.includes('zip bomb detected')) {
      throw e1;
    }
    try {
      return JSON.parse(await decompressBytes(bytes, 'deflate-raw', maxBytes));
    } catch (e2: any) {
      if (e2.message && e2.message.includes('zip bomb detected')) {
        throw e2;
      }
      console.error('[OIM Core] Decompression failed for both deflate and deflate-raw:', e1, e2);
      throw e2;
    }
  }
}

export async function compressAndEncodeJSON(jsonObj: any): Promise<string> {
  const jsonStr = JSON.stringify(jsonObj);
  const stream = new Blob([jsonStr]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
  const buffer = await new Response(compressedStream).arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export async function decompressBytes(
  bytes: Uint8Array,
  format: 'deflate' | 'deflate-raw',
  maxBytes: number = MAX_DECOMPRESSED_METADATA_BYTES
): Promise<string> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  // .catch: on invalid data the stream errors both sides; without these handlers
  // the write/close rejections surface as unhandled even though the read below throws.
  writer.write(bytes as any).catch(function () {});
  writer.close().catch(function () {});

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new Error(`Decompressed metadata exceeds the limit of ${maxBytes / (1024 * 1024)}MB (zip bomb detected)`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(concatenated);
}

/**
 * SHA-256 (hex) of the concatenated IDAT payloads, or null without image data.
 * The backend signs this as `image_hash`, so the player can tell when signed
 * metadata was pasted onto a different image.
 */
export async function imageDataHash(buffer: ArrayBuffer): Promise<string | null> {
  const view = new DataView(buffer);
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let offset = 8; offset + 8 <= buffer.byteLength;) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
    if (type === 'IDAT') {
      parts.push(new Uint8Array(buffer, offset + 8, length));
      total += length;
    }
    offset += 12 + length;
  }
  if (parts.length === 0) return null;
  const joined = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { joined.set(p, at); at += p.length; }
  const digest = await crypto.subtle.digest('SHA-256', joined);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function extractOIM(blob: Blob): Promise<{ image: Blob; metadata: any; imageHash: string | null }> {
  const arrayBuffer = await blob.arrayBuffer();
  const view = new DataView(arrayBuffer);
  let offset = 8;
  let encodedData: string | null = null;
  let decodedMetadata: any = null; // set when we already have the raw JSON (skips base64 decoding)
  const originalChunks: any[] = [new Uint8Array(arrayBuffer, 0, 8)];

  while (offset < arrayBuffer.byteLength) {
    const length = view.getUint32(offset, false);
    const typeOffset = offset + 4;
    const typeStr = String.fromCharCode(
      view.getUint8(typeOffset),
      view.getUint8(typeOffset + 1),
      view.getUint8(typeOffset + 2),
      view.getUint8(typeOffset + 3),
    );
    const totalChunkSize = 4 + 4 + length + 4;

    if (typeStr === 'tEXt') {
      const dataBytes = new Uint8Array(arrayBuffer, typeOffset + 4, length);
      const nullIdx = dataBytes.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder().decode(dataBytes.slice(0, nullIdx));
        if (keyword === 'OIM_Data' || keyword === 'OIM_JSON_DATA') {
          const rawValueBytes = dataBytes.slice(nullIdx + 1);
          // The Python backend may embed raw deflate bytes directly in tEXt (not base64).
          // Try to decompress as raw bytes first; fall back to treating as base64/text string.
          let decompressed: string | null = null;
          try {
            decompressed = await decompressBytes(rawValueBytes, 'deflate');
          } catch (_) {
            try {
              decompressed = await decompressBytes(rawValueBytes, 'deflate-raw');
            } catch (_2) { /* not compressed, will fall back to text */ }
          }
          if (decompressed && decompressed.trim().startsWith('{')) {
            // Already decompressed: parse JSON directly, skip the base64 path
            try { decodedMetadata = JSON.parse(decompressed); } catch (_) {}
          } else {
            // Fall back: treat as plain text (base64 or raw JSON)
            encodedData = new TextDecoder('latin1').decode(rawValueBytes);
          }
          offset += totalChunkSize;
          continue;
        }
      }
    } else if (typeStr === 'zTXt') {
      const dataBytes = new Uint8Array(arrayBuffer, typeOffset + 4, length);
      const nullIdx = dataBytes.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder().decode(dataBytes.slice(0, nullIdx));
        if (keyword === 'OIM_Data' || keyword === 'OIM_JSON_DATA') {
          const compMethod = dataBytes[nullIdx + 1];
          const compressedBytes = dataBytes.slice(nullIdx + 2);
          if (compMethod === 0) {
            try {
              encodedData = await decompressBytes(compressedBytes, 'deflate');
            } catch (err) {
              try {
                encodedData = await decompressBytes(compressedBytes, 'deflate-raw');
              } catch (err2) {
                console.error('[OimPlayer] Failed to decompress zTXt chunk:', err, err2);
              }
            }
          }
          if (encodedData) {
            offset += totalChunkSize;
            continue;
          }
        }
      }
    } else if (typeStr === 'iTXt') {
      const dataBytes = new Uint8Array(arrayBuffer, typeOffset + 4, length);
      const nullIdx = dataBytes.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder().decode(dataBytes.slice(0, nullIdx));
        if (keyword === 'OIM_Data' || keyword === 'OIM_JSON_DATA') {
          const compFlag = dataBytes[nullIdx + 1];
          const compMethod = dataBytes[nullIdx + 2];
          const langBytes = dataBytes.slice(nullIdx + 3);
          const langNullIdx = langBytes.indexOf(0);
          if (langNullIdx !== -1) {
            const transBytes = langBytes.slice(langNullIdx + 1);
            const transNullIdx = transBytes.indexOf(0);
            if (transNullIdx !== -1) {
              const textBytes = transBytes.slice(transNullIdx + 1);
              if (compFlag === 1) {
                if (compMethod === 0) {
                  try {
                    encodedData = await decompressBytes(textBytes, 'deflate');
                  } catch (err) {
                    try {
                      encodedData = await decompressBytes(textBytes, 'deflate-raw');
                    } catch (err2) {
                      console.error('[OimPlayer] Failed to decompress iTXt chunk:', err, err2);
                    }
                  }
                }
              } else {
                encodedData = new TextDecoder().decode(textBytes);
              }
              if (encodedData) {
                offset += totalChunkSize;
                continue;
              }
            }
          }
        }
      }
    }
    originalChunks.push(new Uint8Array(arrayBuffer, offset, totalChunkSize));
    offset += totalChunkSize;
  }

  const cleanImageBlob = new Blob(originalChunks, { type: 'image/png' });
  let metadata = null;
  if (decodedMetadata) {
    metadata = decodedMetadata;
  } else if (encodedData) {
    // zTXt and compressed iTXt arrive already inflated as JSON text; tEXt arrives as base64.
    metadata = encodedData.trimStart().startsWith('{')
      ? JSON.parse(encodedData)
      : await decodeAndDecompressJSON(encodedData);
  }
  return { image: cleanImageBlob, metadata, imageHash: await imageDataHash(arrayBuffer) };
}

export async function fetchMetadataTail(src: string, tailBytes = 65536): Promise<any> {
  const res = await fetch(src, { headers: { Range: `bytes=-${tailBytes}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder().decode(bytes);
  const len = text.length;

  function hasOvmSig(t: string, start: number) {
    const head = t.substring(start, Math.min(start + 80, t.length));
    return head.indexOf('ovm_version') !== -1 || head.indexOf('slots') !== -1;
  }

  function findClosing(t: string, start: number) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') { depth++; }
      else if (ch === '}') { depth--; if (depth === 0) return t.substring(start, i + 1); }
    }
    return null;
  }

  for (let i = 0; i < len; i++) {
    if (text[i] !== '{') continue;
    if (!hasOvmSig(text, i)) continue;
    const json = findClosing(text, i);
    if (!json) continue;
    try { return JSON.parse(json); } catch (_) {}
  }

  for (let j = 0; j < len; j++) {
    if (text[j] !== '{') continue;
    const jjson = findClosing(text, j);
    if (!jjson) continue;
    try {
      const parsed = JSON.parse(jjson);
      if (parsed.slots || parsed.elements || parsed.layers) return parsed;
    } catch (_) {}
  }

  return null;
}

/**
 * Extracts OIM metadata from a ReadableStream<Uint8Array>, reading only the
 * header chunks and aborting the stream as soon as it finds the OIM_Data chunk
 * or the first IDAT chunk.
 *
 * This avoids downloading and loading images of several megabytes into memory
 * on mobile devices when only the interactive interface needs to initialize.
 */
export async function extractOIMMetadataFromStream(
  stream: ReadableStream<Uint8Array>
): Promise<any | null> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);

  function appendChunk(chunk: Uint8Array) {
    const next = new Uint8Array(buffer.length + chunk.length);
    next.set(buffer, 0);
    next.set(chunk, buffer.length);
    buffer = next;
  }

  try {
    // 1. Read at least the 8-byte PNG signature
    while (buffer.length < 8) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      appendChunk(value);
    }

    if (buffer.length < 8) return null;
    const view = () => new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    let offset = 8;
    while (true) {
      // We need at least 8 bytes to read the chunk's length and type
      while (offset + 8 > buffer.length) {
        const { done, value } = await reader.read();
        if (done || !value) return null;
        appendChunk(value);
      }

      const length = view().getUint32(offset, false);
      const typeStr = String.fromCharCode(
        buffer[offset + 4],
        buffer[offset + 5],
        buffer[offset + 6],
        buffer[offset + 7]
      );
      const totalChunkSize = 12 + length;

      // Wait until the chunk's full payload is available in the buffer
      while (offset + totalChunkSize > buffer.length) {
        const { done, value } = await reader.read();
        if (done || !value) return null;
        appendChunk(value);
      }

      // Process OIM metadata chunks
      if (typeStr === 'tEXt' || typeStr === 'zTXt') {
        const dataBytes = buffer.subarray(offset + 8, offset + 8 + length);
        const nullIdx = dataBytes.indexOf(0);
        if (nullIdx !== -1) {
          const keyword = new TextDecoder().decode(dataBytes.subarray(0, nullIdx));
          if (keyword === 'OIM_Data' || keyword === 'OIM_JSON_DATA') {
            const rawValueBytes = dataBytes.subarray(typeStr === 'zTXt' ? nullIdx + 2 : nullIdx + 1);
            let decompressed: string | null = null;
            try {
              decompressed = await decompressBytes(rawValueBytes, 'deflate');
            } catch (_) {
              try {
                decompressed = await decompressBytes(rawValueBytes, 'deflate-raw');
              } catch (_2) {}
            }

            if (decompressed && decompressed.trim().startsWith('{')) {
              await reader.cancel();
              return JSON.parse(decompressed);
            }

            // Fallback: base64 or direct text
            const text = new TextDecoder('latin1').decode(rawValueBytes);
            const meta = await decodeAndDecompressJSON(text);
            await reader.cancel();
            return meta;
          }
        }
      }

      // If we reach the IDAT chunks and have already passed the header without
      // finding tEXt, there is no need to keep reading megabytes of image blindly.
      if (typeStr === 'IDAT') {
        // In OIM the metadata chunk normally precedes IDAT.
        // If it is absent, abort the stream to save transfer.
        break;
      }

      if (typeStr === 'IEND') break;

      offset += totalChunkSize;
    }
  } catch (_) {
    // If reading the stream fails, return null
  } finally {
    try {
      await reader.cancel();
    } catch (_) {}
  }

  return null;
}

