// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Text marks and text animations, ported from @oim-media/core (`text-marks.ts`,
// `text-effects.ts`, `glitch.ts`) and the web player (`typewriterText.ts`,
// `waveText.ts`). The pure functions are checked against the cases the web
// produces (packages/spec/marks-cases.json, text-effect-cases.json).

import 'dart:math' as math;

// ---- Marks ------------------------------------------------------------------

class MarkRun {
  final String text;
  final String? mark;
  const MarkRun(this.text, [this.mark]);
}

final _tag = RegExp(r'^\{(/?)([a-z][a-z0-9-]{0,23})\}');

/// The runs of a text without tags or escapes. Lenient: malformed parts stay text.
List<MarkRun> parseMarks(String text, Iterable<String> known) {
  final names = known.toSet();
  final runs = <List<Object?>>[]; // [text, mark]
  String? open;
  void push(String s) {
    if (s.isEmpty) return;
    if (runs.isNotEmpty && runs.last[1] == open) {
      runs.last[0] = (runs.last[0] as String) + s;
    } else {
      runs.add([s, open]);
    }
  }

  var i = 0;
  while (i < text.length) {
    final c = text[i];
    if (c == '{' || c == '}') {
      if (i + 1 < text.length && text[i + 1] == c) {
        push(c);
        i += 2;
        continue;
      }
      final m = c == '{' ? _tag.firstMatch(text.substring(i)) : null;
      if (m == null) {
        push(c);
        i++;
        continue;
      }
      final raw = m.group(0)!, name = m.group(2)!, close = m.group(1)!.isNotEmpty;
      i += raw.length;
      if (!names.contains(name)) {
        push(raw);
      } else if (!close) {
        if (open != null) {
          push(raw);
        } else {
          open = name;
        }
      } else if (open == name) {
        open = null;
      } else {
        push(raw);
      }
      continue;
    }
    var j = i;
    while (j < text.length && text[j] != '{' && text[j] != '}') {
      j++;
    }
    push(text.substring(i, j));
    i = j;
  }
  return [for (final r in runs) MarkRun(r[0] as String, r[1] as String?)];
}

String plainText(String text, Iterable<String> known) => parseMarks(text, known).map((r) => r.text).join();

// ---- Entrances --------------------------------------------------------------

const entranceEffects = ['fade-chars', 'slide-up', 'bounce-chars', 'reveal-mask', 'scale-in', 'rise-words'];
const entranceSeconds = 0.35;
const _wordEffects = {'slide-up', 'reveal-mask', 'rise-words'};

class EntranceFrame {
  final double opacity, translateYEm, scale, rotateDeg;
  const EntranceFrame(this.opacity, this.translateYEm, this.scale, this.rotateDeg);
}

/// Words (with their spaces as units of their own) or characters (code points).
List<String> entranceUnits(String text, String effect) {
  if (_wordEffects.contains(effect)) return RegExp(r'\S+|\s+').allMatches(text).map((m) => m.group(0)!).toList();
  return text.runes.map(String.fromCharCode).toList();
}

EntranceFrame entranceFrame(String effect, double progress) {
  final p = progress.clamp(0.0, 1.0);
  final e = p * (2 - p);
  switch (effect) {
    case 'slide-up':
      return EntranceFrame(e, (1 - e) * 0.6, 1, 0);
    case 'reveal-mask':
      return EntranceFrame(1, (1 - e) * 1.2, 1, 0);
    case 'scale-in':
      return EntranceFrame(e, 0, 0.6 + 0.4 * e, 0);
    case 'rise-words':
      return EntranceFrame(e, (1 - e) * 0.8, 1, (1 - e) * 8);
    case 'bounce-chars':
      final s = e == 0 ? 0.0 : (e < 0.7 ? e / 0.7 * 1.15 : 1.15 - (e - 0.7) / 0.3 * 0.15);
      return EntranceFrame(e, 0, (s * 1e6).round() / 1e6, 0);
  }
  return EntranceFrame(e, 0, 1, 0);
}

