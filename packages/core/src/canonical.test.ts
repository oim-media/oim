/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { serializeCanonical } from './canonical.js';

describe('serializeCanonical - 7 Reglas Canónicas (RFC 8785)', () => {
  it('Regla 2: excluye signature, key_version, timestamp y creator_user_id SOLO de la raíz', () => {
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

  it('Regla 3: enteros flotantes a enteros, y números decimales redondeados a 6 cifras', () => {
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

  it('Regla 4: ordenación recursiva por punto de código Unicode en objetos y dentro de arrays', () => {
    const input = {
      b: 1,
      a: 2,
      z: [{ y: 10, x: 20 }],
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"a":2,"b":1,"z":[{"x":20,"y":10}]}');
  });

  it('Regla 6 y 7: caracteres UTF-8 no-ASCII sin secuencias \\uXXXX', () => {
    const input = {
      titulo: 'Diseño para niños con acción',
    };

    const out = new TextDecoder().decode(serializeCanonical(input));
    expect(out).toBe('{"titulo":"Diseño para niños con acción"}');
  });
});
