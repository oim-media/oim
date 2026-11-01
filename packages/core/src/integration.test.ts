/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { OimMetadataSchema } from './schema';
import { compressAndEncodeJSON, extractOIM } from './binary';

/**
 * Format round-trip: validate -> compress -> embed in the tEXt chunk -> extract
 * -> decode.
 *
 * This test used to start by calling `mapLayersToOimSlots`, the measurement
 * compiler that lived in `./serialize`. It was removed because it emitted a
 * dialect different from the backend's (it anchored the position to the center
 * of the slot), so the input slots are now a literal fixture in the REAL format:
 * the one that `POST /v1/oim/compile` produces and the player reads.
 *
 * Being a fixture and not a function is deliberate — that way the test pins the
 * file's contract, not the implementation of whoever writes it.
 */
describe('Integration Flow: Package -> Play', () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function buildMockPng(type: string, data: Uint8Array): Blob {
    const totalLen = 8 + 4 + 4 + data.length + 4;
    const buf = new ArrayBuffer(totalLen);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    bytes.set(pngHeader, 0);
    view.setUint32(8, data.length, false);
    for (let i = 0; i < 4; i++) {
      view.setUint8(12 + i, type.charCodeAt(i));
    }
    bytes.set(data, 16);
    view.setUint32(16 + data.length, 0, false);
    return new Blob([buf]);
  }

  it('validates, encodes into PNG, extracts and decodes without losing fields', async () => {
    // Slot as the backend compiler emits it for a 1000x1000 canvas: position as
    // a percentage of the canvas, sizes in `cqw` (proportional to the WIDTH),
    // and `width_px`/`height_px` with the raw values.
    const slots = [
      {
        id: 'header-slot',
        type: 'text' as const,
        align: 'center' as const,
        position: [10, 5] as [number, number],
        width_px: 800,
        height_px: 100,
        content: {
          en: 'Main Title',
          es: 'Título Principal',
          fr: 'Titre Principal'
        },
        style: {
          color: '#ffffff',
          fontSize: '3.2000cqw',
          width: '80.0000cqw',
          height: '10.0000cqw'
        }
      }
    ];

    const metadata = {
      version: '1.0',
      lang: ['es', 'en', 'fr'],
      slots
    };

    const validation = OimMetadataSchema.safeParse(metadata);
    expect(validation.success).toBe(true);

    const encodedDataString = await compressAndEncodeJSON(metadata);
    const keywordBytes = new TextEncoder().encode('OIM_Data');
    const valueBytes = new TextEncoder().encode(encodedDataString);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(valueBytes, keywordBytes.length + 1);

    const mockOimPng = buildMockPng('tEXt', chunkData);

    const extracted = await extractOIM(mockOimPng);
    expect(extracted.metadata).toBeDefined();

    const finalSlots = extracted.metadata?.slots;
    expect(finalSlots).toHaveLength(1);
    expect(finalSlots?.[0].id).toBe('header-slot');
    expect(finalSlots?.[0].content?.en).toBe('Main Title');
    expect(finalSlots?.[0].content?.es).toBe('Título Principal');

    // Geometry is what the player needs to place the layer, and it is exactly
    // what was lost when the .oim arrived in the other dialect.
    expect(finalSlots?.[0].position).toEqual([10, 5]);
    expect(finalSlots?.[0].width_px).toBe(800);
    expect(finalSlots?.[0].style?.fontSize).toBe('3.2000cqw');
  });
});
