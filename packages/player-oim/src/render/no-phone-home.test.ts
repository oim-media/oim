/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * The claim in the privacy policy is that the player is local. This test is
 * what keeps it true: no fetch at all with a key we already carry.
 */
describe('el player no llama a casa', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('verifying a signature with a known key makes no request at all', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('no deberia salir a la red')));
    vi.stubGlobal('fetch', spy);

    const { verifyMetadataSignature } = await import('./security');
    await verifyMetadataSignature({ slots: [], signature: 'no-vale', key_version: 'v1' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('el code ya no menciona supabase ni la lista de dominios', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('./security.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toContain('blocked_domains');
    expect(src).not.toContain('isDomainGloballyBlocked');
  });
});
