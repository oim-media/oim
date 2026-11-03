// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/main.dart';

void main() {
  testWidgets('OimViewerApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const OimViewerApp());
    expect(find.text('Abrir .oim'), findsOneWidget);
  });
}
