/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The group as a wrapper, not as an empty box.
 *
 * Phase 3 of the group-as-node design (see the design spec).
 *
 * Until now the `.oim` carried the `group` slot and the player did not know what it was
 * (there was not even one line mentioning `group`), so it built **an empty element with the
 * group's box, on top of its children**. It painted nothing, but it took up room: dead
 * weight inside a signed file.
 *
 * The model is the same as the editor's: a wrapper the size of the canvas and
 * at its origin, with the group's transform applied around its own center. The
 * children go **inside**, keeping their absolute coordinates as always. So the
 * group's opacity, filter and visibility reach what is inside through CSS, without
 * anyone propagating them by hand.
 *
 * **It degrades in both directions, which is what decides whether it can be published:**
 * an old file has no `style.groupId` on any slot, so `childrenByGroup` comes out empty and
 * nothing is nested: the viewer paints what it always did.
 * And an old player with a new file ignores the field and paints the children loose,
 * which is exactly what is seen today: the children carry their canvas coordinates, not
 * coordinates relative to the group.
 */

/**
 * The membership rule is delegated to `@oim-media/core`, the single source for the
 * player and the editor. If each one answered on its own «which layers go inside this
 * group», the same file would paint differently depending on who opened it, and its
 * author would have no way to know which one is right.
 *
 * The module file is imported, not the package index, as in `binary.ts`: that way the
 * player bundle includes only these three functions and never drags in the schema or zod.
 */
export { isGroup, slotParent, childrenByGroup } from '../../../core/src/groups.js';

export interface CanvasBox { x: number; y: number; width: number; height: number; }
export interface CanvasSize { width: number; height: number; }

export interface WrapperStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  transformOrigin: string;
  pointerEvents: string;
}

/**
 * How the wrapper is placed.
 *
 * It covers the whole canvas and is anchored at its origin, so the children (which carry
 * canvas coordinates) land where they always did. The group's transform (rotation, scale)
 * is applied around the **center of the group**, not the center of the canvas:
 * rotating a group has to turn it around itself.
 *
 * `pointer-events: none` because the wrapper covers the WHOLE canvas: without this,
 * a small group would swallow the clicks of any layer below it in the stack. The
 * children turn it back on by themselves (`.oim-slot` already declares
 * `pointer-events: auto`).
 *
 * The box arrives ALREADY resolved in canvas pixels, not as the raw `position` of
 * the slot. That field comes sometimes in 0..1 and sometimes in 0..100 depending on the
 * age of the file, and `ImageEngine` already normalizes it together with `width_px`
 * and `height_px` to place any layer. Interpreting it again here would be a second
 * reading of the same data with its own criterion, which is exactly how failures
 * tend to appear in this format.
 */
export function wrapperStyle(
  box: CanvasBox,
  canvas: CanvasSize
): WrapperStyle {
  return {
    left: '0px',
    top: '0px',
    width: canvas.width + 'px',
    height: canvas.height + 'px',
    transformOrigin:
      (box.x + box.width / 2) + 'px ' + (box.y + box.height / 2) + 'px',
    pointerEvents: 'none'
  };
}
