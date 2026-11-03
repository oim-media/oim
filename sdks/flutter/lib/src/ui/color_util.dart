/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/widgets.dart';

/// Parses CSS-style hex colors (#RGB, #RRGGBB, #RRGGBBAA, transparent) into Flutter Color.
Color? parseCssColor(dynamic rawColor) {
  if (rawColor == null) return null;
  final str = rawColor.toString().trim().toLowerCase();
  if (str == 'transparent') return const Color(0x00000000);
  if (!str.startsWith('#')) return null;

  final hex = str.substring(1);
  if (hex.length == 3) {
    // #RGB -> #RRGGBB
    final r = hex[0];
    final g = hex[1];
    final b = hex[2];
    return Color(int.parse('FF$r$r$g$g$b$b', radix: 16));
  } else if (hex.length == 6) {
    // #RRGGBB
    return Color(int.parse('FF$hex', radix: 16));
  } else if (hex.length == 8) {
    // #RRGGBBAA -> Flutter Color(0xAARRGGBB)
    final rr = hex.substring(0, 2);
    final gg = hex.substring(2, 4);
    final bb = hex.substring(4, 6);
    final aa = hex.substring(6, 8);
    return Color(int.parse('$aa$rr$gg$bb', radix: 16));
  }
  return null;
}

/// Resolves CSS units (e.g. "62.5cqw", "10.0cqh", "24px", 24) to logical pixels given container dimensions.
double? resolveCssUnit(dynamic rawVal, double containerWidth, double containerHeight) {
  if (rawVal == null) return null;
  if (rawVal is num) return rawVal.toDouble();

  final str = rawVal.toString().trim();
  if (str.endsWith('cqw')) {
    final numStr = str.substring(0, str.length - 3);
    final val = double.tryParse(numStr);
    if (val != null) return (val / 100.0) * containerWidth;
  } else if (str.endsWith('cqh')) {
    final numStr = str.substring(0, str.length - 3);
    final val = double.tryParse(numStr);
    if (val != null) return (val / 100.0) * containerHeight;
  } else if (str.endsWith('px')) {
    final numStr = str.substring(0, str.length - 2);
    return double.tryParse(numStr);
  } else if (str.endsWith('%')) {
    final numStr = str.substring(0, str.length - 1);
    final val = double.tryParse(numStr);
    if (val != null) return (val / 100.0) * containerWidth;
  }

  return double.tryParse(str);
}

/// Parses CSS border-radius (e.g. "10px", "10px 25px 50px 0px") into BorderRadius.
BorderRadius parseBorderRadius(dynamic rawRadius, double containerWidth, double containerHeight) {
  if (rawRadius == null) return BorderRadius.zero;
  if (rawRadius is num) return BorderRadius.circular(rawRadius.toDouble());

  final parts = rawRadius.toString().trim().split(RegExp(r'\s+'));
  final radii = parts.map((p) => resolveCssUnit(p, containerWidth, containerHeight) ?? 0.0).toList();

  if (radii.isEmpty) return BorderRadius.zero;
  if (radii.length == 1) return BorderRadius.circular(radii[0]);
  if (radii.length == 2) {
    return BorderRadius.only(
      topLeft: Radius.circular(radii[0]),
      topRight: Radius.circular(radii[1]),
      bottomLeft: Radius.circular(radii[1]),
      bottomRight: Radius.circular(radii[0]),
    );
  }
  if (radii.length == 4) {
    // CSS order: top-left, top-right, bottom-right, bottom-left
    return BorderRadius.only(
      topLeft: Radius.circular(radii[0]),
      topRight: Radius.circular(radii[1]),
      bottomRight: Radius.circular(radii[2]),
      bottomLeft: Radius.circular(radii[3]),
    );
  }

  return BorderRadius.circular(radii[0]);
}
