/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 *
 * The group stops being an empty box and starts to wrap.
 *
 * Phase 3 of the group-as-node design spec.
 * Measured before this: the player had NOT ONE line that mentioned `group`, so
 * for each group it painted an empty element with the group's box on top of
 * its children.
 *
 * What is checked most here is not the good case, it is the degradation: an
 * old file, a broken `groupId` or a group that never arrived cannot make a
 * layer disappear. A player embedded in a third party's page that loses content
 * is worse than one that ignores an effect.
 */

import { describe, it, expect } from 'vitest';
import { childrenByGroup, wrapperStyle } from './groups';

const grupo = (id: string) => ({ id, type: 'group', style: {} });
const hijo = (id: string, groupId?: string) => ({
  id, type: 'geo', style: groupId ? { groupId } : {}
});


describe('como se coloca el wrapper', () => {
  const canvas = { width: 800, height: 600 };

  it('cubre el lienzo entero y se ancla en su origen', () => {
    // The children carry CANVAS coordinates, not coordinates relative to the
    // group. If the wrapper stayed at the group's box, they would all end up misplaced.
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, canvas);
    expect(env.left).toBe('0px');
    expect(env.top).toBe('0px');
    expect(env.width).toBe('800px');
    expect(env.height).toBe('600px');
  });

  it('la transformada gira sobre el CENTRO DEL GRUPO, no del lienzo', () => {
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, canvas);
    expect(env.transformOrigin).toBe('200px 100px');
  });

  it('no se traga los clics del resto del lienzo', () => {
    // Covers the full 800x600: without this, a 20x20 group would block any
    // interactive layer beneath it in the stack. The children reactivate it
    // themselves, because `.oim-slot` already declares `pointer-events: auto`.
    expect(wrapperStyle({ x: 0, y: 0, width: 20, height: 20 }, canvas).pointerEvents)
      .toBe('none');
  });

  it('un grupo sin size no produce NaN en el origen', () => {
    const env = wrapperStyle({ x: 0, y: 0, width: 0, height: 0 }, canvas);
    expect(env.transformOrigin).toBe('0px 0px');
  });
});

describe('el anidado sobre el DOM, como lo hace el motor', () => {
  /** Reproduces the reparenting step of `renderSlots`. */
  const anidar = (slots: any[]) => {
    const fragment = document.createDocumentFragment();
    const elPorId = new Map<string, HTMLElement>();
    for (const s of slots) {
      const el = document.createElement('div');
      el.className = 'oim-slot';
      el.dataset.slotId = s.id;
      elPorId.set(s.id, el);
      fragment.appendChild(el);
    }
    childrenByGroup(slots).forEach((ids, idGrupo) => {
      const groupEl = elPorId.get(idGrupo);
      if (!groupEl) return;
      ids.forEach((id) => {
        const childEl = elPorId.get(id);
        if (childEl) groupEl.appendChild(childEl);
      });
    });
    return { fragment, elPorId };
  };

  it('los hijos acaban DENTRO del elemento del grupo', () => {
    const { fragment, elPorId } = anidar([grupo('g1'), hijo('a', 'g1'), hijo('b', 'g1')]);
    expect(fragment.children.length).toBe(1);
    expect(elPorId.get('a')!.parentElement).toBe(elPorId.get('g1'));
    expect(elPorId.get('b')!.parentElement).toBe(elPorId.get('g1'));
  });

  it('el orden entre hermanos se conserva', () => {
    const { elPorId } = anidar([grupo('g1'), hijo('a', 'g1'), hijo('b', 'g1')]);
    expect(Array.from(elPorId.get('g1')!.children).map((e) => (e as HTMLElement).dataset.slotId))
      .toEqual(['a', 'b']);
  });

  it('NINGUNA capa desaparece del documento, pase lo que pase', () => {
    // This is the invariant that decides whether this can be published: the
    // player is embedded in third-party pages. Losing content is worse than
    // ignoring an effect.
    const slots = [
      grupo('g1'), hijo('a', 'g1'), hijo('b', 'g1'),
      hijo('huerfano', 'g_perdido'), hijo('suelta'),
      { id: 'g2', type: 'group', style: { groupId: 'g1' } },
    ];
    const { fragment, elPorId } = anidar(slots);
    const enElArbol = Array.from((fragment as any).querySelectorAll('[data-slot-id]'))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(slots.map((s) => s.id).sort());
    expect(elPorId.get('huerfano')!.parentNode).toBe(fragment);
    expect(elPorId.get('suelta')!.parentNode).toBe(fragment);
  });

  it('un archivo antiguo produce el mismo DOM plano de siempre', () => {
    const { fragment } = anidar([
      { id: 'g1', type: 'group', style: {} },
      { id: 'a', type: 'geo', style: {} },
      { id: 'b', type: 'geo', style: {} },
    ]);
    expect(Array.from(fragment.children).map((e) => (e as HTMLElement).dataset.slotId))
      .toEqual(['g1', 'a', 'b']);
  });
});
