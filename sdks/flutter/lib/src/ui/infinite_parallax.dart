/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'package:flutter/material.dart';

/// Configuration of an infinite moving background or parallax layer.
class InfiniteLayerConfig {
  final double speedPxSec;
  final String direction; // 'left_to_right' | 'right_to_left'
  final bool mirror;
  final bool pauseOnHover;

  const InfiniteLayerConfig({
    required this.speedPxSec,
    this.direction = 'right_to_left',
    this.mirror = true,
    this.pauseOnHover = false,
  });
}

/// Render and layout plan for an infinite layer.
///
/// Ported 1:1 from canonical `@oim-media/core/src/parallaxCss.ts` (`infiniteLayerPlan`).
class InfiniteLayerPlan {
  final bool duplicate;
  final int copies;
  final double unitPx;
  final double durationSeconds;
  final String direction;
  final bool mirror;
  final bool pauseOnHover;

  const InfiniteLayerPlan({
    required this.duplicate,
    required this.copies,
    required this.unitPx,
    required this.durationSeconds,
    required this.direction,
    required this.mirror,
    required this.pauseOnHover,
  });

  static const empty = InfiniteLayerPlan(
    duplicate: false,
    copies: 0,
    unitPx: 0.0,
    durationSeconds: 0.0,
    direction: 'right_to_left',
    mirror: false,
    pauseOnHover: false,
  );
}

/// Computes the exact infinite parallax plan for a moving layer.
///
/// Ensures seamless looping by constructing full unit tiles (`unitPx = pieceWidth * (mirror ? 2 : 1)`)
/// and repeating enough copies to cover the canvas (`canvasWidth`) throughout the entire lap.
InfiniteLayerPlan computeInfiniteLayerPlan(
  InfiniteLayerConfig cfg,
  double pieceWidthPx, [
  double? canvasWidthPx,
]) {
  if (cfg.speedPxSec <= 0 ||
      !cfg.speedPxSec.isFinite ||
      pieceWidthPx <= 0 ||
      !pieceWidthPx.isFinite) {
    return InfiniteLayerPlan.empty;
  }

  final piecesPerUnit = cfg.mirror ? 2 : 1;
  final unitPx = pieceWidthPx * piecesPerUnit;
  final canvas = (canvasWidthPx != null && canvasWidthPx.isFinite && canvasWidthPx > 0)
      ? canvasWidthPx
      : pieceWidthPx;

  int copies = (canvas / pieceWidthPx).ceil() + piecesPerUnit;
  if (cfg.mirror && copies % 2 != 0) {
    copies += 1;
  }

  final duration = unitPx / cfg.speedPxSec;
  if (!duration.isFinite || duration <= 0) {
    return InfiniteLayerPlan.empty;
  }

  return InfiniteLayerPlan(
    duplicate: true,
    copies: copies,
    unitPx: unitPx,
    durationSeconds: duration,
    direction: cfg.direction,
    mirror: cfg.mirror,
    pauseOnHover: cfg.pauseOnHover,
  );
}

/// Parses infinite parallax or sceneLoop configuration from a slot and style.
InfiniteLayerConfig? parseInfiniteParallax(
  Map<String, dynamic> slot,
  Map<String, dynamic> style, {
  Map<String, dynamic>? parentSceneLoop,
}) {
  final groupLoop = parentSceneLoop ?? (style['sceneLoop'] as Map<String, dynamic>?);
  final parallaxCfg = (slot['parallax'] as Map<String, dynamic>?) ??
      (style['parallax'] as Map<String, dynamic>?);

  if (parallaxCfg != null && parallaxCfg['enabled'] == true) {
    final inf = (parallaxCfg['infinite'] as Map<String, dynamic>?) ?? {};
    final loopDisabled = inf['enabled'] == false;
    if (loopDisabled) return null;

    final rawSpeed = parallaxCfg['speedPxSec'] ??
        inf['speedPxSec'] ??
        inf['speed_px_sec'] ??
        (parallaxCfg['mode'] == 'infinite_horizontal'
            ? (parallaxCfg['speed'] ?? 20)
            : 0);
    final speed = (rawSpeed as num?)?.toDouble() ?? 0.0;
    if (speed <= 0) return null;

    final direction = (parallaxCfg['direction'] ?? inf['direction'] ?? 'right_to_left').toString();
    final mirror = parallaxCfg['mirror'] ??
        parallaxCfg['seamlessTile'] ??
        inf['mirror'] ??
        inf['seamlessTile'] ??
        inf['seamless_tile'] ??
        true;
    final pauseOnHover = parallaxCfg['pauseOnHover'] ??
        inf['pauseOnHover'] ??
        inf['pause_on_hover'] ??
        false;

    return InfiniteLayerConfig(
      speedPxSec: speed,
      direction: direction == 'left_to_right' ? 'left_to_right' : 'right_to_left',
      mirror: mirror == true,
      pauseOnHover: pauseOnHover == true,
    );
  }

  if (groupLoop != null) {
    final rawSpeed = groupLoop['speedPxSec'] ?? groupLoop['speed_px_sec'];
    final baseSpeed = (rawSpeed as num?)?.toDouble() ?? 0.0;
    if (baseSpeed <= 0) return null;

    final depth = (style['loopDepth'] as num?)?.toDouble() ??
        (style['parallaxDepth'] as num?)?.toDouble() ??
        1.0;
    final speed = baseSpeed * depth;
    if (speed <= 0) return null;

    final direction = (groupLoop['direction'] ?? 'right_to_left').toString();
    final mirror = groupLoop['mirror'] ?? groupLoop['seamlessTile'] ?? true;
    final pauseOnHover = groupLoop['pauseOnHover'] ?? groupLoop['pause_on_hover'] ?? false;

    return InfiniteLayerConfig(
      speedPxSec: speed,
      direction: direction == 'left_to_right' ? 'left_to_right' : 'right_to_left',
      mirror: mirror == true,
      pauseOnHover: pauseOnHover == true,
    );
  }

  return null;
}

