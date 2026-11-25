/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { verifyBytes } from './verify.js';

// `oim verify` checked every file against the 1.x schema, so a valid signed
// 2.0 file (every file the editor writes) was reported as broken.
const VECTORS_2 = join(dirname(createRequire(import.meta.url).resolve('@oim-media/spec/package.json')), 'vectors-2');
const files = readdirSync(VECTORS_2).filter((f) => f.endsWith('.oim.png'));

describe('oim verify on 2.0 files', () => {
  it.each(files)('%s is valid', async (file) => {
    const { issues } = await verifyBytes(readFileSync(join(VECTORS_2, file)));
    expect(issues).toEqual([]);
  });
});
