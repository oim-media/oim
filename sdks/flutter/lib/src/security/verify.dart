// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:typed_data';
import 'package:pointycastle/export.dart';
import '../binary/oim_extractor.dart';
import 'canonical.dart';
import 'keys.dart';

/// What the SDK can say about a file, from strongest to weakest claim.
/// Same vocabulary as `SecurityStatus` in `@oim-media/player-oim`, plus
/// [unknownKey]: the player asks the server for a key it does not carry, the SDK
/// never phones home, so an unknown `key_version` is reported, not guessed at.
enum OimSecurityStatus {
  verified,
  verifiedAuthorless,
  imageUnsealed,
  unsigned,
  expiredKey,
  invalidSignature,
  imageMismatch,
  unknownKey,
}

/// Altered files are refused outright: neither their image nor their layers are shown.
bool isRefused(OimSecurityStatus status) =>
    status == OimSecurityStatus.imageMismatch || status == OimSecurityStatus.invalidSignature;

/// The seal scheme the backend writes in `image_hash_alg`: SHA-256 of the IDAT payloads.
const String imageHashAlg = 'sha256-idat';

enum ReeditPermission { public, authorOnly, sealed }

/// Who may re-edit a file. An unknown value falls back to [ReeditPermission.authorOnly],
/// never to public: corrupt or tampered data must not loosen a permission.
/// Mirrors `permissionOf` and `normalizeLegacyKeys` in `@oim-media/core`.
ReeditPermission permissionOf(Map<String, dynamic> metadata) {
  if (metadata['immutable_lock'] == true || metadata['immutable'] == true) {
    return ReeditPermission.sealed;
  }
  dynamic v = metadata['reedit'];
  if (v == null && metadata.containsKey('reedicion')) {
    const legacy = {'publico': 'public', 'solo_autor': 'author_only', 'sellado': 'sealed'};
    final l = metadata['reedicion'];
    v = l is String ? (legacy[l] ?? 'author_only') : 'author_only';
  }
  switch (v) {
    case 'public':
      return ReeditPermission.public;
    case 'sealed':
      return ReeditPermission.sealed;
    default:
      return ReeditPermission.authorOnly;
  }
}

Uint8List _b64Decode(String s) {
  final clean = s.replaceAll('-', '+').replaceAll('_', '/').replaceAll(RegExp(r'\s'), '');
  return base64.decode(base64.normalize(clean));
}

BigInt _bigIntFromBytes(Uint8List bytes) {
  var r = BigInt.zero;
  for (final b in bytes) {
    r = (r << 8) | BigInt.from(b);
  }
  return r;
}

bool _verifyEcdsa(OimPublicKey key, Uint8List message, Uint8List signature) {
  // WebCrypto and the backend both use the raw form: r || s, 32 bytes each.
  if (signature.length != 64) return false;
  final domain = ECDomainParameters('prime256v1');
  final point = domain.curve.createPoint(
    _bigIntFromBytes(_b64Decode(key.x)),
    _bigIntFromBytes(_b64Decode(key.y)),
  );
  final signer = ECDSASigner(SHA256Digest());
  signer.init(false, PublicKeyParameter<ECPublicKey>(ECPublicKey(point, domain)));
  final r = _bigIntFromBytes(Uint8List.sublistView(signature, 0, 32));
  final s = _bigIntFromBytes(Uint8List.sublistView(signature, 32, 64));
  return signer.verifySignature(message, ECSignature(r, s));
}

/// Whether the ECDSA signature in [metadata] is valid over its canonical bytes.
/// Returns null when the key is not one this SDK carries.
bool? verifyMetadataSignature(Map<String, dynamic> metadata, {List<OimPublicKey> keys = oimEmbeddedKeys}) {
  final signature = metadata['signature'];
  final kid = metadata['key_version'];
  if (signature is! String || signature.isEmpty || kid is! String) return false;

  final key = embeddedKey(kid, keys);
  if (key == null) return null;

  final Uint8List sig;
  try {
    sig = _b64Decode(signature);
  } catch (_) {
    return false;
  }

  try {
    var valid = _verifyEcdsa(key, serializeCanonical(metadata), sig);
    // Files published before `creator_user_id` was excluded kept it in the signed bytes.
    if (!valid && metadata['creator_user_id'] != null) {
      valid = _verifyEcdsa(key, serializeLegacyCanonical(metadata), sig);
    }
    if (valid && !signatureIsWithinKeyWindow(key, metadata['signed_at']?.toString())) {
      return false;
    }
    return valid;
  } catch (_) {
    return false;
  }
}

/// The single place that decides a file's security status. Mirrors
/// `securityVerdict` in the player: the signature covers `image_hash`, so once
/// it is valid the seal can be trusted, and what is checked here is that the
/// image shipped in the file is the one that was sealed.
OimSecurityStatus verifyOim(
  OimExtractionResult result, {
  DateTime? now,
  List<OimPublicKey> keys = oimEmbeddedKeys,
}) {
  final meta = result.metadata;
  final signature = meta['signature'];
  final isSigned = signature is String && signature.isNotEmpty && meta['key_version'] is String;
  if (!isSigned) return OimSecurityStatus.unsigned;

  final valid = verifyMetadataSignature(meta, keys: keys);
  if (valid == null) return OimSecurityStatus.unknownKey;
  if (!valid) return OimSecurityStatus.invalidSignature;

  final key = embeddedKey(meta['key_version'] as String, keys)!;
  if (keyExpiredAt(key, now ?? DateTime.now())) return OimSecurityStatus.expiredKey;

  final hash = meta['image_hash'];
  final seal = meta['image_hash_alg'] == imageHashAlg && hash is String ? hash : '';
  if (seal.isEmpty) return OimSecurityStatus.imageUnsealed;
  final actual = result.imageHash;
  if (actual == null || seal.toLowerCase() != actual.toLowerCase()) {
    return OimSecurityStatus.imageMismatch;
  }

  return permissionOf(meta) == ReeditPermission.public
      ? OimSecurityStatus.verifiedAuthorless
      : OimSecurityStatus.verified;
}
