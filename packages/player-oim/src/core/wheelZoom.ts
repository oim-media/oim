/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Wheel and pinch zoom, proportional to how far the wheel moved.
//
// It used to add or subtract a fixed 5% per event, whatever the delta. A
// trackpad sends many tiny events, and the tail of a gesture flips sign by a
// pixel or two, so the image jumped 1.40 -> 1.35 -> 1.40 -> 1.35: the subtle
// shaking seen while zooming. Measured on a real .oim, 28 Sept 2026.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

// ln(1.05) / 100: one 100px mouse-wheel notch still zooms 5%, as before.
const SCROLL_RATE = Math.log(1.05) / 100;
// A pinch arrives as ctrl + wheel with small deltas; it needs more gain.
const PINCH_RATE = 0.01;

const LINE_PX = 16;
const PAGE_PX = 800;

/**
 * The zoom after one wheel event. Multiplicative, so zooming in and back out
 * by the same distance returns exactly where it started.
 * `deltaMode` is WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages.
 */
export function nextWheelZoom(zoom: number, deltaY: number, deltaMode: number, pinch: boolean): number {
  const px = deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * PAGE_PX : deltaY;
  const next = zoom * Math.exp(-px * (pinch ? PINCH_RATE : SCROLL_RATE));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
}
