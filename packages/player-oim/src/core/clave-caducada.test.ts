/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { securityVerdict, isRefused, keyExpiredForFile } from './security';
import { EMBEDDED_KEYS } from './keys';

const signed = { signature: 'x', key_version: 'v1', image_hash_alg: 'sha256-idat', image_hash: 'ab' };

describe('expired_key', () => {
  afterEach(() => vi.useRealTimers());

  it('a valid signature on an expired key is expired_key, not verified', () => {
    expect(securityVerdict({ isSigned: true, isSigValid: true, keyExpired: true, metadata: signed, imageHash: 'ab' })).toBe('expired_key');
  });

  it('a forged signed_at in the past does not rescue a compromised key', async () => {
    // A key that was compromised gets a verify_until in the next player.
    EMBEDDED_KEYS.push({ kid: 'vX', jwk: {}, verify_until: '2028-06-30T23:59:59Z' });
    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2028-08-01T00:00:00Z'));
      const forged = { ...signed, key_version: 'vX', signed_at: '2026-07-01T00:00:00Z' };
      expect(await keyExpiredForFile(forged)).toBe(true);
      expect(securityVerdict({ isSigned: true, isSigValid: true, keyExpired: await keyExpiredForFile(forged), metadata: forged, imageHash: 'ab' })).toBe('expired_key');
    } finally {
      EMBEDDED_KEYS.pop();
    }
  });

  it('v1 is not expired by a routine rotation, even decades later', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2060-01-01T00:00:00Z'));
    expect(await keyExpiredForFile(signed)).toBe(false);
  });

  it('tampering still wins over expiry: an altered file is refused', () => {
    expect(securityVerdict({ isSigned: true, isSigValid: false, keyExpired: true, metadata: signed, imageHash: 'ab' })).toBe('invalid_signature');
  });

  it('expired_key is not a refusal: the base image is still shown', () => {
    expect(isRefused('expired_key')).toBe(false);
  });

  it('an unsigned file is not judged by key expiry', () => {
    expect(securityVerdict({ isSigned: false, isSigValid: true, keyExpired: true, metadata: {}, imageHash: null })).toBe('unsigned');
  });

  it('v1 is trusted today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    expect(await keyExpiredForFile(signed)).toBe(false);
  });

  it('both load paths ask about expiry and paint only the base for it', async () => {
    // The verdict is useless if a load path never passes keyExpired: the worker
    // and the main thread each build their own call to securityVerdict.
    const fs = await import('node:fs');
    for (const rel of ['./worker.ts', '../engines/ImageEngine.ts']) {
      const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
      expect(src, rel).toMatch(/securityVerdict\(\{[^}]*keyExpired[^}]*\}\)/);
      expect(src, rel).toMatch(/=== 'unsigned' \|\| \w+ === 'expired_key'/);
    }
  });
});
