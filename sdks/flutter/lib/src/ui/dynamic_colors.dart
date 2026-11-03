/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/painting.dart';
import 'color_util.dart';

const List<String> dynamicColorRoles = [
  'primary',
  'on-primary',
  'secondary',
  'on-secondary',
  'surface',
  'on-surface',
  'outline',
  'accent',
  'text-primary',
  'text-secondary',
  'text-muted',
  'text-on-accent',
];

final Set<String> _roleSet = Set<String>.unmodifiable(dynamicColorRoles);

bool isValidDynamicColorRole(dynamic role) => role is String && _roleSet.contains(role);

/// Resolved colors for a palette: map of role -> Color.
typedef OimPalette = Map<String, Color>;

/// Resolves the document's active palette from its metadata.
///
/// Order: `requested` if it exists; otherwise `dark`/`light` according to
/// `prefersDark` when the document carries both; otherwise `defaultPalette`.
OimPalette? resolvePalette(
  Map<String, dynamic> metadata, {
  String? requested,
  bool? prefersDark,
}) {
  final palettes = metadata['palettes'];
  if (palettes is! Map) return null;

  final hasDark = palettes.containsKey('dark');
  final hasLight = palettes.containsKey('light');
  final both = hasDark && hasLight;

  String? byPreference;
  if (both && prefersDark != null) {
    byPreference = prefersDark ? 'dark' : 'light';
  }

  final defaultPalette = metadata['defaultPalette']?.toString();
  final candidates = [requested, byPreference, defaultPalette];

  String? selectedName;
  for (final c in candidates) {
    if (c != null && palettes.containsKey(c)) {
      selectedName = c;
      break;
    }
  }

  if (selectedName == null) return null;

  final rawPalette = palettes[selectedName];
  if (rawPalette is! Map) return null;

  final result = <String, Color>{};
  for (final role in dynamicColorRoles) {
    final rawVal = rawPalette[role];
    if (rawVal != null) {
      final parsed = parseCssColor(rawVal);
      if (parsed != null) {
        result[role] = parsed;
      }
    }
  }

  return result;
}

/// Resolves a color given a semantic role, fallback raw value, and active palette.
Color? resolveColor(
  dynamic role,
  dynamic fallback,
  OimPalette? palette,
) {
  if (isValidDynamicColorRole(role) && palette != null && palette.containsKey(role)) {
    return palette[role];
  }
  return parseCssColor(fallback);
}
