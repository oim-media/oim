/**
 * @vitest-environment happy-dom
 *
 * Cubre el camino `results` -> `elByCompositionId` -> `attachCompositionNode`,
 * que no tenía ninguna prueba.
 *
 * El invariante que protege: para un proyecto que NO usa máscaras ni filtros
 * (es decir, todos los .oim publicados antes de esta feature), el fragmento
 * resultante debe llevar exactamente un hijo por slot, en el mismo orden que la
 * lista de slots de entrada. Durante esta feature el bucle de append pasó de
 * "según resuelve cada promesa" a un mapa indexado por id, y ese cambio llegó a
 * tirar slots del DOM en silencio; sólo lo cazó una revisión humana. Esta
 * prueba es la red para esa clase de fallo.
 */

import { describe, it, expect } from 'vitest';
import { attachCompositionNode } from './ImageEngine';
import { computeLayerComposition, type Slot } from '../core/layerComposition';

function makeSlot(id: string): Slot {
  return { id: id, type: 'text', style: {} };
}

/** Reproduce el mapa id -> elemento que construye `renderSlots`. */
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
    // Los propios elementos del slot, no envoltorios de grupo de filtro.
    expect(children[0]).toBe(elById.get('first'));
    expect(children[1]).toBe(elById.get('second'));
    children.forEach(function (el) {
      expect(el.className).toBe('oim-slot');
      expect(el.style.clipPath).toBe('');
    });
  });
});
