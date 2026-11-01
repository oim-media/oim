/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * The window has to apply where it matters: inside verifyMetadataSignature.
 *
 * Testing `effectiveNotAfter` alone was not enough — the rule can be correct and
 * still unused. Reverting the call site to the embedded-only version left every
 * test green, which is how this file came to exist: it signs a file for real
 * with a key the player does not carry, publishes that key with a `not_after`,
 * and asks for the verdict.
 */

const SERVER_KID = 'v9-server-only';

async function firmarComoElServidor(metadata: any, privateKey: CryptoKey): Promise<string> {
  const { serializeCanonical } = await import('./security');
  const canonical = serializeCanonical(metadata);
  const der = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    canonical as unknown as BufferSource
  );
  let binary = '';
  const bytes = new Uint8Array(der);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function veredicto(signedAt: string, notAfter: string): Promise<boolean> {
  // Fresh module state per call: the key cache and the fetch promise live in
  // module scope, so a second call would reuse the first answer.
  vi.resetModules();

  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ keys: [{ ...jwk, kid: SERVER_KID, not_after: notAfter }] }),
    }))
  );

  const metadata: any = { slots: [], signed_at: signedAt };
  metadata.signature = await firmarComoElServidor(metadata, par.privateKey);
  metadata.key_version = SERVER_KID;

  const { verifyMetadataSignature } = await import('./security');
  return verifyMetadataSignature(metadata);
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('expiry of a key that only the server publishes', () => {
  it('a signature issued before not_after is valid', async () => {
    expect(await veredicto('2026-06-01T00:00:00Z', '2026-12-31T00:00:00Z')).toBe(true);
  });

  it('a signature issued after not_after is NOT valid', async () => {
    expect(await veredicto('2027-06-01T00:00:00Z', '2026-12-31T00:00:00Z')).toBe(false);
  });
});
