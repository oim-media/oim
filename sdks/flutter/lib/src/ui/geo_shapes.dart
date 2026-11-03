/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:math' as math;
import 'package:flutter/rendering.dart';
import 'svg_path.dart';

sealed class ShapeDrawing {
  const ShapeDrawing();
}

class PolygonDrawing extends ShapeDrawing {
  final List<List<double>> points;
  const PolygonDrawing(this.points);
}

class PathDrawing extends ShapeDrawing {
  final String d;
  final bool fillable;
  const PathDrawing(this.d, {this.fillable = true});
}

/// Geometry of the 24 catalogue shapes in the editor's viewBox 0 0 100 100.
/// Copied directly from packages/core/src/geoShapes.ts to guarantee exact parity.
const Map<String, ShapeDrawing> geoShapes = {
  'triangle': PolygonDrawing([
    [50, 5],
    [95, 90],
    [5, 90]
  ]),
  'star': PolygonDrawing([
    [50, 2],
    [62, 38],
    [100, 38],
    [69, 59],
    [80, 95],
    [50, 73],
    [20, 95],
    [31, 59],
    [0, 38],
    [38, 38]
  ]),
  'arrow': PolygonDrawing([
    [5, 40],
    [60, 40],
    [60, 20],
    [95, 50],
    [60, 80],
    [60, 60],
    [5, 60]
  ]),
  'diamond': PolygonDrawing([
    [50, 5],
    [95, 50],
    [50, 95],
    [5, 50]
  ]),
  'hexagon': PolygonDrawing([
    [25, 5],
    [75, 5],
    [95, 50],
    [75, 95],
    [25, 95],
    [5, 50]
  ]),
  'circle': PathDrawing('M 50,5 A 45,45 0 1,1 49.999,5 Z', fillable: true),
  'heart': PathDrawing(
    'M 50,88 C 10,60 -5,30 15,12 C 30,-2 50,5 50,25 C 50,5 70,-2 85,12 C 105,30 90,60 50,88 Z',
    fillable: true,
  ),
  'line': PathDrawing('M 5,50 L 95,50', fillable: false),
  'blob': PathDrawing(
    'M 50,10 C 75,10 92,25 90,50 C 88,75 75,90 50,90 C 25,90 10,75 10,50 C 10,25 25,10 50,10 Z',
    fillable: true,
  ),
  'scribble': PathDrawing(
    'M 5,80 Q 25,65 50,75 T 95,70 Q 75,85 50,82 T 5,88',
    fillable: false,
  ),
  'pill': PathDrawing(
    'M 30,25 L 70,25 C 83.8,25 95,36.2 95,50 C 95,63.8 83.8,75 70,75 L 30,75 C 16.2,75 5,63.8 5,50 C 5,36.2 16.2,25 30,25 Z',
    fillable: true,
  ),
  'octagon': PolygonDrawing([
    [30, 5],
    [70, 5],
    [95, 30],
    [95, 70],
    [70, 95],
    [30, 95],
    [5, 70],
    [5, 30]
  ]),
  'pentagon': PolygonDrawing([
    [50, 5],
    [94.7, 37.5],
    [77.6, 90],
    [22.4, 90],
    [5.3, 37.5]
  ]),
  'cross': PolygonDrawing([
    [35, 5],
    [65, 5],
    [65, 35],
    [95, 35],
    [95, 65],
    [65, 65],
    [65, 95],
    [35, 95],
    [35, 65],
    [5, 65],
    [5, 35],
    [35, 35]
  ]),
  'moon': PathDrawing(
    'M 50,5 C 25.15,5 5,25.15 5,50 C 5,74.85 25.15,95 50,95 C 30,80 30,20 50,5 Z',
    fillable: true,
  ),
  'cloud': PathDrawing(
    'M 25,85 C 8,85 5,62 22,58 C 14,40 35,32 45,42 C 48,22 75,20 78,42 C 96,40 97,66 80,68 C 80,78 78,85 68,85 Z',
    fillable: true,
  ),
  'drop': PathDrawing(
    'M 50,5 C 62,25 80,45 80,65 C 80,81.5 66.5,95 50,95 C 33.5,95 20,81.5 20,65 C 20,45 38,25 50,5 Z',
    fillable: true,
  ),
  'bolt': PolygonDrawing([
    [62, 5],
    [18, 58],
    [46, 58],
    [34, 95],
    [82, 40],
    [55, 40],
    [72, 5]
  ]),
  'bubble': PathDrawing(
    'M 20,5 L 80,5 C 88.3,5 95,11.7 95,20 L 95,57 C 95,65.3 88.3,72 80,72 L 42,72 L 22,93 L 28,72 L 20,72 C 11.7,72 5,65.3 5,57 L 5,20 C 5,11.7 11.7,5 20,5 Z',
    fillable: true,
  ),
  'flower': PathDrawing(
    'M 65.6,41.0 C 85.5,35.7 97.5,39.9 95.0,50.0 C 97.5,60.1 85.5,64.3 65.6,59.0 C 80.1,73.5 82.5,86.1 72.5,89.0 C 65.0,96.2 55.3,87.9 50.0,68.0 C 44.7,87.9 35.0,96.2 27.5,89.0 C 17.5,86.1 19.9,73.5 34.4,59.0 C 14.5,64.3 2.5,60.1 5.0,50.0 C 2.5,39.9 14.5,35.7 34.4,41.0 C 19.9,26.5 17.5,13.9 27.5,11.0 C 35.0,3.8 44.7,12.1 50.0,32.0 C 55.3,12.1 65.0,3.8 72.5,11.0 C 82.5,13.9 80.1,26.5 65.6,41.0 Z',
    fillable: true,
  ),
  'burst': PolygonDrawing([
    [95, 50],
    [82.8, 58.8],
    [89, 72.5],
    [74, 74],
    [72.5, 89],
    [58.8, 82.8],
    [50, 95],
    [41.2, 82.8],
    [27.5, 89],
    [26, 74],
    [11, 72.5],
    [17.2, 58.8],
    [5, 50],
    [17.2, 41.2],
    [11, 27.5],
    [26, 26],
    [27.5, 11],
    [41.2, 17.2],
    [50, 5],
    [58.8, 17.2],
    [72.5, 11],
    [74, 26],
    [89, 27.5],
    [82.8, 41.2]
  ]),
  'arch': PathDrawing(
    'M 5,95 L 5,50 C 5,25.15 25.15,5 50,5 C 74.85,5 95,25.15 95,50 L 95,95 Z',
    fillable: true,
  ),
};

