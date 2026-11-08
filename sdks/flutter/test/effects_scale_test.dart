// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/effects.dart';

// Shadows and effects are in design px: on the web they live in the scaled stage, so a canvas
// drawn at half size halves offsets and blurs too.
void main() {
  const unit = 0.5;

  test('the legacy shadow scales', () {
    final s = shadowOf({'shadowEnabled': true, 'shadowOffsetX': 8, 'shadowOffsetY': 4, 'shadowBlur': 10}, unit: unit)!;
    expect(s.offset, const Offset(4, 2));
    expect(s.blurRadius, 5);
  });

  test('text effect shadows scale', () {
    final s = textEffectShadows({'effects': [
      {'type': 'drop-shadow', 'x': 8, 'y': 8, 'blur': 12},
      {'type': 'glow', 'radius': 20},
    ]}, null, unit: unit);
    expect(s[0].offset, const Offset(4, 4));
    expect(s[0].blurRadius, 6);
    expect(s[2].blurRadius, 10);
  });

  test('a layer drop-shadow moves by the scaled offset', () {
    final w = layerEffects(const SizedBox(width: 10, height: 10), {'effects': [{'type': 'drop-shadow', 'x': 8, 'y': 8, 'blur': 0}]}, null, isText: false, unit: unit);
    final t = ((w as Stack).children.first as Transform).transform.getTranslation();
    expect([t.x, t.y], [4, 4]);
  });
}
