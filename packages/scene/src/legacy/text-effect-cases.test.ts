/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// The shared text-effect cases (packages/spec/text-effect-cases.json) that the
// Flutter SDK also runs: if the web changes, this fails until they are regenerated.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { entranceFrameAt, entranceUnits } from "../../../core/src/text-effects.js";
import { calculateGlitchState, glitchLayers } from "../../../core/src/glitch.js";
import { calculateTypewriterState } from "./typewriterText.js";
import { waveCharAnimationDelay, WAVE_PERIOD_SECONDS } from "./waveText.js";

const d = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "spec", "text-effect-cases.json"), "utf8"));

it("text-effect-cases.json is what the web computes", () => {
  expect(d.wavePeriod).toBe(WAVE_PERIOD_SECONDS);
  for (const c of d.entrance) expect(entranceFrameAt(c.effect, c.t, c.index, c.stagger, c.delay)).toEqual(c.frame);
  for (const c of d.units) expect(entranceUnits(c.text, c.effect)).toEqual(c.units);
  for (const c of d.glitch) expect(glitchLayers(c.type, calculateGlitchState(c.t, c.speed, c.delay, c.intensity))).toEqual(c.layers);
  for (const c of d.typewriter) expect(calculateTypewriterState(c.text, c.t, c.speed, c.delay, c.cursor)).toEqual(c.state);
  for (const c of d.wave) expect(waveCharAnimationDelay(c.index, c.speed, c.delay)).toBe(c.start);
});
