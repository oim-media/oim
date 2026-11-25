/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { extractOIM } from '@oim-media/core';
import { upgradeOimPng } from './upgrade.js';

const spec = dirname(createRequire(import.meta.url).resolve('@oim-media/spec/package.json'));
const read = (dir: string, name: string) => new Uint8Array(readFileSync(join(spec, dir, `${name}.oim.png`)));
const hasChunk = (png: Uint8Array, keyword: string) => Buffer.from(png).includes(Buffer.from(`${keyword}\0`, 'latin1'));

describe('upgradeOimPng', () => {
  it('rewrites a 1.x file as an unsigned 2.0 document over the same image', async () => {
    const source = read('vectors', 'texture');
    expect(hasChunk(source, 'OIM_Seal')).toBe(true);
    const result = await upgradeOimPng(source);
    expect(result.from).toMatch(/^1\./);
    const { metadata } = await extractOIM(new Blob([result.bytes], { type: 'image/png' }));
    expect(metadata.oim).toMatch(/^2\./);
    expect(metadata.signature).toBeUndefined();
    expect(metadata.layers.length).toBeGreaterThan(0);
    expect(hasChunk(result.bytes, 'OIM_Seal')).toBe(false);
  });

  it('leaves a 2.0 file alone', async () => {
    const source = read('vectors-2', 'basic-text');
    const result = await upgradeOimPng(source);
    expect(result.from).toMatch(/^2\./);
    expect(result.bytes).toBe(source);
  });
});