EntranceFrame entranceFrameAt(String effect, double t, int index, [double stagger = 0.05, double delay = 0]) =>
    entranceFrame(effect, (t - (delay + index * stagger)) / entranceSeconds);

// ---- Glitch -----------------------------------------------------------------

class GlitchCopy {
  final String? color;
  final double dx, dy, opacity;
  final double? clipTop, clipBottom; // percent of the height
  const GlitchCopy({this.color, required this.dx, required this.dy, required this.opacity, this.clipTop, this.clipBottom});
}

class GlitchLayers {
  final double skewX;
  final List<GlitchCopy> copies;
  const GlitchLayers(this.skewX, this.copies);
}

double _hash(double seed) {
  final x = math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - x.floorToDouble();
}

double _r(double n) => (n * 100).round() / 100;

/// `glitchLayers(type, calculateGlitchState(t, speed, delay, intensity))` of the web.
GlitchLayers glitchLayersAt(String type, double t, [double speed = 1, double delay = 0, double intensity = 50]) {
  var active = false;
  var cyan = const [0.0, 0.0], magenta = const [0.0, 0.0];
  var skew = 0.0, top = 0.0, bottom = 0.0, shift = 0.0, hasBand = false;
  if (t > 0 && t >= delay) {
    final sp = math.max(0.01, speed);
    final e = t - delay;
    final tau = (e * sp) % 1;
    if (tau >= 0.7) {
      active = true;
      hasBand = true;
      final seed = ((e * sp).floor() * 100 + ((tau - 0.7) / 0.3 * 6).floor() * 10).toDouble();
      final maxPx = 0.08 * intensity.clamp(1, 100);
      List<double> off(double s) => [_r((_hash(s) * 2 - 1) * maxPx), _r((_hash(s + 1) * 2 - 1) * maxPx * .4)];
      cyan = off(seed + 1);
      magenta = off(seed + 3);
      final h = _hash(seed + 5);
      skew = h > 0.6 ? _r((h * 2 - 1) * 0.03 * intensity) : 0;
      final sd = seed + 10;
      top = _r(_hash(sd) * 80);
      bottom = math.min(100, _r(top + 5 + _hash(sd + 1) * 20));
      shift = _r((_hash(sd + 2) * 2 - 1) * 1.5 * maxPx);
    }
  }
  if (type == 'glitch-slice') {
    return GlitchLayers(0, [
      GlitchCopy(dx: hasBand ? shift : 0, dy: 0, opacity: hasBand ? 1 : 0, clipTop: top, clipBottom: bottom),
    ]);
  }
  return GlitchLayers(skew, [
    GlitchCopy(color: '#00ffff', dx: cyan[0], dy: cyan[1], opacity: active ? 0.85 : 0),
    GlitchCopy(color: '#ff00ff', dx: magenta[0], dy: magenta[1], opacity: active ? 0.85 : 0),
  ]);
}

// ---- Typewriter and wave ----------------------------------------------------

/// Visible characters and cursor of the typewriter at [t] seconds.
({String visible, bool cursor}) typewriterAt(String text, double t, [double speed = 20, double delay = 0, bool cursor = true]) {
  final e = t - delay;
  final count = e > 0 ? math.min(text.length, (e * math.max(.1, speed)).floor()) : 0;
  return (visible: text.substring(0, count), cursor: cursor && ((t % .8) + .8) % .8 < .4);
}

const wavePeriod = 2 * math.pi / 6;

/// The CSS animation-delay of character [index] (always ≤ [delay]).
double waveStart(int index, [double speed = 0.05, double delay = 0]) {
  final lag = ((index * speed) % wavePeriod + wavePeriod) % wavePeriod;
  return delay - ((wavePeriod - lag) % wavePeriod);
}

/// Vertical offset in px of character [index] at [t]. shortcut: the web
/// interpolates 9 samples linearly; the exact sine differs by under 0.4 px.
double waveOffset(int index, double t, [double speed = 0.05, double delay = 0]) {
  final e = t - waveStart(index, speed, delay);
  if (e < 0) return 0;
  return math.sin(2 * math.pi * ((e / wavePeriod) % 1)) * 5;
}
