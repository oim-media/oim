/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { serializeCanonical } from './canonical.js';

describe('serializeCanonical - 7 canonical rules (OIM profile)', () => {
  it('Rule 2: excludes signature, key_version, timestamp and creator_user_id ONLY from the root', () => {
    const input = {
      signature: 'sig123',
      key_version: 'v1',
      timestamp: 12345678,
      creator_user_id: 'user_xyz',
      name: 'Cartel',
      slots: [
        {
          id: 's1',
          timestamp: 9999,
          creator_user_id: 'preserved_inside',
        },
      ],
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"name":"Cartel","slots":[{"creator_user_id":"preserved_inside","id":"s1","timestamp":9999}]}');
  });

  it('Rule 3: float integers become integers, and decimal numbers are rounded to 6 digits', () => {
    const input = {
      enteroFloat: 2.0,
      ceroFloat: -0.0,
      decimalCorto: 0.5,
      decimalLargo: 0.123456789,
      negativoLargo: -45.1234564,
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"ceroFloat":0,"decimalCorto":0.5,"decimalLargo":0.123457,"enteroFloat":2,"negativoLargo":-45.123456}');
  });

  it('Rule 4: recursive sorting by Unicode code point in objects and inside arrays', () => {
    const input = {
      b: 1,
      a: 2,
      z: [{ y: 10, x: 20 }],
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"a":2,"b":1,"z":[{"x":20,"y":10}]}');
  });

  it('Rules 6 and 7: non-ASCII UTF-8 characters without \\uXXXX sequences', () => {
    const input = {
      title: 'Diseño para niños con acción',
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"title":"Diseño para niños con acción"}');
  });
});
