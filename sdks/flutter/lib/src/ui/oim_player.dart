/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../binary/oim_extractor.dart';
import 'embedded_fonts.dart';
import 'color_util.dart';
import 'dynamic_colors.dart';
import 'effects.dart';
import 'geo_shapes.dart';
import 'localized_content.dart';
import 'groups.dart';
import 'image_fill.dart';
import 'infinite_parallax.dart';
import 'lottie_slot.dart';
import 'motion.dart';
import 'actions.dart';
import 'artistic_text.dart';
import 'interaction.dart';
import 'css_gradient.dart';
import 'grain.dart';
import 'texture.dart';
import 'masks.dart';
import 'patterns.dart';
import 'text_animation.dart';
import 'text_effects.dart';

/// Interactive native Flutter widget to render OIM files.
class OimPlayer extends StatefulWidget {
  final Uint8List bytes;
  final String? language;
  final String? palette;
  final bool? prefersDark;
  /// False ignores the work's palettes, like allow-dynamic-colors="false" on the web element.
  final bool allowDynamicColors;
  final bool isInteractive;
  final bool showBaseImage;
  final bool allowLottie;
  final bool disableAnimations;
  /// Family for text that names none, like CSS `font-family` on the web element.
  /// Null keeps the platform default.
  final String? fontFamily;
  final Widget Function(BuildContext, Object)? errorBuilder;

  const OimPlayer({
    super.key,
    required this.bytes,
    this.language,
    this.palette,
    this.prefersDark,
    this.allowDynamicColors = true,
    this.isInteractive = true,
    this.showBaseImage = true,
    this.allowLottie = true,
    this.disableAnimations = false,
    this.fontFamily,
    this.errorBuilder,
  });

  @override
  State<OimPlayer> createState() => _OimPlayerState();
}

class _OimPlayerState extends State<OimPlayer> with TickerProviderStateMixin {
  OimExtractionResult? _extractionResult;
  Object? _error;

