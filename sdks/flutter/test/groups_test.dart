/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter_test/flutter_test.dart';
import 'package:oim_flutter/src/ui/groups.dart';

void main() {
  group('Groups and Hierarchy', () {
    test('isGroup and slotParent identify groups correctly', () {
      expect(isGroup({'type': 'group'}), isTrue);
      expect(isGroup({'type': 'geo'}), isFalse);
      expect(isGroup(null), isFalse);

      expect(slotParent({'style': {'groupId': 'parent_1'}}), 'parent_1');
      expect(slotParent({'style': {}}), isNull);
      expect(slotParent(null), isNull);
    });

    test('childrenByGroup indexes children by parent group id', () {
      final slots = [
        {'id': 'g1', 'type': 'group', 'style': {}},
        {'id': 'c1', 'type': 'geo', 'style': {'groupId': 'g1'}},
        {'id': 'c2', 'type': 'text', 'style': {'groupId': 'g1'}},
        {'id': 'orphan', 'type': 'geo', 'style': {}},
        {'id': 'invalid_parent', 'type': 'geo', 'style': {'groupId': 'non_existent_g'}},
      ];

      final grouped = childrenByGroup(slots);
      expect(grouped.length, 1);
      expect(grouped['g1'], equals(['c1', 'c2']));
      expect(grouped.containsKey('non_existent_g'), isFalse);
    });
  });
}
