// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

import '../ui/dynamic_colors.dart';

/// Whether [metadata] is an OIM 2.0 document (`oim: "2.*"` or `layers` without `slots`).
bool isV2Document(Map<String, dynamic> metadata) {
  final oim = metadata['oim'];
  if (oim is String && oim.startsWith('2.')) return true;
  return metadata['layers'] is List && metadata['slots'] == null;
}

/// Normalizes an OIM 2.0 document into the slot-based map structure consumed by
/// `OimPlayer` and the existing rendering helpers. Returns `1.x` metadata unchanged.
Map<String, dynamic> normalizeV2Metadata(Map<String, dynamic> metadata) {
  if (!isV2Document(metadata)) return metadata;

  final out = Map<String, dynamic>.from(metadata);
  final rawCanvas = metadata['canvas'] is Map ? (metadata['canvas'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
  final canvasW = (rawCanvas['width'] as num?)?.toDouble() ?? (rawCanvas['natural_width'] as num?)?.toDouble() ?? 800.0;
  final canvasH = (rawCanvas['height'] as num?)?.toDouble() ?? (rawCanvas['natural_height'] as num?)?.toDouble() ?? 600.0;
  final safeW = canvasW > 0 ? canvasW : 800.0;
  final safeH = canvasH > 0 ? canvasH : 600.0;

  out['canvas'] = {
    ...rawCanvas,
    'width': safeW,
    'height': safeH,
    'natural_width': safeW,
    'natural_height': safeH,
  };

  final resources = metadata['resources'] is Map ? (metadata['resources'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
  final variables = metadata['variables'] is Map ? (metadata['variables'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
  final palettesInfo = _extractPalettesAndDefaults(variables);
  if (palettesInfo.palettes.isNotEmpty && out['palettes'] == null) {
    out['palettes'] = palettesInfo.palettes;
  }
  if (palettesInfo.defaultPalette != null && out['defaultPalette'] == null) {
    out['defaultPalette'] = palettesInfo.defaultPalette;
  }

  final slots = <Map<String, dynamic>>[];
  var hasBaseLayer = false;

  // Canvas background fills (placed at bottom under layers).
  final canvasFills = rawCanvas['fills'];
  if (canvasFills is List && canvasFills.isNotEmpty) {
    final bgStyle = <String, dynamic>{
      'width': '100%',
      'height': '100%',
    };
    _applyFills(canvasFills, bgStyle, resources, palettesInfo.defaults, isText: false);
    if (bgStyle['fillColor'] != null ||
        bgStyle['fillColorRole'] != null ||
        bgStyle['fillGradient'] != null ||
        bgStyle['fillPatternType'] != null ||
        bgStyle['fillImage'] != null) {
      slots.add({
        'id': 'v2-canvas-bg',
        'type': 'geo',
        'position': [0.0, 0.0],
        'width_px': safeW,
        'height_px': safeH,
        'style': bgStyle,
      });
    }
  }

  final rawLayers = metadata['layers'] is List ? metadata['layers'] as List : const [];
  for (var i = 0; i < rawLayers.length; i++) {
    final layer = rawLayers[i];
    if (layer is! Map) continue;
    final foundBase = _appendLayer(
      layer.cast<String, dynamic>(),
      slots: slots,
      canvasW: safeW,
      canvasH: safeH,
      resources: resources,
      varDefaults: palettesInfo.defaults,
      indexHint: i,
    );
    if (foundBase) hasBaseLayer = true;
  }

  out['slots'] = slots;
  out['_v2HasBaseLayer'] = hasBaseLayer;
  return out;
}

class _PalettesAndDefaults {
  final Map<String, Map<String, String>> palettes;
  final String? defaultPalette;
  final Map<String, dynamic> defaults;
  const _PalettesAndDefaults(this.palettes, this.defaultPalette, this.defaults);
}

_PalettesAndDefaults _extractPalettesAndDefaults(Map<String, dynamic> variables) {
  final palettes = <String, Map<String, String>>{};
  final defaults = <String, dynamic>{};
  final values = variables['values'] is Map ? (variables['values'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
  final varDefaults = variables['defaults'] is Map ? (variables['defaults'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
  final defaultPalette = varDefaults['palette']?.toString();

  final roleSet = dynamicColorRoles.toSet();
  for (final entry in values.entries) {
    final k = entry.key;
    final v = entry.value;
    if (v is Map) {
      final modePref = varDefaults[k]?.toString() ?? defaultPalette;
      final picked = (modePref != null ? v[modePref] : null) ?? v['default'] ?? v['light'] ?? v['dark'] ?? (v.isNotEmpty ? v.values.first : null);
      if (picked != null) defaults[k] = picked;
      if (roleSet.contains(k)) {
        for (final modeEntry in v.entries) {
          final mode = modeEntry.key.toString();
          if (modeEntry.value is String) {
            palettes.putIfAbsent(mode, () => <String, String>{})[k] = modeEntry.value as String;
          }
        }
      }
    } else if (v != null) {
      defaults[k] = v;
    }
  }
  return _PalettesAndDefaults(palettes, defaultPalette, defaults);
}

dynamic _resolveRef(dynamic item, Map<String, dynamic> resources) {
  if (item is Map && item['ref'] is String) {
    return resources[item['ref']] ?? item;
  }
  return item;
}

String? _resolveColorRole(dynamic raw) {
  if (raw is Map && raw['var'] is String) {
    final v = raw['var'] as String;
    if (dynamicColorRoles.contains(v)) return v;
  }
  return null;
}

String? _resolveColorValue(dynamic raw, Map<String, dynamic> varDefaults) {
  if (raw is String) return raw;
  if (raw is Map) {
    final varName = raw['var']?.toString();
    if (varName != null && varDefaults[varName] is String) {
      return varDefaults[varName] as String;
    }
    if (raw['fallback'] is String) return raw['fallback'] as String;
    if (raw['value'] is String) return raw['value'] as String;
  }
  return null;
}

String? _resolveImageSrc(dynamic rawSrc, Map<String, dynamic> resources) {
  final resolved = _resolveRef(rawSrc, resources);
  if (resolved is String) return resolved;
  if (resolved is Map && resolved['src'] is String) return resolved['src'] as String;
  return null;
}

String _cqw(num px, double canvasW) => '${(px.toDouble() / canvasW) * 100}cqw';
String _cqh(num px, double canvasH) => '${(px.toDouble() / canvasH) * 100}cqh';

bool _appendLayer(
  Map<String, dynamic> layer, {
  required List<Map<String, dynamic>> slots,
  required double canvasW,
  required double canvasH,
  required Map<String, dynamic> resources,
  required Map<String, dynamic> varDefaults,
  required int indexHint,
  String? groupId,
}) {
  final rawType = layer['type']?.toString() ?? 'shape';
  final id = layer['id']?.toString() ?? 'layer-$indexHint';
  final box = layer['box'] is Map ? (layer['box'] as Map).cast<String, dynamic>() : const <String, dynamic>{};

  // `oim:base` is rendered directly from the PNG IDAT pixels underneath live layers.
  if (rawType == 'image') {
    final img = layer['image'] is Map ? (layer['image'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final src = _resolveImageSrc(img['src'], resources);
    if (src == 'oim:base') return true;
  }

  final style = <String, dynamic>{};
  if (groupId != null) style['groupId'] = groupId;
  if (layer['opacity'] is num) {
    style['opacity'] = ((layer['opacity'] as num).toDouble() * 100).clamp(0, 100);
  }
  if (layer['visible'] == false) {
    style['isVisible'] = false;
  }
  if (layer['blend'] is String && layer['blend'] != 'normal') {
    style['v2Blend'] = layer['blend'];
  }
  if (box['rotation'] is num) style['rotation'] = box['rotation'];
  if (box['flipX'] == true) style['flipX'] = true;
  if (box['flipY'] == true) style['flipY'] = true;

  final wPx = (box['width'] as num?)?.toDouble();
  final hPx = (box['height'] as num?)?.toDouble();
  if (wPx != null) style['width'] = _cqw(wPx, canvasW);
  if (hPx != null) style['height'] = _cqh(hPx, canvasH);

  final xPx = (box['x'] as num?)?.toDouble() ?? 0.0;
  final yPx = (box['y'] as num?)?.toDouble() ?? 0.0;
  final xPct = (xPx / canvasW) * 100.0;
  final yPct = (yPx / canvasH) * 100.0;

  if (layer['corners'] != null) {
    final c = layer['corners'];
    if (c is num) {
      style['borderRadius'] = _cqw(c, canvasW);
    } else if (c is List && c.length == 4) {
      style['borderRadius'] = c.map((e) => e is num ? _cqw(e, canvasW) : '0px').join(' ');
    }
  }

  if (layer['effects'] is List) {
    _applyEffects(layer['effects'] as List, style, varDefaults);
  }
  if (layer['animations'] is List) {
    _applyAnimations(layer['animations'] as List, style, rawType);
  }
  if (layer['motion'] is Map) {
    final loop = (layer['motion'] as Map)['loop'];
    if (loop is Map) style['sceneLoop'] = loop;
  }

  final slot = <String, dynamic>{
    'id': id,
    if (layer['name'] != null) 'name': layer['name'],
    'position': [xPct, yPct],
    if (wPx != null) 'width_px': wPx,
    if (hPx != null) 'height_px': hPx,
    if (layer['languages'] != null) 'languages': layer['languages'],
    if (layer['visible'] == false) 'isVisible': false,
  };

  if (layer['interactions'] is List) {
    final states = _buildStates(layer['interactions'] as List);
    if (states != null) {
      slot['isInteractive'] = true;
      slot['states'] = states;
    }
  }

  if (rawType == 'group') {
    slot['type'] = 'group';
    // The group widget fills the canvas, so its rotation needs the box centre as pivot (web: around the box).
    if (wPx != null && hPx != null) {
      style['rotationPivot'] = [(xPx + wPx / 2) / canvasW * 100.0, (yPx + hPx / 2) / canvasH * 100.0];
    }
    slot['style'] = style;
    slots.add(slot);
    var foundBase = false;
    final children = layer['children'] is List ? layer['children'] as List : const [];
    for (var i = 0; i < children.length; i++) {
      final child = children[i];
      if (child is Map) {
        if (_appendLayer(
          child.cast<String, dynamic>(),
          slots: slots,
          canvasW: canvasW,
          canvasH: canvasH,
          resources: resources,
          varDefaults: varDefaults,
          indexHint: i,
          groupId: id,
        )) {
          foundBase = true;
        }
      }
    }
    return foundBase;
  }

  if (layer['mask'] is Map) {
    final mask = (layer['mask'] as Map).cast<String, dynamic>();
    slot['type'] = 'mask';
    style['maskMode'] = mask['mode'] ?? 'window';
    if (mask['feather'] is num) style['maskFeather'] = mask['feather'];
    if (mask['scope'] == 'group') style['maskCoverage'] = 'container';
    _applyGeometry(layer['geometry'], style, isMask: true);
    if (style['svgPath'] != null) style['maskSvgPath'] = style['svgPath'];
    if (style['geoShape'] != null) style['maskShape'] = style['geoShape'];
    _applyFills(layer['fills'], style, resources, varDefaults, isText: false);
    if (style['fillColor'] != null) style['maskBgColor'] = style['fillColor'];
    if (style['fillColorRole'] != null) style['maskBgColorRole'] = style['fillColorRole'];
    _applyStrokes(layer['strokes'], style, varDefaults);
    if (style['strokeColor'] != null) style['maskStrokeColor'] = style['strokeColor'];
    if (style['strokeColorRole'] != null) style['maskStrokeColorRole'] = style['strokeColorRole'];
    if (style['strokeWidth'] != null) style['maskStrokeWidth'] = style['strokeWidth'];
    slot['style'] = style;
    slots.add(slot);
    return false;
  }

  if (rawType == 'text') {
    final text = layer['text'] is Map ? (layer['text'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final font = text['font'] is Map ? (text['font'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    slot['content'] = text['content'] ?? const <String, dynamic>{};
    if (text['align'] != null) {
      slot['align'] = text['align'];
      style['textAlign'] = text['align'];
    }
    if (font['family'] != null) style['fontFamily'] = font['family'];
    if (font['size'] is num) style['fontSize'] = _cqw(font['size'] as num, canvasW);
    if (font['weight'] != null) style['fontWeight'] = font['weight'];
    if (font['italic'] == true) style['fontStyle'] = 'italic';
    if (text['lineHeight'] is num) style['lineHeight'] = text['lineHeight'];
    if (text['letterSpacing'] is num) style['letterSpacing'] = '${text['letterSpacing']}em';
    if (text['transform'] != null) style['textTransform'] = text['transform'];
    if (text['decoration'] != null) style['textDecoration'] = text['decoration'];
    if (text['maxWidth'] is num) style['maxWidth'] = _cqw(text['maxWidth'] as num, canvasW);
    if (text['marks'] is Map) style['marks'] = text['marks'];
    if (text['highlight'] is Map) style['textHighlight'] = text['highlight'];
    if (text['dropCap'] is Map) style['dropCap'] = text['dropCap'];
    _applyFills(layer['fills'], style, resources, varDefaults, isText: true);
    _applyTextStrokes(layer['strokes'], style, varDefaults);

    if (text['artistic'] is Map) {
      slot['type'] = 'artistic-text';
      final art = (text['artistic'] as Map).cast<String, dynamic>();
      if (art['preset'] != null) style['artisticPreset'] = art['preset'];
      if (art['curve'] is Map) {
        final curve = art['curve'] as Map;
        if (curve['type'] != null) style['curveType'] = curve['type'];
        if (curve['amount'] != null) style['curveAmount'] = curve['amount'];
      }
      if (art['extrusion'] is Map) {
        final ext = art['extrusion'] as Map;
        if (ext['depth'] != null) style['extrusionDepth'] = ext['depth'];
        if (ext['angle'] != null) style['extrusionAngle'] = ext['angle'];
        if (ext['color'] != null) style['extrusionColor'] = ext['color'];
        if (ext['shading'] != null) style['extrusionShading'] = ext['shading'];
      }
    } else {
      slot['type'] = 'text';
    }
  } else if (rawType == 'image') {
    final img = layer['image'] is Map ? (layer['image'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final src = _resolveImageSrc(img['src'], resources);
    slot['type'] = 'image';
    if (src != null) {
      slot['content'] = {'*': src};
      style['src'] = src;
    }
    if (img['crop'] is Map) style['imageCrop'] = img['crop'];
    if (img['flipX'] == true) style['flipX'] = true;
    if (img['flipY'] == true) style['flipY'] = true;
    if (img['filters'] is Map) _applyMediaFilters(img['filters'] as Map, style);
  } else if (rawType == 'lottie') {
    final lot = layer['lottie'] is Map ? (layer['lottie'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    slot['type'] = 'lottie';
    if (lot['src'] != null) slot['content'] = {'*': lot['src']};
    if (lot['loop'] != null) style['lottieLoop'] = lot['loop'];
  } else {
    slot['type'] = 'geo';
    _applyGeometry(layer['geometry'], style);
    _applyFills(layer['fills'], style, resources, varDefaults, isText: false);
    _applyStrokes(layer['strokes'], style, varDefaults);
    _applyPathStroke(layer['geometry'], layer['box'], style);
    if (id == 'background-pattern-slot' && style['fillType'] == 'pattern') {
      slot['is_background_pattern'] = true;
      style['backgroundType'] = 'pattern';
      if (style['fillPatternType'] != null) style['backgroundPatternType'] = style['fillPatternType'];
      if (style['fillPatternColor'] != null) style['backgroundPatternColor'] = style['fillPatternColor'];
      if (style['fillPatternColorRole'] != null) style['backgroundPatternColorRole'] = style['fillPatternColorRole'];
      if (style['fillPatternBgColor'] != null) style['backgroundPatternBgColor'] = style['fillPatternBgColor'];
      if (style['fillPatternBgColorRole'] != null) style['backgroundPatternBgColorRole'] = style['fillPatternBgColorRole'];
      if (style['fillPatternColors'] != null) style['backgroundPatternColors'] = style['fillPatternColors'];
      if (style['fillPatternScale'] != null) style['backgroundPatternScale'] = style['fillPatternScale'];
      if (style['fillPatternCount'] != null) style['backgroundPatternCount'] = style['fillPatternCount'];
      if (style['fillPatternDispersion'] != null) style['backgroundPatternDispersion'] = style['fillPatternDispersion'];
    } else if (style['fillType'] == 'pattern' && layer['geometry'] == null) {
      slot['type'] = 'pattern';
    }
  }

  slot['style'] = style;
  slots.add(slot);
  return false;
}

/// Canonical `@oim-media/core` `presetPath(name, 100, 100)` SVG strings in a `0..100` box.
const Map<String, String> _v2PresetPaths = {
  'circle': 'M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z',
  'star': 'M50 0L62 38.71L100 38.71L69 61.29L80 100L50 76.34L20 100L31 61.29L0 38.71L38 38.71Z',
  'cloud': 'M17.61 100C-3.25 100 -6.94 60.86 13.92 54.05C4.11 23.41 29.88 9.8 42.15 26.82C45.83 -7.22 78.96 -10.62 82.64 26.82C104.73 23.41 105.95 67.66 85.09 71.07C85.09 88.09 82.64 100 70.37 100Z',
  'arch': 'M50 0L50 0A50 50 0 0 1 100 50L100 100A0 0 0 0 1 100 100L0 100A0 0 0 0 1 0 100L0 50A50 50 0 0 1 50 0Z',
  'triangle': 'M50 0L100 100L0 100Z',
  'diamond': 'M50 0L100 50L50 100L0 50Z',
  'hexagon': 'M22.22 0L77.78 0L100 50L77.78 100L22.22 100L0 50Z',
  'pentagon': 'M50 0L100 38.24L80.87 100L19.13 100L0 38.24Z',
  'octagon': 'M27.78 0L72.22 0L100 27.78L100 72.22L72.22 100L27.78 100L0 72.22L0 27.78Z',
  'heart': 'M50 100C4.36 66.4 -12.76 30.4 10.06 8.79C27.18 -8.01 50 0.39 50 24.4C50 0.39 72.82 -8.01 89.94 8.79C112.76 30.4 95.64 66.4 50 100Z',
  'cross': 'M33.33 0L66.67 0L66.67 33.33L100 33.33L100 66.67L66.67 66.67L66.67 100L33.33 100L33.33 66.67L0 66.67L0 33.33L33.33 33.33Z',
  'moon': 'M100 0C44.78 0 0 22.39 0 50C0 77.61 44.78 100 100 100C55.56 83.33 55.56 16.67 100 0Z',
  'drop': 'M50 0C70 22.22 100 44.44 100 66.67C100 85 77.5 100 50 100C22.5 100 0 85 0 66.67C0 44.44 30 22.22 50 0Z',
  'bolt': 'M68.75 0L0 58.89L43.75 58.89L25 100L100 38.89L57.81 38.89L84.38 0Z',
  'flower': 'M67.21 39.17C89.16 32.8 102.4 37.85 99.64 50C102.4 62.15 89.16 67.2 67.21 60.83C83.2 78.27 85.85 93.43 74.82 96.92C66.55 105.58 55.85 95.6 50 71.66C44.15 95.6 33.45 105.58 25.18 96.92C14.15 93.43 16.8 78.27 32.79 60.83C10.84 67.2 -2.4 62.15 0.36 50C-2.4 37.85 10.84 32.8 32.79 39.17C16.8 21.73 14.15 6.57 25.18 3.08C33.45 -5.58 44.15 4.4 50 28.34C55.85 4.4 66.55 -5.58 74.82 3.08C85.85 6.57 83.2 21.73 67.21 39.17Z',
  'burst': 'M100 50L86.44 59.78L93.33 75L76.67 76.67L75 93.33L59.78 86.44L50 100L40.22 86.44L25 93.33L23.33 76.67L6.67 75L13.56 59.78L0 50L13.56 40.22L6.67 25L23.33 23.33L25 6.67L40.22 13.56L50 0L59.78 13.56L75 6.67L76.67 23.33L93.33 25L86.44 40.22Z',
};

/// Canonical `@oim-media/core` `maskOutlinePath({ geoShape }, { x: 0, y: 0, width: 100, height: 100 })` SVG strings.
const Map<String, String> _v2MaskPaths = {
  'circle': 'M50 0C77.61 0 100 22.39 100 50C100 77.61 77.61 100 50 100C22.39 100 0 77.61 0 50C0 22.39 22.38 0 50 0Z',
  'star': 'M50 -3.33L63.33 36.67L105.56 36.67L71.11 60L83.33 100L50 75.56L16.67 100L28.89 60L-5.56 36.67L36.67 36.67Z',
  'triangle': 'M50 0L100 94.44L0 94.44Z',
  'diamond': 'M50 0L100 50L50 100L0 50Z',
  'hexagon': 'M22.22 0L77.78 0L100 50L77.78 100L22.22 100L0 50Z',
  'pentagon': 'M50 0L99.67 36.11L80.67 94.44L19.33 94.44L0.33 36.11Z',
  'octagon': 'M27.78 0L72.22 0L100 27.78L100 72.22L72.22 100L27.78 100L0 72.22L0 27.78Z',
  'heart': 'M50 92.22C5.56 61.11 -11.11 27.78 11.11 7.78C27.78 -7.78 50 0 50 22.22C50 0 72.22 -7.78 88.89 7.78C111.11 27.78 94.44 61.11 50 92.22Z',
  'cloud': 'M22.22 88.89C3.33 88.89 0 63.33 18.89 58.89C10 38.89 33.33 30 44.44 41.11C47.78 18.89 77.78 16.67 81.11 41.11C101.11 38.89 102.22 67.78 83.33 70C83.33 81.11 81.11 88.89 70 88.89Z',
  'arch': 'M0 100L0 50C0 22.39 22.39 0 50 0C77.61 0 100 22.39 100 50L100 100Z',
  'cross': 'M33.33 0L66.67 0L66.67 33.33L100 33.33L100 66.67L66.67 66.67L66.67 100L33.33 100L33.33 66.67L0 66.67L0 33.33L33.33 33.33Z',
  'moon': 'M50 0C22.39 0 0 22.39 0 50C0 77.61 22.39 100 50 100C27.78 83.33 27.78 16.67 50 0Z',
  'drop': 'M50 0C63.33 22.22 83.33 44.44 83.33 66.67C83.33 85 68.33 100 50 100C31.67 100 16.67 85 16.67 66.67C16.67 44.44 36.67 22.22 50 0Z',
  'bolt': 'M63.33 0L14.44 58.89L45.56 58.89L32.22 100L85.56 38.89L55.56 38.89L74.44 0Z',
  'flower': 'M67.33 40C89.44 34.11 102.78 38.78 100 50C102.78 61.22 89.44 65.89 67.33 60C83.44 76.11 86.11 90.11 75 93.33C66.67 101.33 55.89 92.11 50 70C44.11 92.11 33.33 101.33 25 93.33C13.89 90.11 16.56 76.11 32.67 60C10.56 65.89 -2.78 61.22 0 50C-2.78 38.78 10.56 34.11 32.67 40C16.56 23.89 13.89 9.89 25 6.67C33.33 -1.33 44.11 7.89 50 30C55.89 7.89 66.67 -1.33 75 6.67C86.11 9.89 83.44 23.89 67.33 40Z',
  'burst': 'M100 50L86.44 59.78L93.33 75L76.67 76.67L75 93.33L59.78 86.44L50 100L40.22 86.44L25 93.33L23.33 76.67L6.67 75L13.56 59.78L0 50L13.56 40.22L6.67 25L23.33 23.33L25 6.67L40.22 13.56L50 0L59.78 13.56L75 6.67L76.67 23.33L93.33 25L86.44 40.22Z',
};

void _setPresetPath(String name, Map<String, dynamic> style, {bool isMask = false}) {
  final d = (isMask ? _v2MaskPaths : _v2PresetPaths)[name];
  if (d != null) {
    style['svgPath'] = d;
    style['svgViewBox'] = '0 0 100 100';
  } else {
    style['geoShape'] = name;
  }
}

/// A path that carries its own stroke (an icon: `fill` none, `stroke` set) shows it when the
/// layer has no visible stroke of its own. Its width is in viewBox units, so it scales with the box.
void _applyPathStroke(dynamic rawGeo, dynamic box, Map<String, dynamic> style) {
  if (rawGeo is! Map || rawGeo['kind'] != 'paths') return;
  final paths = rawGeo['paths'];
  if (paths is! List || paths.isEmpty || paths.first is! Map) return;
  final p = paths.first as Map;
  final stroke = p['stroke']?.toString();
  final width = p['strokeWidth'];
  final own = style['strokeWidth'];
  if (stroke == null || stroke == 'none' || width is! num || (own is num && own > 0)) return;
  final vb = rawGeo['viewBox'];
  final vbW = vb is List && vb.length == 4 && vb[2] is num && (vb[2] as num) > 0 ? (vb[2] as num).toDouble() : 100.0;
  final boxW = box is Map && box['width'] is num ? (box['width'] as num).toDouble() : vbW;
  style['strokeColor'] = stroke;
  style['strokeWidth'] = width * boxW / vbW;
}

void _applyGeometry(dynamic rawGeo, Map<String, dynamic> style, {bool isMask = false}) {
  if (rawGeo is! Map) return;
  final kind = rawGeo['kind']?.toString();
  switch (kind) {
    case 'ellipse':
      _setPresetPath('circle', style, isMask: isMask);
    case 'line':
      style['geoShape'] = 'line';
    case 'star':
      _setPresetPath('star', style, isMask: isMask);
    case 'polygon':
      final sides = (rawGeo['sides'] as num?)?.toInt() ?? 6;
      final shape = switch (sides) {
        3 => 'triangle',
        5 => 'pentagon',
        6 => 'hexagon',
        8 => 'octagon',
        _ => 'rectangle',
      };
      _setPresetPath(shape, style, isMask: isMask);
    case 'preset':
      if (rawGeo['name'] != null) _setPresetPath(rawGeo['name'].toString(), style, isMask: isMask);
    case 'paths':
      final paths = rawGeo['paths'];
      if (paths is List && paths.isNotEmpty && paths.first is Map) {
        final d = (paths.first as Map)['d']?.toString();
        if (d != null) style['svgPath'] = d;
      }
      final vb = rawGeo['viewBox'];
      if (vb is List && vb.length == 4) {
        style['svgViewBox'] = vb.join(' ');
      }
    default:
      style['geoShape'] = 'rectangle';
  }
}

void _applyFills(
  dynamic rawFills,
  Map<String, dynamic> style,
  Map<String, dynamic> resources,
  Map<String, dynamic> varDefaults, {
  required bool isText,
}) {
  if (rawFills is! List) return;
  for (final item in rawFills) {
    final fill = _resolveRef(item, resources);
    if (fill is! Map) continue;
    final kind = fill['kind']?.toString();
    if (kind == 'color') {
      final role = _resolveColorRole(fill['value']);
      final val = _resolveColorValue(fill['value'], varDefaults);
      if (isText) {
        if (role != null) {
          style['colorRole'] ??= role;
          style['fillColorRole'] ??= role;
        }
        if (val != null) {
          style['color'] ??= val;
          style['fillColor'] ??= val;
        }
      } else {
        if (role != null) style['fillColorRole'] ??= role;
        if (val != null) style['fillColor'] ??= val;
      }
    } else if (kind == 'gradient') {
      if (isText && fill['preset'] is String) {
        style['textGradientType'] ??= fill['preset'];
      }
      final grad = fill['gradient'];
      if (grad is Map) {
        final css = _gradientToCss(grad, varDefaults);
        if (css != null) {
          style['fillType'] = 'gradient';
          style['fillGradient'] = css;
        }
      }
    } else if (kind == 'image') {
      final src = _resolveImageSrc(fill['src'], resources);
      if (src != null) {
        style['fillType'] = 'image';
        style['fillImage'] = src;
        if (fill['crop'] is Map) style['fillImageCrop'] = fill['crop'];
        if (fill['flipX'] == true) style['fillImageFlipX'] = true;
        if (fill['flipY'] == true) style['fillImageFlipY'] = true;
        if (fill['filters'] is Map) _applyMediaFilters(fill['filters'] as Map, style);
      }
    } else if (kind == 'pattern' && fill['pattern'] is Map) {
      final pat = (fill['pattern'] as Map).cast<String, dynamic>();
      style['fillType'] = 'pattern';
      if (pat['preset'] != null) style['fillPatternType'] = pat['preset'];
      if (pat['bg'] != null) {
        final bgRole = _resolveColorRole(pat['bg']);
        final bgVal = _resolveColorValue(pat['bg'], varDefaults) ?? (pat['bg'] is String ? pat['bg'] as String : null);
        if (bgRole != null) style['fillPatternBgColorRole'] = bgRole;
        if (bgVal != null) style['fillPatternBgColor'] = bgVal;
      }
      if (pat['colors'] is List && (pat['colors'] as List).isNotEmpty) {
        final rawColors = pat['colors'] as List;
        final fgRole = _resolveColorRole(rawColors.first);
        if (fgRole != null) style['fillPatternColorRole'] = fgRole;
        final resolvedColors = rawColors
            .map((c) => _resolveColorValue(c, varDefaults) ?? (c is String ? c : null))
            .whereType<String>()
            .toList();
        if (resolvedColors.isNotEmpty) {
          style['fillPatternColor'] = resolvedColors.first;
          style['fillPatternColors'] = resolvedColors;
        }
      }
      if (pat['scale'] != null) style['fillPatternScale'] = pat['scale'];
      if (pat['count'] != null) style['fillPatternCount'] = pat['count'];
      if (pat['dispersion'] != null) style['fillPatternDispersion'] = pat['dispersion'];
    }
  }
}

String? _gradientToCss(Map grad, Map<String, dynamic> varDefaults) {
  final type = grad['type']?.toString() ?? 'linear';
  final stops = grad['stops'];
  if (stops is! List || stops.isEmpty) return null;
  final stopStrs = <String>[];
  for (final s in stops) {
    if (s is! Map) continue;
    final color = _resolveColorValue(s['color'], varDefaults) ?? '#000000';
    final at = s['at'];
    if (at is num) {
      final pct = at <= 1 ? at * 100 : at;
      stopStrs.add('$color ${pct.toStringAsFixed(2)}%');
    } else {
      stopStrs.add(color);
    }
  }
  if (stopStrs.isEmpty) return null;
  if (type == 'radial') {
    return 'radial-gradient(circle, ${stopStrs.join(', ')})';
  }
  if (type == 'linear') {
    final angle = (grad['angle'] as num?)?.toDouble() ?? 180.0;
    return 'linear-gradient(${angle}deg, ${stopStrs.join(', ')})';
  }
  return null;
}

void _applyTextStrokes(dynamic rawStrokes, Map<String, dynamic> style, Map<String, dynamic> varDefaults) {
  if (rawStrokes is! List) return;
  for (final raw in rawStrokes) {
    if (raw is! Map) continue;
    final align = raw['align']?.toString();
    final width = raw['width'];
    final paint = raw['paint'];
    String? color;
    if (paint is Map && paint['kind'] == 'color') {
      color = _resolveColorValue(paint['value'], varDefaults);
    }
    if (align == 'inside') {
      if (width is num) style['innerStrokeWidth'] ??= width;
      if (color != null) style['innerStrokeColor'] ??= color;
    } else {
      if (width is num) style['outerStrokeWidth'] ??= width;
      if (color != null) style['outerStrokeColor'] ??= color;
    }
  }
}

void _applyStrokes(dynamic rawStrokes, Map<String, dynamic> style, Map<String, dynamic> varDefaults) {
  if (rawStrokes is! List || rawStrokes.isEmpty || rawStrokes.first is! Map) return;
  final s = (rawStrokes.first as Map).cast<String, dynamic>();
  if (s['width'] is num) style['strokeWidth'] = s['width'];
  if (s['style'] != null) style['strokeStyle'] = s['style'];
  final paint = s['paint'];
  if (paint is Map && paint['kind'] == 'color') {
    final role = _resolveColorRole(paint['value']);
    final val = _resolveColorValue(paint['value'], varDefaults);
    if (role != null) style['strokeColorRole'] = role;
    if (val != null) style['strokeColor'] = val;
  }
}

void _applyMediaFilters(Map filters, Map<String, dynamic> style) {
  if (filters['preset'] != null) style['filterPreset'] = filters['preset'];
  if (filters['blur'] != null) style['filterBlur'] = filters['blur'];
  if (filters['brightness'] != null) style['filterBrightness'] = filters['brightness'];
  if (filters['contrast'] != null) style['filterContrast'] = filters['contrast'];
  if (filters['saturate'] != null) style['filterSaturate'] = filters['saturate'];
  if (filters['hueRotate'] != null) style['filterHueRotate'] = filters['hueRotate'];
}

void _applyEffects(List effects, Map<String, dynamic> style, Map<String, dynamic> varDefaults) {
  final out = <Map<String, dynamic>>[];
  for (final item in effects) {
    if (item is! Map) continue;
    final kind = item['kind']?.toString();
    if (kind == 'shadow') {
      final col = _resolveColorValue(item['color'], varDefaults);
      final role = _resolveColorRole(item['color']);
      out.add({
        'type': 'drop-shadow',
        'enabled': item['enabled'] != false,
        'x': item['x'] ?? 0,
        'y': item['y'] ?? 4,
        'blur': item['blur'] ?? 12,
        if (item['spread'] != null) 'spread': item['spread'],
        if (item['opacity'] != null) 'opacity': item['opacity'],
        if (col != null) 'color': col,
        if (role != null) 'colorRole': role,
      });
    } else if (kind == 'glow') {
      out.add({
        'type': 'glow',
        'radius': item['radius'] ?? item['blur'] ?? 16,
        if (_resolveColorValue(item['color'], varDefaults) != null) 'color': _resolveColorValue(item['color'], varDefaults),
        if (_resolveColorRole(item['color']) != null) 'colorRole': _resolveColorRole(item['color']),
      });
    } else if (kind == 'blur') {
      out.add({'type': 'blur', 'radius': item['radius'] ?? item['blur'] ?? 8});
    } else if (kind == 'color-grade') {
      out.add({'type': 'color-grade', 'preset': item['preset'], 'intensity': item['intensity'] ?? 100});
    } else if (kind == 'texture') {
      out.add({
        'type': 'texture',
        'preset': item['preset'],
        if (item['intensity'] != null) 'intensity': item['intensity'],
        if (item['scale'] != null) 'scale': item['scale'],
        if (item['blend'] != null) 'blend': item['blend'],
        if (item['color'] != null) 'color': _resolveColorValue(item['color'], varDefaults) ?? item['color'],
      });
    } else if (kind == 'filter') {
      _applyMediaFilters(item, style);
    } else if (kind == 'grain') {
      style['grain'] = true;
      if (item['intensity'] != null) style['grainIntensity'] = item['intensity'];
      if (item['size'] != null) style['grainSize'] = item['size'];
      if (item['blend'] != null) style['grainBlend'] = item['blend'];
    }
  }
  if (out.isNotEmpty) style['effects'] = out;
}

void _applyAnimations(List animations, Map<String, dynamic> style, String rawType) {
  const textPresets = {
    'fade-chars', 'slide-up', 'bounce-chars', 'reveal-mask', 'scale-in', 'rise-words',
    'typewriter', 'wave-chars', 'glitch-cyberpunk', 'glitch-slice',
  };
  const revealPresets = {'fade', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'zoom-in'};

  final motion = <String, dynamic>{};
  for (final item in animations) {
    if (item is! Map) continue;
    final on = item['on']?.toString() ?? 'load';
    final target = item['target']?.toString();
    final preset = item['preset']?.toString();
    final durMs = (item['duration'] as num?)?.toDouble();
    final durSec = durMs != null ? (durMs >= 10 ? durMs / 1000.0 : durMs) : null;
    final delayMs = (item['delay'] as num?)?.toDouble() ?? 0.0;
    final delaySec = delayMs >= 10 ? delayMs / 1000.0 : delayMs;

    if ((target == 'chars' || target == 'words' || target == 'lines') ||
        (rawType == 'text' && preset != null && textPresets.contains(preset) && on != 'hover')) {
      style['textAnimationType'] ??= preset ?? 'fade-chars';
      if (item['stagger'] is num) style['textAnimationSpeed'] ??= item['stagger'];
      style['textAnimationDelay'] ??= delaySec;
      continue;
    }

    if (on == 'hover' && preset != null) {
      motion['hover'] ??= preset.replaceFirst('hover-', '');
      continue;
    }

    if ((on == 'enter' || (on == 'load' && item['tracks'] == null && preset != null && revealPresets.contains(preset))) &&
        style['reveal'] == null) {
      style['reveal'] = {
        'effect': preset == 'fade-in' ? 'fade' : (preset == 'zoom-in' ? 'scale' : (preset ?? 'fade')),
        if (durMs != null) 'duration': durMs,
        if (item['easing'] != null) 'easing': item['easing'],
      };
      continue;
    }

    if (item['tracks'] is List && (item['tracks'] as List).isNotEmpty) {
      final effectiveDur = durSec ?? 1.0;
      motion['duration'] = effectiveDur;
      if (on == 'action') motion['trigger'] = 'action';
      motion['keyframes'] = _tracksToKeyframes(item['tracks'] as List, effectiveDur);
    } else if (on == 'loop' && preset != null) {
      motion['loop'] = preset.replaceFirst('loop-', '');
      if (durSec != null) motion['duration'] = durSec;
      if (delaySec > 0) motion['delay'] = delaySec;
    }
  }
  if (motion.isNotEmpty) style['animation'] = motion;
}

List<Map<String, dynamic>> _tracksToKeyframes(List tracks, double durationSec) {
  final byTime = <double, Map<String, dynamic>>{};
  const propMap = {
    'x': 'x',
    'y': 'y',
    'rotation': 'r',
    'scale': 's',
    'opacity': 'o',
    'blur': 'b',
  };
  for (final tr in tracks) {
    if (tr is! Map) continue;
    final prop = propMap[tr['prop']?.toString()];
    final frames = tr['frames'];
    if (prop == null || frames is! List) continue;
    for (final f in frames) {
      if (f is! Map || f['t'] is! num || f['v'] is! num) continue;
      final tSec = (f['t'] as num).toDouble() * durationSec;
      final row = byTime.putIfAbsent(tSec, () => <String, dynamic>{'t': tSec});
      row[prop] = f['v'];
      if (f['e'] != null) row['e'] = f['e'];
    }
  }
  final times = byTime.keys.toList()..sort();
  return [for (final t in times) byTime[t]!];
}

Map<String, dynamic>? _buildStates(List interactions) {
  final activeActions = <Map<String, dynamic>>[];
  final hoverActions = <Map<String, dynamic>>[];
  for (final inter in interactions) {
    if (inter is! Map) continue;
    final on = inter['on']?.toString();
    final acts = inter['actions'];
    if (acts is! List) continue;
    for (final a in acts) {
      if (a is! Map) continue;
      final mapped = <String, dynamic>{
        'type': a['type'],
        'target': a['target'],
        if (a['value'] != null) 'value': a['value'],
      };
      if (on == 'hover') {
        hoverActions.add(mapped);
      } else if (on == 'press') {
        activeActions.add(mapped);
      }
    }
  }
  if (activeActions.isEmpty && hoverActions.isEmpty) return null;
  return {
    if (activeActions.isNotEmpty) 'active': {'actions': activeActions},
    if (hoverActions.isNotEmpty) 'hover': {'actions': hoverActions},
  };
}
