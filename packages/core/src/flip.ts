/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The layer flip (contract 1.14.0), as the scale pair every renderer applies:
 * the editor and the player in an inner element (so rotation and animations,
 * on the outer one, are untouched), the static export with ctx.scale after
 * rotating. One function, so the three cannot flip in different directions.
 */
export function flipScale(flipX?: boolean, flipY?: boolean): [number, number] | null {
  if (!flipX && !flipY) return null;
  return [flipX ? -1 : 1, flipY ? -1 : 1];
}
