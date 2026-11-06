// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/interaction.dart';
import 'package:oim_flutter/src/ui/motion.dart';
import 'package:path/path.dart' as p;

Uint8List _vector(String name) =>
    File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'vectors', '$name.oim.png')).readAsBytesSync();

Future<void> _pump(WidgetTester t, String name, {bool interactive = true}) async {
  await t.pumpWidget(MaterialApp(
    home: SizedBox(
      width: 800,
      height: 600,
      child: OimPlayer(bytes: _vector(name), isInteractive: interactive, showBaseImage: false),
    ),
  ));
  await t.pump();
}

/// The reveal wrapping the layer that shows [text], or the layer [id] found by its position in the tree.
OimReveal _revealOf(WidgetTester t, Finder inside) =>
    t.widget<OimReveal>(find.ancestor(of: inside, matching: find.byType(OimReveal)).first);

void main() {
  testWidgets('a click toggles another layer (interactive)', (t) async {
    await _pump(t, 'interactive');
    expect(_revealOf(t, find.text('SOY LA FICHA')).visible, isTrue);
    await t.tap(find.text('PULSAME'));
    await t.pump();
    expect(_revealOf(t, find.text('SOY LA FICHA')).visible, isFalse);
    await t.tap(find.text('PULSAME'));
    await t.pump();
    expect(_revealOf(t, find.text('SOY LA FICHA')).visible, isTrue);
  });

  testWidgets('chained actions run in order (interactive-chained-actions)', (t) async {
    await _pump(t, 'interactive-chained-actions');
    final reveals = t.widgetList<OimReveal>(find.byType(OimReveal)).toList();
    expect(reveals.where((r) => !r.visible), isEmpty);
    await t.tap(find.text('Alternar'));
    await t.pump();
    // panel toggled off, alerta hidden, the switch itself still there.
    expect(t.widgetList<OimReveal>(find.byType(OimReveal)).where((r) => !r.visible).length, 2);
    expect(_revealOf(t, find.text('Alternar')).visible, isTrue);
  });

  testWidgets('a hidden layer appears with its reveal and a play runs once (reveal-and-play)', (t) async {
    await _pump(t, 'reveal-and-play');
    final hidden = t.widgetList<OimReveal>(find.byType(OimReveal)).where((r) => !r.visible).toList();
    expect(hidden.length, 1);
    expect(hidden.single.reveal?['effect'], 'slide-up');
    final motion = t.widget<OimMotion>(find.byType(OimMotion));
    expect(motion.playCount, 0);

    await t.tap(find.text('Abrir'));
    await t.pump();
    expect(t.widgetList<OimReveal>(find.byType(OimReveal)).where((r) => !r.visible), isEmpty);
    expect(t.widget<OimMotion>(find.byType(OimMotion)).playCount, 1);
    // Mid-way through the 400 ms slide the panel is still moving.
    await t.pump(const Duration(milliseconds: 100));
    expect(find.byWidgetPredicate((w) => w is Transform && w.transform.getTranslation().y > 0), findsWidgets);
    await t.pumpAndSettle();
  });

  testWidgets('hover scales and rotates, leaving restores (interactive-hover)', (t) async {
    await _pump(t, 'interactive-hover');
    AnimatedScale scale() => t.widget<AnimatedScale>(find.byType(AnimatedScale));
    expect(scale().scale, 1.0);
    final g = await t.createGesture(kind: PointerDeviceKind.mouse);
    await g.addPointer(location: Offset.zero);
    await g.moveTo(t.getCenter(find.byType(OimInteractive)));
    await t.pump();
    expect(scale().scale, closeTo(1.08, 1e-9));
    expect(t.widget<AnimatedRotation>(find.byType(AnimatedRotation)).turns, closeTo(3 / 360, 1e-9));
    await g.moveTo(Offset.zero);
    await t.pump();
    expect(scale().scale, 1.0);
    await g.removePointer();
  });

  testWidgets('isInteractive: false hooks nothing', (t) async {
    await _pump(t, 'interactive', interactive: false);
    expect(find.byType(OimInteractive), findsNothing);
    await t.tap(find.text('PULSAME'), warnIfMissed: false);
    await t.pump();
    expect(_revealOf(t, find.text('SOY LA FICHA')).visible, isTrue);
  });
}
