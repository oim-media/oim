/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Box } from "@oim-media/core/v2";

/** A share of a length as a CSS percentage, rounded so the style stays readable. */
export const percent = (part: number, whole: number): string => `${whole ? +((part / whole) * 100).toFixed(4) : 0}%`;

/** How far a box moves, in shares of its own size, so its anchor lands on x, y. */
const ANCHOR_SHIFT: Record<NonNullable<Box["anchor"]>, [number, number]> = {
  "top-left": [0, 0], top: [-50, 0], "top-right": [-100, 0],
  left: [0, -50], center: [-50, -50], right: [-100, -50],
  "bottom-left": [0, -100], bottom: [-50, -100], "bottom-right": [-100, -100],
};

/** Where a box sits inside its parent. Boxes are in canvas units, wherever the layer is nested. */
export type Frame = { x: number; y: number; width: number; height: number };

export function applyBox(el: HTMLElement, box: Box, parent: Frame): void {
  const s = el.style;
  s.left = percent(box.x - parent.x, parent.width);
  s.top = percent(box.y - parent.y, parent.height);
  // A text with no size fits its content.
  if (box.width !== undefined) s.width = percent(box.width, parent.width);
  if (box.height !== undefined) s.height = percent(box.height, parent.height);
  const [ax, ay] = ANCHOR_SHIFT[box.anchor ?? "top-left"];
  const transform = [
    ax || ay ? `translate(${ax}%, ${ay}%)` : "",
    box.rotation ? `rotate(${box.rotation}deg)` : "",
    box.flipX ? "scaleX(-1)" : "",
    box.flipY ? "scaleY(-1)" : "",
  ].filter(Boolean);
  s.transform = transform.join(" ");
}
