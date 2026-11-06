// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Port of `sampleKeyframes` in @oim-media/core (keyframes.ts): what a keyframed
// layer looks like at a given time, with the meaning WAAPI gives it on the web.
// Both pass packages/spec/keyframe-cases.json.

import 'dart:math' as math;

class KeyframeState {
  final double x, y, r, s, b;

  /// Unclamped (the format allows up to 2); the painter clamps to 1.
  final double o;
  const KeyframeState({this.x = 0, this.y = 0, this.r = 0, this.s = 1, this.o = 1, this.b = 0});

  Map<String, double> toMap() => {'x': x, 'y': y, 'r': r, 's': s, 'o': o, 'b': b};
}

const _named = {
  'ease-in': [0.42, 0.0, 1.0, 1.0],
  'ease-out': [0.0, 0.0, 0.58, 1.0],
  'ease-in-out': [0.42, 0.0, 0.58, 1.0],
};

double _cubicBezier(double x1, double y1, double x2, double y2, double x) {
  double bx(double t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  var lo = 0.0, hi = 1.0;
  for (var i = 0; i < 60; i++) {
    final t = (lo + hi) / 2;
    if (bx(t) < x) {
      lo = t;
    } else {
      hi = t;
    }
  }
  final t = (lo + hi) / 2;
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

/// Eased progress for 0..1, with the CSS meaning of each easing.
double easeProgress(Object? e, double p) {
  if (e == null || e == 'linear') return p;
  if (e == 'steps(1, end)') return p >= 1 ? 1 : 0;
  final b = e is List ? e.map((v) => (v as num).toDouble()).toList() : _named[e];
  return b == null || b.length != 4 ? p : _cubicBezier(b[0], b[1], b[2], b[3], p);
}

class _Frame {
  final double offset;
  final List<double> value;
  final Object? e;
  const _Frame(this.offset, this.value, [this.e]);
}

List<double> _sample(List<_Frame> frames, List<double> base, double p) {
  if (frames.isEmpty) return base;
  final list = [...frames];
  // WAAPI fills a missing 0% or 100% frame with the layer's own value.
  if (list.first.offset > 0) list.insert(0, _Frame(0, base));
  if (list.last.offset < 1) list.add(_Frame(1, base));
  for (var i = 0; i < list.length - 1; i++) {
    final a = list[i], b = list[i + 1];
    if (p <= b.offset) {
      final span = b.offset - a.offset;
      final local = span > 0 ? (p - a.offset) / span : 1.0;
      final k = easeProgress(a.e, local.clamp(0.0, 1.0));
      return [for (var j = 0; j < a.value.length; j++) a.value[j] + (b.value[j] - a.value[j]) * k];
    }
  }
  return list.last.value;
}

double? _num(Object? v) => v is num ? v.toDouble() : null;

/// The layer's state at [time] seconds of an animation lasting [duration].
KeyframeState sampleKeyframes(List<Map<String, dynamic>> keyframes, double duration, double time) {
  final p = duration > 0 ? (time / duration).clamp(0.0, 1.0) : 1.0;
  double offset(Map<String, dynamic> kf) => duration > 0 ? ((_num(kf['t']) ?? 0) / duration).clamp(0.0, 1.0) : 0.0;
  // Each frame always carries a transform (missing parts are identity); opacity
  // and blur only exist in the frames that declare them.
  final transform = [
    for (final kf in keyframes)
      _Frame(offset(kf), [_num(kf['x']) ?? 0, _num(kf['y']) ?? 0, _num(kf['r']) ?? 0, _num(kf['s']) ?? 1], kf['e']),
  ];
  final opacity = [for (final kf in keyframes) if (_num(kf['o']) != null) _Frame(offset(kf), [_num(kf['o'])!], kf['e'])];
  final blur = [for (final kf in keyframes) if (_num(kf['b']) != null) _Frame(offset(kf), [_num(kf['b'])!], kf['e'])];
  final t = _sample(transform, const [0, 0, 0, 1], p);
  return KeyframeState(
    x: t[0],
    y: t[1],
    r: t[2],
    s: t[3],
    o: _sample(opacity, const [1], p)[0],
    b: math.max(0, _sample(blur, const [0], p)[0]),
  );
}
