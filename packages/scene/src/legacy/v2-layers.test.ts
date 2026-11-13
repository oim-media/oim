/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { typographyCss } from './v2-layers';

const text = (t: object) => ({ id: 't', type: 'text', box: { x: 0, y: 0 }, text: { content: { es: 'x' }, ...t } }) as never;

describe('typographyCss', () => {
  it('a size with per-language exceptions takes the one of the language', () => {
    const layer = text({ font: { size: { value: 40, modes: { de: 32 } } } });
    expect(typographyCss(layer, 'de')!.fontSize).toBe('32px');
    expect(typographyCss(layer, 'es')!.fontSize).toBe('40px');
  });

  it('every typography field becomes its CSS', () => {
    expect(typographyCss(text({ font: { family: 'Inter', weight: 700, italic: true }, letterSpacing: 2, transform: 'uppercase', decoration: 'underline', maxWidth: 400 }), 'es')).toEqual({
      fontFamily: 'Inter', fontWeight: '700', fontStyle: 'italic', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'underline', maxWidth: '400px',
    });
  });

  it('a layer that is not a text has no typography', () => {
    expect(typographyCss({ id: 's', type: 'shape' } as never, 'es')).toBeUndefined();
  });
});
