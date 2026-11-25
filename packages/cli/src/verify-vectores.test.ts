/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { extractOIM } from '@oim-media/core';
import { verifySignature } from './crypto.js';

// The conformance vectors are real .oim files signed by production. Until
// 24 Sept 2026 the CLI rejected every one of them: `serializeCanonical` was
// re-exported but never imported, so the call threw a ReferenceError that the
// catch turned into `false`. The only test fed it unsigned or tampered input,
// where `false` was the right answer for the wrong reason.
const VECTORS = join(dirname(createRequire(import.meta.url).resolve('@oim-media/spec/package.json')), 'vectors');
// Some vectors are deliberately unsigned (`"signed": false` in their .expected.json)
// and test the key, not authorship: a valid signature is not expected there.
const isSigned = (file: string) => {
  const expected = join(VECTORS, file.replace(/\.oim\.png$/, '.expected.json'));
  return !existsSync(expected) || JSON.parse(readFileSync(expected, 'utf8')).signed !== false;
};
const files = readdirSync(VECTORS).filter((f) => f.endsWith('.oim.png') && isSigned(f));

describe('oim verify contra los vectores de conformidad', () => {
  it('hay vectores que comprobar', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it.each(files)('acepta la firma real de %s', async (file) => {
    const result: any = await extractOIM(new Blob([readFileSync(join(VECTORS, file))]));
    expect(await verifySignature(result?.metadata ?? result)).toBe(true);
  });
});
