// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Embedded fonts (`metadata.fonts[]`, contract 1.27.0): each WOFF entry is a
// static subset; it is unwrapped to an sfnt and registered with FontLoader
// under its `name`. WOFF2 (files before 1.27.0) is skipped: the text then
// paints in the family the platform has, as the contract allows.

import 'dart:convert' show base64;
import 'dart:io' show ZLibDecoder;
import 'dart:typed_data';
import 'package:flutter/services.dart' show FontLoader;
import 'woff2.dart';

/// The sfnt inside a WOFF 1 file, or null on any inconsistency.
Uint8List? woffToSfnt(Uint8List woff) {
  try {
    if (woff.length < 44) return null;
    final h = ByteData.sublistView(woff);
    if (h.getUint32(0) != 0x774F4646) return null; // 'wOFF'
    final flavor = h.getUint32(4), n = h.getUint16(12);
    if (n == 0 || woff.length < 44 + n * 20) return null;
    final tables = <(int tag, int checksum, Uint8List data)>[];
    for (var i = 0; i < n; i++) {
      final e = 44 + i * 20;
      final tag = h.getUint32(e), off = h.getUint32(e + 4), comp = h.getUint32(e + 8), orig = h.getUint32(e + 12);
      if (off + comp > woff.length || comp > orig) return null;
      final raw = Uint8List.sublistView(woff, off, off + comp);
      final data = comp < orig ? Uint8List.fromList(ZLibDecoder().convert(raw)) : raw;
      if (data.length != orig) return null;
      tables.add((tag, h.getUint32(e + 16), data));
    }
    var pow2 = 1, log2 = 0;
    while (pow2 * 2 <= n) {
      pow2 *= 2;
      log2++;
    }
    var size = 12 + n * 16;
    for (final t in tables) {
      size += (t.$3.length + 3) & ~3;
    }
    final out = Uint8List(size);
    final o = ByteData.sublistView(out)
      ..setUint32(0, flavor)
      ..setUint16(4, n)
      ..setUint16(6, pow2 * 16)
      ..setUint16(8, log2)
      ..setUint16(10, n * 16 - pow2 * 16);
    var at = 12 + n * 16;
    for (var i = 0; i < n; i++) {
      final (tag, checksum, data) = tables[i];
      o
        ..setUint32(12 + i * 16, tag)
        ..setUint32(16 + i * 16, checksum)
        ..setUint32(20 + i * 16, at)
        ..setUint32(24 + i * 16, data.length);
      out.setRange(at, at + data.length, data);
      at += (data.length + 3) & ~3;
    }
    return out;
  } catch (_) {
    return null;
  }
}

/// The `name` of the WOFF entry of [family] in [style] closest to [weight], or null.
String? embeddedFontName(List<dynamic>? fonts, String? family, int weight, String style) {
  if (fonts == null || family == null) return null;
  String? best;
  var gap = 1 << 30;
  for (final f in fonts.whereType<Map>()) {
    if (f['family'] != family || !_formats.contains(f['format']) || (f['style'] ?? 'normal') != style) continue;
    final d = (((f['weight'] as num?) ?? 400).toInt() - weight).abs();
    if (d < gap) {
      gap = d;
      best = f['name']?.toString();
    }
  }
  return best;
}

final _loaded = <String>{};
// "woff" is what writers emit; "woff2" (files before 1.27.0) is read forever.
const _formats = {'woff', 'woff2'};

/// Registers every WOFF entry of [fonts] under its name; each name loads once per process.
Future<void> loadEmbeddedFonts(List<dynamic>? fonts) async {
  for (final f in fonts?.whereType<Map>() ?? const <Map>[]) {
    final name = f['name']?.toString(), data = f['data'];
    if (!_formats.contains(f['format']) || name == null || data is! String || !_loaded.add(name)) continue;
    try {
      final bytes = base64.decode(data.replaceAll(RegExp(r'\s+'), ''));
      final sfnt = f['format'] == 'woff2' ? woff2ToSfnt(bytes) : woffToSfnt(bytes);
      if (sfnt == null) continue;
      await (FontLoader(name)..addFont(Future.value(ByteData.sublistView(sfnt)))).load();
    } catch (_) {
      _loaded.remove(name);
    }
  }
}

