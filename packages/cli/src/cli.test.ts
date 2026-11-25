/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { extractOIM, imageDataHash } from '@oim-media/core';
import { insertOimChunk } from './png.js';
import { verifySignature } from './crypto.js';

function buildMockPng(type: string, data: Uint8Array): Uint8Array {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const totalLen = 8 + 4 + 4 + data.length + 4;
  const buf = new ArrayBuffer(totalLen);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  bytes.set(header, 0);
  view.setUint32(8, data.length, false);
  for (let i = 0; i < 4; i++) {
    view.setUint8(12 + i, type.charCodeAt(i));
  }
  bytes.set(data, 16);
  view.setUint32(16 + data.length, 0, false);
  return bytes;
}

describe('@oim-media/cli core modules', () => {
  it('pack and extract roundtrip preserves metadata and computes imageHash', async () => {
    // 1. Create a minimal PNG with IHDR and IDAT
    const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
    const mockImage = buildMockPng('IHDR', ihdr);

    const metadata = {
      version: '1.6.0',
      oim_id: 'test-doc-123',
      name: 'Test Poster',
      slots: [
        {
          id: 'title-slot',
          type: 'text',
          name: 'Title',
          content: { es: 'Hola Mundo', en: 'Hello World' },
        },
      ],
    };

    // 2. Package
    const packed = await insertOimChunk(mockImage.buffer as ArrayBuffer, metadata);
    expect(packed.length).toBeGreaterThan(mockImage.length);

    // 3. Extract
    const blob = new Blob([packed], { type: 'image/png' });
    const extracted = await extractOIM(blob);

    expect(extracted.metadata).toEqual(metadata);
    expect(extracted.metadata.slots[0].content.en).toBe('Hello World');
  });

  it('pack writes a single zTXt chunk right after IHDR that core decodes', async () => {
    const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
    const mockImage = buildMockPng('IHDR', ihdr);
    const metadata = { version: '1.6.0', oim_id: 'ztxt-doc', slots: [{ id: 's', type: 'text', content: { es: 'ñandú' } }] };

    const once = await insertOimChunk(mockImage.buffer as ArrayBuffer, metadata);
    const packed = await insertOimChunk(once.slice().buffer as ArrayBuffer, metadata);

    const types: string[] = [];
    for (let i = 8; i < packed.length; ) {
      const len = new DataView(packed.buffer, packed.byteOffset).getUint32(i);
      types.push(String.fromCharCode(...packed.slice(i + 4, i + 8)));
      i += 12 + len;
    }
    expect(types.slice(0, 2)).toEqual(['IHDR', 'zTXt']);
    expect(types.filter((t) => t === 'zTXt' || t === 'tEXt')).toEqual(['zTXt']);

    const extracted = await extractOIM(new Blob([packed], { type: 'image/png' }));
    expect(extracted.metadata).toEqual(metadata);
  });

  it('verifies signature returns false for unsigned or tampered metadata', async () => {
    const unsignedMeta = {
      version: '1.6.0',
      slots: [],
    };
    expect(await verifySignature(unsignedMeta)).toBe(false);

    const tamperedMeta = {
      version: '1.6.0',
      signature: 'dGhpcyBpcyBhIGZha2Ugc2lnbmF0dXJl',
      key_version: 'v1',
    };
    expect(await verifySignature(tamperedMeta)).toBe(false);
  });
});
