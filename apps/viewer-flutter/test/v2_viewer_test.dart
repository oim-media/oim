// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/main.dart';
import 'package:oim_viewer_flutter/ui/i18n.dart';

void main() {
  tearDown(() => uiSpanish = false);

  testWidgets('loads Format 2.0 vector with inspector dimensions, slots, and schema version',
      (WidgetTester tester) async {
    uiSpanish = false;
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bytes = File('../../packages/spec/vectors-2/palettes.oim.png').readAsBytesSync();
    await tester.pumpWidget(OimViewerApp(
      initialBytes: bytes,
      initialFileName: 'palettes.oim.png',
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('v2.'), findsAtLeastNWidgets(1));
    expect(find.text('Responsive'), findsNothing);
    expect(find.text('0 slots'), findsNothing);
    expect(find.text('800 × 600 px'), findsOneWidget);
    expect(find.textContaining('slots'), findsOneWidget);
  });
}
