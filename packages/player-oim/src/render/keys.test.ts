/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { EMBEDDED_KEYS, embeddedKey, effectiveNotAfter, keysEndpoint, signatureIsWithinKeyWindow, keyExpiredAt, CLOCK_SKEW_MS } from './keys';

describe('keys', () => {
  it('v1 comes embedded, so the common case needs no network', () => {
    const k = embeddedKey('v1');
    expect(k).not.toBeNull();
    expect(k!.jwk.kty).toBe('EC');
    expect(k!.jwk.crv).toBe('P-256');
  });

  it('getPublicKey returns a plain JWK, not the PlayerKey wrapper', async () => {
    // It goes straight into crypto.subtle.importKey: a wrapper would only show
    // up at runtime, inside a catch that reports "signature verification failed".
    const { getPublicKey } = await import('./security');
    const jwk = await getPublicKey('v1');
    expect(jwk.kty).toBe('EC');
    expect(jwk.jwk).toBeUndefined();
    expect(jwk.kid).toBeUndefined();
  });

  it('an unknown kid is not invented', () => {
    expect(embeddedKey('v99')).toBeNull();
  });

  it('every embedded key is declared once', () => {
    const kids = EMBEDDED_KEYS.map((k) => k.kid);
    expect(new Set(kids).size).toBe(kids.length);
  });

  it('a key without not_after never expires', () => {
    expect(signatureIsWithinKeyWindow({ kid: 'v1', jwk: {} }, '2099-01-01T00:00:00Z')).toBe(true);
  });

  it('a signature after not_after is rejected', () => {
    const key = { kid: 'v1', jwk: {}, not_after: '2026-01-01T00:00:00Z' };
    expect(signatureIsWithinKeyWindow(key, '2026-06-01T00:00:00Z')).toBe(false);
    expect(signatureIsWithinKeyWindow(key, '2025-06-01T00:00:00Z')).toBe(true);
  });

  it('an old file with no signed_at is accepted: expiry cannot be judged', () => {
    const key = { kid: 'v1', jwk: {}, not_after: '2026-01-01T00:00:00Z' };
    expect(signatureIsWithinKeyWindow(key, undefined)).toBe(true);
  });

  it('the worker can be told the endpoint: it has no window to read it from', async () => {
    // The verification runs inside a Web Worker, where `window` does not exist.
    // Without this, a page that configures its own backend was ignored there and
    // the worker asked api.oim.media — silently, and only for self-hosters.
    const { useKeysEndpoint } = await import('./keys');
    useKeysEndpoint('https://mi-empresa.example/keys');
    expect(keysEndpoint()).toBe('https://mi-empresa.example/keys');
    useKeysEndpoint(null);
    expect(keysEndpoint()).toBe('https://api.oim.media/v1/media/keys');
  });

  it('a server key carries its own not_after', () => {
    // Keys learned from the server were exempt from expiry until this: a
    // retired key stayed trusted forever by whoever fetched it.
    expect(effectiveNotAfter('v9', { not_after: '2026-01-01T00:00:00Z' })).toBe('2026-01-01T00:00:00Z');
  });

  it('the earliest of the two windows wins', () => {
    // v1 comes embedded with a window; between embedded and published, the earliest
    // applies. The other way round, nobody can widen a window already shipped.
    expect(effectiveNotAfter('v1', { not_after: '2026-01-01T00:00:00Z' })).toBe('2026-01-01T00:00:00Z');
    const embedded = EMBEDDED_KEYS[0];
    const original = embedded.not_after;
    embedded.not_after = '2026-01-01T00:00:00Z';
    try {
      expect(effectiveNotAfter('v1', { not_after: '2030-01-01T00:00:00Z' })).toBe('2026-01-01T00:00:00Z');
      expect(effectiveNotAfter('v1', { not_after: '2025-01-01T00:00:00Z' })).toBe('2025-01-01T00:00:00Z');
      expect(effectiveNotAfter('v1', null)).toBe('2026-01-01T00:00:00Z');
    } finally {
      embedded.not_after = original;
    }
  });

  it('a key with no window anywhere never expires', () => {
    expect(effectiveNotAfter('v_sin_ventana', {})).toBeUndefined();
    expect(effectiveNotAfter('v9', undefined)).toBeUndefined();
  });

  it('an unparseable signed_at is treated as missing', () => {
    const key = { kid: 'v1', jwk: {}, not_after: '2026-01-01T00:00:00Z' };
    expect(signatureIsWithinKeyWindow(key, 'ayer por la tarde')).toBe(true);
  });

  it('the endpoint defaults to api.oim.media and can be configured', () => {
    expect(keysEndpoint()).toBe('https://api.oim.media/v1/media/keys');
    (globalThis as any).OIM_PLAYER_CONFIG = { keysUrl: 'https://mi-empresa.example/keys' };
    expect(keysEndpoint()).toBe('https://mi-empresa.example/keys');
    delete (globalThis as any).OIM_PLAYER_CONFIG;
  });

  it('the player refuses a signature made after the key was retired', async () => {
    // Guardrail for the wiring in security.ts: the rule is useless if nobody calls it.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./security.ts', import.meta.url), 'utf8')
    );
    expect(src).toContain('signatureIsWithinKeyWindow');
    expect(src).not.toContain('5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs');
  });
});

