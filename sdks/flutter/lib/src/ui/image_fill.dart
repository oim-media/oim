/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'geo_shapes.dart';

// Decoded data URIs, so every rebuild hands Image.memory the same bytes: MemoryImage compares by
// identity, and fresh bytes each build re-decode the picture (dropped frames, a flickering layer).
final _decoded = <String, Uint8List>{};
const _decodedMax = 64;

/// Decodes an embedded base64 data URL (`data:image/...;base64,...`), memoised.
Uint8List? decodeDataUri(String? uri) {
  if (uri == null) return null;
  final hit = _decoded.remove(uri);
  if (hit != null) return _decoded[uri] = hit;
  final bytes = _decodeDataUri(uri);
  if (bytes != null) {
    if (_decoded.length >= _decodedMax) _decoded.remove(_decoded.keys.first);
    _decoded[uri] = bytes;
  }
  return bytes;
}

Uint8List? _decodeDataUri(String uri) {
  final trimmed = uri.trim();
  if (!trimmed.startsWith('data:image/')) return null;

  final commaIdx = trimmed.indexOf(',');
  if (commaIdx == -1) return null;

  final meta = trimmed.substring(0, commaIdx);
  if (!meta.contains(';base64')) return null;

  final payload = trimmed.substring(commaIdx + 1).trim();
  try {
    return base64Decode(payload);
  } catch (_) {
    return null;
  }
}

/// Widget that displays an image with crop, flip, and shape clipping according
/// to OIM canonical specification (contract 1.15.0 & 1.17.0).
class OimImageFillWidget extends StatelessWidget {
  final Uint8List? imageBytes;
  final String? imageUrl;
  final Map<String, dynamic>? crop;
  final bool flipX;
  final bool flipY;
  final ShapeDrawing? drawing;
  final String? svgPath;
  final BorderRadius? borderRadius;

  const OimImageFillWidget({
    super.key,
    this.imageBytes,
    this.imageUrl,
    this.crop,
    this.flipX = false,
    this.flipY = false,
    this.drawing,
    this.svgPath,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    Widget? imageWidget;

    if (imageBytes != null) {
      imageWidget = Image.memory(
        imageBytes!,
        fit: BoxFit.cover,
        alignment: _alignment,
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
      );
    } else if (imageUrl != null && imageUrl!.isNotEmpty) {
      final decoded = decodeDataUri(imageUrl);
      if (decoded != null) {
        imageWidget = Image.memory(
          decoded,
          fit: BoxFit.cover,
          alignment: _alignment,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
        );
      } else if (imageUrl!.startsWith('http://') || imageUrl!.startsWith('https://')) {
        imageWidget = Image.network(
          imageUrl!,
          fit: BoxFit.cover,
          alignment: _alignment,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
        );
      }
    }

    if (imageWidget == null) return const SizedBox.shrink();

    // 1. Zoom around the crop position
    final zoom = _zoom;
    if (zoom != 1.0) {
      imageWidget = Transform.scale(
        scale: zoom,
        alignment: _alignment,
        child: imageWidget,
      );
    }

    // 2. Photo mirror inside the frame
    if (flipX || flipY) {
      imageWidget = Transform(
        alignment: Alignment.center,
        transform: Matrix4.diagonal3Values(flipX ? -1.0 : 1.0, flipY ? -1.0 : 1.0, 1.0),
        child: imageWidget,
      );
    }

    // 3. Silhouette Clip (shape or rounded rectangle)
    if (drawing != null || (svgPath != null && svgPath!.isNotEmpty)) {
      return ClipPath(
        clipper: GeoShapeClipper(drawing: drawing, svgPath: svgPath),
        child: imageWidget,
      );
    } else if (borderRadius != null && borderRadius != BorderRadius.zero) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: imageWidget,
      );
    } else {
      return ClipRect(child: imageWidget);
    }
  }

  double get _cropX {
    final x = crop?['x'];
    if (x is num) return x.toDouble().clamp(0.0, 100.0);
    return 50.0;
  }

  double get _cropY {
    final y = crop?['y'];
    if (y is num) return y.toDouble().clamp(0.0, 100.0);
    return 50.0;
  }

  double get _zoom {
    final z = crop?['zoom'];
    if (z is num) return z.toDouble().clamp(1.0, 10.0);
    return 1.0;
  }

  Alignment get _alignment => Alignment(
        ((_cropX - 50.0) / 50.0).clamp(-1.0, 1.0),
        ((_cropY - 50.0) / 50.0).clamp(-1.0, 1.0),
      );
}
