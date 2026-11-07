// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/library/library_client.dart';
import 'package:oim_viewer_flutter/library/lru.dart';

Uint8List _b(int n) => Uint8List(n);

void main() {
  group('LibraryClient', () {
    test('reads the first page from the public API without any key', () async {
      late Uri asked;
      late Map<String, String> headers;
      final c = LibraryClient(fetch: (u, h) async {
        asked = u;
        headers = h;
        return Uint8List.fromList(utf8.encode(
            '{"items":[{"id":"1","title":"A","media_url":"https://x/a.oim.png","aspect_ratio":"1/1"}],"next_cursor":"c1"}'));
      });
      final items = await c.fetchItems();
      expect(items.single.title, 'A');
      expect(asked.toString(), '${LibraryClient.showcaseApi}?limit=48');
      expect(headers, isEmpty);
      expect(c.hasMore, isTrue);
    });

    test('sends category and search to the server', () async {
      late Uri asked;
      final c = LibraryClient(fetch: (u, h) async {
        asked = u;
        return Uint8List.fromList(utf8.encode('{"items":[],"next_cursor":null}'));
      });
      await c.fetchItems(category: 'ui', query: ' hero ');
      expect(asked.queryParameters, {'limit': '48', 'category': 'ui', 'q': 'hero'});
    });

    test('a repeated request for new filters never returns the previous filters list', () async {
      final c = LibraryClient(fetch: (u, h) async {
        final id = u.queryParameters['category'] == 'ui' ? 'ui' : 'hero';
        return Uint8List.fromList(utf8.encode('{"items":[{"id":"$id","media_url":"https://x/$id"}],"next_cursor":null}'));
      });
      await c.fetchItems(query: 'hero');
      // A chip tap and a pending search debounce ask for the same new filters while the first is in flight.
      final both = await Future.wait([c.fetchItems(category: 'ui'), c.fetchItems(category: 'ui')]);
      expect(both.map((l) => l.single.id), ['ui', 'ui']);
    });

    test('fetchMore sends the cursor and appends', () async {
      final asked = <Uri>[];
      final pages = [
        '{"items":[{"id":"1","media_url":"https://x/a"}],"next_cursor":"c1"}',
        '{"items":[{"id":"2","media_url":"https://x/b"}],"next_cursor":null}',
      ];
      final c = LibraryClient(fetch: (u, h) async {
        asked.add(u);
        return Uint8List.fromList(utf8.encode(pages[asked.length - 1]));
      });
      await c.fetchItems();
      final all = await c.fetchMore();
      expect(all.map((i) => i.id), ['1', '2']);
      expect(asked[1].queryParameters['cursor'], 'c1');
      expect(c.hasMore, isFalse);
    });

    test('caches the list for 60 s', () async {
      var calls = 0;
      var now = DateTime(2026);
      final c = LibraryClient(now: () => now, fetch: (u, h) async {
        calls++;
        return Uint8List.fromList(utf8.encode('{"items":[],"next_cursor":null}'));
      });
      await c.fetchItems();
      now = now.add(const Duration(seconds: 59));
      await c.fetchItems();
      expect(calls, 1);
      now = now.add(const Duration(seconds: 2));
      await c.fetchItems();
      expect(calls, 2);
    });

    test('never runs more than 4 downloads at once', () async {
      var inFlight = 0, peak = 0;
      final c = LibraryClient(fetch: (u, h) async {
        inFlight++;
        peak = peak < inFlight ? inFlight : peak;
        await Future<void>.delayed(const Duration(milliseconds: 5));
        inFlight--;
        return _b(10);
      });
      await Future.wait([for (var i = 0; i < 10; i++) c.fetchBytes('https://x/$i')]);
      expect(peak, 4);
    });

    test('a failed request is a LibraryException', () async {
      final c = LibraryClient(fetch: (u, h) async => throw const LibraryException('HTTP 500'));
      expect(c.fetchItems(), throwsA(isA<LibraryException>()));
    });
  });

  group('LruBytes', () {
    test('evicts the least recently used and stays under its cap, counting the new entry', () {
      final lru = LruBytes(100);
      lru.put('a', _b(40));
      lru.put('b', _b(40));
      lru.get('a');
      lru.put('c', _b(40));
      expect(lru.get('b'), isNull);
      expect(lru.get('a'), isNotNull);
      expect(lru.totalBytes, lessThanOrEqualTo(100));
    });

    test('an entry bigger than the cap is not kept', () {
      final lru = LruBytes(100)..put('big', _b(101));
      expect(lru.get('big'), isNull);
      expect(lru.totalBytes, 0);
    });
  });
}
