// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/actions.dart';
import 'package:path/path.dart' as p;

void main() {
  final file = File(p.join(Directory.current.path, '..', '..', 'packages', 'spec', 'action-cases.json'));
  final cases = (jsonDecode(file.readAsStringSync()) as List).cast<Map<String, dynamic>>();

  test('has cases', () => expect(cases.length, greaterThan(5)));
  for (final c in cases) {
    test(c['name'], () {
      final current = (c['current'] as Map).map((k, v) => MapEntry(k as String, v as bool));
      final got = resolveActions(c['actions'] as List, current);
      expect(got.visibility, c['expected']['visibility']);
      expect(got.texts, c['expected']['texts']);
    });
  }

  test('scale is a percentage, small values a multiplier', () {
    expect(scaleAsFactor(108), closeTo(1.08, 1e-9));
    expect(scaleAsFactor(1.1), 1.1);
  });

  test('interaction is read from style or root', () {
    expect(readInteraction({'style': {'isInteractive': true, 'states': {'hover': {}}}}).isInteractive, isTrue);
    expect(readInteraction({'isInteractive': true, 'states': {'active': {}}}).states, isNotNull);
    expect(readInteraction({'style': {}}).isInteractive, isFalse);
  });
}
