/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'color_util.dart';

const _mask = 0xFFFFFFFF;
int _imul(int a, int b) => (a * b) & _mask;

/// Deterministic Mulberry32, as `@oim-media/core/src/generative/rng.ts`.
class Mulberry32 {
  Mulberry32(int seed) : _state = seed & _mask;
  int _state;

  double next() {
    _state = (_state + 0x6d2b79f5) & _mask;
    var t = _imul(_state ^ (_state >> 15), 1 | _state);
    t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _mask) ^ t;
    return ((t ^ (t >> 14)) & _mask) / 4294967296.0;
  }
}

double _toLinear(double c) => c > 0.04045 ? math.pow((c + 0.055) / 1.055, 2.4).toDouble() : c / 12.92;
double _toSrgb(double c) {
  c = c.clamp(0.0, 1.0);
  return c > 0.0031308 ? 1.055 * math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
}

double _cbrt(double x) => x < 0 ? -math.pow(-x, 1 / 3).toDouble() : math.pow(x, 1 / 3).toDouble();

List<double> _rgb(String hex) {
  var h = hex.trim().replaceFirst('#', '');
  if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
  final n = int.tryParse(h, radix: 16) ?? 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

List<double> _oklab(List<double> c) {
  final r = _toLinear(c[0]), g = _toLinear(c[1]), b = _toLinear(c[2]);
  final l = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  final m = _cbrt(0.2118591070 * r + 0.6806951351 * g + 0.1074457579 * b);
  final s = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/// Perceptual OKLab mix, as `@oim-media/core/src/generative/ramp.ts`.
Color oklabMix(String a, String b, double t) {
  t = t.clamp(0.0, 1.0);
  final p = _oklab(_rgb(a)), q = _oklab(_rgb(b));
  final L = p[0] + (q[0] - p[0]) * t, A = p[1] + (q[1] - p[1]) * t, B = p[2] + (q[2] - p[2]) * t;
  final l = math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3).toDouble();
  final m = math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3).toDouble();
  final s = math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3).toDouble();
  int ch(double v) => (_toSrgb(v) * 255).round().clamp(0, 255);
  return Color.fromARGB(255, ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), ch(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s));
}

Color _layerColor(String mode, List<String> stops, String direction, int i, int total) {
  if (stops.isEmpty) stops = const ['#3b82f6', '#0f172a'];
  if (total <= 1) return oklabMix(stops[0], stops[0], 0);
  var t = i / (total - 1);
  if (direction == 'reverse') t = 1 - t;
  if (direction == 'radial') t = (t - 0.5).abs() * 2;
  if (mode == 'monochrome' || stops.length == 2) return oklabMix(stops.first, stops.last, t);
  final segs = stops.length - 1;
  final st = t * segs;
  final k = math.min(st.floor(), segs - 1);
  return oklabMix(stops[k], stops[k + 1], st - k);
}

/// generatorId → (interpolation, boundary, layers, frequency, amplitude), as the core catalogue.
const _specs = {
  'stacked-waves': ('wave', 'shared', 5, 4, 0.5),
  'layered-waves': ('wave', 'independent', 5, 4, 0.5),
  'stacked-peaks': ('peak', 'shared', 5, 4, 0.6),
  'layered-peaks': ('peak', 'independent', 5, 4, 0.5),
  'stacked-steps': ('step', 'shared', 5, 5, 0.5),
  'layered-steps': ('step', 'independent', 5, 4, 0.5),
  'zigzag-chevron': ('zigzag', 'independent', 6, 4, 0.5),
};

double _num(Map p, String k, num d) {
  final v = p[k];
  return v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? d.toDouble() : d.toDouble());
}

