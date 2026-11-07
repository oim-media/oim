// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/library/library_client.dart';
import 'package:oim_viewer_flutter/library/library_layout.dart';
import 'package:oim_viewer_flutter/library/library_screen.dart';
import 'package:oim_viewer_flutter/ui/i18n.dart';

LibraryItem _item(String id, {String? title, String? cat, double ar = 1}) =>
    LibraryItem(id: id, title: title ?? id, mediaUrl: 'https://x/$id.oim.png', category: cat, aspectRatio: ar);

void main() {
  setUp(() => uiSpanish = true);
  group('justifiedRows', () {
    test('fills each row to the width and keeps every item once, in order', () {
      final items = [for (var i = 0; i < 7; i++) _item('$i', ar: i.isEven ? 1.5 : 0.75)];
      final rows = justifiedRows(items, width: 1000, targetHeight: 200, gap: 8);
      expect([for (final r in rows) ...r.items.map((e) => e.id)], [for (var i = 0; i < 7; i++) '$i']);
      for (final r in rows.take(rows.length - 1)) {
        final used = r.items.fold<double>(0, (s, e) => s + e.aspectRatio * r.height) + 8 * (r.items.length - 1);
        expect(used, closeTo(1000, 0.5));
      }
      // The last row is not stretched past the target height.
      expect(rows.last.height, lessThanOrEqualTo(200));
    });
  });

  testWidgets('shows the count, filters by search, and offers retry on error', (t) async {
    var fail = true;
    final client = LibraryClient(fetch: (u, h) async {
      if (fail) throw const LibraryException('offline');
      final all = [
        {'id': '1', 'title': 'Hero', 'media_url': 'https://x/1.oim.png', 'aspect_ratio': '16/9'},
        {'id': '2', 'title': 'Carta', 'media_url': 'https://x/2.oim.png', 'aspect_ratio': '1/1'},
      ];
      // Stand-in for the server-side search.
      final q = (u.queryParameters['q'] ?? '').toLowerCase();
      final items = [for (final i in all) if ((i['title'] as String).toLowerCase().contains(q)) i];
      return Uint8List.fromList(utf8.encode(jsonEncode({'next_cursor': null, 'items': items})));
    });
    await t.pumpWidget(MaterialApp(home: LibraryScreen(client: client, onOpen: (_, __) {}, loadCards: false)));
    await t.pumpAndSettle();
    expect(find.text('Reintentar'), findsOneWidget);
    fail = false;
    await t.tap(find.text('Reintentar'));
    await t.pumpAndSettle();
    expect(find.text('2 obras'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'carta');
    await t.pump(const Duration(milliseconds: 350));
    await t.pumpAndSettle();
    expect(find.text('1 obras'), findsOneWidget);
  });
}
