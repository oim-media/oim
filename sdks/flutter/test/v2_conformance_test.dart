// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

void main() {
  final v2Dir = Directory(p.normalize(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors-2')));
  final vectors = v2Dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.oim.png'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  test('all 2.0 vectors extract, verify, and normalize', () {
    expect(vectors.length, greaterThanOrEqualTo(40));
    for (final f in vectors) {
      final name = p.basename(f.path);
      final bytes = f.readAsBytesSync();
      final res = extractOIM(bytes);
      expect(isV2Document(res.metadata), isTrue, reason: '$name should be v2');
      final status = verifyOim(res);
      expect(isRefused(status), isFalse, reason: '$name verification failed: $status');

      final normalized = normalizeV2Metadata(res.metadata);
      expect(normalized['canvas'], isA<Map>());
      expect((normalized['canvas']['natural_width'] as num), greaterThan(0));
      expect((normalized['canvas']['natural_height'] as num), greaterThan(0));
      expect(normalized['slots'], isA<List>(), reason: '$name missing normalized slots');
      expect(oimLanguages(res.metadata), isA<List<String>>());
    }
  });

  for (final sample in const ['basic-text', 'artistic-text', 'filter-effects', 'crop', 'flip']) {
    testWidgets('OimPlayer renders 2.0 vector $sample without error', (tester) async {
      final file = File(p.join(v2Dir.path, '$sample.oim.png'));
      expect(file.existsSync(), isTrue);
      final bytes = file.readAsBytesSync();

      await tester.binding.setSurfaceSize(const Size(900, 700));
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: Center(
            child: SizedBox(width: 800, child: OimPlayer(bytes: bytes, disableAnimations: true)),
          ),
        ),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(OimPlayer), findsOneWidget);
    });
  }
}
