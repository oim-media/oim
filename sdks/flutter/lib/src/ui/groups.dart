/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// Is this slot a group?
bool isGroup(dynamic slot) {
  if (slot is! Map) return false;
  return slot['type'] == 'group';
}

/// A slot's parent group id, as the editor writes it in `style.groupId`.
String? slotParent(dynamic slot) {
  if (slot is! Map) return null;
  final style = slot['style'];
  if (style is! Map) return null;
  final id = style['groupId']?.toString();
  return (id != null && id.isNotEmpty) ? id : null;
}

/// Which slots go inside which group.
/// Matches `@oim-media/core` `childrenByGroup`.
Map<String, List<String>> childrenByGroup(List<dynamic>? slots) {
  final groupIds = <String>{};
  for (final s in slots ?? const []) {
    if (s is Map && isGroup(s)) {
      final id = s['id']?.toString();
      if (id != null && id.isNotEmpty) {
        groupIds.add(id);
      }
    }
  }

  final byParent = <String, List<String>>{};
  for (final s in slots ?? const []) {
    if (s is! Map) continue;
    final id = s['id']?.toString();
    if (id == null || id.isEmpty || isGroup(s)) continue;

    final parent = slotParent(s);
    if (parent == null || !groupIds.contains(parent)) continue;

    byParent.putIfAbsent(parent, () => <String>[]).add(id);
  }
  return byParent;
}
