// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:typed_data';

/// Downloaded works kept in memory under a byte cap (50 MB in the Tauri viewer).
class LruBytes {
  final int maxBytes;
  final _entries = <String, Uint8List>{};
  int _total = 0;

  LruBytes(this.maxBytes);

  int get totalBytes => _total;

  Uint8List? get(String key) {
    final v = _entries.remove(key);
    if (v != null) _entries[key] = v; // most recent last
    return v;
  }

  void put(String key, Uint8List bytes) {
    final old = _entries.remove(key);
    if (old != null) _total -= old.length;
    if (bytes.length > maxBytes) return;
    while (_total + bytes.length > maxBytes && _entries.isNotEmpty) {
      final oldest = _entries.keys.first;
      _total -= _entries.remove(oldest)!.length;
    }
    _entries[key] = bytes;
    _total += bytes.length;
  }
}
