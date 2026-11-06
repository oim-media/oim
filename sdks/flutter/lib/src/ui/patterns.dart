// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Pattern fills (`fillPattern*`, `backgroundPattern*`), ported from
// `generatePatternSVG` and `resolvePatternColors` in @oim-media/core
// (patterns.ts): the same 160-unit tile, the same seeded layout, painted on a
// Canvas instead of serialised to SVG. Tiled and moved like the web's
// `background-animation-*`.

import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'color_util.dart';
import 'dynamic_colors.dart';
import 'svg_path.dart';

const double kPatternTile = 160;

/// The web's `PATTERN_PRESET_SVGS`, drawn in a 24-unit box.
const Map<String, String> patternPresets = {
  'clouds': '<path d="M17.5 19A5.5 5.5 0 0 0 18 8.02a7.5 7.5 0 0 0-14.93 2.1A5.5 5.5 0 0 0 4.5 21h13a1 1 0 0 0 0-2z" />',
  'stars': '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />',
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
  'bubbles': '<circle cx="12" cy="12" r="8" fill="none" stroke-width="2" /><circle cx="15" cy="9" r="2" />',
  'bolt': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />',
  'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 8a7 7 0 0 1-9 10z" />',
  'drop': '<path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z" />',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />',
  'crown': '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />',
  'grid': '<path d="M24 0 H0 V24" fill="none" stroke-width="1" />',
  'waves': '<path d="M0 12 Q6 6 12 12 T24 12" fill="none" stroke-width="2" stroke-linecap="round" />',
  'stripes': '<path d="M0 0 L24 24 M-12 12 L12 36 M12 -12 L36 12" fill="none" stroke-width="3" />',
  'dots': '<circle cx="12" cy="12" r="6" />',
  'zigzags': '<path d="M0 12 L6 18 L18 6 L24 12" fill="none" stroke-width="2" stroke-linejoin="round" />',
};

const _strokeOnly = {'waves', 'grid', 'stripes', 'zigzags'};

/// The web's `seededRandom`: `sin(seed) * 10000`, fractional part.
double seededRandom(double seed) {
  final x = math.sin(seed) * 10000;
  return x - x.floorToDouble();
}

/// One placed figure in the 160-unit tile.
class PatternFigure {
  final String item;
  final double x, y, scale, rotation;
  final String color;
  const PatternFigure(this.item, this.x, this.y, this.scale, this.rotation, this.color);
}

const _offsets = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1],
];

/// Where every figure of the tile goes, wrapped copies included: the layout of
/// `generatePatternSVG`, both the shared grid and the per-figure grids.
List<PatternFigure> patternLayout({
  required String type,
  required String fgColor,
  double scale = 1,
  List<String>? colors,
  List<String>? svgs,
  List<num>? sizes,
  List<num>? counts,
  List<num>? dispersions,
  num? count,
  num? dispersion,
}) {
  const base = kPatternTile;
  final colorsList = (colors != null && colors.isNotEmpty) ? colors : [fgColor.isEmpty ? '#D1D1C7' : fgColor];
  final active = (svgs != null && svgs.isNotEmpty) ? svgs : [type.isEmpty ? 'clouds' : type];
  final globalCount = (count != null && count > 0) ? count.toDouble() : 15.0;
  final globalDisp = dispersion?.toDouble() ?? 0.5;
  final out = <PatternFigure>[];

  void place(String item, double posX, double posY, double s, double rot, String color) {
    for (final o in _offsets) {
      final x = posX + o[0] * base, y = posY + o[1] * base;
      if (x > -30 && x < base + 30 && y > -30 && y < base + 30) out.add(PatternFigure(item, x, y, s, rot, color));
    }
  }

  double clampPos(double v) => math.max(5, math.min(base - 5, v));

  if ((counts?.isNotEmpty ?? false) || (dispersions?.isNotEmpty ?? false)) {
    for (var f = 0; f < active.length; f++) {
      final color = f < colorsList.length ? colorsList[f] : colorsList.first;
      final size = (sizes != null && f < sizes.length) ? sizes[f].toDouble() : 1.0;
      final n = (counts != null && f < counts.length) ? counts[f].toInt() : math.max(1, (globalCount / active.length).round());
      final disp = (dispersions != null && f < dispersions.length) ? dispersions[f].toDouble() : globalDisp;
      final cols = math.sqrt(n).ceil();
      final rows = (n / cols).ceil();
      final grid = base / math.max(1, cols);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          final idx = r * cols + c;
          if (idx >= n) break;
          final seed = (f * 100 + idx) * 23.456 + 1.23;
          place(
            active[f],
            clampPos(c * grid + grid / 2 + (seededRandom(seed) - 0.5) * grid * disp * 1.5),
            clampPos(r * grid + grid / 2 + (seededRandom(seed + 7.4) - 0.5) * grid * disp * 1.5),
            (0.8 + (seededRandom(seed + 13.9) - 0.5) * 0.7 * disp) * size * scale,
            seededRandom(seed + 19.3) * 360 * disp,
            color,
          );
        }
      }
    }
    return out;
  }

  final n = globalCount.toInt();
  final cols = math.sqrt(n).ceil();
  final rows = (n / cols).ceil();
  final grid = base / cols;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      final idx = r * cols + c;
      if (idx >= n) break;
      final seed = idx * 23.456 + 1.23;
      final si = idx % active.length;
      final size = (sizes != null && si < sizes.length) ? sizes[si].toDouble() : 1.0;
      place(
        active[si],
        clampPos(c * grid + grid / 2 + (seededRandom(seed) - 0.5) * grid * globalDisp * 1.5),
        clampPos(r * grid + grid / 2 + (seededRandom(seed + 7.4) - 0.5) * grid * globalDisp * 1.5),
        (0.8 + (seededRandom(seed + 13.9) - 0.5) * 0.7 * globalDisp) * size * scale,
        seededRandom(seed + 19.3) * 360 * globalDisp,
        colorsList[idx % colorsList.length],
      );
    }
  }
  return out;
}