/// Returns the ShapeDrawing for [geoShape], or null if rectangle or unknown.
ShapeDrawing? shapeDrawing(dynamic geoShape) {
  if (geoShape == null) return null;
  final name = geoShape.toString();
  if (name == 'rect' || name == 'rectangle') return null;
  return geoShapes[name];
}

bool isKnownGeoShape(dynamic geoShape) {
  if (geoShape == null) return false;
  final name = geoShape.toString();
  if (name == 'rect' || name == 'rectangle') return true;
  return geoShapes.containsKey(name);
}

/// Builds a Path scaled to [size] from [drawing] or [svgPath].
Path buildShapePath({
  ShapeDrawing? drawing,
  String? svgPath,
  required Size size,
  Rect viewBox = const Rect.fromLTWH(0, 0, 100, 100),
}) {
  final path = Path();
  if (size.width <= 0 || size.height <= 0) return path;

  final sx = size.width / viewBox.width;
  final sy = size.height / viewBox.height;
  final ox = -viewBox.left * sx;
  final oy = -viewBox.top * sy;

  if (drawing is PolygonDrawing) {
    final pts = drawing.points;
    if (pts.isNotEmpty) {
      path.moveTo(pts[0][0] * sx + ox, pts[0][1] * sy + oy);
      for (var i = 1; i < pts.length; i++) {
        path.lineTo(pts[i][0] * sx + ox, pts[i][1] * sy + oy);
      }
      path.close();
    }
  } else if (drawing is PathDrawing) {
    final parsed = parseSvgPath(drawing.d);
    final matrix = Matrix4.diagonal3Values(sx, sy, 1.0)..setTranslationRaw(ox, oy, 0.0);
    return parsed.transform(matrix.storage);
  } else if (svgPath != null && svgPath.isNotEmpty) {
    final parsed = parseSvgPath(svgPath);
    final matrix = Matrix4.diagonal3Values(sx, sy, 1.0)..setTranslationRaw(ox, oy, 0.0);
    return parsed.transform(matrix.storage);
  }

  return path;
}

class GeoShapeClipper extends CustomClipper<Path> {
  final ShapeDrawing? drawing;
  final String? svgPath;
  final Rect viewBox;

  const GeoShapeClipper({
    this.drawing,
    this.svgPath,
    this.viewBox = const Rect.fromLTWH(0, 0, 100, 100),
  });

  @override
  Path getClip(Size size) {
    return buildShapePath(
      drawing: drawing,
      svgPath: svgPath,
      size: size,
      viewBox: viewBox,
    );
  }

  @override
  bool shouldReclip(covariant GeoShapeClipper oldClipper) =>
      oldClipper.drawing != drawing ||
      oldClipper.svgPath != svgPath ||
      oldClipper.viewBox != viewBox;
}

class GeoShapePainter extends CustomPainter {
  final ShapeDrawing? drawing;
  final String? svgPath;
  final Rect viewBox;
  final Color? fillColor;
  final Color? borderColor;
  final double borderWidth;
  final bool isDashed;
  final bool isDotted;

  const GeoShapePainter({
    this.drawing,
    this.svgPath,
    this.viewBox = const Rect.fromLTWH(0, 0, 100, 100),
    this.fillColor,
    this.borderColor,
    this.borderWidth = 0.0,
    this.isDashed = false,
    this.isDotted = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final path = buildShapePath(
      drawing: drawing,
      svgPath: svgPath,
      size: size,
      viewBox: viewBox,
    );

    final fillable = drawing is PathDrawing ? (drawing as PathDrawing).fillable : true;

    // 1. Fill
    if (fillColor != null && fillColor != const Color(0x00000000) && fillable) {
      final fillPaint = Paint()
        ..color = fillColor!
        ..style = PaintingStyle.fill;
      canvas.drawPath(path, fillPaint);
    }

    // 2. Stroke
    if (borderWidth > 0 && borderColor != null && borderColor != const Color(0x00000000)) {
      final strokePaint = Paint()
        ..color = borderColor!
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth
        ..strokeCap = isDotted ? StrokeCap.round : StrokeCap.butt;

      if (isDashed || isDotted) {
        final dash = isDotted ? borderWidth : borderWidth * 3;
        final gap = borderWidth * 2;
        for (final metric in path.computeMetrics()) {
          var distance = 0.0;
          while (distance < metric.length) {
            canvas.drawPath(
              metric.extractPath(distance, math.min(distance + dash, metric.length)),
              strokePaint,
            );
            distance += dash + gap;
          }
        }
      } else {
        canvas.drawPath(path, strokePaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant GeoShapePainter oldDelegate) =>
      oldDelegate.drawing != drawing ||
      oldDelegate.svgPath != svgPath ||
      oldDelegate.fillColor != fillColor ||
      oldDelegate.borderColor != borderColor ||
      oldDelegate.borderWidth != borderWidth ||
      oldDelegate.isDashed != isDashed ||
      oldDelegate.isDotted != isDotted;
}
