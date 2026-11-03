/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/geo_shapes.dart';
import 'package:oim_flutter/src/ui/svg_path.dart';

void main() {
  group('Geo Shapes & SVG Path Parser', () {
    test('contains all 22 custom catalogue shapes (excluding rect)', () {
      expect(geoShapes.length, 22);

      expect(isKnownGeoShape('rectangle'), isTrue);
      expect(isKnownGeoShape('rect'), isTrue);
      expect(isKnownGeoShape('circle'), isTrue);
      expect(isKnownGeoShape('star'), isTrue);
      expect(isKnownGeoShape('cloud'), isTrue);
      expect(isKnownGeoShape('heart'), isTrue);
      expect(isKnownGeoShape('flower'), isTrue);
      expect(isKnownGeoShape('unknown_shape'), isFalse);

      expect(shapeDrawing('rect'), isNull);
      expect(shapeDrawing('rectangle'), isNull);
      expect(shapeDrawing('star'), isA<PolygonDrawing>());
      expect(shapeDrawing('circle'), isA<PathDrawing>());
    });

    test('parseSvgPath parses basic SVG path commands', () {
      final p1 = parseSvgPath('M 10 20 L 30 40 Z');
      expect(p1, isNotNull);
      final bounds1 = p1.getBounds();
      expect(bounds1.left, 10.0);
      expect(bounds1.top, 20.0);
      expect(bounds1.right, 30.0);
      expect(bounds1.bottom, 40.0);

      final p2 = parseSvgPath('M 0 0 H 50 V 100 Z');
      final bounds2 = p2.getBounds();
      expect(bounds2.width, 50.0);
      expect(bounds2.height, 100.0);
    });

    test('buildShapePath scales polygon to container size', () {
      final star = shapeDrawing('star')!;
      final path = buildShapePath(drawing: star, size: const Size(200, 400));
      final bounds = path.getBounds();
      expect(bounds.width, inInclusiveRange(190.0, 200.0));
      expect(bounds.height, inInclusiveRange(370.0, 400.0));
    });

    test('buildShapePath scales SVG path to container size', () {
      final heart = shapeDrawing('heart')!;
      final path = buildShapePath(drawing: heart, size: const Size(100, 100));
      final bounds = path.getBounds();
      expect(bounds.width, inInclusiveRange(80.0, 110.0));
      expect(bounds.height, inInclusiveRange(80.0, 110.0));
    });
  });
}
