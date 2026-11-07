// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

final _bytes = File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors', 'basic-text.oim.png')).readAsBytesSync();

Widget _app(String lang, {bool reduceMotion = false}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduceMotion),
        child: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: _bytes, language: lang, showBaseImage: false)),
      ),
    );

// The web blurs the whole viewport, swaps the text at the peak, then refocuses.
bool _blurred(WidgetTester t) => t.widget<ImageFiltered>(find.byKey(const ValueKey('oim-language-blur'))).enabled;

void main() {
  testWidgets('changing language blurs, swaps at the peak, then refocuses', (t) async {
    await t.pumpWidget(_app('en'));
    expect(find.text('Hello'), findsOneWidget);
    expect(_blurred(t), isFalse);

    await t.pumpWidget(_app('es'));
    await t.pump(const Duration(milliseconds: 100));
    expect(_blurred(t), isTrue);
    expect(find.text('Hello'), findsOneWidget, reason: 'the text does not change during the ramp');

    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Hola'), findsOneWidget);

    await t.pumpAndSettle();
    expect(_blurred(t), isFalse);
    expect(find.text('Hola'), findsOneWidget);
  });

  testWidgets('with reduced motion the language swaps without a blur', (t) async {
    await t.pumpWidget(_app('en', reduceMotion: true));
    await t.pumpWidget(_app('es', reduceMotion: true));
    expect(_blurred(t), isFalse);
    expect(find.text('Hola'), findsOneWidget);
  });
}