/// The layer-stack paths of `@oim-media/core/src/generative/primitives/layer-stack.ts`, in a w x h box.
List<(Path, Color)> layerStackPaths(Map gen, double w, double h, {double bleed = 1}) {
  final spec = _specs[gen['generatorId']] ?? _specs['stacked-waves']!;
  final p = (gen['params'] as Map?) ?? const {};
  final colors = (gen['colors'] as Map?) ?? const {};
  final layers = _num(p, 'layers', spec.$3).toInt().clamp(1, 12);
  final freq = _num(p, 'frequency', spec.$4).toInt().clamp(2, 12);
  final amp = _num(p, 'amplitude', spec.$5).clamp(0.0, 1.0);
  final balance = _num(p, 'balance', 0.5).clamp(0.0, 1.0);
  final anchor = (p['anchor'] is String && (p['anchor'] as String).isNotEmpty) ? p['anchor'] as String : 'bottom';
  final vertical = anchor == 'bottom' || anchor == 'top';
  final main = vertical ? h : w, cross = vertical ? w : h;
  final span = main / (layers + 1);
  final bias = (balance - 0.5) * cross * 0.4;
  final rng = Mulberry32((gen['seed'] as num?)?.toInt() ?? 0);
  final step = cross / freq;
  final pts = <List<Offset>>[];
  for (var l = 0; l < layers; l++) {
    final row = <Offset>[];
    for (var f = 0; f <= freq; f++) {
      final c = f * step + (f > 0 && f < freq ? bias : 0);
      final off = math.max(10.0, math.min(main - 10, (l + 1) * span + (rng.next() - 0.5) * span * amp * 1.6));
      row.add(vertical ? Offset(c, anchor == 'bottom' ? h - off : off) : Offset(anchor == 'right' ? w - off : off, c));
    }
    pts.add(row);
  }
  final order = spec.$2 == 'independent' ? [for (var l = layers - 1; l >= 0; l--) l] : [for (var l = 0; l < layers; l++) l];
  final stops = ((colors['stops'] as List?) ?? const []).whereType<String>().toList();
  return [
    for (final l in order) () {
      final q = pts[l];
      final path = Path()..moveTo(q[0].dx, q[0].dy);
      for (var i = 0; i < q.length - 1; i++) {
        final a = q[i], b = q[i + 1];
        switch (spec.$1) {
          case 'step':
            vertical ? path.lineTo(b.dx, a.dy) : path.lineTo(a.dx, b.dy);
            path.lineTo(b.dx, b.dy);
          case 'peak':
            path.lineTo(b.dx, b.dy);
          case 'zigzag':
            final s = l.isEven ? 30.0 : -30.0;
            path.lineTo((a.dx + b.dx) / 2 + (vertical ? 0 : s), (a.dy + b.dy) / 2 + (vertical ? s : 0));
            path.lineTo(b.dx, b.dy);
          default:
            final cx = a.dx + (b.dx - a.dx) * 0.5;
            path.cubicTo(cx, a.dy, cx, b.dy, b.dx, b.dy);
        }
      }
      if (spec.$2 == 'shared' && l > 0) {
        final d = switch (anchor) { 'bottom' => Offset(0, bleed), 'top' => Offset(0, -bleed), 'right' => Offset(bleed, 0), _ => Offset(-bleed, 0) };
        for (final o in pts[l - 1].reversed) {
          path.lineTo(o.dx + d.dx, o.dy + d.dy);
        }
      } else {
        switch (anchor) {
          case 'bottom':
            path..lineTo(w, h + bleed)..lineTo(0, h + bleed);
          case 'top':
            path..lineTo(w, -bleed)..lineTo(0, -bleed);
          case 'right':
            path..lineTo(w + bleed, h)..lineTo(w + bleed, 0);
          default:
            path..lineTo(-bleed, h)..lineTo(-bleed, 0);
        }
      }
      path.close();
      return (path, _layerColor('${colors['mode'] ?? ''}', stops, '${colors['direction'] ?? ''}', l, layers));
    }(),
  ];
}

/// A shape's generative fill (v2 `fills[].generative`), covering its box as the web's SVG does.
class GenerativeFillPainter extends CustomPainter {
  GenerativeFillPainter(this.gen, this.unit);
  final Map gen;
  /// Device px per design px: the generator's fixed offsets (10, 30) are design px.
  final double unit;

  @override
  void paint(Canvas canvas, Size size) {
    const bleed = 1.0;
    final w = math.max(size.width / unit, 1.0), h = math.max(size.height / unit, 1.0);
    canvas.clipRect(Offset.zero & size);
    canvas.scale(unit);
    final colors = (gen['colors'] as Map?) ?? const {};
    final bg = colors['backgroundVisible'] == true ? parseCssColor(colors['background']) : null;
    if (bg != null) canvas.drawRect(Rect.fromLTWH(0, 0, w, h + bleed), Paint()..color = bg);
    for (final (path, color) in layerStackPaths(gen, w, h, bleed: bleed)) {
      canvas.drawPath(path, Paint()..color = color);
      canvas.drawPath(path, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 0.5..strokeJoin = StrokeJoin.round);
    }
  }

  @override
  bool shouldRepaint(GenerativeFillPainter old) => old.gen != gen || old.unit != unit;
}
