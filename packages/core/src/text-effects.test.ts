/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Entrance text effects as data: one sampling for the editor, the player and
 * any native renderer. Only portable primitives (opacity, translation, scale).
 * Spec: docs/superpowers/specs/2026-10-10-efectos-de-texto-design.md
 */
import { describe, it, expect } from "vitest";
import { ENTRANCE_EFFECTS, entranceUnits, entranceStart, entranceFrame, entranceFrameAt, entranceKeyframes, ENTRANCE_SECONDS, isEntranceEffect, entranceClips } from "./text-effects.js";

describe("entrance text effects", () => {
  it("are the three portable ones the contract promised (blur-chars is retired)", () => {
    expect([...ENTRANCE_EFFECTS]).toEqual(["fade-chars", "slide-up", "bounce-chars", "reveal-mask", "scale-in", "rise-words"]);
    expect(isEntranceEffect("blur-chars")).toBe(false);
    expect(isEntranceEffect("fade-chars")).toBe(true);
  });

  it("units: letters, or words for slide-up; spaces are their own unit", () => {
    expect(entranceUnits("ab c", "fade-chars")).toEqual(["a", "b", " ", "c"]);
    expect(entranceUnits("hola  mundo", "slide-up")).toEqual(["hola", "  ", "mundo"]);
    expect(entranceUnits("añ😀", "bounce-chars")).toEqual(["a", "ñ", "😀"]);
  });

  it("each unit starts after the delay plus its index times the stagger (default 0.05 s)", () => {
    expect(entranceStart(0)).toBe(0);
    expect(entranceStart(3)).toBeCloseTo(0.15);
    expect(entranceStart(2, 0.1, 1)).toBeCloseTo(1.2);
  });

  it("start and end values of each effect", () => {
    expect(entranceFrame("fade-chars", 0)).toEqual({ opacity: 0, translateYEm: 0, scale: 1, rotateDeg: 0 });
    expect(entranceFrame("slide-up", 0)).toEqual({ opacity: 0, translateYEm: 0.6, scale: 1, rotateDeg: 0 });
    expect(entranceFrame("bounce-chars", 0)).toEqual({ opacity: 0, translateYEm: 0, scale: 0, rotateDeg: 0 });
    for (const e of ENTRANCE_EFFECTS) expect(entranceFrame(e, 1)).toEqual({ opacity: 1, translateYEm: 0, scale: 1, rotateDeg: 0 });
  });

  it("ease-out: past half way at the middle; bounce overshoots before settling", () => {
    expect(entranceFrame("fade-chars", 0.5).opacity).toBeCloseTo(0.75);
    expect(Math.max(...entranceKeyframes("bounce-chars").map((f) => f.scale))).toBeGreaterThan(1.1);
  });

  it("entranceFrameAt clamps before the start and after the end", () => {
    expect(entranceFrameAt("fade-chars", 0, 4).opacity).toBe(0);
    expect(entranceFrameAt("fade-chars", 10, 4).opacity).toBe(1);
    expect(entranceFrameAt("fade-chars", entranceStart(4) + ENTRANCE_SECONDS / 2, 4).opacity).toBeCloseTo(0.75);
  });

  it("keyframes are evenly sampled from 0 to 1 and only use the portable primitives", () => {
    const k = entranceKeyframes("slide-up", 4);
    expect(k).toHaveLength(5);
    expect(k[0]).toEqual(entranceFrame("slide-up", 0));
    expect(k[4]).toEqual(entranceFrame("slide-up", 1));
    for (const e of ENTRANCE_EFFECTS) for (const f of entranceKeyframes(e)) expect(Object.keys(f).sort()).toEqual(["opacity", "rotateDeg", "scale", "translateYEm"]);
  });

  // Delivery B (contract 1.13.0): reveal-mask, scale-in, rise-words.
  it("reveal-mask rises a word from under its own clip, without fading", () => {
    expect(entranceUnits("ab cd", "reveal-mask")).toEqual(["ab", " ", "cd"]);
    expect(entranceFrame("reveal-mask", 0)).toEqual({ opacity: 1, translateYEm: 1.2, scale: 1, rotateDeg: 0 });
  });

  it("scale-in grows each letter from 0.6 while it fades in", () => {
    expect(entranceUnits("ab", "scale-in")).toEqual(["a", "b"]);
    expect(entranceFrame("scale-in", 0)).toEqual({ opacity: 0, translateYEm: 0, scale: 0.6, rotateDeg: 0 });
  });

  it("rise-words lifts and straightens each word", () => {
    expect(entranceUnits("ab cd", "rise-words")).toEqual(["ab", " ", "cd"]);
    expect(entranceFrame("rise-words", 0)).toEqual({ opacity: 0, translateYEm: 0.8, scale: 1, rotateDeg: 8 });
  });

  it("only reveal-mask clips", () => {
    expect(ENTRANCE_EFFECTS.filter(entranceClips)).toEqual(["reveal-mask"]);
  });

  it("every effect ends in place", () => {
    for (const e of ENTRANCE_EFFECTS) expect(entranceFrame(e, 1)).toEqual({ opacity: 1, translateYEm: 0, scale: 1, rotateDeg: 0 });
  });
});
