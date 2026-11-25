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
    _applyGeometry(layer['geometry'], style);
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
    if (style['fillType'] == 'pattern' && layer['geometry'] == null) {
      slot['type'] = 'pattern';
    }
  }

  slot['style'] = style;
  slots.add(slot);
  return false;
}

void _applyGeometry(dynamic rawGeo, Map<String, dynamic> style) {
  if (rawGeo is! Map) return;
  final kind = rawGeo['kind']?.toString();
  switch (kind) {
    case 'ellipse':
      style['geoShape'] = 'circle';
    case 'line':
      style['geoShape'] = 'line';
    case 'star':
      style['geoShape'] = 'star';
    case 'polygon':
      final sides = (rawGeo['sides'] as num?)?.toInt() ?? 6;
      style['geoShape'] = switch (sides) {
        3 => 'triangle',
        5 => 'pentagon',
        6 => 'hexagon',
        8 => 'octagon',
        _ => 'rectangle',
      };
    case 'preset':
      if (rawGeo['name'] != null) style['geoShape'] = rawGeo['name'].toString();
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
        if (role != null) style['colorRole'] ??= role;
        if (val != null) style['color'] ??= val;
      } else {
        if (role != null) style['fillColorRole'] ??= role;
        if (val != null) style['fillColor'] ??= val;
      }
    } else if (kind == 'gradient') {
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
      if (pat['bg'] != null) style['fillPatternBgColor'] = _resolveColorValue(pat['bg'], varDefaults) ?? pat['bg'];
      if (pat['colors'] is List && (pat['colors'] as List).isNotEmpty) {
        style['fillPatternColor'] = _resolveColorValue((pat['colors'] as List).first, varDefaults);
        style['fillPatternColors'] = pat['colors'];
      }
      if (pat['scale'] != null) style['fillPatternScale'] = pat['scale'];
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
      out.add({
        'type': 'drop-shadow',
        'x': item['x'] ?? 0,
        'y': item['y'] ?? 4,
        'blur': item['blur'] ?? 12,
        if (_resolveColorValue(item['color'], varDefaults) != null) 'color': _resolveColorValue(item['color'], varDefaults),
        if (_resolveColorRole(item['color']) != null) 'colorRole': _resolveColorRole(item['color']),
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
