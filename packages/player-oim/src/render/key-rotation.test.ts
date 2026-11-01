import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Rotating the signing key, rehearsed.
 *
 * The fixture was produced by the REAL backend (`sign_metadata` with
 * `OIM_KEY_VERSION` and `OIM_RETIRED_PUBLIC_KEYS` set): two throwaway keypairs,
 * the old one retired with a `not_after`, and three files signed around that
 * date. Regenerating it is in the runbook; the keys in it are disposable and
 * sign nothing real.
 *
 * What this pins is the whole procedure, which no unit test covers: a released
 * player keeps verifying old files, refuses what was signed after the old key
 * was retired, and learns the new key from the server when it meets it.
 */

const F = JSON.parse(readFileSync(new URL('./__fixtures__/rotation.json', import.meta.url), 'utf8'));

const claveVieja = {
  kid: F.jwk_vieja.kid,
  jwk: { kty: 'EC', crv: 'P-256', x: F.jwk_vieja.x, y: F.jwk_vieja.y },
  not_after: F.not_after,
};

function elServidorPublicaSusClaves() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ keys: F.keys }),
    }))
  );
}

beforeEach(() => {
  vi.resetModules();
  // No IndexedDB in this environment: the cache must not be what makes it pass.
  vi.stubGlobal('indexedDB', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('rotacion de clave', () => {
  it('un player nuevo, con la clave vieja caducada dentro, sigue validando lo firmado antes — y sin red', async () => {
    const espia = vi.fn(() => Promise.reject(new Error('no deberia salir a la red')));
    vi.stubGlobal('fetch', espia);

    const { EMBEDDED_KEYS } = await import('./keys');
    EMBEDDED_KEYS.push(claveVieja);

    const { verifyMetadataSignature } = await import('./security');
    expect(await verifyMetadataSignature(F.firmado_con_la_vieja_antes)).toBe(true);
    expect(espia).not.toHaveBeenCalled();
  });

  it('rechaza lo firmado con la clave vieja DESPUES de retirarla', async () => {
    const { EMBEDDED_KEYS } = await import('./keys');
    EMBEDDED_KEYS.push(claveVieja);

    const { verifyMetadataSignature } = await import('./security');
    expect(await verifyMetadataSignature(F.firmado_con_la_vieja_despues)).toBe(false);
  });

  it('un player viejo aprende del servidor la clave que no lleva dentro', async () => {
    elServidorPublicaSusClaves();
    const { verifyMetadataSignature } = await import('./security');
    expect(await verifyMetadataSignature(F.firmado_con_la_nueva)).toBe(true);
  });

  it('un player viejo tambien respeta la caducidad que publica el servidor', async () => {
    elServidorPublicaSusClaves();
    const { verifyMetadataSignature } = await import('./security');
    expect(await verifyMetadataSignature(F.firmado_con_la_vieja_despues)).toBe(false);
    expect(await verifyMetadataSignature(F.firmado_con_la_vieja_antes)).toBe(true);
  });
});
