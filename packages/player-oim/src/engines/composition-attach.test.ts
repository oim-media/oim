/**
 * @vitest-environment happy-dom
 *
 * Covers the `results` -> `elByCompositionId` -> `attachCompositionNode` path,
 * which had no test at all.
 *
 * The invariant it protects: for a project that does NOT use masks or filters
 * (that is, all the .oim files published before this feature), the resulting fragment
 * must carry exactly one child per slot, in the same order as the input slot list.
 * During this feature the append loop changed from "as each promise resolves" to a map
 * indexed by id, and that change ended up silently dropping slots from the DOM; only a
 * human review caught it.
 * This test is the safety net for that class of failure.
 */

import { describe, it, expect } from 'vitest';
import { attachCompositionNode } from './ImageEngine';
import { computeLayerComposition, type Slot } from '../core/layerComposition';

function makeSlot(id: string): Slot {
  return { id: id, type: 'text', style: {} };
}

/** Reproduces the id -> element map that `renderSlots` builds. */
function buildElementMap(slots: Slot[]): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  slots.forEach(function (s) {
    const el = document.createElement('div');
    el.className = 'oim-slot';
    el.dataset.slotId = s.id;
    map.set(s.id, el);
  });
  return map;
}

describe('attachCompositionNode (no-mask / no-filter projects)', () => {
  it('appends exactly one element per slot, in the input slot order', () => {
    const slots = ['a', 'b', 'c', 'd'].map(makeSlot);
    const elById = buildElementMap(slots);

    const fragment = document.createDocumentFragment();
    computeLayerComposition(slots).forEach(function (node) {
      attachCompositionNode(node, fragment, elById);
    });

    expect(fragment.childNodes.length).toBe(slots.length);
    const rendered = Array.from(fragment.children).map(function (el) {
      return (el as HTMLElement).dataset.slotId;
    });
    expect(rendered).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not wrap, clip or reorder anything when no slot opted into the feature', () => {
    const slots = ['first', 'second'].map(makeSlot);
    const elById = buildElementMap(slots);

    const fragment = document.createDocumentFragment();
    computeLayerComposition(slots).forEach(function (node) {
      attachCompositionNode(node, fragment, elById);
    });

    const children = Array.from(fragment.children) as HTMLElement[];
    // The slot's own elements, not filter-group wrappers.
    expect(children[0]).toBe(elById.get('first'));
    expect(children[1]).toBe(elById.get('second'));
    children.forEach(function (el) {
      expect(el.className).toBe('oim-slot');
      expect(el.style.clipPath).toBe('');
    });
  });
});
