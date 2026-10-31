/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.22.0: how a layer appears (`reveal`), whether its animation waits
// for an action (`animation.trigger`) and the action that plays it (`play`).

import { describe, it, expect } from "vitest";
import { revealSchema, stateActionSchema, styleSchema } from "./schema";
import { CONTRACT_VERSION } from "./compatibility";

describe("contract 1.22.0: reveal, trigger and play", () => {
  it("accepts a reveal with a bezier easing", () => {
    expect(revealSchema.safeParse({ effect: "slide-up", duration: 400, easing: [0.22, 1, 0.36, 1] }).success).toBe(true);
  });

  it("rejects an unknown effect and a duration over 2000", () => {
    expect(revealSchema.safeParse({ effect: "spin", duration: 300 }).success).toBe(false);
    expect(revealSchema.safeParse({ effect: "fade", duration: 2001 }).success).toBe(false);
  });

  it("accepts the play action", () => {
    expect(stateActionSchema.safeParse({ target: "icon", type: "play" }).success).toBe(true);
  });

  it("accepts animation.trigger and rejects other values", () => {
    const frames = [{ t: 0, o: 0 }, { t: 1, o: 1 }];
    expect(styleSchema.safeParse({ animation: { keyframes: frames, trigger: "action" } }).success).toBe(true);
    expect(styleSchema.safeParse({ animation: { keyframes: frames, trigger: "hover" } }).success).toBe(false);
  });

  it("a style with a reveal validates, and one without still does", () => {
    expect(styleSchema.safeParse({ reveal: { effect: "scale", duration: 250, easing: "ease-in" } }).success).toBe(true);
    expect(styleSchema.safeParse({ reveal: { effect: "scale", duration: -1 } }).success).toBe(false);
    expect(styleSchema.safeParse({ width: "10cqw" }).success).toBe(true);
  });

  it("contract is 1.22.0", () => {
    expect(CONTRACT_VERSION).toBe("1.22.0");
  });
});