final _elem = RegExp(r'<(path|circle)\b([^>]*)/?>', caseSensitive: false);
final _attr = RegExp(r'([\w-]+)\s*=\s*"([^"]*)"');

/// Paints one figure's markup (a preset, `<path>`/`<circle>` markup, a bare
/// path `d`, or text such as an emoji) in its 24-unit box.
void _paintFigure(Canvas canvas, String item, Color color) {
  final markup = patternPresets[item] ??
      (item.contains('<') ? item : (item.startsWith('M') || item.startsWith('m') ? '<path d="$item" />' : null));
  final stroke = _strokeOnly.contains(item);
  if (markup == null) {
    // shortcut: text figures use the platform font, the web uses system-ui.
    final size = item.length > 2 ? (item.length > 4 ? 8.0 : 11.0) : 16.0;
    final tp = TextPainter(
      text: TextSpan(text: item, style: TextStyle(fontSize: size, color: color)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(12 - tp.width / 2, 12 - tp.height / 2));
    return;
  }
  // shortcut: only <path> and <circle> of custom SVG figures are drawn; other elements are skipped.
  for (final m in _elem.allMatches(markup)) {
    final a = {for (final x in _attr.allMatches(m.group(2)!)) x.group(1)!: x.group(2)!};
    final Path path;
    if (m.group(1)!.toLowerCase() == 'circle') {
      final cx = double.tryParse(a['cx'] ?? '') ?? 0, cy = double.tryParse(a['cy'] ?? '') ?? 0;
      final r = double.tryParse(a['r'] ?? '') ?? 0;
      path = Path()..addOval(Rect.fromCircle(center: Offset(cx, cy), radius: r));
    } else {
      final d = a['d'];
      if (d == null) continue;
      path = parseSvgPath(d);
    }
    final noFill = stroke || a['fill'] == 'none';
    final sw = double.tryParse(a['stroke-width'] ?? '') ?? (stroke ? 1.5 : 0);
    if (!noFill) canvas.drawPath(path, Paint()..color = color);
    if (noFill || (a['stroke-width'] != null && sw > 0)) {
      if (sw > 0) {
        canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = sw
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..color = color,
        );
      }
    }
  }
}

/// The 160-unit tile as an image of [pixels] square.
ui.Image paintPatternTile(List<PatternFigure> figures, Color background, int pixels) {
  final rec = ui.PictureRecorder();
  final canvas = Canvas(rec);
  final k = pixels / kPatternTile;
  canvas.scale(k);
  canvas.clipRect(const Rect.fromLTWH(0, 0, kPatternTile, kPatternTile));
  if (background.a > 0) canvas.drawColor(background, BlendMode.src);
  for (final f in figures) {
    canvas.save();
    canvas.translate(f.x, f.y);
    canvas.scale(f.scale);
    canvas.rotate(f.rotation * math.pi / 180);
    canvas.translate(-12, -12);
    _paintFigure(canvas, f.item, parseCssColor(f.color) ?? const Color(0xFF000000));
    canvas.restore();
  }
  return rec.endRecording().toImageSync(pixels, pixels);
}

Object? _field(Map style, String name) => style['backgroundPattern$name'] ?? style['fillPattern$name'];

/// Whether [style] asks for a pattern: a background pattern, a pattern layer or a pattern fill.
bool hasPattern(Map style) => _field(style, 'Type') != null || _field(style, 'Svgs') != null;

