/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Who is a child of whom. This is the rule where the editor and the player
 * HAVE to agree.
 *
 * It lives here, and not on each side, because it is the only part of the
 * groups whose disagreement shows: if both do not answer the same to "which
 * layers go inside this group", the same file is painted differently depending
 * on who opens it, and its author has no way of knowing which of the two is right.
 *
 * What is NOT here is deliberate. The editor has editing operations -dissolve,
 * extract, duplicate, select- that the player never runs, and each one computes
 * its wrapper's style from different data: the player receives the box already
 * resolved in pixels, while the editor carries opacity, blend, filter and
 * preview state. They are two different functions that shared a name, not a
 * copy that drifted. Merging them would force one to pretend to be what the
 * other needs.
 *
 * ## Why the parent lives in `style`
 *
 * `RawSlot`, in the backend, is a Pydantic model with `extra='ignore'`: a new
 * field at the ROOT of the slot is silently discarded when signing. That is how
 * the parallax was lost in every published `.oim`. So it is read from one single
 * place, and that place is `style`.
 *
 * ## Why it travels in one direction only
 *
 * The editor keeps two representations -the group carries `childIds` and each
 * child carries `groupId`- because it needs to walk the hierarchy in both
 * directions. Only the second one travels in the file: two copies of the same
 * truth inside a signed file is how the duplicated group broke in the past.
 * On opening, the editor derives `childIds` from the `groupId`s.
 *
 * ## Degrades in both directions
 *
 * An old file carries no `style.groupId` in any slot: the map comes out empty,
 * nothing is nested, and the viewer paints things as always. An old player with
 * a new file ignores the field and paints the children loose, with their canvas
 * coordinates. In no case does a layer disappear.
 */

/** Is this slot a group? */
export function isGroup(slot: any): boolean {
  return !!slot && slot.type === 'group';
}

/**
 * A slot's parent, as the editor writes it.
 *
 * It is read from ONE place only -`style.groupId`- for the reason explained
 * above about `extra='ignore'`.
 */
export function slotParent(slot: any): string | null {
  const style = (slot && slot.style) || {};
  const id = style.groupId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Which slots go inside which group.
 *
 * It is walked by the child's `groupId`, the only direction that travels to the
 * file. A `groupId` that points to something that does not exist, or that is not
 * a group, nests nothing: the child stays loose where it was, which is the usual
 * behavior, and never a layer that disappears.
 *
 * A group cannot be a child of itself or of another group -the editor enforces
 * that rule-, but this cannot trust a file that may come from anywhere: without
 * this cut, two groups that point at each other would hang the nesting.
 */
export function childrenByGroup(slots: any[]): Map<string, string[]> {
  const groupIds = new Set<string>();
  for (const s of slots || []) {
    if (isGroup(s) && s.id) groupIds.add(String(s.id));
  }

  const byParent = new Map<string, string[]>();
  for (const s of slots || []) {
    if (!s || !s.id || isGroup(s)) continue;
    const parent = slotParent(s);
    if (!parent || !groupIds.has(parent)) continue;
    const list = byParent.get(parent);
    if (list) list.push(String(s.id));
    else byParent.set(parent, [String(s.id)]);
  }
  return byParent;
}
