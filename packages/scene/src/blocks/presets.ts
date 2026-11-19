/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { entranceClips, entranceKeyframes, entranceStart, entranceUnits, ENTRANCE_SECONDS, type EntranceEffect } from "../../../core/src/text-effects.js";

// Written as CSS declarations: the 1.x stylesheet joins them as they are; scene parses them for WAAPI.
const AMBER = "rgba(245, 158, 11, ";
const SCALE_1 = "transform:scale(1);opacity:1";
const STILL = "transform:translateY(0)";

/** The named loops: [seconds, easing, frames evenly spaced]. The 1.x stylesheet and the scene both read this table. */
const LOOPS: Record<string, [number, string, string[]]> = {
  pulse: [2, "ease-in-out", [SCALE_1, "transform:scale(0.95);opacity:0.8", SCALE_1]],
  float: [3, "ease-in-out", [STILL, "transform:translateY(-6px)", STILL]],
  bounce: [1.2, "ease-in-out", [STILL, "transform:translateY(-8px)", STILL]],
  spin: [4, "linear", ["transform:rotate(0deg)", "transform:rotate(360deg)"]],
  glow: [2, "ease-in-out", [`text-shadow:0 0 4px ${AMBER}0.2)`, `text-shadow:0 0 16px ${AMBER}0.8)`, `text-shadow:0 0 4px ${AMBER}0.2)`]],
};

/** The named hovers: the look a pointer over the layer reaches. */
const HOVERS: Record<string, string> = {
  grow: "transform:scale(1.08)",
  shrink: "transform:scale(0.92)",
  lift: "transform:translateY(-6px)",
  glow: `text-shadow:0 0 12px ${AMBER}0.8)`,
};

const own = <T>(table: Record<string, T>, name: string | undefined): T | undefined => (name && Object.hasOwn(table, name) ? table[name] : undefined);

const keyframe = (css: string): Keyframe =>
  Object.fromEntries(css.split(";").map((d) => [d.slice(0, d.indexOf(":")).replace(/-[a-z]/g, (c) => c[1].toUpperCase()), d.slice(d.indexOf(":") + 1)]));

/** A named loop's or hover's WAAPI frames; a hover runs from the layer's own look to the preset's. */
export function presetFrames(on: "loop" | "hover", name: string | undefined): Keyframe[] | undefined {
  if (on === "loop") return own(LOOPS, name)?.[2].map(keyframe);
  const look = own(HOVERS, name);
  return look === undefined ? undefined : [{}, keyframe(look)];
}

export const presetSeconds = (name: string): number | undefined => own(LOOPS, name)?.[0];
export const presetEasing = (name: string): string | undefined => own(LOOPS, name)?.[1];

/**
 * A text entrance (core text-effects): one span per unit, handed to `start` with
 * its start in seconds. Spaces stay as text so the line breaks as before.
 */
export function applyEntrance(
  el: HTMLElement,
  text: string,
  effect: EntranceEffect,
  stagger: number | undefined,
  delay: number | undefined,
  start: (span: HTMLElement, seconds: number) => void,
): void {
  const doc = el.ownerDocument;
  el.textContent = "";
  entranceUnits(text, effect).forEach((unit, i) => {
    if (/^\s+$/.test(unit)) return void el.appendChild(doc.createTextNode(unit));
    const span = doc.createElement("span");
    span.textContent = unit;
    span.style.display = "inline-block";
    let holder: HTMLElement = span;
    if (entranceClips(effect)) {
      // A rectangular clip of the word's own box: the word rises into view.
      holder = doc.createElement("span");
      holder.className = "oim-entrance-clip";
      Object.assign(holder.style, { display: "inline-block", overflow: "hidden", verticalAlign: "top" });
      holder.appendChild(span);
    }
    el.appendChild(holder);
    start(span, entranceStart(i, stagger, delay));
  });
}

/** An entrance's WAAPI frames, sampled from the core like the 1.x keyframes. */
export function entranceFrames(effect: EntranceEffect): Keyframe[] {
  const frames = entranceKeyframes(effect);
  const rotates = frames.some((f) => f.rotateDeg !== 0);
  return frames.map((f) => ({ opacity: f.opacity, transform: `translateY(${f.translateYEm}em) scale(${f.scale})${rotates ? ` rotate(${f.rotateDeg}deg)` : ""}` }));
}

export const ENTRANCE_MS = ENTRANCE_SECONDS * 1000;
