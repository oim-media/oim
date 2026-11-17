/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { OimDocument } from '../../../core/src/v2/schema.js';
import { legacyView } from './legacy-view';
import { v2LayersOf } from './v2-layers';

const doc = (layers: unknown[]): OimDocument => ({
  oim: '2.0.0-draft.1',
  canvas: { width: 800, height: 600 },
  languages: ['es', 'en'],
  layers,
} as unknown as OimDocument);

const text = (id: string) => ({ id, type: 'text', box: { x: 0, y: 0, width: 100, height: 40 }, text: { content: { es: id } } });
const group = (id: string, children: unknown[]) => ({ id, type: 'group', box: { x: 0, y: 0, width: 800, height: 600 }, children });

describe('legacyView', () => {
  it('lists layers in paint order, children after their group', () => {
    const view = legacyView(doc([group('g', [text('a'), text('b')]), text('c')]));
    expect(view.slots.map((s) => s.id)).toEqual(['g', 'a', 'b', 'c']);
    expect(view.slots[1].style.groupId).toBe('g');
  });

  it('carries the canvas and languages', () => {
    const view = legacyView(doc([text('a')]));
    expect(view.canvas_width).toBe(800);
    expect(view.canvas_height).toBe(600);
    expect(view.languages).toEqual(['es', 'en']);
  });

  it('lets v2LayersOf read the document without upgrading again', () => {
    const d = doc([group('g', [text('a')]), text('c')]);
    expect(v2LayersOf(legacyView(d)).get('a')).toBe((d.layers[0] as { children: unknown[] }).children[0]);
  });

  it('nests a grandchild under its own group, two levels down', () => {
    const view = legacyView(doc([group('outer', [group('inner', [text('a')])])]));
    expect(view.slots.map((s) => s.id)).toEqual(['outer', 'inner', 'a']);
    expect(view.slots[1].style.groupId).toBe('outer');
    expect(view.slots[2].style.groupId).toBe('inner');
  });
});

describe('legacyView keeps what paints colours and fonts', () => {
  it('turns the variables back into the named palettes, with the default one', () => {
    const d = { ...doc([text('a')]), variables: { modes: { palette: ['light', 'dark'], language: ['es'] }, defaults: { palette: 'dark' }, values: { text: { light: '#111111', dark: '#eeeeee' }, accent: { dark: '#ff0000' } } } } as unknown as OimDocument;
    const view = legacyView(d);
    expect(view.palettes).toEqual({ light: { text: '#111111' }, dark: { text: '#eeeeee', accent: '#ff0000' } });
    expect(view.defaultPalette).toBe('dark');
  });

  it('a document without palettes has none', () => {
    expect(legacyView(doc([text('a')])).palettes).toBeUndefined();
  });

  it('carries the embedded fonts as they are', () => {
    const font = { name: 'Inter-Regular', family: 'Inter', weight: 400, style: 'normal', format: 'woff2', data: 'd09GMgAB' };
    const d = { ...doc([text('a')]), fonts: [font] } as unknown as OimDocument;
    expect(legacyView(d).fonts).toEqual([font]);
  });
});

describe('legacyView types', () => {
  // Needed by vectors-2/artistic-text: the 1.x renderer paints an artistic text only as 'artistic-text'.
  it('a text with an artistic block is an artistic-text slot', () => {
    const artistic = { ...text('a'), text: { content: { es: 'x' }, artistic: { preset: 'retro-wave-3d' } } };
    expect(legacyView(doc([artistic])).slots[0].type).toBe('artistic-text');
    expect(legacyView(doc([text('b')])).slots[0].type).toBe('text');
  });
});

describe('legacyView for the language switch', () => {
  // The switch classifies the change of each text from its words and sizes per language (renderer _classifyLangChange).
  it('a text carries its words per language', () => {
    const d = doc([{ ...text('a'), text: { content: { en: 'Hello', es: 'Hola' } } }]);
    expect(legacyView(d).slots[0].content).toEqual({ en: 'Hello', es: 'Hola' });
  });

  it('a text carries its size and width, and the exceptions of each language', () => {
    const d = doc([{ ...text('a'), text: { content: { es: 'x' }, font: { size: { value: 40, modes: { en: 32 } } }, maxWidth: 550 } }]);
    const style = legacyView(d).slots[0].style;
    expect(style.fontSize).toBe('40px');
    expect(style.fontSizes).toEqual({ en: '32px' });
    expect(style.maxWidth).toBe('550px');
    expect(style.maxWidths).toBeUndefined();
  });
});

describe('legacyView: a filter', () => {
  // A 2.0 filter is a shape with a backdrop effect; the renderer paints a filter only from a slot of type "filter".
  it('a shape with a backdrop is a filter slot, and its 2.0 layer stays a shape', () => {
    const layer = { id: 'f', type: 'shape', box: { x: 200, y: 120, width: 300, height: 200 }, geometry: { kind: 'preset', name: 'star' }, effects: [{ kind: 'backdrop', preset: 'grayscale' }] };
    const view = legacyView(doc([layer]));
    expect(view.slots[0].type).toBe('filter');
    expect(v2LayersOf(view).get('f')?.type).toBe('shape');
  });
});
