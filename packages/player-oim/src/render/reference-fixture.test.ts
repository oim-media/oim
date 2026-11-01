/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractOIM } from '../../../core/src/binary.js';
import { verifyMetadataSignature } from './security.js';
import { REFERENCE_OIM } from '../../../core/test/fixtures/index.ts';

async function loadReference() {
  const blob = new Blob([readFileSync(REFERENCE_OIM)], { type: 'image/png' });
  return extractOIM(blob);
}

describe('reference.oim.png', () => {
  it('parses and its signature verifies against the embedded keys', async () => {
    const { metadata, imageHash } = await loadReference();
    expect(metadata.key_version).toBe('v1');
    expect(metadata.image_hash).toBe(imageHash);
    expect(metadata.slots).toHaveLength(9);
    expect(await verifyMetadataSignature(metadata)).toBe(true);
  });

  it('the same metadata with one changed byte does not verify', async () => {
    const { metadata } = await loadReference();
    expect(await verifyMetadataSignature({ ...metadata, name: metadata.name + '!' })).toBe(false);
  });
});
