/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The membership rule: who is a child of whom.
 *
 * These tests lived in `player-oim` and travelled with the code when it was
 * extracted to `@oim-media/core`. Now they guard the only part of the groups
 * where the editor and the player MUST agree: if both do not answer the same to
 * "which layers go inside this group", the same file is painted differently
 * depending on who opens it.
 *
 * What matters most here is not the good case, it is the degradation: an old
 * file, a broken `groupId` or a group that never arrived cannot make a layer
 * disappear. A player embedded in a third party's page that loses content is
 * worse than one that ignores an effect.
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
    // The root does not survive the backend: `RawSlot` is a Pydantic model with
    // `extra='ignore'`. If the player read it from there, it would work in tests
    // and fail on every signed file — which is exactly how the parallax got lost.
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
    // No slot carries `style.groupId`: the viewer paints things as always.
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
    // The editor forbids it, but the file can come from anywhere.
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