/// An animated horizontal track that loops child pieces infinitely.
class InfiniteParallaxTrack extends StatefulWidget {
  final InfiniteLayerPlan plan;
  final double pieceWidth;
  final double pieceHeight;
  final Widget child;
  final bool disableAnimations;

  const InfiniteParallaxTrack({
    super.key,
    required this.plan,
    required this.pieceWidth,
    required this.pieceHeight,
    required this.child,
    this.disableAnimations = false,
  });

  @override
  State<InfiniteParallaxTrack> createState() => _InfiniteParallaxTrackState();
}

class _InfiniteParallaxTrackState extends State<InfiniteParallaxTrack>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    final durationMs = (widget.plan.durationSeconds * 1000).round();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: durationMs > 0 ? durationMs : 1000),
    );

    if (widget.plan.duplicate && !widget.disableAnimations) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(InfiniteParallaxTrack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.plan.durationSeconds != oldWidget.plan.durationSeconds) {
      final durationMs = (widget.plan.durationSeconds * 1000).round();
      _controller.duration = Duration(milliseconds: durationMs > 0 ? durationMs : 1000);
      if (widget.plan.duplicate && !widget.disableAnimations && !_isHovered) {
        _controller.repeat();
      }
    }

    if (widget.disableAnimations != oldWidget.disableAnimations) {
      if (widget.disableAnimations) {
        _controller.stop();
        _controller.value = 0.0;
      } else if (widget.plan.duplicate && !_isHovered) {
        _controller.repeat();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onMouseEnter(PointerEvent event) {
    if (!widget.plan.pauseOnHover) return;
    setState(() => _isHovered = true);
    _controller.stop();
  }

  void _onMouseExit(PointerEvent event) {
    if (!widget.plan.pauseOnHover) return;
    setState(() => _isHovered = false);
    if (!widget.disableAnimations && widget.plan.duplicate) {
      _controller.repeat();
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    if (!plan.duplicate || plan.copies <= 0 || widget.disableAnimations) {
      return SizedBox(
        width: widget.pieceWidth,
        height: widget.pieceHeight,
        child: widget.child,
      );
    }

    final pieces = <Widget>[];
    final effectivePieceWidth = widget.pieceWidth;

    for (int i = 0; i < plan.copies; i++) {
      final isOdd = i % 2 == 1;
      Widget pieceContent;
      if (isOdd && plan.mirror) {
        pieceContent = Transform(
          alignment: Alignment.center,
          transform: Matrix4.diagonal3Values(-1.0, 1.0, 1.0),
          child: SizedBox(
            width: effectivePieceWidth,
            height: widget.pieceHeight,
            child: widget.child,
          ),
        );
      } else {
        pieceContent = SizedBox(
          width: effectivePieceWidth,
          height: widget.pieceHeight,
          child: widget.child,
        );
      }
      pieces.add(pieceContent);
    }

    Widget track = AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final val = _controller.value;
        final double dx;
        if (plan.direction == 'left_to_right') {
          dx = -(1.0 - val) * plan.unitPx;
        } else {
          dx = -val * plan.unitPx;
        }

        return Transform.translate(
          offset: Offset(dx, 0.0),
          child: OverflowBox(
            alignment: Alignment.topLeft,
            minWidth: 0.0,
            maxWidth: double.infinity,
            minHeight: widget.pieceHeight,
            maxHeight: widget.pieceHeight,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: pieces,
            ),
          ),
        );
      },
    );

    if (plan.pauseOnHover) {
      track = MouseRegion(
        onEnter: _onMouseEnter,
        onExit: _onMouseExit,
        child: track,
      );
    }

    return ClipRect(
      child: SizedBox(
        width: widget.pieceWidth,
        height: widget.pieceHeight,
        child: track,
      ),
    );
  }
}
