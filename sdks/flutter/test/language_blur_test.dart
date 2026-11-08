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

// On desktop the web blurs the whole viewport, swaps the text at the peak, then refocuses.
bool _blurred(WidgetTester t) => t.widget<ImageFiltered>(find.byKey(const ValueKey('oim-language-blur'))).enabled;

void main() {
  testWidgets('on desktop changing language blurs, swaps at the peak, then refocuses', (t) async {
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
  }, variant: TargetPlatformVariant.only(TargetPlatform.linux));

  // Web _switchWithFade: on phones and with reduced motion the changing layers fade (120 ms) instead.
  double fadeOpacity(WidgetTester t) => t.widget<FadeTransition>(find.ancestor(of: find.byType(Text).first, matching: find.byType(FadeTransition)).first).opacity.value;

  for (final reduce in [false, true]) {
    testWidgets(reduce ? 'with reduced motion the layer fades, no blur' : 'on a phone the layer fades, no blur', (t) async {
      await t.pumpWidget(_app('en', reduceMotion: reduce));
      await t.pumpWidget(_app('es', reduceMotion: reduce));
      await t.pump(const Duration(milliseconds: 60));
      expect(_blurred(t), isFalse);
      expect(fadeOpacity(t), inExclusiveRange(0, 1));
      expect(find.text('Hello'), findsOneWidget, reason: 'the text swaps once faded out');
      await t.pump(const Duration(milliseconds: 80));
      expect(find.text('Hola'), findsOneWidget);
      await t.pumpAndSettle();
      expect(fadeOpacity(t), 1);
      expect(find.text('Hola'), findsOneWidget);
    }, variant: TargetPlatformVariant.only(reduce ? TargetPlatform.linux : TargetPlatform.android));
  }
}
