// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// The `texture` effect's tiles, as TEXTURE_CATALOG in @oim-media/core: each
// preset is an SVG tile the web draws as a repeated background. The noise
// presets are `feTurbulence` (default seed) through `luminanceToAlpha`, flooded
// with the colour; the others are plain shapes.

import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'grain.dart';

class TexturePreset {
  final String blend;
  final double intensity;
  final double size;
  const TexturePreset(this.blend, this.intensity, this.size);
}

/// Default blend, default intensity (0..100) and square tile size, per preset.
const texturePresets = <String, TexturePreset>{
  'film-grain-35mm': TexturePreset('overlay', 35, 128),
  'fine-noise': TexturePreset('overlay', 25, 128),
  'dust-scratches': TexturePreset('screen', 30, 256),
  'vintage-paper': TexturePreset('multiply', 25, 256),
  'rough-canvas': TexturePreset('overlay', 30, 128),
  'halftone-dots': TexturePreset('overlay', 25, 16),
  'scanlines': TexturePreset('overlay', 20, 8),
  'concentric-rings': TexturePreset('soft-light', 25, 32),
};

double _lum(double r, double g, double b) => 0.2125 * r + 0.7154 * g + 0.0721 * b;

/// feTurbulence fractalNoise channel [ch] (0..3) as a 0..1 value.
double _n(int ch, double x, double y, double fx, double fy, int oct, double? tile) =>
    ((textureNoise(ch, x, y, fx, fy, oct, tile: tile) + 1) / 2).clamp(0.0, 1.0);

/// The noise presets' coverage (0..1) at user-space point (x, y), before the rect's opacity.
double? noiseCoverage(String preset, double x, double y) {
  double grainLum(double fx, double fy, int oct, double? tile) =>
      _lum(_n(0, x, y, fx, fy, oct, tile), _n(1, x, y, fx, fy, oct, tile), _n(2, x, y, fx, fy, oct, tile));
  switch (preset) {
    case 'film-grain-35mm':
      return grainLum(0.75, 0.75, 3, 128);
    case 'fine-noise':
      return grainLum(0.95, 0.95, 2, 128);
    case 'vintage-paper':
      return grainLum(0.02, 0.04, 4, null);
    case 'rough-canvas':
      return grainLum(0.35, 0.35, 3, null);
    case 'dust-scratches':
      // Two noises with their alpha pushed hard (18a-15, 25a-22), dust merged over scratches.
      List<double> layer(double fx, double fy, int oct, double k, double off) {
        final a = (k * _n(3, x, y, fx, fy, oct, null) + off).clamp(0.0, 1.0);
        return [_n(0, x, y, fx, fy, oct, null), _n(1, x, y, fx, fy, oct, null), _n(2, x, y, fx, fy, oct, null), a];
      }
      final s = layer(0.04, 0.9, 3, 18, -15), d = layer(0.8, 0.8, 2, 25, -22);
      final a = d[3] + s[3] * (1 - d[3]);
      if (a <= 0) return 0;
      double ch(int i) => (d[i] * d[3] + s[i] * s[3] * (1 - d[3])) / a;
      return _lum(ch(0), ch(1), ch(2));
  }
  return null;
}

/// Unpremultiplied RGBA of a noise preset tile, [px] pixels square, flooded with [rgb] at [opacity].
Uint8List noiseTilePixels(String preset, int rgb, double opacity, int px, double tileSize) {
  final out = Uint8List(px * px * 4);
  final k = tileSize / px;
  for (var y = 0; y < px; y++) {
    for (var x = 0; x < px; x++) {
      final o = (y * px + x) * 4;
      out[o] = (rgb >> 16) & 0xff;
      out[o + 1] = (rgb >> 8) & 0xff;
      out[o + 2] = rgb & 0xff;
      out[o + 3] = ((noiseCoverage(preset, x * k, y * k) ?? 0) * opacity * 255).round().clamp(0, 255);
    }
  }
  return out;
}

void _paintShapes(ui.Canvas c, String preset, ui.Color color) {
  final p = ui.Paint()..color = color..isAntiAlias = true;
  switch (preset) {
    case 'halftone-dots':
      c.drawCircle(const ui.Offset(8, 8), 2.5, p);
    case 'scanlines':
      c.drawRect(const ui.Rect.fromLTWH(0, 0, 8, 1), p);
    case 'concentric-rings':
      p
        ..style = ui.PaintingStyle.stroke
        ..strokeWidth = 1.5;
      c.drawCircle(const ui.Offset(16, 16), 15, p);
      c.drawCircle(const ui.Offset(16, 16), 8, p);
  }
}

final _cache = <String, Future<ui.Image>>{};

/// The tile of [preset] drawn [px] pixels square, coloured [color] at [opacity] (0..1).
/// Null for an unknown preset.
Future<ui.Image>? textureTile(String preset, ui.Color color, double opacity, int px) {
  final def = texturePresets[preset];
  if (def == null || px <= 0) return null;
  px = math.min(px, 1024);
  final rgb = color.toARGB32() & 0xffffff;
  final op = (opacity * color.a).clamp(0.01, 1.0);
  return _cache.putIfAbsent('$preset|$rgb|$op|$px', () {
    if (noiseCoverage(preset, 0, 0) != null) {
      final done = Completer<ui.Image>();
      ui.decodeImageFromPixels(noiseTilePixels(preset, rgb, op, px, def.size), px, px, ui.PixelFormat.rgba8888, done.complete);
      return done.future;
    }
    final rec = ui.PictureRecorder();
    final c = ui.Canvas(rec)..scale(px / def.size);
    _paintShapes(c, preset, ui.Color(0xff000000 | rgb).withValues(alpha: op));
    return rec.endRecording().toImage(px, px);
  });
}

/// The first enabled `texture` effect with a known preset in [style]`.effects` (also a document's metadata).
Map<String, dynamic>? textureEffectOf(Map<String, dynamic>? style) {
  final effects = style?['effects'];
  if (effects is! List) return null;
  for (final e in effects) {
    if (e is Map<String, dynamic> && e['type'] == 'texture' && e['enabled'] != false && texturePresets.containsKey(e['preset'])) return e;
  }
  return null;
}
