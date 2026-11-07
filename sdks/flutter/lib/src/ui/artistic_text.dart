// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// `artistic-text` layers, painted as the web player does (packages/player-oim
// render/artisticText.ts): an SVG box of `width x height` canvas px fitted into the
// slot ("meet"), one group per line, each with its extrusion layers, outer stroke
// and face. Curve, lines and extrusion follow @oim-media/core; the shared cases are
// packages/spec/artistic-text-cases.json.

import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'color_util.dart';

/// JS `Number#toString` for the values these paths produce (no trailing `.0`).
String _num(num v) => v == v.truncate() ? v.truncate().toString() : v.toString();

/// `calculateTextCurvePath` of the core: the `d` of the path the text runs along.
String textCurvePathD(double width, double height, double curveAmount, String curveType) {
  final midY = height / 2;
  final c = curveAmount.clamp(-100, 100).toDouble();
  if (c == 0) return 'M 0 ${_num(midY)} L ${_num(width)} ${_num(midY)}';
  final deltaY = (c / 100) * height * 0.45;
  if (curveType == 'wave') {
    return 'M 0 ${_num(midY)} C ${_num(width * 0.25)} ${_num(midY - deltaY)}, ${_num(width * 0.75)} ${_num(midY + deltaY)}, ${_num(width)} ${_num(midY)}';
  }
  final yEnds = midY + deltaY * 0.5;
  return 'M 0 ${_num(yEnds)} Q ${_num(width / 2)} ${_num(midY - deltaY)} ${_num(width)} ${_num(yEnds)}';
}

/// The same path as [textCurvePathD], as a Flutter [Path].
Path textCurvePath(double width, double height, double curveAmount, String curveType) {
  final midY = height / 2;
  final c = curveAmount.clamp(-100, 100).toDouble();
  final p = Path();
  if (c == 0) return p..moveTo(0, midY)..lineTo(width, midY);
  final deltaY = (c / 100) * height * 0.45;
  if (curveType == 'wave') {
    return p..moveTo(0, midY)..cubicTo(width * 0.25, midY - deltaY, width * 0.75, midY + deltaY, width, midY);
  }
  final yEnds = midY + deltaY * 0.5;
  return p..moveTo(0, yEnds)..quadraticBezierTo(width / 2, midY - deltaY, width, yEnds);
}

/// `artisticTextLines` of the core: each line and its offset from the box's vertical centre.
List<({String text, double offset})> artisticTextLines(String text, double fontSize, double lineHeight) {
  final lines = text.split(RegExp(r'\r\n|\r|\n'));
  final middle = (lines.length - 1) / 2;
  return [for (var i = 0; i < lines.length; i++) (text: lines[i], offset: (i - middle) * fontSize * lineHeight)];
}

/// `shadeHexColor` of the core: darkens `#rgb`/`#rrggbb` towards black; anything else is returned as is.
String shadeHexColor(String color, double percent) {
  if (!color.startsWith('#')) return color;
  var hex = color.substring(1);
  if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
  if (hex.length != 6) return color;
  final n = int.tryParse(hex, radix: 16);
  if (n == null) return color;
  int ch(int v) => (v * (1 - percent)).floor().clamp(0, 255);
  final out = (ch(n >> 16) << 16) | (ch((n >> 8) & 0xff) << 8) | ch(n & 0xff);
  return '#${out.toRadixString(16).padLeft(6, '0')}';
}

/// `calculate3DExtrusionLayers` of the core, deepest first.
List<({double dx, double dy, String color, double opacity})> extrusionLayers(double depth, double angle, String color, bool shading) {
  final steps = depth.clamp(0, 60).round();
  if (steps == 0) return const [];
  final rad = angle * math.pi / 180;
  double r1(double v) => (v * 10).roundToDouble() / 10;
  return [
    for (var i = steps; i >= 1; i--)
      (
        dx: r1(math.cos(rad) * i) + 0.0,
        dy: r1(math.sin(rad) * i) + 0.0,
        color: shading ? shadeHexColor(color, 1 - (i / steps) * 0.5) : color,
        opacity: 1.0,
      ),
  ];
}

