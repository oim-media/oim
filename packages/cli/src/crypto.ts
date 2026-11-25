/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Canonical public keys of the OIM ecosystem for offline validation
export const EMBEDDED_KEYS: Record<string, JsonWebKey> = {
  v1: {
    kty: 'EC',
    crv: 'P-256',
    x: '5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs',
    y: 'oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o',
  },
};

import { serializeCanonical } from '@oim-media/core';

// Imported, not only re-exported: `export { x } from` creates no local
// binding, and verifySignature below needs one.
export { serializeCanonical };

/**
 * Validates the ECDSA P-256 cryptographic signature of OIM metadata.
 */
export async function verifySignature(metadata: any): Promise<boolean> {
  if (!metadata || typeof metadata !== 'object') return false;
  if (!metadata.signature || !metadata.key_version) return false;

  const keyJwk = EMBEDDED_KEYS[metadata.key_version];
  if (!keyJwk) {
    return false;
  }

  try {
    const canonicalBytes = serializeCanonical(metadata);
    const sigBinary = atob(metadata.signature);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const pubKey = await crypto.subtle.importKey(
      'jwk',
      keyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      pubKey,
      sigBytes as any,
      canonicalBytes as any
    );
  } catch {
    return false;
  }
}

