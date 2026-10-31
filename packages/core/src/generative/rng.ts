/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Rng } from "./types.js";

/**
 * Deterministic PRNG based on Mulberry32.
 * Guarantees identical sequences for the same seed without re-seeding per index.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next(): number {
      return mulberry32();
    },
    range(min: number, max: number): number {
      return min + mulberry32() * (max - min);
    },
    pick<T>(items: T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from empty array");
      }
      const idx = Math.floor(mulberry32() * items.length);
      return items[idx];
    }
  };
}