/// Built-in face gradients (`textGradientType`), as the web's SVG `linearGradient`s.
LinearGradient? _faceGradient(String? type) => switch (type) {
      'sunset-gold' => const LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0xFFFDE047), Color(0xFFF97316), Color(0xFFBE185D)], stops: [0, 0.5, 1]),
      'metallic-chrome' => const LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0xFFFFFFFF), Color(0xFFE2E8F0), Color(0xFF64748B), Color(0xFF0F172A), Color(0xFF94A3B8), Color(0xFFFFFFFF)],
          stops: [0, 0.35, 0.5, 0.51, 0.75, 1]),
      'neon-glow' => const LinearGradient(colors: [Color(0xFF67E8F9), Color(0xFFA5F3FC)]),
      _ => null,
    };

/// The web model (`buildArtisticTextModelFromSlot`): sizes are canvas px, `cqw` of [canvasWidth].
class ArtisticTextModel {
  ArtisticTextModel.fromSlot(Map<String, dynamic> slot, Map<String, dynamic> style, this.text, double canvasWidth, this.fontFamily)
      : width = _first([slot['width_px'], slot['w'], _px(style['width'], canvasWidth)]) ?? 400,
        height = _first([slot['height_px'], slot['h'], _px(style['height'], canvasWidth)]) ?? 120,
        fontSize = _first([slot['font_size_px'], _px(style['fontSize'], canvasWidth)]) ?? 48,
        bold = style['fontWeight'] == 'bold' || (num.tryParse('${style['fontWeight']}') ?? 0) >= 700,
        letterSpacing = style['letterSpacing'] is num ? (style['letterSpacing'] as num).toDouble() : double.tryParse('${style['letterSpacing']}'.replaceAll(RegExp(r'[a-z]+$'), '')) ?? 0,
        lineHeight = _lineHeight(style['lineHeight']),
        fill = parseCssColor(style['fillColor'] ?? '#FBBF24') ?? const Color(0xFFFBBF24),
        curveAmount = (style['curveAmount'] is num ? style['curveAmount'] as num : 0).toDouble(),
        curveType = style['curveType']?.toString() ?? 'arc',
        layers = extrusionLayers(
          (style['extrusionDepth'] is num ? style['extrusionDepth'] as num : 0).toDouble(),
          (style['extrusionAngle'] is num ? style['extrusionAngle'] as num : 45).toDouble(),
          style['extrusionColor']?.toString() ?? '#111827',
          style['extrusionShading'] != false,
        ),
        outerStroke = parseCssColor(style['outerStrokeColor']),
        outerStrokeWidth = (style['outerStrokeWidth'] is num ? style['outerStrokeWidth'] as num : 0).toDouble(),
        innerStroke = parseCssColor(style['innerStrokeColor'] ?? '#FFFFFF'),
        innerStrokeWidth = (style['innerStrokeWidth'] is num ? style['innerStrokeWidth'] as num : 0).toDouble(),
        gradient = _faceGradient(style['textGradientType']?.toString());

  final String text;
  final String fontFamily;
  final double width, height, fontSize, letterSpacing, lineHeight, curveAmount, outerStrokeWidth, innerStrokeWidth;
  final bool bold;
  final Color fill;
  final Color? outerStroke, innerStroke;
  final String curveType;
  final List<({double dx, double dy, String color, double opacity})> layers;
  final LinearGradient? gradient;

  static double? _first(List<dynamic> v) {
    for (final x in v) {
      if (x is num && x > 0) return x.toDouble();
    }
    return null;
  }

  static double? _px(dynamic v, double canvasWidth) {
    if (v is num) return v > 0 ? v.toDouble() : null;
    if (v is! String) return null;
    final n = double.tryParse(RegExp(r'^\s*-?[\d.]+').stringMatch(v) ?? '');
    if (n == null || n <= 0) return null;
    return v.contains('cqw') ? n / 100 * canvasWidth : n;
  }

  // `resolveLineHeight` of the core: default 1.25, clamped.
  static double _lineHeight(dynamic v) {
    final n = v is num ? v.toDouble() : double.tryParse('$v');
    if (n == null || !n.isFinite || n <= 0) return 1.25;
    return n.clamp(0.5, 3.0);
  }
}

/// Paints an [ArtisticTextModel] fitted into its box, without clipping (web `overflow: visible`).
class ArtisticTextPainter extends CustomPainter {
  ArtisticTextPainter(this.m);
  final ArtisticTextModel m;