/// The tile of [style], its colours resolved against [palette] (web `resolvePatternColors`).
ui.Image buildPatternTile(Map style, OimPalette? palette, int pixels) {
  final fg = resolveColor(_field(style, 'ColorRole'), _field(style, 'Color'), palette) ?? const Color(0xFF000000);
  final bg = resolveColor(_field(style, 'BgColorRole'), _field(style, 'BgColor'), palette) ?? const Color(0x00000000);
  final rawColors = (_field(style, 'Colors') as List?)?.map((e) => e.toString()).toList();
  // Only the first colour has a role (web `patternTileUri`).
  final colors = rawColors == null || rawColors.isEmpty ? null : [_hex(fg), ...rawColors.skip(1)];
  List<num>? nums(String n) => (_field(style, n) as List?)?.whereType<num>().toList();
  final figures = patternLayout(
    type: _field(style, 'Type')?.toString() ?? 'clouds',
    fgColor: _hex(fg),
    scale: double.tryParse('${_field(style, 'Scale')}') ?? 1,
    colors: colors,
    svgs: (_field(style, 'Svgs') as List?)?.map((e) => e.toString()).toList(),
    sizes: nums('Sizes'),
    counts: nums('Counts'),
    dispersions: nums('Dispersions'),
    count: style['backgroundPatternCount'] as num?,
    dispersion: style['backgroundPatternDispersion'] as num?,
  );
  return paintPatternTile(figures, bg, pixels);
}

String _hex(Color c) => '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}${c.a < 1 ? (c.a * 255).round().toRadixString(16).padLeft(2, '0') : ''}';

/// A tiled pattern filling its box, moving as the web's `background-animation-*`.
class OimPatternFill extends StatefulWidget {
  final Map style;
  final OimPalette? palette;
  /// Design px to logical px (container width / natural width).
  final double unit;
  final bool disableAnimations;
  /// The layer is the canvas background (`backgroundPattern*`) rather than a fill.
  final bool background;
  const OimPatternFill({
    super.key,
    required this.style,
    required this.palette,
    required this.unit,
    required this.disableAnimations,
    this.background = false,
  });

  @override
  State<OimPatternFill> createState() => _OimPatternFillState();
}

class _OimPatternFillState extends State<OimPatternFill> with SingleTickerProviderStateMixin {
  ui.Image? _tile;
  AnimationController? _c;
  String _direction = 'none';

  double get _scale => double.tryParse('${_field(widget.style, 'Scale')}') ?? 1;
  double get _tileSize => kPatternTile * _scale * widget.unit;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void didUpdateWidget(OimPatternFill old) {
    super.didUpdateWidget(old);
    if (old.style != widget.style || old.palette != widget.palette || old.unit != widget.unit ||
        old.disableAnimations != widget.disableAnimations) {
      _tile?.dispose();
      _c?.dispose();
      _c = null;
      _setup();
    }
  }

  void _setup() {
    final px = (_tileSize * ui.PlatformDispatcher.instance.implicitView!.devicePixelRatio).round().clamp(16, 1024);
    _tile = buildPatternTile(widget.style, widget.palette, px);
    final s = widget.style;
    num? speed;
    if (widget.background) {
      if (s['backgroundPatternSpeed'] != null || s['backgroundPatternDirection'] != null) {
        speed = (s['backgroundPatternSpeed'] as num?) ?? 8;
        _direction = s['backgroundPatternDirection']?.toString() ?? 'right';
      }
    } else {
      speed = s['fillPatternSpeed'] as num?;
      _direction = s['fillPatternDirection']?.toString() ?? 'right';
    }
    if (widget.disableAnimations || speed == null || speed <= 0 || _direction == 'none') return;
    _c = AnimationController(vsync: this, duration: Duration(microseconds: (speed * 1e6).round()))..repeat();
  }

  @override
  void dispose() {
    _c?.dispose();
    _tile?.dispose();
    super.dispose();
  }

  Widget _paint(double t) {
    final tile = _tile!;
    var size = _tileSize;
    var dx = 0.0, dy = 0.0, opacity = 1.0;
    final wave = 0.5 - 0.5 * math.cos(2 * math.pi * t); // 0 → 1 → 0, as the 0%/50%/100% keyframes
    switch (_direction) {
      case 'right':
        dx = size * t;
      case 'left':
        dx = -size * t;
      case 'up':
        dy = -size * t;
      case 'down':
        dy = size * t;
      case 'zoom-in':
        size *= 1 + 0.15 * wave;
      case 'zoom-out':
        size *= 1.15 - 0.15 * wave;
      case 'pulse':
        opacity = 1 - 0.35 * wave;
    }
    final k = size / tile.width;
    final m = Matrix4.identity()
      ..translateByDouble(dx, dy, 0, 1)
      ..scaleByDouble(k, k, 1, 1);
    return Opacity(
      opacity: opacity,
      child: CustomPaint(
        painter: _ShaderPainter(ImageShader(tile, TileMode.repeated, TileMode.repeated, m.storage)),
        size: Size.infinite,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    if (c == null) return _paint(0);
    return AnimatedBuilder(animation: c, builder: (_, _x) => _paint(c.value));
  }
}

class _ShaderPainter extends CustomPainter {
  final Shader shader;
  _ShaderPainter(this.shader);

  @override
  void paint(Canvas canvas, Size size) => canvas.drawRect(Offset.zero & size, Paint()..shader = shader);

  @override
  bool shouldRepaint(_ShaderPainter old) => old.shader != shader;
}
