// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:typed_data';

/// Root keys that are never part of the signed bytes (canonical rule 2).
const Set<String> _excludedRootKeys = {
  'signature',
  'key_version',
  'timestamp',
  'creator_user_id',
};

/// Largest magnitude a signed number may have (2^53 - 1): every JSON parser reads it exactly.
const int maxCanonicalNumber = 9007199254740991;

/// Whether [value] carries, at any depth, a number with no canonical form.
/// Beyond 2^53 - 1 parsers disagree on the value they read, so such a file's
/// signature is invalid (BINARY_SPEC 5.1 rule 3).
bool hasNumberOutOfRange(dynamic value) {
  if (value is num) return !value.isFinite || value.abs() > maxCanonicalNumber;
  if (value is List) return value.any(hasNumberOutOfRange);
  if (value is Map) return value.values.any(hasNumberOutOfRange);
  return false;
}

/// The same rules as `serializeCanonical` in `@oim-media/core` (canonical.ts):
/// root exclusion, numeric normalization, key ordering by Unicode code point,
/// compact output, non-ASCII emitted raw, UTF-8.
///
/// Written out by hand instead of calling `jsonEncode` because the output must
/// match JavaScript's `JSON.stringify` byte for byte: Dart prints `2.0` and
/// `1.0e-6` where JavaScript prints `2` and `0.000001`.
Uint8List serializeCanonical(Map<String, dynamic> metadata) {
  final kept = <String, dynamic>{};
  for (final e in metadata.entries) {
    if (!_excludedRootKeys.contains(e.key)) kept[e.key] = e.value;
  }
  final out = StringBuffer();
  _write(out, kept, normalize: true, codePointOrder: true);
  return Uint8List.fromList(utf8.encode(out.toString()));
}

/// Files published before `creator_user_id` was excluded were signed keeping it
/// at the root. Mirrors the legacy fallback in the player: only the three
/// transport keys are dropped, keys are sorted, numbers are left as they came.
Uint8List serializeLegacyCanonical(Map<String, dynamic> metadata) {
  const legacyExcluded = {'signature', 'key_version', 'timestamp'};
  final kept = <String, dynamic>{};
  for (final e in metadata.entries) {
    if (!legacyExcluded.contains(e.key)) kept[e.key] = e.value;
  }
  final out = StringBuffer();
  _write(out, kept, normalize: false, codePointOrder: false);
  return Uint8List.fromList(utf8.encode(out.toString()));
}

int _compareByCodePoint(String a, String b) {
  final ar = a.runes.toList();
  final br = b.runes.toList();
  final min = ar.length < br.length ? ar.length : br.length;
  for (var i = 0; i < min; i++) {
    final d = ar[i] - br[i];
    if (d != 0) return d;
  }
  return ar.length - br.length;
}

void _write(StringBuffer b, dynamic v, {required bool normalize, required bool codePointOrder}) {
  if (v == null) {
    b.write('null');
  } else if (v is bool) {
    b.write(v ? 'true' : 'false');
  } else if (v is int) {
    b.write(v.toString());
  } else if (v is double) {
    b.write(_formatDouble(v, normalize: normalize));
  } else if (v is String) {
    _writeString(b, v);
  } else if (v is List) {
    b.write('[');
    for (var i = 0; i < v.length; i++) {
      if (i > 0) b.write(',');
      _write(b, v[i], normalize: normalize, codePointOrder: codePointOrder);
    }
    b.write(']');
  } else if (v is Map) {
    final keys = v.keys.map((k) => k.toString()).toList();
    keys.sort(codePointOrder ? _compareByCodePoint : (a, c) => a.compareTo(c));
    b.write('{');
    for (var i = 0; i < keys.length; i++) {
      if (i > 0) b.write(',');
      _writeString(b, keys[i]);
      b.write(':');
      _write(b, v[keys[i]], normalize: normalize, codePointOrder: codePointOrder);
    }
    b.write('}');
  } else {
    b.write('null');
  }
}

/// JavaScript prints an integral double without a fraction, and a non-finite
/// one as `null`. With `normalize`, non-integers are rounded to 6 decimals.
String _formatDouble(double d, {required bool normalize}) {
  if (d.isNaN || d.isInfinite) return 'null';
  if (d == d.truncateToDouble()) return d.toInt().toString();
  if (!normalize) return d.toString();
  final rounded = double.parse(d.toStringAsFixed(6));
  if (rounded == rounded.truncateToDouble()) return rounded.toInt().toString();
  var s = rounded.toStringAsFixed(6);
  s = s.replaceFirst(RegExp(r'0+$'), '');
  return s.endsWith('.') ? s.substring(0, s.length - 1) : s;
}

/// `JSON.stringify` string escaping: quotes, backslash, short forms for
/// \b \f \n \r \t, lowercase \u00xx for the rest below 0x20, and lone
/// surrogates as \udxxx. Everything else is emitted as is.
void _writeString(StringBuffer b, String s) {
  b.write('"');
  final units = s.codeUnits;
  for (var i = 0; i < units.length; i++) {
    final c = units[i];
    switch (c) {
      case 0x22:
        b.write(r'\"');
      case 0x5C:
        b.write(r'\\');
      case 0x08:
        b.write(r'\b');
      case 0x0C:
        b.write(r'\f');
      case 0x0A:
        b.write(r'\n');
      case 0x0D:
        b.write(r'\r');
      case 0x09:
        b.write(r'\t');
      default:
        if (c < 0x20) {
          b.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
        } else if (c >= 0xD800 && c <= 0xDBFF) {
          final hasLow = i + 1 < units.length && units[i + 1] >= 0xDC00 && units[i + 1] <= 0xDFFF;
          if (hasLow) {
            b.writeCharCode(c);
            b.writeCharCode(units[i + 1]);
            i++;
          } else {
            b.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
          }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          b.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
        } else {
          b.writeCharCode(c);
        }
    }
  }
  b.write('"');
}
