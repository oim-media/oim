/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3: the artistic text drawn from its 2.0 layer is the one drawn from 1.x.
import { describe, expect, it } from 'vitest';
import { upgrade } from '../../../core/src/v2/upgrade.js';
import { buildArtisticTextModelFromLayer, buildArtisticTextModelFromSlot, generateArtisticTextSvgString } from './artisticText';

const W = 800;
const slots = {
  // The two artistic texts of the conformance vectors.
  'curved, extruded, gradient preset': {
    width: '100.0cqw', height: '27.5cqw', fontSize: '15.0cqw', fillColor: '#f9a8d4', fontFamily: 'Inter', fontWeight: '700', lineHeight: 1.25,
    artisticPreset: 'retro-wave-3d', extrusionDepth: 18, extrusionAngle: 45, extrusionColor: '#DB2777', extrusionShading: true,
    curveAmount: 60, curveType: 'arc', outerStrokeColor: '#1e1b4b', outerStrokeWidth: 4, innerStrokeColor: '#ffffff', innerStrokeWidth: 1, textGradientType: 'sunset-gold',
  },
  'flat, outlined': {
    width: '50.0cqw', height: '25.0cqw', fontSize: '8.0cqw', fillColor: '#fde047', fontFamily: 'Inter', fontWeight: '700', lineHeight: 1.25,
    artisticPreset: 'custom', extrusionDepth: 10, extrusionAngle: 135, extrusionColor: '#7c2d12', extrusionShading: false,
    curveAmount: 0, curveType: 'arc', outerStrokeColor: '#000000', outerStrokeWidth: 2,
  },
  'what 1.x defaulted': { width: '50.0cqw', height: '25.0cqw', curveAmount: 30, letterSpacing: 3 },
};

describe('the artistic text drawn from 2.0 is the SVG drawn from 1.x', () => {
  for (const [name, style] of Object.entries(slots)) {
    it(name, () => {
      const slot = { id: 'a', type: 'artistic-text', position: [0, 0], content: { es: 'Hola' }, style };
      const layer = upgrade({ oim: '1.27.9', canvas: { natural_width: W, natural_height: 600 }, slots: [slot] }).document.layers[0];
      const literal = (v: unknown) => (typeof v === 'string' ? v : undefined);
      const svg = (model: Parameters<typeof generateArtisticTextSvgString>[0]) => generateArtisticTextSvgString(model, 'a');
      expect(svg(buildArtisticTextModelFromLayer(layer, 'es', literal))).toBe(svg(buildArtisticTextModelFromSlot(slot, 'es', W)));
    });
  }
});
