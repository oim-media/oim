/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The cases live in packages/spec/keyframe-cases.json so every player
// (web, Flutter) samples a keyframe animation the same way.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleKeyframes } from "./keyframes.js";

type Case = {
  name: string;
  keyframes: any[];
  duration: number;
  samples: { time: number; expect: Record<string, number> }[];
};
const CASES: Case[] = JSON.parse(readFileSync(join(__dirname, "..", "..", "spec", "keyframe-cases.json"), "utf8"));

describe("sampleKeyframes", () => {
  it("has cases", () => expect(CASES.length).toBeGreaterThan(5));
  for (const c of CASES) {
    for (const s of c.samples) {
      it(`${c.name} at ${s.time}s`, () => {
        const got = sampleKeyframes(c.keyframes, c.duration, s.time) as Record<string, number>;
        for (const [k, v] of Object.entries(s.expect)) expect(got[k]).toBeCloseTo(v, 3);
      });
    }
  }
});
