/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The player's key set.
 *
 * Keys live here, embedded at build time, for one reason: a player already
 * pasted into someone else's page must verify files without asking anyone.
 * Asking on every render would send that page's visitors to our servers.
 *
 * `not_after` is what makes rotation possible at all. Without it, a key
 * compromised tomorrow stays trusted forever by every copy already out there,
 * and there is no way to reach those copies.
 */
export interface PlayerKey {
  kid: string;
  jwk: JsonWebKey;
  /** ISO date. The backend stops signing with this key after it. Compared
   *  with `signed_at`, which the signer writes, so it does NOT stop a thief. */
  not_after?: string;
  /** ISO date. After it (plus CLOCK_SKEW_MS), THIS player stops trusting the
   *  key, judged by the device clock. Only set on a key that was COMPROMISED:
   *  a routine rotation leaves old keys trusted forever, so nobody has to
   *  re-sign their works (decided 26 Sept 2026; the earlier plan expired every
   *  key on a calendar and forced mass re-signing). */
  verify_until?: string;
}

export const EMBEDDED_KEYS: PlayerKey[] = [
  {
    kid: 'v1',
    jwk: {
      kty: 'EC',
      crv: 'P-256',
      x: '5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs',
      y: 'oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o',
    },
  },
  {
    // Standby key. Every player shipped from now on already trusts it, so if
    // v1 is ever compromised the backend can switch to v2 at once and a new
    // player can give v1 a verify_until. Its private half sits unused in
    // Secret Manager (oim-private-key-v2).
    kid: 'v2',
    jwk: { kty: 'EC', crv: 'P-256', x: 'pRSLtFHe9p8sR8jyqP5eoaBGbHdJgjjrdClda2lNp4A', y: 'oopYYhgja8m2iAlSMPigeWw-F72KJLNCRFQzlyWdt2I' },
  },
];

const DEFAULT_KEYS_URL = 'https://api.oim.media/v1/media/keys';

export function embeddedKey(kid: string): PlayerKey | null {
  for (let i = 0; i < EMBEDDED_KEYS.length; i++) {
    if (EMBEDDED_KEYS[i].kid === kid) return EMBEDDED_KEYS[i];
  }
  return null;
}

let _endpointDelEntorno: string | null = null;

/**
 * Tells THIS scope where to ask for keys.
 *
 * Verification runs inside a Web Worker, which has no `window` and so never
 * sees `OIM_PLAYER_CONFIG`: a page pointing at its own backend was obeyed on the
 * main thread and ignored in the worker, which kept asking api.oim.media. The
 * main thread passes the address in the message and the worker sets it here.
 */
export function useKeysEndpoint(url?: string | null): void {
  _endpointDelEntorno = typeof url === 'string' && url ? url : null;
}

/** Where to ask for a key we do not know. Configurable so a fork is not tied to us. */
export function keysEndpoint(): string {
  if (_endpointDelEntorno) return _endpointDelEntorno;
  const cfg = (globalThis as any).OIM_PLAYER_CONFIG;
  const url = cfg && typeof cfg.keysUrl === 'string' ? cfg.keysUrl : '';
  return url || DEFAULT_KEYS_URL;
}

/**
 * The window that actually applies to a kid: the earliest of what the player
 * carries and what the server published for it.
 *
 * Keys learned from the server used to be exempt, which made retiring one
 * pointless for whoever had already fetched it. The earliest date wins in both
 * directions: the server can retire a key sooner than planned, and nobody can
 * widen a window already burned into a released player.
 */
export function effectiveNotAfter(kid: string, jwk?: { not_after?: string } | null): string | undefined {
  const embedded = embeddedKey(kid)?.not_after;
  const published = jwk && typeof jwk.not_after === 'string' ? jwk.not_after : undefined;
  if (!embedded) return published;
  if (!published) return embedded;
  return Date.parse(published) < Date.parse(embedded) ? published : embedded;
}

/**
 * A file with no `signed_at` cannot be judged: it predates signed dates, and
 * refusing it would break every file made before this change.
 */
export function signatureIsWithinKeyWindow(key: PlayerKey, signedAt?: string): boolean {
  if (!key.not_after || !signedAt) return true;
  const signed = Date.parse(signedAt);
  const limit = Date.parse(key.not_after);
  if (isNaN(signed) || isNaN(limit)) return true;
  return signed <= limit;
}

/** A device clock a few days off must not switch valid works off. */
export const CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether this player no longer trusts `kid`, judged by the device clock.
 *
 * Unlike `not_after`, nothing here comes from the file, so a stolen key cannot
 * argue its way past it. A key with no verify_until anywhere is trusted: that
 * is the normal case. When a date exists, the earliest one wins, so the server
 * can shorten a key's life but never extend one burned into a player. A kid
 * this player neither carries nor got from the server is not trusted.
 */
export function keyExpiredAt(kid: string, serverJwk: { verify_until?: string; [field: string]: unknown } | null | undefined, now: number = Date.now()): boolean {
  const embedded = embeddedKey(kid)?.verify_until;
  const published = serverJwk && typeof serverJwk.verify_until === 'string' ? serverJwk.verify_until : undefined;
  if (!embeddedKey(kid) && !serverJwk) return true;
  const dates = [embedded, published].filter((d): d is string => !!d && !isNaN(Date.parse(d)));
  if (dates.length === 0) return false;
  const limit = Math.min(...dates.map((d) => Date.parse(d)));
  return now > limit + CLOCK_SKEW_MS;
}
