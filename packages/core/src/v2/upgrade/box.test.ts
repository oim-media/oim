/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Where 1.x puts a layer is what the player paints, not what the fields seem to
// say: the player anchors the layer by `textAlign`, centres it vertically on a
// height measured against the canvas height, and paints a height measured
// against the canvas width. The 2.0 box is the box the reader saw.
import { describe, expect, it } from "vitest";
import { documentSchema } from "../schema.js";
import { upgrade } from "../upgrade.js";

const at = (slot: object, canvas = { natural_width: 1000, natural_height: 500 }) =>
  upgrade({ oim: "1.27.9", canvas, slots: [{ id: "a", type: "geo", ...slot }] }).document.layers[0];

describe("upgrade: the box the player painted", () => {
  it("a position under 1 on both axes is a fraction, as the player reads it", () => {
    const layer = at({ position: [0.5, 0.25], width_px: 100, height_px: 50 });
    expect(layer.box).toMatchObject({ x: 500, y: 125 });
  });

  it("width_px wins over a style width the player does not use", () => {
    expect(at({ position: [0, 0], width_px: 300, height_px: 40, style: { width: "10cqw" } }).box).toMatchObject({ width: 300, height: 40 });
  });

  it("widthPercent and heightPercent are shares of the canvas width", () => {
    expect(at({ position: [0, 0], widthPercent: 20, heightPercent: 10 }).box).toMatchObject({ width: 200, height: 100 });
  });

  it("on a canvas that is not square, a cqw height moves the layer as the player did", () => {
    // Painted 100 tall (10% of the width), centred on 25 (half of 10% of the height).
    expect(at({ position: [0, 0], style: { width: "10cqw", height: "10cqw" } }).box).toEqual({ x: 0, y: -25, width: 100, height: 100 });
  });

  it("a shape with no size is the player's 10cqw square", () => {
    expect(at({ position: [0, 0] }).box).toMatchObject({ width: 100, height: 100 });
  });

  it.each([
    ["left", "left"],
    ["center", "center"],
    ["right", "right"],
  ])("a text with no size fits its content, anchored %s", (align, anchor) => {
    const layer = at({ type: "text", position: [50, 40], content: { es: "Hola" }, style: { textAlign: align } });
    expect(layer.box).toEqual({ x: 500, y: 200, anchor });
  });

  it("a text with no align is anchored left, the player's default", () => {
    expect(at({ type: "text", position: [10, 10], content: { es: "Hola" } }).box.anchor).toBe("left");
  });

  it("a sized text keeps its size and its top-left corner", () => {
    const layer = at({ type: "text", position: [10, 20], content: { es: "Hola" }, style: { width: "20cqw", height: "10%", textAlign: "center" } });
    expect(layer.box).toEqual({ x: 100, y: 100, width: 200, height: 50 });
  });

  it("a centred layer is centred on its reference width, then on its painted one", () => {
    // The stale width_px (100) sets the anchor; the style (200) sets what is painted.
    const layer = at({ type: "text", position: [10, 20], width_px: 100, content: { es: "Hola" }, style: { width: "20cqw", height: "10%", textAlign: "center" } });
    expect(layer.box).toMatchObject({ x: 50, width: 200 });
  });

  it("the slot's own align counts when the style says none", () => {
    expect(at({ type: "text", position: [10, 10], align: "right", content: { es: "Hola" } }).box.anchor).toBe("right");
  });

  it("a text with only width_px and height_px still fits its content, as the player did", () => {
    const layer = at({ type: "text", position: [10, 10], width_px: 300, height_px: 40, content: { es: "Hola" } });
    expect(layer.box).not.toHaveProperty("width");
    expect(layer.box.anchor).toBe("left");
  });

  it("only a text may leave its size out", () => {
    const shape = { id: "s", type: "shape", box: { x: 0, y: 0 }, geometry: { kind: "rect" } };
    const text = { id: "t", type: "text", box: { x: 0, y: 0, anchor: "center" }, text: { content: { es: "x" } } };
    const doc = (layer: object) => ({ oim: "2.0.0-draft.1", canvas: { width: 10, height: 10 }, languages: ["es"], layers: [layer] });
    expect(documentSchema.safeParse(doc(shape)).success).toBe(false);
    expect(documentSchema.safeParse(doc(text)).success).toBe(true);
    expect(documentSchema.safeParse(doc({ ...text, box: { x: 0, y: 0, anchor: "middle" } })).success).toBe(false);
  });
});
