// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// The public library, read the same way as the Tauri viewer
// (apps/viewer-desktop/src/library/libraryClient.ts). No CORS natively, so the
// files are fetched directly.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'lru.dart';

typedef Fetch = Future<Uint8List> Function(Uri url, Map<String, String> headers);

class LibraryException implements Exception {
  final String message;
  const LibraryException(this.message);
  @override
  String toString() => message;
}

class LibraryItem {
  final String id, title, mediaUrl;
  final String? titleEn, thumbnailUrl, category, description;
  final double aspectRatio;
  const LibraryItem({
    required this.id,
    required this.title,
    required this.mediaUrl,
    this.titleEn,
    this.thumbnailUrl,
    this.category,
    this.description,
    this.aspectRatio = 1,
  });

  factory LibraryItem.fromJson(Map<String, dynamic> j) => LibraryItem(
        id: j['id'].toString(),
        title: (j['title'] ?? '').toString(),
        titleEn: j['title_en'] as String?,
        mediaUrl: (j['media_url'] ?? '').toString(),
        thumbnailUrl: j['thumbnail_url'] as String?,
        category: j['category'] as String?,
        description: j['description'] as String?,
        aspectRatio: parseAspectRatio(j['aspect_ratio']),
      );
}

/// "16/9", "16:9" or a number; 1 when unreadable.
double parseAspectRatio(Object? v) {
  if (v is num && v > 0) return v.toDouble();
  final parts = v?.toString().split(RegExp(r'[/:]')) ?? const [];
  if (parts.length == 2) {
    final a = double.tryParse(parts[0].trim()), b = double.tryParse(parts[1].trim());
    if (a != null && b != null && a > 0 && b > 0) return a / b;
  }
  return 1;
}

Future<Uint8List> _httpFetch(Uri url, Map<String, String> headers) async {
  final client = HttpClient();
  try {
    final req = await client.getUrl(url);
    headers.forEach(req.headers.set);
    final res = await req.close();
    if (res.statusCode != 200) throw LibraryException('HTTP ${res.statusCode}');
    final b = BytesBuilder(copy: false);
    await for (final chunk in res) {
      b.add(chunk);
    }
    return b.takeBytes();
  } on SocketException catch (e) {
    throw LibraryException(e.message);
  } finally {
    client.close();
  }
}

class LibraryClient {
  static const supabaseUrl = 'https://eawltbnmonimtmtqslmk.supabase.co';
  // Public anon key, read-only through RLS; the Tauri viewer ships the same one.
  static const anonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2x0Ym5tb25pbXRtdHFzbG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDEwOTAsImV4cCI6MjA5NzgxNzA5MH0.EERuWIHr-WcXvewklF3DbjIZz7-JYEPsqpeszCd2ySo';
  // Only what the gallery shows: never author or moderation columns.
  static const publicColumns =
      'id,title,title_en,description,description_en,thumbnail_url,media_url,type,aspect_ratio,category,tags,features,created_at';
  static const maxInFlight = 4;

  final Fetch _fetch;
  final DateTime Function() _now;
  final LruBytes cache;
  List<LibraryItem>? _items;
  DateTime? _itemsAt;
  int _inFlight = 0;
  final _waiting = <Completer<void>>[];

  LibraryClient({Fetch? fetch, DateTime Function()? now, int maxBytes = 50 * 1024 * 1024})
      : _fetch = fetch ?? _httpFetch,
        _now = now ?? DateTime.now,
        cache = LruBytes(maxBytes);

  Future<List<LibraryItem>> fetchItems({bool force = false}) async {
    final at = _itemsAt;
    if (!force && _items != null && at != null && _now().difference(at) < const Duration(seconds: 60)) {
      return _items!;
    }
    final url = Uri.parse('$supabaseUrl/rest/v1/showcase_items').replace(queryParameters: {
      'status': 'eq.approved',
      'order': 'created_at.desc',
      'select': publicColumns,
    });
    final raw = await _fetch(url, const {'apikey': anonKey, 'Authorization': 'Bearer $anonKey'});
    final Object? list;
    try {
      list = jsonDecode(utf8.decode(raw));
    } on FormatException {
      throw const LibraryException('Invalid library response');
    }
    if (list is! List) throw const LibraryException('Invalid library response');
    _items = [for (final j in list) if (j is Map<String, dynamic>) LibraryItem.fromJson(j)];
    _itemsAt = _now();
    return _items!;
  }

  /// The work's bytes, from the cache or the network, with at most four downloads at once.
  Future<Uint8List> fetchBytes(String url) async {
    final hit = cache.get(url);
    if (hit != null) return hit;
    while (_inFlight >= maxInFlight) {
      final c = Completer<void>();
      _waiting.add(c);
      await c.future;
    }
    _inFlight++;
    try {
      final bytes = await _fetch(Uri.parse(url), const {});
      cache.put(url, bytes);
      return bytes;
    } finally {
      _inFlight--;
      if (_waiting.isNotEmpty) _waiting.removeAt(0).complete();
    }
  }
}
