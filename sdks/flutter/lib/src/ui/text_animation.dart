// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// `style.textAnimationType` on a text slot: typewriter, wave-chars, the six
// entrances and the two glitches, as the web player paints them. Each one
// animates the plain text (marks stripped), as the web does.

import 'dart:math' as math;
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'color_util.dart';
import 'dynamic_colors.dart';
import 'text_effects.dart';

bool isTextAnimation(Object? type) =>
    type == 'typewriter' || type == 'wave-chars' || entranceEffects.contains(type) || type == 'glitch-cyberpunk' || type == 'glitch-slice';

class OimTextAnimation extends StatefulWidget {
  final String text;
  final TextStyle style;
  final TextAlign? textAlign;
  final String type;
  final double? speed, delay, intensity;
  final bool cursor;

  /// Logical px per design px (the wave's 5 px amplitude and the glitch offsets are design px).
  final double unit;

  const OimTextAnimation({
    super.key,
    required this.text,
    required this.style,
    required this.type,
    this.textAlign,
    this.speed,
    this.delay,
    this.intensity,
    this.cursor = true,
    this.unit = 1,
  });

  @override
  State<OimTextAnimation> createState() => _OimTextAnimationState();
}

class _OimTextAnimationState extends State<OimTextAnimation> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  double _t = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((d) => setState(() => _t = d.inMicroseconds / 1e6))..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  Widget _spans(List<InlineSpan> children) => Text.rich(TextSpan(style: widget.style, children: children), textAlign: widget.textAlign);

  @override
  Widget build(BuildContext context) {
    final w = widget, fontSize = w.style.fontSize ?? 16;
    if (w.type == 'typewriter') {
      final s = typewriterAt(w.text, _t, w.speed ?? 20, w.delay ?? 0, w.cursor);
      return _spans([
        TextSpan(text: s.visible),
        // The cursor keeps its place when hidden, so the line does not jump.
        if (w.cursor) TextSpan(text: '|', style: TextStyle(color: s.cursor ? null : const Color(0x00000000))),
      ]);
    }
    if (w.type == 'wave-chars') {
      final chars = w.text.runes.map(String.fromCharCode).toList();
      return _spans([
        for (var i = 0; i < chars.length; i++)
          chars[i].trim().isEmpty
              ? TextSpan(text: chars[i])
              : WidgetSpan(
                  child: Transform.translate(
                    offset: Offset(0, waveOffset(i, _t, w.speed ?? 0.05, w.delay ?? 0) * w.unit),
                    child: Text(chars[i], style: w.style),
                  ),
                ),
      ]);
    }
    if (entranceEffects.contains(w.type)) {
      final units = entranceUnits(w.text, w.type);
      return _spans([
        for (var i = 0; i < units.length; i++)
          units[i].trim().isEmpty ? TextSpan(text: units[i]) : WidgetSpan(child: _entranceUnit(units[i], i, fontSize)),
      ]);
    }
    return _glitch();
  }

  Widget _entranceUnit(String unit, int i, double fontSize) {
    final f = entranceFrameAt(widget.type, _t, i, widget.speed ?? 0.05, widget.delay ?? 0);
    Widget child = Transform(
      alignment: Alignment.center,
      transform: Matrix4.translationValues(0, f.translateYEm * fontSize, 0)
        ..rotateZ(f.rotateDeg * math.pi / 180)
        ..scaleByDouble(f.scale, f.scale, 1, 1),
      child: Opacity(opacity: f.opacity, child: Text(unit, style: widget.style)),
    );
    if (widget.type == 'reveal-mask') child = ClipRect(child: child);
    return child;
  }

  Widget _glitch() {
    final w = widget;
    final g = glitchLayersAt(w.type, _t, w.speed ?? 1, w.delay ?? 0, w.intensity ?? 50);
    final base = Text(w.text, style: w.style, textAlign: w.textAlign);
    final copies = <Widget>[
      for (final c in g.copies)
        if (c.opacity > 0)
          Positioned.fill(
            child: Transform.translate(
              offset: Offset(c.dx, c.dy) * w.unit,
              child: Opacity(
                opacity: c.opacity,
                child: c.clipTop == null
                    ? Text(w.text, style: w.style.copyWith(color: parseCssColor(c.color!)), textAlign: w.textAlign)
                    : ClipRect(clipper: _Band(c.clipTop! / 100, c.clipBottom! / 100), child: base),
              ),
            ),
          ),
    ];
    final stack = Stack(children: [base, ...copies]);
    if (g.skewX == 0) return stack;
    return Transform(alignment: Alignment.center, transform: Matrix4.skewX(math.tan(g.skewX * math.pi / 180)), child: stack);
  }
}

class _Band extends CustomClipper<Rect> {
  final double top, bottom;
  const _Band(this.top, this.bottom);
  @override
  Rect getClip(Size s) => Rect.fromLTRB(0, s.height * top, s.width, s.height * bottom);
  @override
  bool shouldReclip(_Band old) => old.top != top || old.bottom != bottom;
}

/// A text with `{name}…{/name}` marks painted with `style.marks`, as
/// `markStyle` of @oim-media/core. [transform] is the CSS text-transform.
/// shortcut: every highlight style paints as a plain background (no padding,
/// radius or thick underline); upgrade if a design depends on the pill shape.
/// CSS `text-align` as the web applies it; anything else is the CSS default, left.
TextAlign textAlignOf(Object? v) => switch (v) {
      'center' => TextAlign.center,
      'right' || 'end' => TextAlign.right,
      'justify' => TextAlign.justify,
      _ => TextAlign.left,
    };

Widget markedText(String text, Map<String, dynamic> marks, TextStyle style, OimPalette? palette, String Function(String) transform,
    {TextAlign textAlign = TextAlign.left}) {
  TextStyle? markStyle(Object? raw) {
    if (raw is! Map) return null;
    final m = raw.cast<String, dynamic>();
    final h = m['highlight'] is Map ? (m['highlight'] as Map).cast<String, dynamic>() : null;
    return TextStyle(
      color: resolveColor(m['colorRole'], m['color'], palette),
      fontWeight: m['bold'] == true ? FontWeight.w700 : null,
      fontStyle: m['italic'] == true ? FontStyle.italic : null,
      decoration: m['underline'] == true ? TextDecoration.underline : null,
      backgroundColor: h == null ? null : resolveColor(h['colorRole'], h['color'], palette) ?? const Color(0x59F59E0B),
    );
  }

  // Full slot width, so the alignment has room to act (a Text otherwise shrinks to its content).
  if (marks.isEmpty) return SizedBox(width: double.infinity, child: Text(transform(text), style: style, textAlign: textAlign));
  return SizedBox(
    width: double.infinity,
    child: Text.rich(
      TextSpan(style: style, children: [
        for (final r in parseMarks(text, marks.keys)) TextSpan(text: transform(r.text), style: r.mark == null ? null : markStyle(marks[r.mark])),
      ]),
      textAlign: textAlign,
    ),
  );
}
