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

const groupItem = (id: string) => ({ id, type: 'group', style: {} });
const child = (id: string, groupId?: string) => ({
  id, type: 'geo', style: groupId ? { groupId } : {}
});


describe('how the wrapper is placed', () => {
  const canvas = { width: 800, height: 600 };

  it('covers the entire canvas and is anchored at its origin', () => {
    // The children carry CANVAS coordinates, not coordinates relative to the
    // group. If the wrapper stayed at the group's box, they would all end up misplaced.
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, canvas);
    expect(env.left).toBe('0px');
    expect(env.top).toBe('0px');
    expect(env.width).toBe('800px');
    expect(env.height).toBe('600px');
  });

  it('the transform rotates around the CENTER OF THE GROUP, not the canvas', () => {
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, canvas);
    expect(env.transformOrigin).toBe('200px 100px');
  });

  it('does not swallow the clicks of the rest of the canvas', () => {
    // Covers the full 800x600: without this, a 20x20 group would block any
    // interactive layer beneath it in the stack. The children reactivate it
    // themselves, because `.oim-slot` already declares `pointer-events: auto`.
    expect(wrapperStyle({ x: 0, y: 0, width: 20, height: 20 }, canvas).pointerEvents)
      .toBe('none');
  });

  it('a group without a size does not produce NaN at the origin', () => {
    const env = wrapperStyle({ x: 0, y: 0, width: 0, height: 0 }, canvas);
    expect(env.transformOrigin).toBe('0px 0px');
  });
});

describe('nesting over the DOM, as the engine does it', () => {
  /** Reproduces the reparenting step of `renderSlots`. */
  const nest = (slots: any[]) => {
    const fragment = document.createDocumentFragment();
    const byId = new Map<string, HTMLElement>();
    for (const s of slots) {
      const el = document.createElement('div');
      el.className = 'oim-slot';
      el.dataset.slotId = s.id;
      byId.set(s.id, el);
      fragment.appendChild(el);
    }
    childrenByGroup(slots).forEach((ids, idGrupo) => {
      const groupEl = byId.get(idGrupo);
      if (!groupEl) return;
      ids.forEach((id) => {
        const childEl = byId.get(id);
        if (childEl) groupEl.appendChild(childEl);
      });
    });
    return { fragment, byId };
  };

  it('the children end up INSIDE the group element', () => {
    const { fragment, byId } = nest([groupItem('g1'), child('a', 'g1'), child('b', 'g1')]);
    expect(fragment.children.length).toBe(1);
    expect(byId.get('a')!.parentElement).toBe(byId.get('g1'));
    expect(byId.get('b')!.parentElement).toBe(byId.get('g1'));
  });

  it('the order among siblings is preserved', () => {
    const { byId } = nest([groupItem('g1'), child('a', 'g1'), child('b', 'g1')]);
    expect(Array.from(byId.get('g1')!.children).map((e) => (e as HTMLElement).dataset.slotId))
      .toEqual(['a', 'b']);
  });

  it('NO layer disappears from the document, whatever happens', () => {
    // This is the invariant that decides whether this can be published: the
    // player is embedded in third-party pages. Losing content is worse than
    // ignoring an effect.
    const slots = [
      groupItem('g1'), child('a', 'g1'), child('b', 'g1'),
      child('huerfano', 'g_perdido'), child('suelta'),
      { id: 'g2', type: 'group', style: { groupId: 'g1' } },
    ];
    const { fragment, byId } = nest(slots);
    const enElArbol = Array.from((fragment as any).querySelectorAll('[data-slot-id]'))
      .map((e: any) => e.dataset.slotId).sort();
    expect(enElArbol).toEqual(slots.map((s) => s.id).sort());
    expect(byId.get('huerfano')!.parentNode).toBe(fragment);
    expect(byId.get('suelta')!.parentNode).toBe(fragment);
  });

  it('an old file produces the same flat DOM as always', () => {
    const { fragment } = nest([
      { id: 'g1', type: 'group', style: {} },
      { id: 'a', type: 'geo', style: {} },
      { id: 'b', type: 'geo', style: {} },
    ]);
    expect(Array.from(fragment.children).map((e) => (e as HTMLElement).dataset.slotId))
      .toEqual(['g1', 'a', 'b']);
  });
});
