// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/main.dart';
import 'package:oim_viewer_flutter/ui/i18n.dart';

void main() {
  tearDown(() => uiSpanish = false);

  testWidgets('OimViewerApp shows the empty state with the load button', (WidgetTester tester) async {
    uiSpanish = true;
    await tester.pumpWidget(const OimViewerApp());
    expect(find.text('Cargar otro'), findsOneWidget);
    expect(find.text('Cargar archivo'), findsOneWidget);
  });

  // Like the Tauri viewer: Spanish only when the system is in Spanish, English otherwise.
  testWidgets('the interface is in English when the system is not in Spanish', (WidgetTester tester) async {
    uiSpanish = false;
    await tester.pumpWidget(const OimViewerApp());
    expect(find.text('Load another'), findsOneWidget);
    expect(find.text('Load file'), findsOneWidget);
    expect(find.text('Cargar archivo'), findsNothing);
  });
}
