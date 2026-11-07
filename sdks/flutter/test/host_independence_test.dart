// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:path/path.dart' as p;

final _vectors = Directory(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors'));

// Like the web component, the player must not depend on the page it is put in. Without a
// Material ancestor Flutter's fallback text style is red, 48px monospace with a yellow
// double underline; the player's text must not inherit any of it.
void main() {
  for (final f in _vectors.listSync().whereType<File>().where((f) => f.path.endsWith('.oim.png'))) {
    final name = p.basename(f.path);
    testWidgets('$name: no text inherits the host fallback style', (t) async {
      await t.pumpWidget(MaterialApp(
        home: SizedBox(width: 800, height: 600, child: OimPlayer(bytes: f.readAsBytesSync(), showBaseImage: false, disableAnimations: true)),
      ));
      await t.pump(const Duration(milliseconds: 100));
      for (final rt in t.widgetList<RichText>(find.byType(RichText))) {
        rt.text.visitChildren((span) {
          final s = (span as TextSpan).style;
          expect(s?.decoration, isNot(TextDecoration.underline), reason: '"${span.toPlainText()}" is underlined');
          expect(s?.decorationColor, isNot(const Color(0xFFFFFF00)));
          return true;
        });
      }
    });
  }
}
