/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_TYPEWRITER_SPEED = 20;
export const DEFAULT_TYPEWRITER_DELAY = 0;
export const DEFAULT_TYPEWRITER_CURSOR = true;

export interface TypewriterState {
  visibleText: string;
  showCursor: boolean;
  isComplete: boolean;
}

export function calculateTypewriterState(
  text: string,
  currentTime: number,
  speed = DEFAULT_TYPEWRITER_SPEED,
  delay = DEFAULT_TYPEWRITER_DELAY,
  cursorEnabled = DEFAULT_TYPEWRITER_CURSOR,
  isStaticFallback = false
): TypewriterState {
  if (isStaticFallback) return { visibleText: text, showCursor: false, isComplete: true };

  const elapsed = currentTime - delay;
  const count = elapsed > 0 ? Math.min(text.length, Math.floor(elapsed * Math.max(.1, speed))) : 0;
  return {
    visibleText: text.slice(0, count),
    showCursor: cursorEnabled && ((currentTime % .8) + .8) % .8 < .4,
    isComplete: count >= text.length
  };
}
