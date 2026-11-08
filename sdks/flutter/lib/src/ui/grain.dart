// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Per-layer grain (`style.grain`), as `buildLayerGrainFilter` in
// @oim-media/core: SVG `feTurbulence` fractal noise (seed 7, 3 octaves,
// stitched), made grey, cut to the layer's alpha, scaled by the intensity and
// blended with the layer. The turbulence is the reference implementation from
// the SVG 1.1 specification, so the noise is the browser's noise.

import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

const _bSize = 0x100, _bm = 0xff, _perlinN = 0x1000;
const _randM = 2147483647, _randA = 16807, _randQ = 127773, _randR = 2836;

class _Turbulence {
  final lattice = Int32List(_bSize + _bSize + 2);
  final gradient = List.generate(4, (_) => Float64List((_bSize + _bSize + 2) * 2));

  _Turbulence(int seed) {
    if (seed <= 0) seed = -(seed % (_randM - 1)) + 1;
    if (seed > _randM - 1) seed = _randM - 1;
    int rand(int s) {
      var r = _randA * (s % _randQ) - _randR * (s ~/ _randQ);
      if (r <= 0) r += _randM;
      return r;
    }

    var i = 0;
    for (var k = 0; k < 4; k++) {
      for (i = 0; i < _bSize; i++) {
        lattice[i] = i;
        for (var j = 0; j < 2; j++) {
          seed = rand(seed);
          gradient[k][i * 2 + j] = ((seed % (_bSize + _bSize)) - _bSize) / _bSize;
        }
        final g = gradient[k];
        final s = math.sqrt(g[i * 2] * g[i * 2] + g[i * 2 + 1] * g[i * 2 + 1]);
        g[i * 2] /= s;
        g[i * 2 + 1] /= s;
      }
    }
    while (--i > 0) {
      final k = lattice[i];
      seed = rand(seed);
      final j = seed % _bSize;
      lattice[i] = lattice[j];
      lattice[j] = k;
    }
    for (i = 0; i < _bSize + 2; i++) {
      lattice[_bSize + i] = lattice[i];
      for (var k = 0; k < 4; k++) {
        gradient[k][(_bSize + i) * 2] = gradient[k][i * 2];
        gradient[k][(_bSize + i) * 2 + 1] = gradient[k][i * 2 + 1];
      }
    }
  }

  static double _s(double t) => t * t * (3 - 2 * t);

  double noise2(int ch, double x, double y, int w, int h, int wrapX, int wrapY) {
    var t = x + _perlinN;
    var bx0 = t.toInt() & _bm, bx1 = (bx0 + 1) & _bm;
    final rx0 = t - t.toInt(), rx1 = rx0 - 1;
    t = y + _perlinN;
    var by0 = t.toInt() & _bm, by1 = (by0 + 1) & _bm;
    final ry0 = t - t.toInt(), ry1 = ry0 - 1;
    // Stitching, as the reference does: compares the masked lattice indices.
    if (bx0 >= wrapX) bx0 -= w;
    if (bx1 >= wrapX) bx1 -= w;
    if (by0 >= wrapY) by0 -= h;
    if (by1 >= wrapY) by1 -= h;
    bx0 &= _bm;
    bx1 &= _bm;
    by0 &= _bm;
    by1 &= _bm;
    final i = lattice[bx0], j = lattice[bx1];
    final b00 = lattice[i + by0], b10 = lattice[j + by0], b01 = lattice[i + by1], b11 = lattice[j + by1];
    final sx = _s(rx0), sy = _s(ry0);
    final g = gradient[ch];
    var u = rx0 * g[b00 * 2] + ry0 * g[b00 * 2 + 1];
    var v = rx1 * g[b10 * 2] + ry0 * g[b10 * 2 + 1];
    final a = u + sx * (v - u);
    u = rx0 * g[b01 * 2] + ry1 * g[b01 * 2 + 1];
    v = rx1 * g[b11 * 2] + ry1 * g[b11 * 2 + 1];
    final b = u + sx * (v - u);
    return a + sy * (b - a);
  }

  /// fractalNoise with stitching over a [tile] square starting at 0.
  double fractal(int ch, double px, double py, double freq, int octaves, double tile) {
    final lo = (tile * freq).floorToDouble() / tile, hi = (tile * freq).ceilToDouble() / tile;
    final f = lo > 0 && freq / lo < hi / freq ? lo : hi;
    var w = (tile * f + 0.5).toInt(), h = w;
    var wrapX = (_perlinN + w).toInt(), wrapY = wrapX;
    var x = px * f, y = py * f, ratio = 1.0, sum = 0.0;
    for (var o = 0; o < octaves; o++) {
      sum += noise2(ch, x, y, w, h, wrapX, wrapY) / ratio;
      x *= 2;
      y *= 2;
      ratio *= 2;
      w *= 2;
      h *= 2;
      wrapX = 2 * wrapX - _perlinN;
      wrapY = 2 * wrapY - _perlinN;
    }
    return sum;
  }

