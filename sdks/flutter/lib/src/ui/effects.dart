// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import 'dart:math' as math;
import 'package:flutter/painting.dart';

/// Same table and order as `mediaFilterCss` in `@oim-media/core` (media-filters.ts):
/// preset, blur, brightness, contrast, saturation, hue-rotate. Neutral values
/// produce no CSS, so a slot with no adjustments pays for no filter at all.
const Map<String, String> filterPresetCss = {
  'grayscale': 'grayscale(1)',
  'sepia': 'sepia(0.8)',
  'high-contrast': 'contrast(1.5) saturate(1.2)',
  'vintage': 'sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)',
  'cool': 'saturate(1.1) hue-rotate(15deg) brightness(1.02)',
  'warm': 'saturate(1.15) hue-rotate(-12deg) brightness(1.03)',
  'faded': 'contrast(0.85) brightness(1.1) saturate(0.8)',
  'cinema': 'contrast(1.25) saturate(1.1) hue-rotate(-8deg) brightness(0.95)',
  'nordic': 'saturate(0.7) hue-rotate(20deg) brightness(1.05) contrast(1.1)',
  'sunset': 'sepia(0.4) saturate(1.4) hue-rotate(-20deg) brightness(1.05)',
  'noir': 'grayscale(1) contrast(1.6) brightness(0.9)',
  'dramatic': 'contrast(1.6) saturate(1.3) brightness(0.95)',
  'cyberpunk': 'contrast(1.3) saturate(1.8) hue-rotate(140deg)',
  'pastel': 'brightness(1.15) saturate(1.3) contrast(0.9) hue-rotate(-5deg)',
  'vhs': 'sepia(0.2) contrast(1.2) saturate(1.5) hue-rotate(30deg) brightness(1.05)',
};

double? _clamp(dynamic v, double min, double max) {
  if (v is! num || !v.isFinite) return null;
  return v.toDouble().clamp(min, max).toDouble();
}

String _num(double v) => v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

/// The CSS filter chain a slot's style asks for, or null when everything is neutral.
String? mediaFilterCss(Map<String, dynamic> style) {
  final preset = style['filterPreset'];
  final parts = <String>[];
  if (preset is String && filterPresetCss.containsKey(preset)) parts.add(filterPresetCss[preset]!);
  final blur = _clamp(style['filterBlur'], 0, 100) ?? 0;
  final brightness = _clamp(style['filterBrightness'], 0, 500) ?? 100;
  final contrast = _clamp(style['filterContrast'], 0, 500) ?? 100;
  final saturate = _clamp(style['filterSaturate'], 0, 500) ?? 100;
  final hue = _clamp(style['filterHueRotate'], 0, 360) ?? 0;
  if (blur != 0) parts.add('blur(${_num(blur)}px)');
  if (brightness != 100) parts.add('brightness(${_num(brightness)}%)');
  if (contrast != 100) parts.add('contrast(${_num(contrast)}%)');
  if (saturate != 100) parts.add('saturate(${_num(saturate)}%)');
  if (hue != 0) parts.add('hue-rotate(${_num(hue)}deg)');
  return parts.isEmpty ? null : parts.join(' ');
}

/// A parsed CSS filter chain: a Gaussian blur sigma and one color matrix
/// (Flutter's 4x5 layout, offsets in the 0-255 scale).
class OimFilter {
  const OimFilter({this.blurSigma = 0, this.matrix});
  final double blurSigma;
  final List<double>? matrix;
}