  // What the file's actions changed, keyed by slot id (web: the slot elements' inline state).
  final _visible = <String, bool>{};
  final _texts = <String, String>{};
  final _plays = <String, int>{};
  // Per hovered slot: what its hover actions changed, to put back on leaving.
  final _hoverBaseVisible = <String, Map<String, bool>>{};
  final _hoverBaseText = <String, Map<String, String?>>{};
  // Design px to logical px, for pattern tiles (160 design px * scale).
  double _unit = 1;
  // The language on screen: it trails widget.language until the blur peaks (web: _switchWithBlur).
  late String _lang = widget.language ?? oimDefaultLanguage;
  late final AnimationController _blur = AnimationController(vsync: this);
  // Web _switchWithFade: on phones and with reduced motion only the changing layers fade out and back.
  late final AnimationController _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 120));
  Set<String> _fading = const {};

  @override
  void initState() {
    super.initState();
    _parseOim();
  }

  @override
  void dispose() {
    _blur.dispose();
    _fade.dispose();
    super.dispose();
  }

  void _switchLanguage(String next) {
    final slots = (_extractionResult?.metadata['slots'] as List<dynamic>?) ?? const [];
    // Same image in both languages: a blur would suggest a change that did not happen.
    // shortcut: compares content only, not per-language textRuns or styles; extend if those start to differ alone.
    final changed = {
      for (final s in slots)
        if (s is Map && resolveContent(s['content'], _lang) != resolveContent(s['content'], next)) s['id']?.toString() ?? '',
    };
    if (changed.isEmpty || widget.disableAnimations) {
      _blur.value = 0;
      setState(() => _lang = next);
      return;
    }
    final mobile = switch (defaultTargetPlatform) {
      TargetPlatform.android || TargetPlatform.iOS || TargetPlatform.fuchsia => true,
      _ => false,
    };
    if (mobile || (MediaQuery.maybeDisableAnimationsOf(context) ?? false)) {
      _blur.value = 0;
      setState(() => _fading = changed);
      _fade.forward(from: 0).then((_) {
        if (!mounted) return;
        setState(() => _lang = next);
        _fade.reverse().then((_) {
          if (mounted) setState(() => _fading = const {});
        });
      });
      return;
    }
    _blur.animateTo(1, duration: const Duration(milliseconds: 180), curve: Curves.easeOut).then((_) {
      if (!mounted) return;
      setState(() => _lang = next);
      _blur.animateTo(0, duration: const Duration(milliseconds: 320), curve: Curves.easeInOut);
    });
  }

  @override
  void didUpdateWidget(OimPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.bytes != oldWidget.bytes) {
      _lang = widget.language ?? oimDefaultLanguage;
      _parseOim();
    } else if (widget.language != oldWidget.language) {
      _switchLanguage(widget.language ?? oimDefaultLanguage);
    }
  }

  void _parseOim() {
    try {
      final res = extractOIM(widget.bytes);
      setState(() {
        _resetInteraction(res.metadata);
        _extractionResult = res;
        _error = null;
      });
      // Text repaints in the embedded fonts once FontLoader has them.
      loadEmbeddedFonts(res.metadata['fonts'] as List<dynamic>?).then((_) {
        if (mounted) setState(() {});
      });
    } catch (e) {
      setState(() {
        _error = e;
        _extractionResult = null;
      });
    }
  }

  void _resetInteraction(Map<String, dynamic> metadata) {
    _visible.clear();
    _texts.clear();
    _plays.clear();
    _hoverBaseVisible.clear();
    _hoverBaseText.clear();
    for (final raw in (metadata['slots'] as List<dynamic>?) ?? const []) {
      if (raw is! Map) continue;
      final style = raw['style'] is Map ? raw['style'] as Map : const {};
      if (raw['isVisible'] == false || style['isVisible'] == false) _visible[raw['id'].toString()] = false;
    }
  }

  /// Runs a slot's actions; with [hoverOf] it records what they change so [_revert] can undo it.
  void _run(List actions, {String? hoverOf}) {
    setState(() {
      final current = <String, bool>{};
      for (final a in actions) {
        if (a is! Map) continue;
        final t = a['target']?.toString() ?? '';
        if (t.isEmpty) continue;
        if (a['type'] == 'play') {
          _plays[t] = (_plays[t] ?? 0) + 1;
          continue;
        }
        current[t] = _visible[t] ?? true;
        if (hoverOf != null) {
          _hoverBaseVisible.putIfAbsent(hoverOf, () => {}).putIfAbsent(t, () => current[t]!);
          if (a['type'] == 'setText') {
            final base = _hoverBaseText.putIfAbsent(hoverOf, () => {});
            if (!base.containsKey(t)) base[t] = _texts[t];
          }
        }
      }
      final res = resolveActions(actions, current);
      _visible.addAll(res.visibility);
      _texts.addAll(res.texts);
    });
  }

  void _revert(String slotId) {
    setState(() {
      _visible.addAll(_hoverBaseVisible.remove(slotId) ?? const {});
      (_hoverBaseText.remove(slotId) ?? const {}).forEach((t, v) => v == null ? _texts.remove(t) : _texts[t] = v);
    });
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

    final currentLang = _lang;

    // Dynamic color resolution
    final activePalette = !widget.allowDynamicColors ? null : resolvePalette(
      res.metadata,
      requested: widget.palette,
      prefersDark: widget.prefersDark ?? (Theme.of(context).brightness == Brightness.dark),
    );

    // Like the web component, the work does not inherit the host's text style: without a Material
    // ancestor that is Flutter's error style (red, 48px monospace, yellow double underline).
    return DefaultTextStyle(
      style: TextStyle(fontFamily: widget.fontFamily, color: const Color(0xFF000000), fontSize: 14, fontWeight: FontWeight.w400, decoration: TextDecoration.none),
      child: LayoutBuilder(
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
          _unit = containerWidth / naturalWidth;

          return AnimatedBuilder(
            animation: _blur,
            builder: (context, child) => ImageFiltered(
              key: const ValueKey('oim-language-blur'),
              // Always in the tree, only toggled: swapping the wrapper would remount the slots and restart their motion.
              enabled: _blur.value > 0,
              imageFilter: ui.ImageFilter.blur(sigmaX: 14 * _blur.value, sigmaY: 14 * _blur.value),
              child: child,
            ),
            child: Center(
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
                      if (textureEffectOf(res.metadata) case final t?)
                        Positioned.fill(
                          child: IgnorePointer(
                            child: _Texture(effect: t, unit: _unit, ink: false, overlay: true, canvas: true, child: const SizedBox.expand()),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
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

    // Web: the canvas background has z-index 0 and every other layer 1, so it is behind them all
    // even when listed last.
    bool isBackground(dynamic s) => s is Map && (s['is_background_pattern'] == true || s['id'] == 'background-pattern-slot');
    final ordered = [...rawSlots.where(isBackground), ...rawSlots.where((s) => !isBackground(s))];

    for (final raw in ordered) {
      if (raw is! Map<String, dynamic>) continue;
      final slotId = raw['id']?.toString() ?? '';

      // If this slot is inside an existing group, the group mounts it.
      if (childSlotIds.contains(slotId)) continue;

      if (raw['type'] == 'mask' && slotShownIn(raw, currentLang)) {
        final style = (raw['style'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
        final box = _maskBox(raw, style, containerWidth, containerHeight);
        final canvas = Size(containerWidth, containerHeight);
        if (style['maskMode'] == 'cutout') {
          if (widgets.isEmpty || _visible[slotId] == false) continue;
          final feather = (style['maskFeather'] as num?)?.toDouble() ?? 0;
          widgets
            ..replaceRange(0, widgets.length, [
              Positioned.fill(
                child: cutoutMask(
                  path: cutoutPath(style, box, canvas, _unit),
                  canvas: canvas,
                  feather: feather * _unit,
                  child: Stack(fit: StackFit.expand, children: List.of(widgets)),
                ),
              ),
            ]);
        } else {
          final painter = WindowMaskPainter(
            windowPath(style, box, canvas, _unit),
            maskSilhouettes(style, box, _unit),
            resolveColor(style['maskBgColorRole'] ?? style['fillColorRole'], style['maskBgColor'] ?? '#38BDF8', activePalette) ?? const Color(0xFF38BDF8),
            resolveColor(style['maskStrokeColorRole'] ?? style['strokeColorRole'], style['maskStrokeColor'] ?? '#FFFFFF', activePalette) ?? const Color(0xFFFFFFFF),
            ((style['maskStrokeWidth'] as num?) ?? 0).toDouble() * _unit,
          );
          widgets.add(Positioned.fill(child: _wrap(raw, style, CustomPaint(painter: painter), containerWidth)));
        }
        continue;
      }

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

  /// A mask's box in logical px: its position and size, as every layer's.
  Rect _maskBox(Map<String, dynamic> raw, Map<String, dynamic> style, double cw, double ch) {
    final pos = raw['position'] is List ? raw['position'] as List : const [0, 0];
    double px(Object? v) => ((v is num ? v : num.tryParse('$v')) ?? 0).toDouble() * _unit;
    final w = resolveCssUnit(style['width'], cw, ch) ?? (raw['width'] is num ? px(raw['width']) : px(raw['width_px']));
    final h = resolveCssUnit(style['height'], cw, ch) ?? (raw['height'] is num ? px(raw['height']) : px(raw['height_px']));
    return Rect.fromLTWH((pos[0] as num).toDouble() / 100 * cw, (pos[1] as num).toDouble() / 100 * ch, w, h);
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
    if (!slotShownIn(raw, currentLang)) return null;
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

      final opacity = _opacityOf(style);
      if (opacity < 1.0) {
        groupWrapper = Opacity(opacity: opacity.clamp(0.0, 1.0), child: groupWrapper);
      }

      // style.blendMode was retired in 1.12.0: readers draw the layer as normal (as the web does).

      // Check if group itself has infinite motion / parallax
      final parallaxCfg = parseInfiniteParallax(raw, style);
      if (parallaxCfg != null) {
        final plan = computeInfiniteLayerPlan(parallaxCfg, containerWidth, containerWidth, _unit);
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

      final isParallaxGrp = style['sceneLoop'] != null || style['isParallaxGroup'] == true || raw['isParallaxGroup'] == true || raw['name']?.toString().toLowerCase().contains('parallax') == true;

      if (isParallaxGrp) {
        groupWrapper = ClipRect(child: groupWrapper);
      }

      return Positioned.fill(child: _wrap(raw, style, groupWrapper, containerWidth));
    }

    if (pos == null || pos.length < 2) return null;

    final posX = (pos[0] as num).toDouble();
    final posY = (pos[1] as num).toDouble();
    var left = (posX / 100.0) * containerWidth;
    var top = (posY / 100.0) * containerHeight;

    var slotWidth = resolveCssUnit(style['width'], containerWidth, containerHeight);
    var slotHeight = resolveCssUnit(style['height'], containerWidth, containerHeight);
    final opacity = _opacityOf(style);

    Widget slotWidget;

    if (type == 'text') {
      slotWidget =
          _textFill(_buildTextSlot(raw, style, currentLang, activePalette, containerWidth, containerHeight), style, activePalette, Size(slotWidth ?? containerWidth, slotHeight ?? containerHeight));
    } else if (type == 'artistic-text') {
      final family = style['fontFamily']?.toString() ?? 'Bangers';
      final bold = style['fontWeight'] == 'bold' || (num.tryParse('${style['fontWeight']}') ?? 0) >= 700;
      final text = resolveContent(raw['content'], currentLang);
      slotWidget = artisticTextSlot(ArtisticTextModel.fromSlot(
        raw,
        style,
        text.isEmpty ? 'CARTEL' : text,
        containerWidth / _unit,
        embeddedFontName(_extractionResult?.metadata['fonts'] as List<dynamic>?, family, bold ? 700 : 400, 'normal') ?? family,
      ));
    } else if (style['backgroundType'] == 'pattern' && hasPattern(style)) {
      // The canvas background pattern (web `isBackgroundSlot`): a tile across the whole layer.
      slotWidget = OimPatternFill(style: style, palette: activePalette, unit: _unit, disableAnimations: widget.disableAnimations, background: true);
    } else if (type == 'pattern') {
      // A pattern layer: tiled and moved, cut to its `geoShape` (web `patternLayerCss`).
      slotWidget = OimPatternFill(style: style, palette: activePalette, unit: _unit, disableAnimations: widget.disableAnimations);
      final drawing = shapeDrawing(style['geoShape']);
      if (drawing != null) slotWidget = ClipPath(clipper: GeoShapeClipper(drawing: drawing), child: slotWidget);
    } else if (type == 'geo' || type == 'shape' || type == 'container') { // web: container is geo-like
      slotWidget = _buildGeoSlot(style, activePalette, slotWidth ?? 100, slotHeight ?? 100, containerWidth, containerHeight);
      // Web: a rectangle's stroke is a CSS border on a content-box element, so the box grows by
      // it on every side, keeps its vertical centre and is anchored horizontally by textAlign.
      final b = _rectBorderWidth(style, activePalette, containerWidth, containerHeight);
      if (b > 0 && slotWidth != null && slotHeight != null) {
        final align = (style['textAlign'] ?? raw['align'])?.toString() ?? 'left';
        left -= align == 'center' ? b : align == 'right' ? 2 * b : 0;
        top -= b;
        slotWidth += 2 * b;
        slotHeight += 2 * b;
      }
    } else if (type == 'image') {
      slotWidget = _buildImageSlot(raw, style, currentLang, containerWidth, containerHeight);
    } else if (type == 'svg') {
      slotWidget = _buildSvgSlot(raw, style, currentLang, activePalette);
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

    if (style['grain'] == true && !hasEffectsStack(style) && _grainTypes.contains(type)) {
      slotWidget = _Grain(style: style, child: slotWidget);
    }

    final texture = textureEffectOf(style);
    if (texture != null) {
      final ink = type == 'text' || type == 'artistic-text';
      slotWidget = _Texture(
        effect: texture,
        unit: _unit,
        // Web: text gets the tile clipped to its glyphs; svg and image an overlay masked to their pixels; the rest an overlay on the box.
        ink: ink || type == 'svg' || type == 'image',
        overlay: !ink,
        child: slotWidget,
      );
    }

    slotWidget = _applyEffects(slotWidget, style, mediaFilter: type == 'image', palette: activePalette, isText: type == 'text' || type == 'artistic-text');

    if (opacity < 1.0) {
      slotWidget = Opacity(opacity: opacity.clamp(0.0, 1.0), child: slotWidget);
    }

    // style.blendMode was retired in 1.12.0: readers draw the layer as normal (as the web does).

    // Infinite parallax check
    final parallaxCfg = parseInfiniteParallax(
      raw,
      style,
      parentSceneLoop: parentSceneLoop,
    );
    if (parallaxCfg != null) {
      final pieceW = slotWidth ?? containerWidth;
      final pieceH = slotHeight ?? containerHeight;
      final plan = computeInfiniteLayerPlan(parallaxCfg, pieceW, containerWidth, _unit);
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
      child: _wrap(raw, style, slotWidget, containerWidth),
    );
  }

  /// Around a layer, outermost last: its `style.animation` (as the web's loop
  /// wrapper), its states and actions, and its visibility with `reveal`.
  Widget _wrap(Map<String, dynamic> raw, Map<String, dynamic> style, Widget child, double canvasWidth) {
    final id = raw['id']?.toString() ?? '';
    var w = child;
    final anim = style['animation'];
    if (anim is Map<String, dynamic>) {
      w = OimMotion(animation: anim, disableAnimations: widget.disableAnimations, playCount: _plays[id] ?? 0, child: w);
    }
    // `isInteractive: false` on the widget is the web's `disableActions`.
    if (widget.isInteractive) {
      final legacy = raw['interaction'];
      if (legacy is Map && legacy['action_type'] == 'toggle_elements' && legacy['target'] is Map) {
        final t = legacy['target'] as Map;
        w = GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() {
            for (final h in (t['hide_slots'] as List?) ?? const []) {
              _visible[h.toString()] = false;
            }
            for (final s in (t['show_slots'] as List?) ?? const []) {
              _visible[s.toString()] = true;
            }
          }),
          child: MouseRegion(cursor: SystemMouseCursors.click, child: w),
        );
      }
      final i = readInteraction(raw);
      if (i.isInteractive && i.states != null) {
        w = OimInteractive(
          states: i.states!,
          onHover: (a) => _run(a, hoverOf: id),
          onLeave: () => _revert(id),
          onTap: (a) => _run(a),
          child: w,
        );
      }
    }
    return OimReveal(
      visible: _visible[id] ?? true,
      reveal: style['reveal'] is Map ? style['reveal'] as Map : null,
      canvasWidth: canvasWidth,
      disableAnimations: widget.disableAnimations,
      // Always in the tree, only its animation swaps: changing the wrapper would remount the layer.
      child: FadeTransition(opacity: _fading.contains(id) ? ReverseAnimation(_fade) : kAlwaysCompleteAnimation, child: w),
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
    String text = _texts[slot['id']?.toString()] ?? resolveContent(slot['content'], language);

    // CSS text-transform: applied to the painted text, after the mark tags are read.
    String tx(String s) => switch (style['textTransform']) { 'uppercase' => s.toUpperCase(), 'lowercase' => s.toLowerCase(), _ => s };

    final fontSize = resolveCssUnit(style['fontSize'], containerWidth, containerHeight) ?? 16.0;
    final color = resolveColor(
          style['colorRole'] ?? style['fillColorRole'],
          style['color'] ?? style['fillColor'],
          activePalette,
        ) ??
        // No colour set: the player's own default text colour (the root DefaultTextStyle), as a
        // browser paints uncoloured text black. It was white, which hid the text on light works.
        const Color(0xFF000000);

    FontWeight fontWeight = FontWeight.normal;
    final rawWeight = style['fontWeight'];
    if (rawWeight != null) {
      if (rawWeight is num) {
        final w = rawWeight.toInt();
        if (w >= 900)
          fontWeight = FontWeight.w900;
        else if (w >= 800)
          fontWeight = FontWeight.w800;
        else if (w >= 700)
          fontWeight = FontWeight.w700;
        else if (w >= 600)
          fontWeight = FontWeight.w600;
        else if (w >= 500)
          fontWeight = FontWeight.w500;
        else if (w >= 300) fontWeight = FontWeight.w300;
      } else if (rawWeight.toString().toLowerCase() == 'bold') {
        fontWeight = FontWeight.bold;
      }
    }

    final fontStyle = style['fontStyle'] == 'italic' ? FontStyle.italic : FontStyle.normal;
    // Web sets `letter-spacing` verbatim: a bare number is invalid CSS and the browser ignores it,
    // so only a length with its unit spaces the letters (the editor measured textRuns that way).
    final spacingMatch = RegExp(r'^\s*(-?[\d.]+)(px|em)\s*$').firstMatch(style['letterSpacing']?.toString() ?? '');
    final spacingValue = spacingMatch == null ? null : double.tryParse(spacingMatch[1]!);
    final letterSpacing = spacingValue == null ? null : (spacingMatch![2] == 'em' ? spacingValue * fontSize : spacingValue);
    final lineHeight = (style['lineHeight'] as num?)?.toDouble();

    final family = style['fontFamily']?.toString();
    final textStyle = TextStyle(
      fontFamily: embeddedFontName(
            _extractionResult?.metadata['fonts'] as List<dynamic>?,
            family,
            rawWeight is num ? rawWeight.toInt() : (rawWeight?.toString().toLowerCase() == 'bold' ? 700 : 400),
            style['fontStyle'] == 'italic' ? 'italic' : 'normal',
          ) ??
          family,
      fontSize: fontSize,
      color: color,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      letterSpacing: letterSpacing,
      height: lineHeight,
      // CSS puts half the leading above the glyphs and half below.
      leadingDistribution: TextLeadingDistribution.even,
      shadows: [if (shadowOf(style) != null) shadowOf(style)!, ...textEffectShadows(style, activePalette)],
    );
    final marks = style['marks'] is Map ? (style['marks'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    // Web: `.oim-slot` has `padding: 0 0.25em 0 0` (content-box) and is
    // translated by 0% (left), -50% (centre) or -100% (right) of that padded box: the text moves
    // left by none, half or all of the 0.25em.
    final shift = switch (style['textAlign'] ?? slot['align']) { 'left' => 0.0, 'right' => 0.25, _ => 0.125 };
    Widget slotPadding(Widget child) => Transform.translate(offset: Offset(-shift * (textStyle.fontSize ?? 0), 0), child: child);
    final animType = style['textAnimationType'];
    if (isTextAnimation(animType) && !widget.disableAnimations) {
      num? n(String k) => style[k] is num ? style[k] as num : null;
      return slotPadding(OimTextAnimation(
        text: tx(plainText(text, marks.keys)),
        style: textStyle,
        type: animType as String,
        speed: n('textAnimationSpeed')?.toDouble(),
        delay: n('textAnimationDelay')?.toDouble(),
        intensity: n('textAnimationIntensity')?.toDouble(),
        cursor: style['typewriterCursor'] != false,
        unit: _unit,
        textAlign: textAlignOf(style['textAlign'] ?? slot['align']),
      ));
    }
    // `style.textRuns` is ignored, as on the web: it is for readers without a paragraph engine, and
    // the editor's line breaks can disagree with the real layout (CANONICAL_SPEC.md, textRuns).
    // Web: the text slot is a flex column with justify-content: center.
    return slotPadding(Center(child: markedText(text, marks, textStyle, activePalette, tx, textAlign: textAlignOf(style['textAlign'] ?? slot['align']))));
  }

  /// `strokeWidth` in canvas units: a number is design px and scales with the canvas, like the
  /// web's border inside its scaled stage.
  double _strokeWidth(Map<String, dynamic> style, double cw, double ch) {
    final v = style['strokeWidth'];
    return v is num ? v.toDouble() * _unit : resolveCssUnit(v, cw, ch) ?? 0.0;
  }

  /// The width of the CSS border the web puts on a plain rectangle, or 0. Shapes drawn as SVG
  /// (a catalogue shape, `svgPath`, `svgRawXml`) stroke their outline instead (web `hasVector`).
  double _rectBorderWidth(Map<String, dynamic> style, OimPalette? palette, double cw, double ch) {
    final shapeName = style['drawing']?.toString() ?? style['geoDrawing']?.toString() ?? style['shape']?.toString();
    if ((shapeName != null && geoShapes[shapeName] != null) || shapeDrawing(style['geoShape']) != null) return 0;
    if (style['svgPath'] != null || style['path'] != null || style['svgRawXml'] != null) return 0;
    if (resolveColor(style['strokeColorRole'], style['strokeColor'], palette) == null) return 0;
    return _strokeWidth(style, cw, ch);
  }

  Widget _buildGeoSlot(
    Map<String, dynamic> style,
    OimPalette? activePalette,
    double slotWidth,
    double slotHeight,
    double containerWidth,
    double containerHeight,
  ) {
    var fillColor = resolveColor(style['fillColorRole'], style['fillColor'], activePalette) ?? Colors.transparent;
    // Gradient and pattern fills replace the colour; without a valid one the colour stays (web `getFillCss`).
    Widget? fillLayer;
    if (style['fillType'] == 'gradient') {
      final g = parseCssGradient(style['fillGradient'], Size(slotWidth, slotHeight));
      if (g != null) fillLayer = DecoratedBox(decoration: BoxDecoration(gradient: g));
    } else if (style['fillType'] == 'pattern' && style['fillPatternType'] != null) {
      fillLayer = OimPatternFill(style: style, palette: activePalette, unit: _unit, disableAnimations: widget.disableAnimations);
    } else if (style['fillType'] == 'image' && style['fillImage'] is String && (style['fillImage'] as String).trim().startsWith('data:image/')) {
      // 1.17.0 picture fill; like the web, only an embedded data:image counts, otherwise the colour stays.
      fillLayer = _mediaFiltered(style, OimImageFillWidget(
        imageUrl: (style['fillImage'] as String).trim(),
        crop: style['fillImageCrop'] as Map<String, dynamic>?,
        flipX: style['fillImageFlipX'] == true,
        flipY: style['fillImageFlipY'] == true,
      ));
    }
    if (fillLayer != null) fillColor = Colors.transparent;
    // Only the contract's stroke*: the web ignores border*, so a stroke drawn from them is one it never shows.
    final borderColor = resolveColor(style['strokeColorRole'], style['strokeColor'], activePalette);
    final borderWidth = _strokeWidth(style, containerWidth, containerHeight);
    final borderRadius = parseBorderRadius(style['borderRadius'], containerWidth, containerHeight);

    final shapeName = style['drawing']?.toString() ?? style['geoDrawing']?.toString() ?? style['shape']?.toString();
    final ShapeDrawing? drawing = shapeName != null ? geoShapes[shapeName] : shapeDrawing(style['geoShape']);
    final svgPath = style['svgPath']?.toString() ?? style['path']?.toString();
    // core frameSilhouette: only a custom path (no catalogue shape) is drawn in its own svgViewBox.
    final viewBox = drawing == null ? _viewBoxOf(style['svgViewBox']) : const Rect.fromLTWH(0, 0, 100, 100);
    final borderStyle = style['strokeStyle']?.toString();
    final isDashed = borderStyle == 'dashed';
    final isDotted = borderStyle == 'dotted';

    if (drawing != null || (svgPath != null && svgPath.isNotEmpty)) {
      Widget geo = CustomPaint(
        size: Size(slotWidth, slotHeight),
        painter: GeoShapePainter(
          drawing: drawing,
          svgPath: svgPath,
          viewBox: viewBox,
          fillColor: fillColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          isDashed: isDashed,
          isDotted: isDotted,
        ),
      );

      Widget? castShadow;
      final shadow = shadowOf(style);
      if (shadow != null) {
        // CSS drop-shadow follows the silhouette; a BoxShadow is the slot's rectangle (the dark square behind a circle).
        Color? tint(Color? c) => c == null ? null : shadow.color.withValues(alpha: shadow.color.a * c.a);
        Widget cast = CustomPaint(
          size: Size(slotWidth, slotHeight),
          painter: GeoShapePainter(
            drawing: drawing,
            svgPath: svgPath,
            viewBox: viewBox,
            fillColor: tint(fillLayer == null ? fillColor : Colors.black),
            borderColor: tint(borderColor),
            borderWidth: borderWidth,
            isDashed: isDashed,
            isDotted: isDotted,
          ),
        );
        if (shadow.blurRadius > 0) {
          cast = ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: shadow.blurSigma, sigmaY: shadow.blurSigma, tileMode: TileMode.decal), child: cast);
        }
        castShadow = Transform.translate(offset: shadow.offset, child: cast);
      }
      if (fillLayer == null && castShadow == null) return geo;
      // The shadow goes under the picture fill, not over it.
      return Stack(fit: StackFit.expand, clipBehavior: Clip.none, children: [
        if (castShadow != null) castShadow,
        if (fillLayer != null) ClipPath(clipper: GeoShapeClipper(drawing: drawing, svgPath: svgPath, viewBox: viewBox), child: fillLayer),
        geo,
      ]);
    }

    // Default rectangle
    final dashed = isDashed || isDotted;
    final rect = Container(
      foregroundDecoration: dashed && borderWidth > 0 && borderColor != null ? _DashedBorder(color: borderColor, width: borderWidth, radius: borderRadius, dotted: isDotted) : null,
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: borderRadius,
        boxShadow: shadowOf(style) == null ? null : [shadowOf(style)!],
        border: borderWidth > 0 && borderColor != null && !dashed ? Border.all(color: borderColor, width: borderWidth) : null,
      ),
    );
    if (fillLayer == null) return rect;
    return Stack(fit: StackFit.expand, children: [
      rect,
      ClipRRect(borderRadius: borderRadius, child: fillLayer),
      if (borderWidth > 0 && borderColor != null && !dashed)
        DecoratedBox(
          decoration: BoxDecoration(borderRadius: borderRadius, border: Border.all(color: borderColor, width: borderWidth)),
        ),
    ]);
  }

  /// A text's gradient or pattern fill paints its glyphs (web `background-clip: text`).
  Widget _textFill(Widget text, Map<String, dynamic> style, OimPalette? palette, Size size) {
    if (style['fillType'] == 'gradient') {
      final g = parseCssGradient(style['fillGradient'], size);
      if (g == null) return text;
      return ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: g.createShader, child: text);
    }
    if (style['fillType'] == 'pattern' && style['fillPatternType'] != null) {
      final fill = OimPatternFill(style: style, palette: palette, unit: _unit, disableAnimations: widget.disableAnimations);
      // The glyphs as a mask, the tile drawn only inside them, in one isolated layer.
      return _BlendMask(
        mode: BlendMode.srcOver,
        child: Stack(fit: StackFit.passthrough, children: [
          text,
          Positioned.fill(child: _BlendMask(mode: BlendMode.srcIn, child: fill)),
        ]),
      );
    }
    return text;
  }

  /// An icon or vector layer: its markup in `content` (a language map, like a text's), or `svgRawXml`.
  Widget _buildSvgSlot(Map raw, Map<String, dynamic> style, String language, OimPalette? palette) {
    var xml = resolveContent(raw['content'], language);
    if (!xml.contains('<svg')) xml = style['svgRawXml']?.toString() ?? '';
    if (!xml.contains('<svg')) return const SizedBox.shrink();
    // Web: `currentColor` strokes take the layer's stroke colour; explicit colours stay.
    final stroke = resolveColor(style['strokeColorRole'], style['strokeColor'], palette);
    return SvgPicture.string(
      xml,
      fit: BoxFit.contain,
      theme: SvgTheme(currentColor: stroke ?? const Color(0xFF000000)),
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
  }

  Widget _buildImageSlot(
    Map<String, dynamic> raw,
    Map<String, dynamic> style,
    String language,
    double containerWidth,
    double containerHeight,
  ) {
    // Content may be a language map (`{"*": "data:image/..."}`), like a text's.
    final resolved = resolveContent(raw['content'], language);
    final imageUri = resolved.isNotEmpty ? resolved : style['src']?.toString();
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

/// `svgViewBox` ("minX minY width height"), or core's default 0 0 100 100 when absent or invalid.
Rect _viewBoxOf(dynamic raw) {
  final n = (raw?.toString() ?? '').trim().split(RegExp(r'[\s,]+')).map(double.tryParse).toList();
  if (n.length != 4 || n.any((v) => v == null) || n[2]! <= 0 || n[3]! <= 0) return const Rect.fromLTWH(0, 0, 100, 100);
  return Rect.fromLTWH(n[0]!, n[1]!, n[2]!, n[3]!);
}

/// Contract: style.opacity is a percentage, 0..100.
double _opacityOf(Map<String, dynamic> style) => (((style['opacity'] as num?)?.toDouble() ?? 100) / 100).clamp(0.0, 1.0);

/// An image fill's media filter (web image-fill.ts: on the <img>, inside the clip).
Widget _mediaFiltered(Map<String, dynamic> style, Widget picture) {
  final filter = parseCssFilter(mediaFilterCss(style));
  var w = picture;
  if (filter?.matrix != null) w = ColorFiltered(colorFilter: ColorFilter.matrix(filter!.matrix!), child: w);
  final sigma = filter?.blurSigma ?? 0;
  if (sigma > 0) w = ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.decal), child: w);
  return w;
}

/// Everything the style says about the slot as a whole, in the order the player
/// applies it: filter chain, layer blur, flip, rotation. Opacity and blend mode wrap it after.
Widget _applyEffects(Widget child, Map<String, dynamic> style, {bool mediaFilter = false, OimPalette? palette, bool? isText}) {
  var w = child;
  // Web: media filters belong to image layers (and image fills, see _mediaFiltered), never to the rest.
  final filter = mediaFilter ? parseCssFilter(mediaFilterCss(style)) : null;
  if (filter?.matrix != null) {
    w = ColorFiltered(colorFilter: ColorFilter.matrix(filter!.matrix!), child: w);
  }
  final layerBlur = hasEffectsStack(style) ? 0.0 : (style['layerBlur'] as num?)?.toDouble() ?? (style['blur'] as num?)?.toDouble() ?? 0;
  final sigma = (filter?.blurSigma ?? 0) + (layerBlur > 0 ? layerBlur : 0);
  if (sigma > 0) {
    w = ImageFiltered(
      imageFilter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.decal),
      child: w,
    );
  }
  // Groups pass no isText: the web stack is per slot.
  if (isText != null) w = layerEffects(w, style, palette, isText: isText);
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
/// The web's `GRAIN_LAYER_TYPES`: groups and Lottie take none.
const _grainTypes = {'text', 'artistic-text', 'geo', 'shape', 'svg', 'draw', 'image', 'pattern'};

/// Grain over a layer: the noise tile cut to the layer's own alpha, at the
/// intensity's opacity, blended with the layer (web `buildLayerGrainFilter`).
class _Grain extends StatefulWidget {
  final Map<String, dynamic> style;
  final Widget child;
  const _Grain({required this.style, required this.child});

  @override
  State<_Grain> createState() => _GrainState();
}

class _GrainState extends State<_Grain> {
  ui.Image? _tile;
  double _ratio = 1;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  @override
  void didUpdateWidget(_Grain old) {
    super.didUpdateWidget(old);
    if (old.style['grainSize'] != widget.style['grainSize']) _load();
  }

  void _load() {
    _ratio = MediaQuery.maybeDevicePixelRatioOf(context)?.clamp(1, 3).roundToDouble() ?? 1;
    grainTile(widget.style['grainSize'] as num?, _ratio).then((img) {
      if (mounted) setState(() => _tile = img);
    });
  }

  @override
  Widget build(BuildContext context) {
    final tile = _tile;
    if (tile == null) return widget.child;
    final blend = switch (widget.style['grainBlend']) {
      'soft-light' => BlendMode.softLight,
      'multiply' => BlendMode.multiply,
      _ => BlendMode.overlay,
    };
    final m = Matrix4.diagonal3Values(1 / _ratio, 1 / _ratio, 1);
    return _GrainPaint(
      shader: ImageShader(tile, TileMode.repeated, TileMode.repeated, m.storage),
      blend: blend,
      opacity: grainOpacity(widget.style['grainIntensity'] as num?),
      child: widget.child,
    );
  }
}

/// The `texture` effect (web ImageEngine): the preset tile repeated at `tileSize * scale` canvas
/// units and blended with the layer. [overlay] tiles also fade by the intensity, as the web's
/// overlay div does; the canvas-level one draws its tile at the preset's default intensity.
class _Texture extends StatefulWidget {
  final Map<String, dynamic> effect;
  final double unit;
  final bool ink, overlay, canvas;
  final Widget child;
  const _Texture({required this.effect, required this.unit, required this.ink, required this.overlay, this.canvas = false, required this.child});

  @override
  State<_Texture> createState() => _TextureState();
}

class _TextureState extends State<_Texture> {
  ui.Image? _tile;
  double _logical = 0;
  String _key = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  @override
  void didUpdateWidget(_Texture old) {
    super.didUpdateWidget(old);
    _load();
  }

  void _load() {
    final e = widget.effect;
    final preset = e['preset'].toString();
    final def = texturePresets[preset]!;
    final scale = e['scale'] is num && e['scale'] != 0 ? (e['scale'] as num).toDouble() : 1.0;
    final ratio = MediaQuery.maybeDevicePixelRatioOf(context)?.clamp(1, 3).toDouble() ?? 1;
    _logical = def.size * scale * widget.unit;
    final intensity = (!widget.canvas && e['intensity'] is num ? (e['intensity'] as num).toDouble() : def.intensity) / 100;
    final color = resolveColor(null, e['color'] ?? '#ffffff', null) ?? const Color(0xFFFFFFFF);
    final px = (_logical * ratio).round();
    final key = '$preset|$px|$intensity|${color.toARGB32()}';
    if (key == _key) return;
    _key = key;
    textureTile(preset, color, intensity, px)?.then((img) {
      if (mounted && key == _key) setState(() => _tile = img);
    });
  }

  @override
  Widget build(BuildContext context) {
    final tile = _tile;
    if (tile == null || _logical <= 0) return widget.child;
    final e = widget.effect;
    final def = texturePresets[e['preset'].toString()]!;
    final k = _logical / tile.width;
    final fade = widget.overlay ? ((e['intensity'] is num ? (e['intensity'] as num).toDouble() : def.intensity) / 100).clamp(0.0, 1.0) : 1.0;
    return _GrainPaint(
      shader: ImageShader(tile, TileMode.repeated, TileMode.repeated, Matrix4.diagonal3Values(k, k, 1).storage),
      blend: blendModeOf(e['blend'] ?? def.blend) ?? BlendMode.srcOver,
      opacity: fade,
      ink: widget.ink,
      child: widget.child,
    );
  }
}

class _GrainPaint extends SingleChildRenderObjectWidget {
  final Shader shader;
  final BlendMode blend;
  final double opacity;
  final bool ink;
  const _GrainPaint({required this.shader, required this.blend, required this.opacity, this.ink = true, super.child});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderGrain(shader, blend, opacity)..ink = ink;

  @override
  void updateRenderObject(BuildContext context, _RenderGrain r) {
    r
      ..shader = shader
      ..blend = blend
      ..opacity = opacity
      ..ink = ink
      ..markNeedsPaint();
  }
}

/// Paints the layer, then over it, in one layer blended with [blend], the
/// layer again as a mask with the noise drawn `srcIn`: the noise only where
/// there is ink, at [opacity]. All on one canvas, so the blend applies.
class _RenderGrain extends RenderProxyBox {
  Shader shader;
  BlendMode blend;
  double opacity;
  /// False: the noise covers the whole box instead of only the layer's ink.
  bool ink = true;
  _RenderGrain(this.shader, this.blend, this.opacity);

  @override
  void paint(PaintingContext context, Offset offset) {
    super.paint(context, offset);
    final child = this.child;
    if (!ink) {
      context.canvas
        ..save()
        ..translate(offset.dx, offset.dy)
        ..drawRect(Offset.zero & size, Paint()..shader = shader..blendMode = blend..color = Color.fromRGBO(0, 0, 0, opacity))
        ..restore();
      return;
    }
    // shortcut: a child on its own compositing layer cannot be used as a mask here; it keeps no grain.
    if (child == null || child.needsCompositing) return;
    final canvas = context.canvas;
    final bounds = offset & size;
    canvas.saveLayer(bounds, Paint()..blendMode = blend);
    context.paintChild(child, offset);
    canvas.save();
    canvas.translate(offset.dx, offset.dy);
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = shader
        ..blendMode = BlendMode.srcIn
        ..color = Color.fromRGBO(0, 0, 0, opacity),
    );
    canvas.restore();
    canvas.restore();
  }
}

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
