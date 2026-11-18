/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { TRACK_CLASS } from "../../../core/src/parallaxCss.js";
import { applyLoop } from "./motion.js";

const cqw = (n: number) => `${n / 8}cqw`;
const layer = (loop: NonNullable<Layer["motion"]>["loop"]) =>
  ({ id: "belt", type: "shape", box: { x: 0, y: 0, width: 800, height: 120 }, motion: { loop } }) as Layer;

describe("applyLoop", () => {
  it("a moving layer clips a track of copies of its paint, measured in the scene's lengths", () => {
    const el = document.createElement("div");
    el.style.backgroundColor = "rgb(15, 23, 42)";
    el.style.backgroundImage = "linear-gradient(red, blue)";
    applyLoop(el, layer({ speedPxSec: 35, direction: "right_to_left" }), 800, cqw);
    const track = el.querySelector<HTMLElement>(`:scope > .${TRACK_CLASS}`)!;
    expect(el.style.overflow).toBe("hidden");
    expect(el.style.backgroundColor + el.style.backgroundImage).toBe("");
    expect(track.children.length).toBe(4); // mirrored: whole pairs over the canvas
    expect((track.children[0] as HTMLElement).style.backgroundColor).toBe("rgb(15, 23, 42)");
    expect((track.children[3] as HTMLElement).style.backgroundImage).toBe("linear-gradient(red, blue)");
    expect((track.children[1] as HTMLElement).style.transform).toContain("translateX(100.125cqw) scaleX(-1)"); // the mirrored copy, its 801 px in cqw
    expect(track.style.getPropertyValue("--oim-parallax-unit")).toBe("200cqw");
  });

  it("a still layer is not touched", () => {
    const el = document.createElement("div");
    applyLoop(el, layer({ speedPxSec: 0 }), 800, cqw);
    expect(el.children.length).toBe(0);
    expect(el.style.overflow).toBe("");
  });
});
