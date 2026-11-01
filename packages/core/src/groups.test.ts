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

const group = (id: string) => ({ id, type: 'group', style: {} });
const child = (id: string, groupId?: string) => ({
  id, type: 'geo', style: groupId ? { groupId } : {}
});

describe('who is the parent of each slot', () => {
  it('reads it from `style`, which is where the editor writes it', () => {
    expect(slotParent(child('a', 'g1'))).toBe('g1');
  });

  it('does NOT read it from the root of the slot', () => {
    // The root does not survive the backend: `RawSlot` is a Pydantic model with
    // `extra='ignore'`. If the player read it from there, it would work in tests
    // and fail on every signed file — which is exactly how the parallax got lost.
    expect(slotParent({ id: 'a', type: 'geo', groupId: 'g1', style: {} })).toBeNull();
  });

  it('a slot without `style` does not blow up', () => {
    expect(slotParent({ id: 'a', type: 'geo' })).toBeNull();
    expect(slotParent(null)).toBeNull();
  });

  it('a `groupId` that is not text does not count', () => {
    expect(slotParent({ id: 'a', style: { groupId: 7 } })).toBeNull();
    expect(slotParent({ id: 'a', style: { groupId: '' } })).toBeNull();
  });

  it('recognizes the group type', () => {
    expect(isGroup(group('g1'))).toBe(true);
    expect(isGroup(child('a'))).toBe(false);
    expect(isGroup(undefined)).toBe(false);
  });
});

describe('who goes inside whom', () => {
  it('groups the children by their parent, in stack order', () => {
    const map = childrenByGroup([group('g1'), child('a', 'g1'), child('b', 'g1')]);
    expect(map.get('g1')).toEqual(['a', 'b']);
  });

  it('two groups do not mix', () => {
    const map = childrenByGroup([
      group('g1'), child('a', 'g1'), group('g2'), child('b', 'g2'),
    ]);
    expect(map.get('g1')).toEqual(['a']);
    expect(map.get('g2')).toEqual(['b']);
  });

  it('a loose layer does not join any group', () => {
    expect(childrenByGroup([group('g1'), child('loose')]).size).toBe(0);
  });
});

describe('what must NOT happen even if the file arrives broken', () => {
  it('an old file nests nothing', () => {
    // No slot carries `style.groupId`: the viewer paints things as always.
    expect(childrenByGroup([
      { id: 'g1', type: 'group', style: {} },
      { id: 'a', type: 'geo', style: {} },
    ]).size).toBe(0);
  });

  it('a `groupId` pointing to a group that never arrived leaves the child loose', () => {
    expect(childrenByGroup([child('a', 'g_lost')]).size).toBe(0);
  });

  it('a `groupId` pointing to something that is not a group does not nest either', () => {
    expect(childrenByGroup([{ id: 't', type: 'text', style: {} }, child('a', 't')]).size).toBe(0);
  });

  it('a group inside another group does not nest', () => {
    // The editor forbids it, but the file can come from anywhere.
    const map = childrenByGroup([
      group('g1'), { id: 'g2', type: 'group', style: { groupId: 'g1' } },
    ]);
    expect(map.size).toBe(0);
  });

  it('two groups that point at each other do not hang the nesting', () => {
    const map = childrenByGroup([
      { id: 'p', type: 'group', style: { groupId: 'q' } },
      { id: 'q', type: 'group', style: { groupId: 'p' } },
    ]);
    expect(map.size).toBe(0);
  });

  it('a group that points at itself does not swallow itself', () => {
    const map = childrenByGroup([{ id: 'g1', type: 'group', style: { groupId: 'g1' } }]);
    expect(map.get('g1')).toBeUndefined();
  });

  it('an empty or broken list does not blow up', () => {
    expect(childrenByGroup([]).size).toBe(0);
    expect(childrenByGroup([null as any, undefined as any]).size).toBe(0);
  });
});
