/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractOIM } from '../../../core/src/binary.js';
import { normalizeLegacyKeys } from '../../../core/src/legacyKeys.js';
import { verifyMetadataSignature } from './security.js';
import { REFERENCE_OIM } from '../../../core/test/fixtures/index';

let cachedReference: Awaited<ReturnType<typeof extractOIM>>;

describe('reference.oim.png', { timeout: 15_000 }, () => {
  beforeAll(async () => {
    const blob = new Blob([readFileSync(REFERENCE_OIM)], { type: 'image/png' });
    cachedReference = await extractOIM(blob);
  });

  it('parses and its signature verifies against the embedded keys', async () => {
    const { metadata, imageHash } = cachedReference;
    expect(metadata.key_version).toBe('v1');
    expect(metadata.image_hash).toBe(imageHash);
    expect(metadata.slots).toHaveLength(9);
    expect(await verifyMetadataSignature(metadata)).toBe(true);
  });

  it('a pre-1.23.0 file (reedicion) verifies as read, and normalizing it breaks the signature', async () => {
    // The signature covers the keys as written. Verification must run before
    // normalizeLegacyKeys, never on its output.
    const { metadata } = cachedReference;
    expect(metadata.reedicion).toBe('publico');
    expect(await verifyMetadataSignature(metadata)).toBe(true);
    expect(await verifyMetadataSignature(normalizeLegacyKeys(metadata))).toBe(false);
  });

  it('the same metadata with one changed byte does not verify', async () => {
    const { metadata } = cachedReference;
    expect(await verifyMetadataSignature({ ...metadata, name: metadata.name + '!' })).toBe(false);
  });
});
