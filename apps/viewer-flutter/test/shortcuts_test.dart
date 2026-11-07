// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_viewer_flutter/library/library_screen.dart';
import 'package:oim_viewer_flutter/main.dart';
import 'package:oim_viewer_flutter/ui/i18n.dart';

void main() {
  setUp(() => uiSpanish = true);
  testWidgets('the Library button and Ctrl+B open the public library', (t) async {
    await t.pumpWidget(const OimViewerApp());
    await t.tap(find.text('Biblioteca'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.byType(LibraryScreen), findsOneWidget);
  });

  testWidgets('Ctrl+B opens the library from the keyboard', (t) async {
    await t.pumpWidget(const OimViewerApp());
    await t.pump();
    await t.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
    await t.sendKeyEvent(LogicalKeyboardKey.keyB);
    await t.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.byType(LibraryScreen), findsOneWidget);
  });
}
