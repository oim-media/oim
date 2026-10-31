import { describe, it, expect } from 'vitest';
import { compressAndEncodeJSON, decodeAndDecompressJSON } from './binary';

describe('compressAndEncodeJSON / decodeAndDecompressJSON', () => {
  it('round-trips simple object', async () => {
    const original = { slots: [{ id: 'test', content: { es: 'Hola' } }] };
    const encoded = await compressAndEncodeJSON(original);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = await decodeAndDecompressJSON(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips nested object', async () => {
    const original = {
      version: '1.0',
      lang: ['es', 'en', 'zh'],
      slots: [
        {
          id: 'title',
          content: { es: 'Título', en: 'Title', zh: '标题' },
          position: [50, 20],
          style: { color: '#f59e0b', fontSize: '24px', textAlign: 'center' },
        },
      ],
    };
    const encoded = await compressAndEncodeJSON(original);
    const decoded = await decodeAndDecompressJSON(encoded);
    expect(decoded).toEqual(original);
  });

  it('handles empty object', async () => {
    const original = {};
    const encoded = await compressAndEncodeJSON(original);
    const decoded = await decodeAndDecompressJSON(encoded);
    expect(decoded).toEqual(original);
  });

  it('decodes RAW deflate payloads (backend format, wbits=-15)', async () => {
    // The production backend compresses with zlib raw deflate (no zlib header).
    const original = { oim: 'true', slots: [{ id: 's1', content: { es: 'hola', en: 'hello' } }] };
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(JSON.stringify(original)) as any);
    writer.close();
    const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    let binary = '';
    for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]);
    const encoded = btoa(binary);
    const decoded = await decodeAndDecompressJSON(encoded);
    expect(decoded).toEqual(original);
  });

  it('decodes plain (uncompressed) base64 JSON', async () => {
    const original = { version: '1.0', slots: [] };
    const encoded = btoa(JSON.stringify(original));
    const decoded = await decodeAndDecompressJSON(encoded);
    expect(decoded).toEqual(original);
  });

  it('rejects garbage without unhandled rejections', async () => {
    await expect(decodeAndDecompressJSON('AAAABBBBCCCC')).rejects.toBeDefined();
  });

  it('rejects zip bomb / payload exceeding maxBytes', async () => {
    const largePayload = { filler: 'A'.repeat(50000) };
    const encoded = await compressAndEncodeJSON(largePayload);
    await expect(decodeAndDecompressJSON(encoded, 1000)).rejects.toThrow(/Zip Bomb Detectado/);
  });
});

