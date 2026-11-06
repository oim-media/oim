// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Same cases as @oim-media/core (keyframes.test.ts): both players must sample
// a keyframe animation identically.
import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';
import 'package:oim_flutter/src/ui/keyframes.dart';

void main() {
  final file = File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'keyframe-cases.json'));
  final cases = (jsonDecode(file.readAsStringSync()) as List).cast<Map<String, dynamic>>();

  test('has cases', () => expect(cases.length, greaterThan(5)));
  for (final c in cases) {
    for (final s in (c['samples'] as List).cast<Map<String, dynamic>>()) {
      test('${c['name']} at ${s['time']}s', () {
        final got = sampleKeyframes(
          (c['keyframes'] as List).cast<Map<String, dynamic>>(),
          (c['duration'] as num).toDouble(),
          (s['time'] as num).toDouble(),
        ).toMap();
        (s['expect'] as Map<String, dynamic>).forEach((k, v) {
          expect(got[k], closeTo((v as num).toDouble(), 1e-3), reason: k);
        });
      });
    }
  }
}
