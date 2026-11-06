// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/motion.dart';

const _key = Key('box');

Widget _host(Map<String, dynamic> anim, {bool disable = false}) => Directionality(
      textDirection: TextDirection.ltr,
      child: Center(
        child: OimMotion(
          animation: anim,
          disableAnimations: disable,
          child: const SizedBox(key: _key, width: 20, height: 20),
        ),
      ),
    );

/// The matrix of the motion `Transform` closest to the box.
Matrix4 _matrix(WidgetTester t) =>
    t.widget<Transform>(find.ancestor(of: find.byKey(_key), matching: find.byType(Transform)).first).transform;

void main() {
  testWidgets('keyframes move the layer with the controller', (t) async {
    await t.pumpWidget(_host({
      'duration': 2,
      'keyframes': [
        {'t': 0, 'x': 0},
        {'t': 2, 'x': 100},
      ],
    }));
    await t.pump(const Duration(seconds: 1));
    expect(_matrix(t).getTranslation().x, closeTo(50, 0.5));
  });

  testWidgets('trigger "action" rests on the first keyframe', (t) async {
    await t.pumpWidget(_host({
      'duration': 2,
      'trigger': 'action',
      'keyframes': [
        {'t': 0, 'x': 30},
        {'t': 2, 'x': 100},
      ],
    }));
    await t.pump(const Duration(seconds: 5));
    expect(_matrix(t).getTranslation().x, closeTo(30, 0.01));
    expect(t.hasRunningAnimations, isFalse);
  });

  testWidgets('disableAnimations: nothing moves and no ticker runs', (t) async {
    await t.pumpWidget(_host({
      'loop': 'spin',
      'hover': 'grow',
      'keyframes': [
        {'t': 0, 'x': 0},
        {'t': 2, 'x': 100},
      ],
    }, disable: true));
    await t.pump(const Duration(seconds: 1));
    expect(find.ancestor(of: find.byKey(_key), matching: find.byType(Transform)), findsNothing);
    expect(t.hasRunningAnimations, isFalse);
  });

  testWidgets('loop spin turns a quarter in a quarter of its 4 s', (t) async {
    await t.pumpWidget(_host({'loop': 'spin'}));
    await t.pump(const Duration(seconds: 1));
    final m = _matrix(t);
    // rotateZ(90°): the x axis maps onto y.
    expect(m.entry(1, 0), closeTo(1, 0.01));
  });

  testWidgets('hover grow scales to 1.08 and back', (t) async {
    await t.pumpWidget(_host({'hover': 'grow'}));
    final mouse = await t.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: Offset.zero);
    await mouse.moveTo(t.getCenter(find.byKey(_key)));
    await t.pumpAndSettle();
    expect(_matrix(t).entry(0, 0), closeTo(1.08, 0.001));
    await mouse.moveTo(Offset.zero);
    await t.pumpAndSettle();
    expect(_matrix(t).entry(0, 0), closeTo(1, 0.001));
  });
}