describe('extractOIM', () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function buildMockPng(type: string, data: Uint8Array): Blob {
    const totalLen = 8 + 4 + 4 + data.length + 4;
    const buf = new ArrayBuffer(totalLen);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // PNG Header
    bytes.set(pngHeader, 0);

    // Chunk Length
    view.setUint32(8, data.length, false);

    // Chunk Type
    for (let i = 0; i < 4; i++) {
      view.setUint8(12 + i, type.charCodeAt(i));
    }

    // Chunk Data
    bytes.set(data, 16);

    // Dummy CRC
    view.setUint32(16 + data.length, 0, false);

    return new Blob([buf]);
  }

  it('extracts metadata from tEXt chunk', async () => {
    const original = { slots: [{ id: 'test', content: { es: 'hola' } }] };
    const encoded = await compressAndEncodeJSON(original);

    // Format: Keyword (OIM_Data) + null separator (0) + value
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    const valueBytes = new TextEncoder().encode(encoded);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(valueBytes, keywordBytes.length + 1);

    const mockPng = buildMockPng('tEXt', chunkData);
    const extracted = await import('./binary').then(m => m.extractOIM(mockPng));
    expect(extracted.metadata).toEqual(original);
  });

  it('extracts metadata from zTXt chunk', async () => {
    const original = { slots: [{ id: 'test', content: { es: 'hola' } }] };
    const encoded = await compressAndEncodeJSON(original);

    // Format: Keyword (OIM_Data) + null separator (0) + compression method (0) + compressed value (zlib/deflate)
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    
    // Compress encoded string with deflate (standard zlib)
    const ds = new CompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(new TextEncoder().encode(encoded) as any);
    writer.close();
    const compressedBuffer = await new Response(ds.readable).arrayBuffer();
    const compressedBytes = new Uint8Array(compressedBuffer);

    const chunkData = new Uint8Array(keywordBytes.length + 1 + 1 + compressedBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData[keywordBytes.length + 1] = 0; // comp method
    chunkData.set(compressedBytes, keywordBytes.length + 2);

    const mockPng = buildMockPng('zTXt', chunkData);
    const extracted = await import('./binary').then(m => m.extractOIM(mockPng));
    expect(extracted.metadata).toEqual(original);
  });

  it('extracts metadata from iTXt chunk', async () => {
    const original = { slots: [{ id: 'test', content: { es: 'hola' } }] };
    const encoded = await compressAndEncodeJSON(original);

    // Format: Keyword (OIM_Data) + null (0) + compFlag (1) + compMethod (0) + langTag + null (0) + transKeyword + null (0) + compressedText
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    
    // Compress encoded string with deflate (standard zlib)
    const ds = new CompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(new TextEncoder().encode(encoded) as any);
    writer.close();
    const compressedBuffer = await new Response(ds.readable).arrayBuffer();
    const compressedBytes = new Uint8Array(compressedBuffer);

    // Build iTXt structure:
    // keyword (OIM_Data) + 0 + compFlag(1) + compMethod(0) + langTag(null terminated, here empty) + transKeyword(null terminated, here empty) + compressedBytes
    const chunkData = new Uint8Array(keywordBytes.length + 1 + 1 + 1 + 1 + 1 + compressedBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData[keywordBytes.length + 1] = 1; // compFlag = 1
    chunkData[keywordBytes.length + 2] = 0; // compMethod = 0
    chunkData[keywordBytes.length + 3] = 0; // null separator for langTag (empty)
    chunkData[keywordBytes.length + 4] = 0; // null separator for transKeyword (empty)
    chunkData.set(compressedBytes, keywordBytes.length + 5);

    const mockPng = buildMockPng('iTXt', chunkData);
    const extracted = await import('./binary').then(m => m.extractOIM(mockPng));
    expect(extracted.metadata).toEqual(original);
  });

  it('extractOIMMetadataFromStream extracts metadata early and aborts before downloading whole stream', async () => {
    const original = { slots: [{ id: 'streaming-slot', content: { es: 'hola stream' } }] };
    const encoded = await compressAndEncodeJSON(original);
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    const valueBytes = new TextEncoder().encode(encoded);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(valueBytes, keywordBytes.length + 1);

    const mockPng = buildMockPng('tEXt', chunkData);
    const { extractOIMMetadataFromStream } = await import('./binary');

    const pngBytes = new Uint8Array(await mockPng.arrayBuffer());

    // Simular un PNG grande (con datos de imagen/IDAT posteriores)
    // El stream debe abortar tan pronto se lean los metadatos sin descargar el resto.
    const trailingBytesCount = 100 * 1024; // 100 KB de imagen simulada
    let streamCancelled = false;
    let totalBytesEnqueued = 0;
    let cursor = 0;
    const chunkSize = 64;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (cursor < pngBytes.length) {
          const piece = pngBytes.subarray(cursor, Math.min(cursor + chunkSize, pngBytes.length));
          controller.enqueue(piece);
          cursor += piece.length;
          totalBytesEnqueued += piece.length;
        } else if (cursor < pngBytes.length + trailingBytesCount) {
          const remaining = pngBytes.length + trailingBytesCount - cursor;
          const pieceSize = Math.min(chunkSize, remaining);
          controller.enqueue(new Uint8Array(pieceSize));
          cursor += pieceSize;
          totalBytesEnqueued += pieceSize;
        } else {
          controller.close();
        }
      },
      cancel() {
        streamCancelled = true;
      },
    });

    const meta = await extractOIMMetadataFromStream(stream);
    expect(meta).toEqual(original);
    expect(streamCancelled).toBe(true);
    // Verificar que no se descargaron los 100 KB posteriores
    expect(totalBytesEnqueued).toBeLessThan(pngBytes.length + 1024);
  });
});