const List<double> _identity = [
  1, 0, 0, 0, 0, //
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/// Applies [a] first and then [b].
List<double> composeMatrices(List<double> a, List<double> b) {
  final out = List<double>.filled(20, 0);
  for (var row = 0; row < 4; row++) {
    for (var col = 0; col < 5; col++) {
      var sum = 0.0;
      for (var k = 0; k < 4; k++) {
        sum += b[row * 5 + k] * a[k * 5 + col];
      }
      if (col == 4) sum += b[row * 5 + 4];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

double _amount(String arg, {bool allowPercent = true}) {
  final t = arg.trim();
  if (allowPercent && t.endsWith('%')) return (double.tryParse(t.substring(0, t.length - 1)) ?? 100) / 100;
  return double.tryParse(t) ?? 1;
}

List<double> _saturate(double s) => [
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0, //
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
      0, 0, 0, 1, 0,
    ];

List<double> _grayscale(double amount) {
  final a = 1 - amount.clamp(0.0, 1.0);
  return [
    0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0, //
    0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0,
    0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

List<double> _sepia(double amount) {
  final a = 1 - amount.clamp(0.0, 1.0);
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0, //
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

List<double> _hueRotate(double degrees) {
  final r = degrees * math.pi / 180;
  final c = math.cos(r);
  final s = math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0, //
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

List<double> _brightness(double b) => [
      b, 0, 0, 0, 0, //
      0, b, 0, 0, 0,
      0, 0, b, 0, 0,
      0, 0, 0, 1, 0,
    ];

List<double> _contrast(double c) {
  final o = 255 * (0.5 - 0.5 * c);
  return [
    c, 0, 0, 0, o, //
    0, c, 0, 0, o,
    0, 0, c, 0, o,
    0, 0, 0, 1, 0,
  ];
}

/// Parses the chain `mediaFilterCss` writes. Unknown functions are ignored.
OimFilter? parseCssFilter(String? css) {
  if (css == null || css.trim().isEmpty) return null;
  var blur = 0.0;
  List<double>? matrix;
  for (final m in RegExp(r'([a-z-]+)\(([^)]*)\)').allMatches(css)) {
    final fn = m.group(1)!;
    final arg = m.group(2)!;
    List<double>? step;
    switch (fn) {
      case 'blur':
        blur += double.tryParse(arg.replaceAll('px', '').trim()) ?? 0;
      case 'brightness':
        step = _brightness(_amount(arg));
      case 'contrast':
        step = _contrast(_amount(arg));
      case 'saturate':
        step = _saturate(_amount(arg));
      case 'grayscale':
        step = _grayscale(_amount(arg));
      case 'sepia':
        step = _sepia(_amount(arg));
      case 'hue-rotate':
        step = _hueRotate(double.tryParse(arg.replaceAll('deg', '').trim()) ?? 0);
    }
    if (step != null) matrix = composeMatrices(matrix ?? _identity, step);
  }
  if (blur == 0 && matrix == null) return null;
  return OimFilter(blurSigma: blur, matrix: matrix);
}

/// The slot's drop shadow. The player uses CSS `drop-shadow`, whose blur radius
/// is twice the Gaussian sigma, which is what Flutter's `blurRadius` means too.
BoxShadow? shadowOf(Map<String, dynamic> style) {
  if (style['shadowEnabled'] != true) return null;
  final raw = (style['shadowColor'] ?? '#000000').toString().replaceFirst('#', '');
  final hex = raw.length == 3 ? raw.split('').map((c) => '$c$c').join() : raw;
  final r = int.tryParse(hex.length >= 2 ? hex.substring(0, 2) : '', radix: 16) ?? 0;
  final g = int.tryParse(hex.length >= 4 ? hex.substring(2, 4) : '', radix: 16) ?? 0;
  final b = int.tryParse(hex.length >= 6 ? hex.substring(4, 6) : '', radix: 16) ?? 0;
  final opacity = style['shadowOpacity'] is num ? (style['shadowOpacity'] as num).toDouble().clamp(0, 100) / 100 : 1.0;
  return BoxShadow(
    color: Color.fromRGBO(r, g, b, opacity.toDouble()),
    offset: Offset(
      (style['shadowOffsetX'] as num?)?.toDouble() ?? 0,
      (style['shadowOffsetY'] as num?)?.toDouble() ?? 0,
    ),
    blurRadius: (style['shadowBlur'] as num?)?.toDouble() ?? 0,
  );
}

/// CSS `mix-blend-mode` names to Flutter blend modes. `normal` and unknown names return null.
BlendMode? blendModeOf(dynamic name) {
  switch (name) {
    case 'multiply':
      return BlendMode.multiply;
    case 'screen':
      return BlendMode.screen;
    case 'overlay':
      return BlendMode.overlay;
    case 'darken':
      return BlendMode.darken;
    case 'lighten':
      return BlendMode.lighten;
    case 'color-dodge':
      return BlendMode.colorDodge;
    case 'color-burn':
      return BlendMode.colorBurn;
    case 'hard-light':
      return BlendMode.hardLight;
    case 'soft-light':
      return BlendMode.softLight;
    case 'difference':
      return BlendMode.difference;
    case 'exclusion':
      return BlendMode.exclusion;
    case 'hue':
      return BlendMode.hue;
    case 'saturation':
      return BlendMode.saturation;
    case 'color':
      return BlendMode.color;
    case 'luminosity':
      return BlendMode.luminosity;
    default:
      return null;
  }
}
