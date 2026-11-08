// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/texture.dart';

void main() {
  test('noise presets cover 0..1, shape presets have no noise', () {
    for (final p in ['film-grain-35mm', 'fine-noise', 'dust-scratches', 'vintage-paper', 'rough-canvas']) {
      for (var i = 0; i < 20; i++) {
        final v = noiseCoverage(p, i * 6.3, i * 4.1)!;
        expect(v, inInclusiveRange(0, 1), reason: p);
      }
    }
    expect(noiseCoverage('halftone-dots', 1, 1), isNull);
  });

  test('dust-scratches is mostly empty (its alpha is pushed to 0 except for the streaks)', () {
    var zero = 0;
    for (var i = 0; i < 400; i++) {
      if (noiseCoverage('dust-scratches', (i % 20) * 12.7, (i ~/ 20) * 12.7) == 0) zero++;
    }
    expect(zero, greaterThan(300));
  });

  test('textureEffectOf picks the first enabled known texture', () {
    expect(textureEffectOf({'effects': [{'type': 'texture', 'preset': 'nope'}, {'type': 'texture', 'preset': 'scanlines', 'enabled': false}]}), isNull);
    expect(textureEffectOf({'effects': [{'type': 'blur'}, {'type': 'texture', 'preset': 'scanlines'}]})!['preset'], 'scanlines');
    expect(textureEffectOf(null), isNull);
  });
}
