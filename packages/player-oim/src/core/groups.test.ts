/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 *
 * El grupo deja de ser una caja vacía y pasa a envolver.
 *
 * Fase 3 de `docs/superpowers/specs/2026-08-23-el-grupo-como-nodo-design.md`.
 * Medido antes de esto: el player no tenía NI UNA línea que mencionara
 * `group`, así que por cada grupo pintaba un elemento vacío con la caja del
 * grupo encima de sus hijos.
 *
 * Lo que más se comprueba aquí no es el caso bueno, es la degradación: un
 * archivo antiguo, un `groupId` roto o un grupo que no llegó no pueden hacer
 * desaparecer una capa. Un player embebido en la página de un tercero que
 * pierde content es peor que uno que ignora un efecto.
 */

import { describe, it, expect } from 'vitest';
import { childrenByGroup, wrapperStyle } from './groups';

const grupo = (id: string) => ({ id, type: 'group', style: {} });
const hijo = (id: string, groupId?: string) => ({
  id, type: 'geo', style: groupId ? { groupId } : {}
});


describe('como se coloca el wrapper', () => {
  const lienzo = { width: 800, height: 600 };

  it('cubre el lienzo entero y se ancla en su origen', () => {
    // Los hijos traen coordenadas de LIENZO, no relativas al grupo. Si el
    // wrapper se quedara en la caja del grupo, se irian todos de sitio.
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, lienzo);
    expect(env.left).toBe('0px');
    expect(env.top).toBe('0px');
    expect(env.width).toBe('800px');
    expect(env.height).toBe('600px');
  });

  it('la transformada gira sobre el CENTRO DEL GRUPO, no del lienzo', () => {
    const env = wrapperStyle({ x: 100, y: 50, width: 200, height: 100 }, lienzo);
    expect(env.transformOrigin).toBe('200px 100px');
  });

  it('no se traga los clics del resto del lienzo', () => {
    // Cubre los 800x600 enteros: sin esto, un grupo de 20x20 bloquearia
    // cualquier capa interactiva que quedara por debajo en la pila. Los hijos
    // lo reactivan solos, porque `.oim-slot` ya declara `pointer-events: auto`.
    expect(wrapperStyle({ x: 0, y: 0, width: 20, height: 20 }, lienzo).pointerEvents)
      .toBe('none');
  });

  it('un grupo sin size no produce NaN en el origen', () => {
    const env = wrapperStyle({ x: 0, y: 0, width: 0, height: 0 }, lienzo);
    expect(env.transformOrigin).toBe('0px 0px');
  });
});

describe('el anidado sobre el DOM, como lo hace el motor', () => {
  /** Reproduce el paso de reparentado de `renderSlots`. */
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
    // Es el invariante que decide si esto se puede publicar: el player va
    // embebido en paginas de terceros. Perder content es peor que ignorar
    // un efecto.
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
