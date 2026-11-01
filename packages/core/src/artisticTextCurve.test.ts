/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The artistic text curve, now in a single place.
 *
 * The figures here are the ones the editor had been drawing. If someone
 * "improves" the curve, this test says that the look of already-saved works
 * has just changed -which is exactly the conversation to have beforehand, not
 * afterwards.
 */

import { describe, it, expect } from "vitest";
import { calculateTextCurvePath, artisticTextLines } from "./artisticTextCurve.js";

describe("calculateTextCurvePath", () => {
  it("with curvature 0 returns a straight line through the center", () => {
    expect(calculateTextCurvePath(360, 120, 0)).toBe("M 0 60 L 360 60");
    expect(calculateTextCurvePath(360, 120, 0, "wave")).toBe("M 0 60 L 360 60");
  });

  // The default values of a new poster: 360x120, curve 15, arc.
  it("the default arc keeps the text centered in the box", () => {
    // deltaY = 15/100 * 120*0.45 = 8.1
    // endpoints at 60 + 4.05, control point at 60 - 8.1
    expect(calculateTextCurvePath(360, 120, 15, "arc")).toBe(
      "M 0 64.05 Q 180 51.9 360 64.05"
    );
  });

  it("the wave oscillates symmetrically around the center", () => {
    expect(calculateTextCurvePath(360, 120, 15, "wave")).toBe(
      "M 0 60 C 90 51.9, 270 68.1, 360 60"
    );
  });

  it("`arch` is treated as an arc, as the editor already did", () => {
    expect(calculateTextCurvePath(360, 120, 15, "arch")).toBe(
      calculateTextCurvePath(360, 120, 15, "arc")
    );
  });

  it("by default the type is arc", () => {
    expect(calculateTextCurvePath(360, 120, 40)).toBe(
      calculateTextCurvePath(360, 120, 40, "arc")
    );
  });

  it("a negative curvature inverts the arc", () => {
    const arriba = calculateTextCurvePath(360, 120, 50, "arc");
    const abajo = calculateTextCurvePath(360, 120, -50, "arc");
    expect(arriba).not.toBe(abajo);
    // deltaY = ±27: control point at 60∓27, endpoints at 60±13.5
    expect(arriba).toBe("M 0 73.5 Q 180 33 360 73.5");
    expect(abajo).toBe("M 0 46.5 Q 180 87 360 46.5");
  });

  it("curvature is clamped to ±100", () => {
    expect(calculateTextCurvePath(360, 120, 500)).toBe(
      calculateTextCurvePath(360, 120, 100)
    );
    expect(calculateTextCurvePath(360, 120, -500)).toBe(
      calculateTextCurvePath(360, 120, -100)
    );
  });

  // This is the reason the editor's geometry was chosen. The apex is measured
  // from the RETURNED path, not from the formula, and compared with the one the
  // player used to produce.
  it("even at maximum curvature the path stays inside the box", () => {
    const HEIGHT = 120;
    const d = calculateTextCurvePath(360, HEIGHT, 100, "arc");

    // `M 0 y0 Q cx cy 360 y1` -> the apex of a quadratic Bézier is at
    // (P0 + 2*P1 + P2) / 4.
    const m = d.match(/^M 0 (\S+) Q \S+ (\S+) \S+ (\S+)$/);
    expect(m).not.toBeNull();
    const [y0, cy, y1] = m!.slice(1).map(Number);
    const vertex = (y0 + 2 * cy + y1) / 4;

    expect(vertex).toBeGreaterThanOrEqual(0);
    expect(vertex).toBeLessThanOrEqual(HEIGHT);

    // What the player returned: endpoints on the baseline and the control at
    // `sagitta * 1.8`. Its apex went above a 120 px box.
    const sagitta = HEIGHT * 0.45;
    const vertexPlayer = (HEIGHT / 2 + 2 * (HEIGHT / 2 - sagitta * 1.8) + HEIGHT / 2) / 4;
    expect(vertexPlayer).toBeLessThan(vertex);
  });
});

describe("artisticTextLines", () => {
  /**
   * SVG `<text>` does not break lines: a "\n" is painted as a space. That is
   * why pressing Enter in 3D text did nothing. Each line is drawn separately at
   * `offset` px from the centre, and the editor and the player must stack them
   * the same way: that is why it lives here and not in each one.
   */
  it("a single line stays centered", () => {
    expect(artisticTextLines("HOLA", 40, 1.25)).toEqual([{ text: "HOLA", offset: 0 }]);
  });

  it("two lines are spread around the center", () => {
    expect(artisticTextLines("UNO\nDOS", 40, 1.25)).toEqual([
      { text: "UNO", offset: -25 },
      { text: "DOS", offset: 25 },
    ]);
  });

  it("with three lines the middle one stays centered", () => {
    expect(artisticTextLines("A\nB\nC", 40, 1).map((l) => l.offset)).toEqual([-40, 0, 40]);
  });

  it("an empty line keeps its slot", () => {
    expect(artisticTextLines("A\n\nC", 10, 1).map((l) => l.text)).toEqual(["A", "", "C"]);
  });

  it("accepts Windows line breaks", () => {
    expect(artisticTextLines("A\r\nB", 10, 1).map((l) => l.text)).toEqual(["A", "B"]);
  });
});
