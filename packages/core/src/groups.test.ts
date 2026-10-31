/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La regla de pertenencia: quien es hijo de quien.
 *
 * Estas pruebas vivian en `player-oim` y viajaron con el codigo al extraerse a
 * `@oim-media/core`. Ahora vigilan la unica parte de los grupos donde el editor y el
 * player DEBEN coincidir: si ambos no responden lo mismo a «que layers van
 * dentro de este grupo», el mismo archivo se pinta distinto segun quien lo
 * abra.
 *
 * Lo que mas se comprueba aqui no es el caso bueno, es la degradacion: un
 * archivo antiguo, un `groupId` roto o un grupo que no llego no pueden hacer
 * desaparecer una capa. Un player embebido en la pagina de un tercero que
 * pierde contenido es peor que uno que ignora un efecto.
 */

import { describe, it, expect } from 'vitest';
import { isGroup, slotParent, childrenByGroup } from './groups';

const grupo = (id: string) => ({ id, type: 'group', style: {} });
const hijo = (id: string, groupId?: string) => ({
  id, type: 'geo', style: groupId ? { groupId } : {}
});

describe('quien es el padre de cada slot', () => {
  it('lo lee de `style`, que es donde el editor lo escribe', () => {
    expect(slotParent(hijo('a', 'g1'))).toBe('g1');
  });

  it('NO lo lee de la raiz del slot', () => {
    // La raiz no sobrevive al backend: `RawSlot` es un modelo Pydantic con
    // `extra='ignore'`. Si el player lo leyera de ahi, funcionaria en pruebas
    // y fallaria en todos los archivos firmados — que es exactamente como se
    // perdio el parallax.
    expect(slotParent({ id: 'a', type: 'geo', groupId: 'g1', style: {} })).toBeNull();
  });

  it('un slot sin `style` no revienta', () => {
    expect(slotParent({ id: 'a', type: 'geo' })).toBeNull();
    expect(slotParent(null)).toBeNull();
  });

  it('un `groupId` que no es texto no cuenta', () => {
    expect(slotParent({ id: 'a', style: { groupId: 7 } })).toBeNull();
    expect(slotParent({ id: 'a', style: { groupId: '' } })).toBeNull();
  });

  it('reconoce el tipo grupo', () => {
    expect(isGroup(grupo('g1'))).toBe(true);
    expect(isGroup(hijo('a'))).toBe(false);
    expect(isGroup(undefined)).toBe(false);
  });
});

describe('quien va dentro de quien', () => {
  it('agrupa a los hijos por su padre, en orden de pila', () => {
    const mapa = childrenByGroup([grupo('g1'), hijo('a', 'g1'), hijo('b', 'g1')]);
    expect(mapa.get('g1')).toEqual(['a', 'b']);
  });

  it('dos grupos no se mezclan', () => {
    const mapa = childrenByGroup([
      grupo('g1'), hijo('a', 'g1'), grupo('g2'), hijo('b', 'g2'),
    ]);
    expect(mapa.get('g1')).toEqual(['a']);
    expect(mapa.get('g2')).toEqual(['b']);
  });

  it('una capa suelta no entra en ningun grupo', () => {
    expect(childrenByGroup([grupo('g1'), hijo('suelta')]).size).toBe(0);
  });
});

describe('lo que NO puede pasar aunque el archivo venga roto', () => {
  it('un archivo antiguo no anida nada', () => {
    // Ningun slot trae `style.groupId`: el visor pinta lo de siempre.
    expect(childrenByGroup([
      { id: 'g1', type: 'group', style: {} },
      { id: 'a', type: 'geo', style: {} },
    ]).size).toBe(0);
  });

  it('un `groupId` que apunta a un grupo que no llego deja al hijo suelto', () => {
    expect(childrenByGroup([hijo('a', 'g_perdido')]).size).toBe(0);
  });

  it('un `groupId` que apunta a algo que no es un grupo tampoco anida', () => {
    expect(childrenByGroup([{ id: 't', type: 'text', style: {} }, hijo('a', 't')]).size).toBe(0);
  });

  it('un grupo dentro de otro grupo no se anida', () => {
    // El editor lo prohibe, pero el archivo puede venir de cualquier sitio.
    const mapa = childrenByGroup([
      grupo('g1'), { id: 'g2', type: 'group', style: { groupId: 'g1' } },
    ]);
    expect(mapa.size).toBe(0);
  });

  it('dos grupos que se apuntan mutuamente no cuelgan el anidado', () => {
    const mapa = childrenByGroup([
      { id: 'p', type: 'group', style: { groupId: 'q' } },
      { id: 'q', type: 'group', style: { groupId: 'p' } },
    ]);
    expect(mapa.size).toBe(0);
  });

  it('un grupo que se apunta a si mismo no se traga a si mismo', () => {
    const mapa = childrenByGroup([{ id: 'g1', type: 'group', style: { groupId: 'g1' } }]);
    expect(mapa.get('g1')).toBeUndefined();
  });

  it('una lista vacia o rota no revienta', () => {
    expect(childrenByGroup([]).size).toBe(0);
    expect(childrenByGroup([null as any, undefined as any]).size).toBe(0);
  });
});
