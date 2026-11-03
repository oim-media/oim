/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import '../binary/oim_extractor.dart';
import 'color_util.dart';
import 'dynamic_colors.dart';
import 'effects.dart';
import 'geo_shapes.dart';
import 'groups.dart';
import 'image_fill.dart';
import 'infinite_parallax.dart';
import 'lottie_slot.dart';

/// Interactive native Flutter widget to render OIM files.
class OimPlayer extends StatefulWidget {
  final Uint8List bytes;
  final String? language;
  final String? palette;
  final bool? prefersDark;
  final bool isInteractive;
  final bool showBaseImage;
  final bool allowLottie;
  final bool disableAnimations;
  final Widget Function(BuildContext, Object)? errorBuilder;

  const OimPlayer({
    super.key,
    required this.bytes,
    this.language,
    this.palette,
    this.prefersDark,
    this.isInteractive = true,
    this.showBaseImage = true,
    this.allowLottie = true,
    this.disableAnimations = false,
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

    final declaredLanguages = (res.metadata['languages'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        ['es'];
    final currentLang = widget.language ??
        (declaredLanguages.isNotEmpty ? declaredLanguages.first : 'es');

    // Dynamic color resolution
    final activePalette = resolvePalette(
      res.metadata,
      requested: widget.palette,
      prefersDark: widget.prefersDark ?? (Theme.of(context).brightness == Brightness.dark),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        double containerWidth;
        double containerHeight;

        if (constraints.maxWidth.isFinite && constraints.maxHeight.isFinite) {
          final boxRatio = constraints.maxWidth / constraints.maxHeight;
          if (boxRatio > aspectRatio) {
            containerHeight = constraints.maxHeight;
            containerWidth = containerHeight * aspectRatio;
          } else {
            containerWidth = constraints.maxWidth;
            containerHeight = containerWidth / aspectRatio;
          }
        } else if (constraints.maxWidth.isFinite) {
          containerWidth = constraints.maxWidth;
          containerHeight = containerWidth / aspectRatio;
        } else if (constraints.maxHeight.isFinite) {
          containerHeight = constraints.maxHeight;
          containerWidth = containerHeight * aspectRatio;
        } else {
          containerWidth = naturalWidth;
          containerHeight = naturalHeight;
        }

        return Center(
          child: SizedBox(
            width: containerWidth,
            height: containerHeight,
            child: ClipRect(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (widget.showBaseImage && res.imageBytes.isNotEmpty)
                    Positioned.fill(
                      child: Image.memory(
                        res.imageBytes,
                        fit: BoxFit.fill,
                        gaplessPlayback: true,
                      ),
                    ),
                  ..._buildSlots(
                    res.metadata,
                    currentLang,
                    activePalette,
                    containerWidth,
                    containerHeight,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildSlots(
    Map<String, dynamic> metadata,
    String currentLang,
    OimPalette? activePalette,
    double containerWidth,
    double containerHeight,
  ) {
    final rawSlots = metadata['slots'] as List<dynamic>?;
    if (rawSlots == null) return const [];

    final byId = <String, Map<String, dynamic>>{};
    for (final raw in rawSlots) {
      if (raw is Map<String, dynamic>) {
        final id = raw['id']?.toString() ?? '';
        if (id.isNotEmpty) byId[id] = raw;
      }
    }

    final groupChildrenMap = childrenByGroup(rawSlots);
    final childSlotIds = <String>{};
    for (final children in groupChildrenMap.values) {
      childSlotIds.addAll(children);
    }

    final widgets = <Widget>[];

    for (final raw in rawSlots) {
      if (raw is! Map<String, dynamic>) continue;
      final slotId = raw['id']?.toString() ?? '';

      // If this slot is inside an existing group, the group mounts it.
      if (childSlotIds.contains(slotId)) continue;

      final slotWidget = _buildSlotEntry(
        raw,
        byId,
        groupChildrenMap,
        currentLang,
        activePalette,
        containerWidth,
        containerHeight,
      );

      if (slotWidget != null) {
        widgets.add(slotWidget);
      }
    }

    return widgets;
  }

  Widget? _buildSlotEntry(
    Map<String, dynamic> raw,
    Map<String, Map<String, dynamic>> byId,
    Map<String, List<String>> groupChildrenMap,
    String currentLang,
    OimPalette? activePalette,
    double containerWidth,
    double containerHeight, {
    Map<String, dynamic>? parentSceneLoop,
  }) {
    final type = raw['type']?.toString();
    final pos = raw['position'] as List<dynamic>?;
    final style = (raw['style'] as Map<String, dynamic>?) ?? {};
    final slotId = raw['id']?.toString() ?? '';

    if (type == 'group') {
      final childrenIds = groupChildrenMap[slotId];
      if (childrenIds == null || childrenIds.isEmpty) {
        return null;
      }

      final groupSceneLoop = (style['sceneLoop'] as Map<String, dynamic>?);
      final effectiveGroupLoop = groupSceneLoop ?? parentSceneLoop;

      final childrenWidgets = <Widget>[];
      for (final cid in childrenIds) {
        final childRaw = byId[cid];
        if (childRaw != null) {
          final cw = _buildSlotEntry(
            childRaw,
            byId,
            groupChildrenMap,
            currentLang,
            activePalette,
            containerWidth,
            containerHeight,
            parentSceneLoop: effectiveGroupLoop,
          );
          if (cw != null) childrenWidgets.add(cw);
        }
      }

      Widget groupWrapper = Stack(
        fit: StackFit.expand,
        children: childrenWidgets,
      );

      groupWrapper = _applyEffects(groupWrapper, style);

      final opacity = (style['opacity'] as num?)?.toDouble() ?? 1.0;
      if (opacity < 1.0) {
        groupWrapper = Opacity(opacity: opacity.clamp(0.0, 1.0), child: groupWrapper);
      }

      final blend = blendModeOf(style['blendMode']);
      if (blend != null) groupWrapper = _BlendMask(mode: blend, child: groupWrapper);

      // Check if group itself has infinite motion / parallax
      final parallaxCfg = parseInfiniteParallax(raw, style);
      if (parallaxCfg != null) {
        final plan = computeInfiniteLayerPlan(parallaxCfg, containerWidth, containerWidth);
        if (plan.duplicate) {
          groupWrapper = InfiniteParallaxTrack(
            plan: plan,
            pieceWidth: containerWidth,
            pieceHeight: containerHeight,
            disableAnimations: widget.disableAnimations,
            child: groupWrapper,
          );
        }
      }

      final isParallaxGrp = style['sceneLoop'] != null ||
          style['isParallaxGroup'] == true ||
          raw['isParallaxGroup'] == true ||
          raw['name']?.toString().toLowerCase().contains('parallax') == true;

      if (isParallaxGrp) {
        groupWrapper = ClipRect(child: groupWrapper);
      }

      return Positioned.fill(child: groupWrapper);
    }

    if (pos == null || pos.length < 2) return null;

    final posX = (pos[0] as num).toDouble();
    final posY = (pos[1] as num).toDouble();
    final left = (posX / 100.0) * containerWidth;
    final top = (posY / 100.0) * containerHeight;

    final slotWidth = resolveCssUnit(style['width'], containerWidth, containerHeight);
    final slotHeight = resolveCssUnit(style['height'], containerWidth, containerHeight);
    final opacity = (style['opacity'] as num?)?.toDouble() ?? 1.0;

    Widget slotWidget;

    if (type == 'text') {
      slotWidget = _buildTextSlot(raw, style, currentLang, activePalette, containerWidth, containerHeight);
    } else if (type == 'geo' || type == 'shape') {
      slotWidget = _buildGeoSlot(style, activePalette, slotWidth ?? 100, slotHeight ?? 100, containerWidth, containerHeight);
    } else if (type == 'image') {
      slotWidget = _buildImageSlot(raw, style, containerWidth, containerHeight);
    } else if (type == 'lottie') {
      slotWidget = LottieSlot(
        slot: raw,
        style: style,
        language: currentLang,
        allowLottie: widget.allowLottie,
        disableAnimations: widget.disableAnimations,
      );
    } else {
      slotWidget = const SizedBox.shrink();
    }

    slotWidget = _applyEffects(slotWidget, style);

    if (opacity < 1.0) {
      slotWidget = Opacity(opacity: opacity.clamp(0.0, 1.0), child: slotWidget);
    }

    final blend = blendModeOf(style['blendMode']);
    if (blend != null) slotWidget = _BlendMask(mode: blend, child: slotWidget);

    // Infinite parallax check
    final parallaxCfg = parseInfiniteParallax(
      raw,
      style,
      parentSceneLoop: parentSceneLoop,
    );
    if (parallaxCfg != null) {
      final pieceW = slotWidth ?? containerWidth;
      final pieceH = slotHeight ?? containerHeight;
      final plan = computeInfiniteLayerPlan(parallaxCfg, pieceW, containerWidth);
      if (plan.duplicate) {
        slotWidget = InfiniteParallaxTrack(
          plan: plan,
          pieceWidth: pieceW,
          pieceHeight: pieceH,
          disableAnimations: widget.disableAnimations,
          child: slotWidget,
        );
      }
    }

    return Positioned(
      left: left,
      top: top,
      width: slotWidth,
      height: slotHeight,
      child: slotWidget,
    );
  }

  Widget _buildTextSlot(
    Map<String, dynamic> slot,
    Map<String, dynamic> style,
    String language,
    OimPalette? activePalette,
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
    final color = resolveColor(
          style['colorRole'] ?? style['fillColorRole'],
          style['color'] ?? style['fillColor'],
          activePalette,
        ) ??
        Colors.white;

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
        shadows: shadowOf(style) == null ? null : [shadowOf(style)!],
      ),
    );
  }

  Widget _buildGeoSlot(
    Map<String, dynamic> style,
    OimPalette? activePalette,
    double slotWidth,
    double slotHeight,
    double containerWidth,
    double containerHeight,
  ) {
    final fillColor = resolveColor(style['fillColorRole'], style['fillColor'], activePalette) ??
        Colors.transparent;
    final borderColor = resolveColor(style['borderColorRole'], style['borderColor'], activePalette);
    final borderWidth = resolveCssUnit(style['borderWidth'], containerWidth, containerHeight) ?? 0.0;
    final borderRadius = parseBorderRadius(style['borderRadius'], containerWidth, containerHeight);

    final shapeName = style['drawing']?.toString() ?? style['geoDrawing']?.toString() ?? style['shape']?.toString();
    final ShapeDrawing? drawing = shapeName != null ? geoShapes[shapeName] : null;
    final svgPath = style['svgPath']?.toString() ?? style['path']?.toString();
    final borderStyle = style['borderStyle']?.toString();
    final isDashed = borderStyle == 'dashed';
    final isDotted = borderStyle == 'dotted';

    if (drawing != null || (svgPath != null && svgPath.isNotEmpty)) {
      Widget geo = CustomPaint(
        size: Size(slotWidth, slotHeight),
        painter: GeoShapePainter(
          drawing: drawing,
          svgPath: svgPath,
          fillColor: fillColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          isDashed: isDashed,
          isDotted: isDotted,
        ),
      );

      if (shadowOf(style) != null) {
        geo = DecoratedBox(
          decoration: BoxDecoration(boxShadow: [shadowOf(style)!]),
          child: geo,
        );
      }
      return geo;
    }

    // Default rectangle
    final dashed = isDashed || isDotted;
    return Container(
      foregroundDecoration: dashed && borderWidth > 0 && borderColor != null
          ? _DashedBorder(color: borderColor, width: borderWidth, radius: borderRadius, dotted: isDotted)
          : null,
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: borderRadius,
        boxShadow: shadowOf(style) == null ? null : [shadowOf(style)!],
        border: borderWidth > 0 && borderColor != null && !dashed
            ? Border.all(color: borderColor, width: borderWidth)
            : null,
      ),
    );
  }

  Widget _buildImageSlot(
    Map<String, dynamic> raw,
    Map<String, dynamic> style,
    double containerWidth,
    double containerHeight,
  ) {
    final imageUri = raw['content']?.toString() ?? style['src']?.toString();
    final crop = (style['imageCrop'] ?? style['crop']) as Map<String, dynamic>?;
    final borderRadius = parseBorderRadius(style['borderRadius'], containerWidth, containerHeight);

    return OimImageFillWidget(
      imageUrl: imageUri,
      crop: crop,
      flipX: style['flipX'] == true,
      flipY: style['flipY'] == true,
      borderRadius: borderRadius,
    );
  }
}

/// Everything the style says about the slot as a whole, in the order the player
/// applies it: filter chain, layer blur, flip, rotation. Opacity and blend mode wrap it after.
Widget _applyEffects(Widget child, Map<String, dynamic> style) {
  var w = child;
  final filter = parseCssFilter(mediaFilterCss(style));
  if (filter?.matrix != null) {
    w = ColorFiltered(colorFilter: ColorFilter.matrix(filter!.matrix!), child: w);
  }
  final layerBlur = (style['layerBlur'] as num?)?.toDouble() ?? (style['blur'] as num?)?.toDouble() ?? 0;
  final sigma = (filter?.blurSigma ?? 0) + (layerBlur > 0 ? layerBlur : 0);
  if (sigma > 0) {
    w = ImageFiltered(
      imageFilter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.decal),
      child: w,
    );
  }
  final fx = style['flipX'] == true ? -1.0 : 1.0;
  final fy = style['flipY'] == true ? -1.0 : 1.0;
  if (fx < 0 || fy < 0) {
    w = Transform(alignment: Alignment.center, transform: Matrix4.diagonal3Values(fx, fy, 1), child: w);
  }

  final rotation = (style['rotation'] as num?)?.toDouble();
  if (rotation != null && rotation != 0) {
    w = Transform.rotate(angle: rotation * math.pi / 180.0, child: w);
  }

  return w;
}

/// Paints [child] into its own layer and composites it onto what is behind with [mode].
class _BlendMask extends SingleChildRenderObjectWidget {
  const _BlendMask({required this.mode, super.child});

  final BlendMode mode;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderBlendMask(mode);

  @override
  void updateRenderObject(BuildContext context, _RenderBlendMask renderObject) {
    renderObject.mode = mode;
  }
}

class _RenderBlendMask extends RenderProxyBox {
  _RenderBlendMask(this._mode);

  BlendMode _mode;
  set mode(BlendMode value) {
    if (value == _mode) return;
    _mode = value;
    markNeedsPaint();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    context.canvas.saveLayer(offset & size, Paint()..blendMode = _mode);
    super.paint(context, offset);
    context.canvas.restore();
  }
}

/// A dashed or dotted outline that follows the rounded corners.
class _DashedBorder extends Decoration {
  const _DashedBorder({required this.color, required this.width, required this.radius, required this.dotted});

  final Color color;
  final double width;
  final BorderRadius radius;
  final bool dotted;

  @override
  BoxPainter createBoxPainter([VoidCallback? onChanged]) => _DashedBorderPainter(this);
}

class _DashedBorderPainter extends BoxPainter {
  _DashedBorderPainter(this.d);

  final _DashedBorder d;

  @override
  void paint(Canvas canvas, Offset offset, ImageConfiguration configuration) {
    final size = configuration.size;
    if (size == null) return;
    final rect = (offset & size).deflate(d.width / 2);
    final path = Path()..addRRect(d.radius.toRRect(rect));
    final paint = Paint()
      ..color = d.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = d.width
      ..strokeCap = d.dotted ? StrokeCap.round : StrokeCap.butt;
    final dash = d.dotted ? d.width : d.width * 3;
    final gap = d.dotted ? d.width * 2 : d.width * 2;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, math.min(distance + dash, metric.length)), paint);
        distance += dash + gap;
      }
    }
  }
}
