/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Who clips and who does not.
 *
 * ## The failure, measured in a real browser
 *
 * A text was clipping its own descenders (the "j", the "p", the "g").
 * Not by the slot's box: text slots do NOT carry a height (checked on three
 * published `.oim` files: neither `height_px` nor `style.height`), and the engine
 * already sets them to `height: auto`.
 *
 * They were being clipped by the LINE BOX. When `line-height x size` is smaller
 * than the height the font declares, the ink sticks out of the box, and
 * `overflow: hidden` cuts it. Measured at 48 px with `line-height: 1.2`:
 *
 *     Poppins            clips 0.70 px at the bottom
 *     Playfair Display   clips 0.20 px
 *     Montserrat, Inter, Georgia, Arial    do not clip
 *
 * It depends on the font and grows with the size. The two that clip are the ones
 * that the real files use.
 *
 * ## Why it is not fixed by raising the line height
 *
 * Because the line height is chosen by the author. A headline set tight at 1.0 is a
 * legitimate design decision, and the player cannot correct it: that would change the
 * document. What it can do is not CLIP what the author chose to draw.
 *
 * A text has nothing to clip. Its box is `width: max-content` and `height: auto`,
 * so it already fits its content; the only thing left over from it is the ink that
 * legitimately exceeds the line box. Clipping it protects against nothing and loses
 * part of a letter.
 *
 * ## What must keep clipping
 *
 * The parallax group. Its clipping is what makes the effect: the track moves and the
 * box is the window through which it is seen. Without `hidden` the whole ribbon would
 * show and the loop would stop existing. That is why it wins over everything else.
 */

export type Clipping = 'visible' | 'hidden';

export interface WhoClips {
  /** `slot.type === 'text'`, the same criterion the shadow uses. */
  isText: boolean;
  /** Its clipping IS the effect: the box is the loop's window. */
  isParallaxGroup: boolean;
  /** Shadow or filter are painted OUTSIDE the box; clipping them cuts them off. */
  hasFilterOrShadow: boolean;
  /** Keyframes move a wrapper inside the slot; clipping would cut the layer as it travels. */
  hasKeyframes?: boolean;
}

export function slotClipping(slot: WhoClips): Clipping {
  // First, because it is the only case where clipping is the goal.
  if (slot.isParallaxGroup) return 'hidden';
  if (slot.isText) return 'visible';
  if (slot.hasFilterOrShadow) return 'visible';
  if (slot.hasKeyframes) return 'visible';
  return 'hidden';
}
