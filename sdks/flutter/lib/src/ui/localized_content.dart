// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

/// Language used when the caller does not set one, as in the web player (1.26.0).
const String oimDefaultLanguage = 'en';

/// A layer's content in [lang]. Mirrors `resolveContent` in
/// `@oim-media/player-oim` so both players show the same text.
String resolveContent(Object? content, String lang) {
  if (content is! Map) return content?.toString() ?? '';
  final map = content.map((k, v) => MapEntry(k.toString(), v));

  String? byLang(String key, {bool skipEmpty = true}) {
    final lk = key.toLowerCase();
    for (final e in map.entries) {
      if (e.key.toLowerCase() != lk || e.value == null) continue;
      final s = e.value.toString();
      if (skipEmpty && s.isEmpty) continue;
      return s;
    }
    return null;
  }

  // Media keep their principal under "*"; an own key is final even when empty.
  if (map.containsKey('*')) {
    return byLang(lang, skipEmpty: false) ?? (map['*']?.toString() ?? '');
  }
  return byLang(lang) ??
      byLang('en') ??
      byLang('es') ??
      byLang('default') ??
      (map.isEmpty ? '' : (map.values.first?.toString() ?? ''));
}

/// The languages of a file's texts, lower-case and sorted (the web player's `languages`).
List<String> oimLanguages(Map<String, dynamic> metadata) {
  final out = <String>{};
  void collectLayers(List<dynamic>? layers) {
    for (final l in layers ?? const []) {
      if (l is! Map) continue;
      final t = l['text'];
      if (t is Map && t['content'] is Map) {
        out.addAll((t['content'] as Map).keys.map((k) => k.toString().toLowerCase()).where((k) => k != '*'));
      }
      if (l['children'] is List) collectLayers(l['children'] as List);
    }
  }

  for (final s in (metadata['slots'] as List?) ?? const []) {
    final c = s is Map ? s['content'] : null;
    if (c is Map) out.addAll(c.keys.map((k) => k.toString().toLowerCase()).where((k) => k != '*'));
  }
  collectLayers(metadata['layers'] as List?);
  return out.toList()..sort();
}

/// A layer with `languages` (other than `["*"]`) shows only in those languages.
bool slotShownIn(Map raw, String lang) {
  final l = raw['languages'];
  return l is! List || l.contains('*') || l.contains(lang);
}