  TextPainter _tp(String text, Paint paint) => TextPainter(
        text: TextSpan(
          text: text,
          style: TextStyle(
            fontFamily: m.fontFamily,
            fontSize: m.fontSize,
            fontWeight: m.bold ? FontWeight.bold : FontWeight.normal,
            letterSpacing: m.letterSpacing == 0 ? null : m.letterSpacing,
            foreground: paint,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

  Paint _fill(Color c) => Paint()..color = c;
  Paint _stroke(Color c, double w) => Paint()
    ..color = c
    ..style = PaintingStyle.stroke
    ..strokeWidth = w
    ..strokeJoin = StrokeJoin.round;

  /// Draws [text] with [paint]; returns the area it covered (for the face gradient).
  Rect _draw(Canvas canvas, String text, Paint paint, Path? curve, double lineOffsetY) {
    if (curve == null) {
      // x=50% y=50%, text-anchor middle, dominant-baseline central.
      final tp = _tp(text, paint);
      final at = Offset((m.width - tp.width) / 2, m.height / 2 + lineOffsetY - tp.height / 2);
      tp.paint(canvas, at);
      // Italic glyphs overhang their advance; the SVG box holds the ink.
      return (at & tp.size).inflate(m.fontSize * 0.25);
    }
    // textPath startOffset 50%, text-anchor middle: glyph baselines on the path, centred on it.
    final metric = curve.computeMetrics().first;
    final glyphs = text.characters.map((g) => (g, _tp(g, paint))).toList();
    final total = glyphs.fold<double>(0, (s, g) => s + g.$2.width);
    var dist = metric.length / 2 - total / 2;
    var area = Rect.zero;
    for (final (_, tp) in glyphs) {
      final t = metric.getTangentForOffset((dist + tp.width / 2).clamp(0, metric.length));
      dist += tp.width;
      if (t == null) continue;
      final baseline = tp.computeDistanceToActualBaseline(TextBaseline.alphabetic);
      canvas
        ..save()
        ..translate(t.position.dx, t.position.dy + lineOffsetY)
        ..rotate(-t.angle);
      tp.paint(canvas, Offset(-tp.width / 2, -baseline));
      canvas.restore();
      // The glyph's box sits above its baseline point on the path.
      final r = Rect.fromLTWH(t.position.dx - tp.width / 2, t.position.dy + lineOffsetY - baseline, tp.width, tp.height).inflate(m.fontSize * 0.1);
      area = area.isEmpty ? r : area.expandToInclude(r);
    }
    return area;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / m.width, size.height / m.height);
    canvas
      ..save()
      ..translate((size.width - m.width * scale) / 2, (size.height - m.height * scale) / 2)
      ..scale(scale);
    final curve = m.curveAmount == 0 ? null : textCurvePath(m.width, m.height, m.curveAmount, m.curveType);
    final extrusionStroke = m.outerStrokeWidth > 0 ? m.outerStrokeWidth : 1.0;
    for (final line in artisticTextLines(m.text, m.fontSize, m.lineHeight)) {
      for (final l in m.layers) {
        final c = parseCssColor(l.color) ?? const Color(0xFF111827);
        canvas
          ..save()
          ..translate(l.dx, l.dy);
        _draw(canvas, line.text, _fill(c), curve, line.offset);
        _draw(canvas, line.text, _stroke(c, extrusionStroke), curve, line.offset);
        canvas.restore();
      }
      if (m.outerStrokeWidth > 0 && m.outerStroke != null) {
        _draw(canvas, line.text, _stroke(m.outerStroke!, m.outerStrokeWidth * 2), curve, line.offset);
      }
      // paint-order: stroke, then fill.
      if (m.innerStrokeWidth > 0 && m.innerStroke != null) {
        _draw(canvas, line.text, _stroke(m.innerStroke!, m.innerStrokeWidth), curve, line.offset);
      }
      if (m.gradient == null) {
        _draw(canvas, line.text, _fill(m.fill), curve, line.offset);
      } else {
        // The gradient spans the line's box (SVG objectBoundingBox), whatever the glyphs' rotation.
        canvas.saveLayer(null, Paint());
        final area = _draw(canvas, line.text, _fill(const Color(0xFFFFFFFF)), curve, line.offset);
        canvas.drawRect(area, Paint()
          ..blendMode = BlendMode.srcIn
          ..shader = m.gradient!.createShader(area));
        canvas.restore();
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(ArtisticTextPainter old) => old.m != m;
}

/// The slot's widget.
Widget artisticTextSlot(ArtisticTextModel model) => CustomPaint(painter: ArtisticTextPainter(model), size: Size.infinite);
