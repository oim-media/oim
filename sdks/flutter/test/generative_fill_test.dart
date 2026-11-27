/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/generative_fill.dart';

void main() {
  test('Mulberry32 draws the same numbers as the core rng', () {
    final r = Mulberry32(7);
    expect([r.next(), r.next(), r.next()], [0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
  });

  test('stacked waves paint one path per layer, lighter to darker', () {
    final gen = {
      'generatorId': 'stacked-waves', 'seed': 7,
      'params': {'layers': 5, 'frequency': 4},
      'colors': {'mode': 'monochrome', 'stops': ['#3b82f6', '#0f172a']},
    };
    final out = layerStackPaths(gen, 260, 120);
    expect(out.length, 5);
    expect(out.first.$2, const Color(0xFF3B82F6));
    expect(out.last.$2, const Color(0xFF0F172A));
    expect(out.first.$1.getBounds().bottom, closeTo(121, 0.01));
  });
}
