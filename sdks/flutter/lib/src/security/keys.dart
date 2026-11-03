// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

/// A public key the SDK trusts. Mirrors `PlayerKey` in `@oim-media/player-oim`.
///
/// Keys are embedded, never fetched: an app that embeds the SDK must verify a
/// file without sending its users' traffic to anyone's servers.
class OimPublicKey {
  const OimPublicKey({required this.kid, required this.x, required this.y, this.notAfter, this.verifyUntil});

  final String kid;

  /// Base64url affine coordinates of the P-256 point (the JWK `x` and `y`).
  final String x;
  final String y;

  /// ISO date. The backend stopped signing with this key after it.
  final String? notAfter;

  /// ISO date. After it (plus [clockSkew]) this SDK stops trusting the key.
  /// Only set on a compromised key; a routine rotation leaves old keys trusted.
  final String? verifyUntil;
}

/// Same key set as `EMBEDDED_KEYS` in `packages/player-oim/src/render/keys.ts`.
const List<OimPublicKey> oimEmbeddedKeys = [
  OimPublicKey(
    kid: 'v1',
    x: '5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs',
    y: 'oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o',
  ),
  // Standby key, held offline by Xue Studios.
  OimPublicKey(
    kid: 'v2',
    x: 'pRSLtFHe9p8sR8jyqP5eoaBGbHdJgjjrdClda2lNp4A',
    y: 'oopYYhgja8m2iAlSMPigeWw-F72KJLNCRFQzlyWdt2I',
  ),
];

/// A device clock a few days off must not switch valid works off.
const Duration clockSkew = Duration(days: 7);

OimPublicKey? embeddedKey(String kid, [List<OimPublicKey> keys = oimEmbeddedKeys]) {
  for (final k in keys) {
    if (k.kid == kid) return k;
  }
  return null;
}

/// A file with no `signed_at` cannot be judged: it predates signed dates.
bool signatureIsWithinKeyWindow(OimPublicKey key, String? signedAt) {
  if (key.notAfter == null || signedAt == null) return true;
  final signed = DateTime.tryParse(signedAt);
  final limit = DateTime.tryParse(key.notAfter!);
  if (signed == null || limit == null) return true;
  return !signed.isAfter(limit);
}

/// Whether this SDK no longer trusts [key], judged by the device clock.
bool keyExpiredAt(OimPublicKey key, DateTime now) {
  if (key.verifyUntil == null) return false;
  final limit = DateTime.tryParse(key.verifyUntil!);
  if (limit == null) return false;
  return now.isAfter(limit.add(clockSkew));
}
