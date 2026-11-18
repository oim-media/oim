/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { verifyPosterSeal } from './security';
import { EMBEDDED_KEYS } from './keys';

let priv: CryptoKey;
const KID = 'vSealTest';

async function sign(body: object): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, bytes));
  return btoa(String.fromCharCode(...sig));
}

async function sealFor(imageHash: string) {
  // Keys in the order the backend's canonical form sorts them.
  const body = { alg: 'sha256-idat', image_hash: imageHash, key_version: KID, v: 1 };
  return { ...body, signature: await sign(body) };
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  priv = pair.privateKey;
  EMBEDDED_KEYS.push({ kid: KID, jwk: await crypto.subtle.exportKey('jwk', pair.publicKey) } as any);
  // A refused seal retries with the server's key: offline here, or CI waits on the real network and times out.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
});
afterAll(() => { EMBEDDED_KEYS.pop(); vi.unstubAllGlobals(); });

describe('verifyPosterSeal', () => {
  it('a seal signed for this image is valid', async () => {
    expect(await verifyPosterSeal(await sealFor('ab'), 'ab')).toBe('ok');
  });

  it('another image under a good seal is refused', async () => {
    expect(await verifyPosterSeal(await sealFor('ab'), 'cd')).toBe('invalid');
  });

  it('a seal whose hash was rewritten is refused', async () => {
    const seal = await sealFor('ab');
    expect(await verifyPosterSeal({ ...seal, image_hash: 'cd' }, 'cd')).toBe('invalid');
  });

  it('a seal of another scheme or version is not trusted', async () => {
    const seal = await sealFor('ab');
    expect(await verifyPosterSeal({ ...seal, v: 2 }, 'ab')).toBe('invalid');
    expect(await verifyPosterSeal({ ...seal, alg: 'md5' }, 'ab')).toBe('invalid');
  });

  it('an unknown key is refused', async () => {
    const seal = await sealFor('ab');
    expect(await verifyPosterSeal({ ...seal, key_version: 'nope' }, 'ab')).toBe('invalid');
  });
});
