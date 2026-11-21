/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { geometryOutline } from "./geometry-outline.js";

describe("geometryOutline", () => {
  it("a rectangle (or nothing) is the box", () => {
    expect(geometryOutline(undefined)).toEqual({ silhouette: null, fillable: true, round: false });
    expect(geometryOutline({ kind: "rect" } as never).silhouette).toBeNull();
  });

  it("an ellipse draws the catalogue circle and is round", () => {
    const o = geometryOutline({ kind: "ellipse" } as never);
    expect(o.round).toBe(true);
    expect(o.preset).toBe("circle");
    expect(o.silhouette).not.toBeNull();
  });

  it("a single bare path is a fillable custom outline with its viewBox", () => {
    const o = geometryOutline({ kind: "paths", viewBox: [0, 0, 100, 100], paths: [{ d: "M 0 0 L 100 0 L 50 100 Z" }] } as never);
    expect(o.fillable).toBe(true);
    expect(o.path).toEqual({ d: "M 0 0 L 100 0 L 50 100 Z", viewBox: "0 0 100 100" });
  });

  it("a painted drawing of paths paints itself: the box", () => {
    expect(geometryOutline({ kind: "paths", viewBox: [0, 0, 1, 1], paths: [{ d: "M0 0", fill: { kind: "color", value: "#000" } }] } as never).silhouette).toBeNull();
  });

  it("a preset is outlined in the pixels of the box", () => {
    const o = geometryOutline({ kind: "preset", name: "arch" } as never, { width: 320, height: 480 });
    expect(o.silhouette!.viewBox).toBe("0 0 320 480");
    expect(o.silhouette!.d).toContain("L0 160");
  });

  it("an ellipse outline is the inscribed ellipse of the box", () => {
    const o = geometryOutline({ kind: "ellipse" } as never, { width: 300, height: 100 });
    expect(o.silhouette!.viewBox).toBe("0 0 300 100");
  });
});
