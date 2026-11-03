// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/main.dart';

void main() {
  testWidgets('OimViewerApp shows the empty state with the load button', (WidgetTester tester) async {
    await tester.pumpWidget(const OimViewerApp());
    expect(find.text('Cargar otro'), findsOneWidget);
    expect(find.text('Cargar archivo'), findsOneWidget);
  });
}
