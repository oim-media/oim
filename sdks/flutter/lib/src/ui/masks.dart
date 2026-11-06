// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// Mask layers (`type: "mask"`), as `layerComposition.ts` of the web player:
// - "window" (default): paints a frame of `maskBgColor` over the canvas (or its
//   own box with `maskCoverage: "container"`) with the silhouette as a hole.
// - "cutout": clips every layer below it. Outside the mask's box they stay;
//   inside it only the silhouette shows. `maskFeather` blurs that edge.
// Silhouettes are drawn in a 0–100 box and stretched to the mask's box; `cuts`
// place several silhouettes, each in its own box (canvas px from the mask's corner).

import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'svg_path.dart';

const maskShapePaths = <String, String>{
  'circle': 'M50 0 A50 50 0 1 1 49.99 0 Z',
  'rectangle': 'M0 0 H100 V100 H0 Z',
  'heart': 'M50 88 C10 60 -5 30 15 12 C30 -2 50 5 50 25 C50 5 70 -2 85 12 C105 30 90 60 50 88 Z',
  'blob': 'M40 4 C70 -4 100 20 96 48 C104 78 72 100 44 96 C12 100 -8 72 4 44 C0 16 16 8 40 4 Z',
  'triangle': 'M50 5 L95 90 L5 90 Z',
  'star': 'M50 2 L62 38 L100 38 L69 59 L80 95 L50 73 L20 95 L31 59 L0 38 L38 38 Z',
  'line': 'M5 45 L95 45 L95 55 L5 55 Z',
  'arrow': 'M5 40 L60 40 L60 20 L95 50 L60 80 L60 60 L5 60 Z',
  'diamond': 'M50 5 L95 50 L50 95 L5 50 Z',
  'hexagon': 'M25 5 L75 5 L95 50 L75 95 L25 95 L5 50 Z',
};

/// The silhouette's path data in its 0–100 box (`getMaskSilhouettePath`).
String maskSilhouetteData(Map<String, dynamic> style) {
  final shape = (style['maskShape'] ?? style['geoShape'])?.toString();
  final custom = (style['maskSvgPath'] ?? style['svgPath'])?.toString();
  if (custom != null && custom.isNotEmpty && (shape == null || shape == 'custom')) return custom;
  return maskShapePaths[shape] ?? maskShapePaths['circle']!;
}

Path _fitted(String d, Rect box) =>
    parseSvgPath(d).transform((Matrix4.translationValues(box.left, box.top, 0)..scaleByDouble(box.width / 100, box.height / 100, 1, 1)).storage);

/// The silhouettes of a mask whose box is [box], [unit] logical px per canvas px for `cuts`.
Path maskSilhouettes(Map<String, dynamic> style, Rect box, double unit) {
  final out = Path()..fillType = PathFillType.evenOdd;
  final cuts = style['cuts'];
  if (cuts is List && cuts.isNotEmpty) {
    for (final c in cuts.whereType<Map>()) {
      double n(String k) => ((c[k] as num?) ?? 0).toDouble() * unit;
      final d = c['svgPath']?.toString() ?? maskShapePaths[c['shape']] ?? maskShapePaths['circle']!;
      out.addPath(_fitted(d, Rect.fromLTWH(box.left + n('x'), box.top + n('y'), n('width'), n('height'))), Offset.zero);
    }
  } else {
    out.addPath(_fitted(maskSilhouetteData(style), box), Offset.zero);
  }
  return out;
}

/// What a cutout leaves visible: canvas, minus the box, plus the silhouettes (even-odd).
Path cutoutPath(Map<String, dynamic> style, Rect box, Size canvas, double unit) => Path()
  ..fillType = PathFillType.evenOdd
  ..addRect(Offset.zero & canvas)
  ..addRect(box)
  ..addPath(maskSilhouettes(style, box, unit), Offset.zero);

/// The painted frame of a window mask: its coverage minus the silhouettes.
Path windowPath(Map<String, dynamic> style, Rect box, Size canvas, double unit) => Path()
  ..fillType = PathFillType.evenOdd
  ..addRect(style['maskCoverage'] == 'container' ? box : Offset.zero & canvas)
  ..addPath(maskSilhouettes(style, box, unit), Offset.zero);

class _PathClip extends CustomClipper<Path> {
  final Path path;
  const _PathClip(this.path);
  @override
  Path getClip(Size size) => path;
  @override
  bool shouldReclip(_PathClip old) => true;
}

/// [child] (the layers below a cutout) seen through [path]; [feather] in logical px blurs the edge.
Widget cutoutMask({required Widget child, required Path path, required Size canvas, double feather = 0}) {
  if (feather <= 0) return ClipPath(clipper: _PathClip(path), child: child);
  // The blurred silhouette as an image, used as the alpha of the layers (SVG <mask> with feGaussianBlur).
  final rec = ui.PictureRecorder();
  Canvas(rec).drawPath(path, Paint()
    ..color = const Color(0xFFFFFFFF)
    ..maskFilter = MaskFilter.blur(BlurStyle.normal, feather));
  final image = rec.endRecording().toImageSync(canvas.width.ceil().clamp(1, 8192), canvas.height.ceil().clamp(1, 8192));
  return ShaderMask(
    blendMode: BlendMode.dstIn,
    shaderCallback: (b) => ImageShader(image, TileMode.decal, TileMode.decal, Matrix4.translationValues(b.left, b.top, 0).storage),
    child: child,
  );
}

/// A window mask's frame and, with a stroke width, the silhouette's outline.
class WindowMaskPainter extends CustomPainter {
  final Path frame, outline;
  final Color fill, stroke;
  final double strokeWidth;
  const WindowMaskPainter(this.frame, this.outline, this.fill, this.stroke, this.strokeWidth);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(frame, Paint()..color = fill);
    if (strokeWidth > 0) {
      canvas.drawPath(outline, Paint()
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeWidth = strokeWidth
        ..color = stroke);
    }
  }

  @override
  bool shouldRepaint(WindowMaskPainter old) => true;
}
