/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../binary/oim_extractor.dart';
import 'color_util.dart';

/// Interactive native Flutter widget to render OIM files.
class OimPlayer extends StatefulWidget {
  final Uint8List bytes;
  final String? language;
  final bool isInteractive;
  final bool showBaseImage;
  final Widget Function(BuildContext, Object)? errorBuilder;

  const OimPlayer({
    super.key,
    required this.bytes,
    this.language,
    this.isInteractive = true,
    this.showBaseImage = true,
    this.errorBuilder,
  });

  @override
  State<OimPlayer> createState() => _OimPlayerState();
}

class _OimPlayerState extends State<OimPlayer> {
  OimExtractionResult? _extractionResult;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _parseOim();
  }

  @override
  void didUpdateWidget(OimPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.bytes != oldWidget.bytes) {
      _parseOim();
    }
  }

  void _parseOim() {
    try {
      final res = extractOIM(widget.bytes);
      setState(() {
        _extractionResult = res;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = e;
        _extractionResult = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      if (widget.errorBuilder != null) {
        return widget.errorBuilder!(context, _error!);
      }
      return Center(
        child: Text(
          'Error loading OIM: $_error',
          style: const TextStyle(color: Colors.red),
        ),
      );
    }

    final res = _extractionResult;
    if (res == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final canvas = res.metadata['canvas'] as Map<String, dynamic>?;
    final naturalWidth = (canvas?['natural_width'] as num?)?.toDouble() ?? 800.0;
    final naturalHeight = (canvas?['natural_height'] as num?)?.toDouble() ?? 600.0;
    final aspectRatio = naturalWidth / naturalHeight;

    return AspectRatio(
      aspectRatio: aspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;

          return ClipRect(
            child: Stack(
              fit: StackFit.expand,
              children: [
                // 1. Base Image
                if (widget.showBaseImage)
                  Image.memory(
                    res.imageBytes,
                    width: w,
                    height: h,
                    fit: BoxFit.fill,
                  ),

                // 2. Interactive Layer Slots
                if (widget.isInteractive)
                  ..._buildSlots(res.metadata, w, h),
              ],
            ),
          );
        },
      ),
    );
  }

  List<Widget> _buildSlots(Map<String, dynamic> metadata, double containerWidth, double containerHeight) {
    final rawSlots = metadata['slots'] as List<dynamic>? ?? [];
    final currentLang = widget.language ?? (metadata['languages'] as List<dynamic>?)?.firstOrNull?.toString() ?? 'es';
    final widgets = <Widget>[];

    for (final raw in rawSlots) {
      if (raw is! Map<String, dynamic>) continue;

      final type = raw['type']?.toString();
      final pos = raw['position'] as List<dynamic>?;
      if (pos == null || pos.length < 2) continue;

      final posX = (pos[0] as num).toDouble();
      final posY = (pos[1] as num).toDouble();
      final left = (posX / 100.0) * containerWidth;
      final top = (posY / 100.0) * containerHeight;

      final style = (raw['style'] as Map<String, dynamic>?) ?? {};
      final slotWidth = resolveCssUnit(style['width'], containerWidth, containerHeight);
      final slotHeight = resolveCssUnit(style['height'], containerWidth, containerHeight);
      final opacity = (style['opacity'] as num?)?.toDouble() ?? 1.0;

      Widget slotWidget;

      if (type == 'text') {
        slotWidget = _buildTextSlot(raw, style, currentLang, containerWidth, containerHeight);
      } else if (type == 'geo') {
        slotWidget = _buildGeoSlot(style, containerWidth, containerHeight);
      } else {
        // Fallback for other slot types
        slotWidget = const SizedBox.shrink();
      }

      if (opacity < 1.0) {
        slotWidget = Opacity(opacity: opacity.clamp(0.0, 1.0), child: slotWidget);
      }

      widgets.add(
        Positioned(
          left: left,
          top: top,
          width: slotWidth,
          height: slotHeight,
          child: slotWidget,
        ),
      );
    }

    return widgets;
  }

  Widget _buildTextSlot(
    Map<String, dynamic> slot,
    Map<String, dynamic> style,
    String language,
    double containerWidth,
    double containerHeight,
  ) {
    String text = '';
    final content = slot['content'];
    if (content is Map) {
      text = content[language]?.toString() ??
          content['*']?.toString() ??
          content['es']?.toString() ??
          content['en']?.toString() ??
          content.values.firstOrNull?.toString() ??
          '';
    } else if (content != null) {
      text = content.toString();
    }

    if (style['textTransform'] == 'uppercase') {
      text = text.toUpperCase();
    } else if (style['textTransform'] == 'lowercase') {
      text = text.toLowerCase();
    }

    final fontSize = resolveCssUnit(style['fontSize'], containerWidth, containerHeight) ?? 16.0;
    final color = parseCssColor(style['fillColor'] ?? style['color']) ?? Colors.white;

    FontWeight fontWeight = FontWeight.normal;
    final rawWeight = style['fontWeight'];
    if (rawWeight != null) {
      if (rawWeight is num) {
        final w = rawWeight.toInt();
        if (w >= 900) fontWeight = FontWeight.w900;
        else if (w >= 800) fontWeight = FontWeight.w800;
        else if (w >= 700) fontWeight = FontWeight.w700;
        else if (w >= 600) fontWeight = FontWeight.w600;
        else if (w >= 500) fontWeight = FontWeight.w500;
        else if (w >= 300) fontWeight = FontWeight.w300;
      } else if (rawWeight.toString().toLowerCase() == 'bold') {
        fontWeight = FontWeight.bold;
      }
    }

    final fontStyle = style['fontStyle'] == 'italic' ? FontStyle.italic : FontStyle.normal;
    final letterSpacing = (style['letterSpacing'] as num?)?.toDouble();
    final lineHeight = (style['lineHeight'] as num?)?.toDouble();

    return Text(
      text,
      style: TextStyle(
        fontSize: fontSize,
        color: color,
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        letterSpacing: letterSpacing,
        height: lineHeight,
      ),
    );
  }

  Widget _buildGeoSlot(
    Map<String, dynamic> style,
    double containerWidth,
    double containerHeight,
  ) {
    final fillColor = parseCssColor(style['fillColor']) ?? Colors.transparent;
    final borderColor = parseCssColor(style['borderColor']);
    final borderWidth = resolveCssUnit(style['borderWidth'], containerWidth, containerHeight) ?? 0.0;
    final borderRadius = parseBorderRadius(style['borderRadius'], containerWidth, containerHeight);

    return Container(
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: borderRadius,
        border: borderWidth > 0 && borderColor != null
            ? Border.all(color: borderColor, width: borderWidth)
            : null,
      ),
    );
  }
}
