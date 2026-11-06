// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/oim_flutter.dart';
import 'package:oim_flutter/src/ui/masks.dart';

void main() {
  const canvas = Size(800, 600);
  const box = Rect.fromLTWH(100, 100, 200, 200);

  test('a cutout keeps what is outside its box and only the silhouette inside', () {
    final path = cutoutPath({'maskShape': 'circle'}, box, canvas, 1);
    expect(path.contains(const Offset(50, 50)), isTrue, reason: 'outside the box');
    expect(path.contains(const Offset(105, 105)), isFalse, reason: 'box corner, outside the circle');
    expect(path.contains(const Offset(200, 200)), isTrue, reason: 'inside the circle');
  });

  test('a window paints its coverage with the silhouette as a hole', () {
    final canvasWide = windowPath({'maskShape': 'diamond'}, box, canvas, 1);
    expect(canvasWide.contains(const Offset(50, 50)), isTrue);
    expect(canvasWide.contains(const Offset(200, 200)), isFalse);
    final container = windowPath({'maskShape': 'diamond', 'maskCoverage': 'container'}, box, canvas, 1);
    expect(container.contains(const Offset(50, 50)), isFalse);
    expect(container.contains(const Offset(105, 105)), isTrue);
  });

  test('silhouette: a custom path only without a named shape; circle by default', () {
    expect(maskSilhouetteData({'svgPath': 'M0 0 L1 1 Z'}), 'M0 0 L1 1 Z');
    expect(maskSilhouetteData({'svgPath': 'M0 0 L1 1 Z', 'maskShape': 'star'}), maskShapePaths['star']);
    expect(maskSilhouetteData({}), maskShapePaths['circle']);
  });

  test('cuts place each silhouette in its own box', () {
    final path = cutoutPath({
      'cuts': [
        {'shape': 'rectangle', 'x': 0, 'y': 0, 'width': 50, 'height': 50},
        {'shape': 'rectangle', 'x': 150, 'y': 150, 'width': 50, 'height': 50},
      ],
    }, box, canvas, 1);
    expect(path.contains(const Offset(110, 110)), isTrue);
    expect(path.contains(const Offset(290, 290)), isTrue);
    expect(path.contains(const Offset(200, 200)), isFalse);
  });

  test('languages of a file and layers limited to some', () {
    expect(oimLanguages({
      'slots': [
        {'content': {'ES': 'a', 'en': 'b'}},
        {'content': {'*': 'x.png', 'fr': 'y.png'}},
      ],
    }), ['en', 'es', 'fr']);
    expect(slotShownIn({'languages': ['es']}, 'en'), isFalse);
    expect(slotShownIn({'languages': ['es']}, 'es'), isTrue);
    expect(slotShownIn({'languages': ['*']}, 'en'), isTrue);
    expect(slotShownIn({}, 'en'), isTrue);
  });

  testWidgets('a cutout clips the layers below it, feathered or not', (t) async {
    for (final feather in [0.0, 6.0]) {
      await t.pumpWidget(MaterialApp(
        home: SizedBox(
          width: 800,
          height: 600,
          child: cutoutMask(path: cutoutPath({}, box, canvas, 1), canvas: canvas, feather: feather, child: const ColoredBox(color: Colors.red)),
        ),
      ));
      expect(find.byType(feather == 0 ? ClipPath : ShaderMask), findsOneWidget);
    }
  });
}