describe('verify_until: only a compromised key expires, by the device clock', () => {
  const compromised = { kid: 'vX', jwk: {}, verify_until: '2028-06-30T23:59:59Z' };
  const limit = Date.parse(compromised.verify_until);

  it('routine keys carry no expiry: a rotation never forces re-signing', () => {
    for (const k of EMBEDDED_KEYS) {
      expect(k.verify_until, k.kid).toBeUndefined();
      expect(k.not_after, k.kid).toBeUndefined();
    }
    expect(keyExpiredAt('v1', null, Date.parse('2099-01-01T00:00:00Z'))).toBe(false);
  });

  it('ships v1 and the standby key v2, with real coordinates', () => {
    expect(EMBEDDED_KEYS.map((k) => k.kid)).toEqual(['v1', 'v2']);
    const v2 = embeddedKey('v2')!;
    expect(v2.jwk.x).not.toMatch(/REEMPLAZAR/);
    expect(v2.jwk.y).not.toMatch(/REEMPLAZAR/);
  });

  it('a key given verify_until expires only after it plus the clock tolerance', () => {
    EMBEDDED_KEYS.push(compromised);
    try {
      expect(keyExpiredAt('vX', null, limit + CLOCK_SKEW_MS - 1000)).toBe(false);
      expect(keyExpiredAt('vX', null, limit + CLOCK_SKEW_MS + 1000)).toBe(true);
    } finally {
      EMBEDDED_KEYS.pop();
    }
  });

  it('the tolerance is seven days', () => {
    expect(CLOCK_SKEW_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('a server key without verify_until is trusted', () => {
    expect(keyExpiredAt('v9', { x: 'a', y: 'b' }, Date.parse('2099-01-01T00:00:00Z'))).toBe(false);
  });

  it('a server key is judged by its published verify_until', () => {
    const jwk = { verify_until: '2027-01-01T00:00:00Z' };
    expect(keyExpiredAt('v9', jwk, Date.parse('2026-10-01T00:00:00Z'))).toBe(false);
    expect(keyExpiredAt('v9', jwk, Date.parse('2027-02-01T00:00:00Z'))).toBe(true);
  });

  it('the server cannot extend an embedded date: the earliest wins', () => {
    EMBEDDED_KEYS.push(compromised);
    try {
      expect(keyExpiredAt('vX', { verify_until: '2099-01-01T00:00:00Z' }, limit + CLOCK_SKEW_MS + 1000)).toBe(true);
    } finally {
      EMBEDDED_KEYS.pop();
    }
  });

  it('an unknown kid with no key at all is not trusted', () => {
    expect(keyExpiredAt('v9', null, Date.parse('2026-10-01T00:00:00Z'))).toBe(true);
  });
});