  /// fractalNoise with separate base frequencies, as `feTurbulence baseFrequency="fx fy"`.
  /// Stitched over a [tileW] x [tileH] tile from 0 when both are given; free otherwise.
  double fractalXY(int ch, double px, double py, double fx, double fy, int octaves, {double tileX = 0, double tileY = 0, double? tileW, double? tileH}) {
    double adjust(double f, double t) {
      final lo = (t * f).floorToDouble() / t, hi = (t * f).ceilToDouble() / t;
      return lo > 0 && f / lo < hi / f ? lo : hi;
    }

    final stitch = tileW != null && tileH != null;
    var w = 0, h = 0, wrapX = 0x7fffffff, wrapY = 0x7fffffff;
    if (stitch) {
      fx = adjust(fx, tileW);
      fy = adjust(fy, tileH);
      w = (tileW * fx + 0.5).toInt();
      h = (tileH * fy + 0.5).toInt();
      wrapX = (tileX * fx + _perlinN + w).toInt();
      wrapY = (tileY * fy + _perlinN + h).toInt();
    }
    var x = px * fx, y = py * fy, ratio = 1.0, sum = 0.0;
    for (var o = 0; o < octaves; o++) {
      sum += noise2(ch, x, y, w, h, wrapX, wrapY) / ratio;
      x *= 2;
      y *= 2;
      ratio *= 2;
      if (stitch) {
        w *= 2;
        h *= 2;
        wrapX = 2 * wrapX - _perlinN;
        wrapY = 2 * wrapY - _perlinN;
      }
    }
    return sum;
  }
}

final _seed0 = _Turbulence(0);

/// [_Turbulence.fractalXY] with the SVG default seed (0), which the texture tiles use.
/// A stitched [tile] is the SVG filter region: the default -10% / 120% of the rect.
double textureNoise(int ch, double px, double py, double fx, double fy, int octaves, {double? tile}) => tile == null
    ? _seed0.fractalXY(ch, px, py, fx, fy, octaves)
    : _seed0.fractalXY(ch, px, py, fx, fy, octaves, tileX: -0.1 * tile, tileY: -0.1 * tile, tileW: 1.2 * tile, tileH: 1.2 * tile);

final _turbulence = _Turbulence(7);

/// The web's `grainFrequency`: size 1 (finest) → 2.0, size 100 (coarsest) → 0.2.
double grainFrequency(num? size) {
  final s = size == null || !size.isFinite ? 50.0 : size.clamp(1, 100).toDouble();
  return ((2 - ((s - 1) * 1.8) / 99) * 1000).round() / 1000;
}

/// The intensity (1–100, default 20) as the grain's opacity.
double grainOpacity(num? intensity) =>
    (intensity == null || !intensity.isFinite ? 20 : intensity.clamp(1, 100)).round() / 100;

/// Grey noise with its own alpha, as `feTurbulence` + `saturate 0`, in RGBA
/// bytes: [logical] units square at [ratio] pixels per unit, stitched so it tiles.
Uint8List grainPixels(double frequency, int logical, double ratio) {
  final n = (logical * ratio).round();
  final out = Uint8List(n * n * 4);
  int c(double v) => ((v * 255 + 255) / 2).round().clamp(0, 255);
  for (var y = 0; y < n; y++) {
    for (var x = 0; x < n; x++) {
      final px = x / ratio, py = y / ratio;
      final r = c(_turbulence.fractal(0, px, py, frequency, 3, logical.toDouble()));
      final g = c(_turbulence.fractal(1, px, py, frequency, 3, logical.toDouble()));
      final b = c(_turbulence.fractal(2, px, py, frequency, 3, logical.toDouble()));
      final a = c(_turbulence.fractal(3, px, py, frequency, 3, logical.toDouble()));
      final grey = (0.2126 * r + 0.7152 * g + 0.0722 * b).round().clamp(0, 255);
      final o = (y * n + x) * 4;
      out[o] = grey;
      out[o + 1] = grey;
      out[o + 2] = grey;
      out[o + 3] = a;
    }
  }
  return out;
}

const kGrainTile = 128;
final _cache = <String, Future<ui.Image>>{};

/// The grain tile for [size] at [ratio], decoded once and shared by every layer.
Future<ui.Image> grainTile(num? size, double ratio) {
  final f = grainFrequency(size);
  final r = ratio.clamp(1, 3).roundToDouble();
  return _cache.putIfAbsent('$f@$r', () {
    final n = (kGrainTile * r).round();
    final px = grainPixels(f, kGrainTile, r);
    final done = Completer<ui.Image>();
    ui.decodeImageFromPixels(px, n, n, ui.PixelFormat.rgba8888, done.complete);
    return done.future;
  });
}
