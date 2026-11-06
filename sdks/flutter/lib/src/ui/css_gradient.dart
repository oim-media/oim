// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// `style.fillGradient`: a CSS `linear-gradient(...)` or `radial-gradient(...)`
// string, as the web paints it (`getFillCss` in @oim-media/core). Anything
// else (conic, repeating, unknown words) gives null and the layer keeps its
// solid fill, as the web drops an unsafe gradient.

import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'color_util.dart';

final _fn = RegExp(r'^(linear|radial)-gradient\(([\s\S]*)\)$');
final _rgb = RegExp(r'^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$');
final _stop = RegExp(r'^(.*?)((?:\s+-?\d*\.?\d+%?)*)$');

/// A CSS colour as used in gradient stops: hex, `transparent` or `rgb()/rgba()`.
Color? cssStopColor(String raw) {
  final s = raw.trim().toLowerCase();
  final m = _rgb.firstMatch(s);
  if (m == null) return parseCssColor(s);
  double ch(int i) => double.parse(m.group(i)!).clamp(0, 255).toDouble();
  var a = 1.0;
  final ra = m.group(4);
  if (ra != null) a = ra.endsWith('%') ? double.parse(ra.substring(0, ra.length - 1)) / 100 : double.parse(ra);
  return Color.fromARGB((a.clamp(0.0, 1.0) * 255).round(), ch(1).round(), ch(2).round(), ch(3).round());
}

List<String>? _splitTopLevel(String body) {
  final parts = <String>[];
  var depth = 0, start = 0;
  for (var i = 0; i < body.length; i++) {
    final c = body[i];
    if (c == '(') depth++;
    if (c == ')' && --depth < 0) return null;
    if (c == ',' && depth == 0) {
      parts.add(body.substring(start, i).trim());
      start = i + 1;
    }
  }
  if (depth != 0) return null;
  parts.add(body.substring(start).trim());
  return parts;
}

/// The CSS angle of a linear gradient's header: `135deg`, `0.5turn`, `to right`, `to top left`.
double? _cssAngle(String h) {
  final m = RegExp(r'^(-?\d*\.?\d+)(deg|turn|rad)$').firstMatch(h);
  if (m != null) {
    final v = double.parse(m.group(1)!);
    return switch (m.group(2)) { 'turn' => v * 360, 'rad' => v * 180 / math.pi, _ => v };
  }
  if (!h.startsWith('to ')) return null;
  final w = h.substring(3).split(RegExp(r'\s+')).toSet();
  final x = w.contains('right') ? 1 : (w.contains('left') ? -1 : 0);
  final y = w.contains('bottom') ? 1 : (w.contains('top') ? -1 : 0);
  if (x == 0 && y == 0) return null;
  // shortcut: corners as 45° steps; CSS aims at the real corner of a non-square box.
  return (math.atan2(x.toDouble(), -y.toDouble()) * 180 / math.pi) % 360;
}

/// The gradient for a box of [size] (CSS sizes the gradient line by the box).
Gradient? parseCssGradient(Object? value, Size size) {
  if (value is! String) return null;
  final m = _fn.firstMatch(value.trim());
  if (m == null) return null;
  final parts = _splitTopLevel(m.group(2)!);
  if (parts == null || parts.any((p) => p.isEmpty)) return null;

  final linear = m.group(1) == 'linear';
  var angle = 180.0; // CSS default: to bottom
  var circle = false;
  var stops = parts;
  final head = parts.first.toLowerCase();
  if (cssStopColor(_stop.firstMatch(head)!.group(1)!) == null) {
    if (linear) {
      final a = _cssAngle(head);
      if (a == null) return null;
      angle = a;
    } else {
      // shortcut: only the shape word is read; sizes and `at <pos>` fall back to the centre.
      circle = head.split(RegExp(r'\s+')).contains('circle');
    }
    stops = parts.sublist(1);
  }
  if (stops.isEmpty) return null;

  final colors = <Color>[];
  final positions = <double?>[];
  for (final s in stops) {
    final sm = _stop.firstMatch(s)!;
    final c = cssStopColor(sm.group(1)!);
    if (c == null) return null;
    final pos = sm.group(2)!.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    double? p(String e) => e.endsWith('%') ? double.parse(e.substring(0, e.length - 1)) / 100 : null;
    if (pos.isEmpty) {
      colors.add(c);
      positions.add(null);
    } else {
      for (final e in pos.take(2)) {
        colors.add(c);
        positions.add(p(e));
      }
    }
  }
  if (colors.length == 1) colors.add(colors.first);
  final resolved = _fillPositions(positions, colors.length);

  if (!linear) {
    return RadialGradient(colors: colors, stops: resolved, radius: circle ? 0.5 : 0.7071);
  }
  // CSS angle: 0deg points up, clockwise; the line is long enough to reach the corners.
  final r = angle * math.pi / 180;
  final sx = math.sin(r), sy = -math.cos(r);
  final w = size.width <= 0 ? 1.0 : size.width, h = size.height <= 0 ? 1.0 : size.height;
  final half = (w * sx.abs() + h * sy.abs()) / 2;
  final end = Alignment(2 * half * sx / w, 2 * half * sy / h);
  return LinearGradient(begin: -end, end: end, colors: colors, stops: resolved);
}

/// CSS rules for missing stop positions: first 0, last 1, gaps evenly spread, never going back.
List<double> _fillPositions(List<double?> raw, int n) {
  final p = List<double?>.from(raw.length == n ? raw : List.filled(n, null));
  p[0] ??= 0;
  p[n - 1] ??= 1;
  for (var i = 1; i < n; i++) {
    if (p[i] != null && p[i]! < p[i - 1]!) p[i] = p[i - 1];
    if (p[i] != null) continue;
    var j = i;
    while (p[j] == null) {
      j++;
    }
    final from = p[i - 1]!, to = p[j]!;
    for (var k = i; k < j; k++) {
      p[k] = from + (to - from) * (k - i + 1) / (j - i + 1);
    }
  }
  return p.cast<double>();
}
