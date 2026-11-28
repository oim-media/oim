/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "../compatibility.js";
import { canonizeStyle, compileRaw, rawToDocument } from "./compile.js";
import { upgrade } from "./upgrade.js";

const dir = new URL("./__fixtures__/compile/", import.meta.url);
const names = readdirSync(dir)
  .filter((f) => f.endsWith(".request.json"))
  .map((f) => f.replace(".request.json", ""));
const read = (name: string, kind: "request" | "expected") => JSON.parse(readFileSync(new URL(`${name}.${kind}.json`, dir), "utf8"));

describe("canonizeStyle", () => {
  it("renames aliases and the full form wins", () => {
    expect(canonizeStyle({ size: 12, color: "#fff", bold: false, fontWeight: 700 })).toEqual({
      fontSize: 12,
      fillColor: "#fff",
      fontWeight: 700,
    });
  });
  it("keeps the full name when an alias repeats it", () => {
    expect(canonizeStyle({ size: 12, fontSize: 20 })).toEqual({ fontSize: 20 });
  });
  it("turns the boolean shortcuts into their full keys", () => {
    expect(canonizeStyle({ bold: true, italic: false, underline: true })).toEqual({
      fontWeight: 700,
      fontStyle: "normal",
      textDecoration: "underline",
    });
  });
  it("merges fontSizeOverrides under fontSizes", () => {
    expect(canonizeStyle({ fontSizeOverrides: { es: "1cqw", en: "2cqw" }, fontSizes: { en: "3cqw" } })).toEqual({
      fontSizes: { es: "1cqw", en: "3cqw" },
    });
  });
  it("returns {} for nothing and does not mutate", () => {
    const s = { bold: true };
    canonizeStyle(s);
    expect(s).toEqual({ bold: true });
    expect(canonizeStyle(undefined)).toEqual({});
  });
});

describe("compileRaw matches the backend /compile", () => {
  it("covers every edge case of the spec", () => {
    expect(names.length).toBeGreaterThanOrEqual(14);
  });
  it.each(names)("%s", (name) => {
    const { timestamp, oim, ...got } = compileRaw(read(name, "request"), { round: true });
    const { oim: _expectedVersion, ...expected } = read(name, "expected");
    expect(timestamp).toBeUndefined();
    expect(got).toEqual(expected);
    // The version is the contract's, not the one the fixture was captured under.
    expect(oim).toBe(CONTRACT_VERSION);
  });
  it("rejects more than 150 slots", () => {
    expect(() =>
      compileRaw({ canvas_width: 10, canvas_height: 10, slots_raw: Array.from({ length: 151 }, (_, i) => ({ id: `s${i}` })) }),
    ).toThrow(/150/);
  });
  it("rejects a canvas that is not positive or is larger than 16384", () => {
    expect(() => compileRaw({ canvas_width: 0, canvas_height: 10, slots_raw: [] })).toThrow(/canvas/);
    expect(() => compileRaw({ canvas_width: 10, canvas_height: 16385, slots_raw: [] })).toThrow(/canvas/);
  });
  it("rejects invalid palettes", () => {
    const base = { canvas_width: 10, canvas_height: 10, slots_raw: [] };
    expect(() => compileRaw({ ...base, palettes: { Bad: {} } })).toThrow(/palette name/);
    expect(() => compileRaw({ ...base, palettes: { ok: { nope: "#fff" } } })).toThrow(/role/);
    expect(() => compileRaw({ ...base, palettes: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`p${i}`, {}])) })).toThrow(/6 palettes/);
  });
  it("mints an oim_id when none is given", () => {
    expect(compileRaw({ canvas_width: 10, canvas_height: 10, slots_raw: [] }).oim_id).toMatch(/^oim_[0-9a-f]{12}$/);
  });
});

// Numbers differ by at most half the last decimal the backend kept; everything else must be identical.
const close = (a: unknown, b: unknown, tol: number): boolean =>
  typeof a === "number" && typeof b === "number"
    ? Math.abs(a - b) <= tol
    : Array.isArray(a) && Array.isArray(b)
      ? a.length === b.length && a.every((x, i) => close(x, b[i], tol))
      : a && b && typeof a === "object" && typeof b === "object"
        ? Object.keys(a).length === Object.keys(b).length &&
          Object.keys(a).every((k) => k in b && close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol))
        : a === b;

describe("rawToDocument == upgrade(backend compile)", () => {
  it.each(names)("%s", (name) => {
    const request = read(name, "request");
    const fresh = rawToDocument(request).document;
    const old = upgrade(read(name, "expected")).document;
    const side = Math.max(request.canvas_width ?? request.width, request.canvas_height ?? request.height);
    // A measure kept to 4 decimals of a percentage of the canvas: half a unit of the last decimal, in px.
    expect(close(fresh, old, side * 5e-7)).toBe(true);
  });
  it("keeps the pixels the author sent, without the rounding of the old round trip", () => {
    const { document } = rawToDocument({
      canvas_width: 1080,
      canvas_height: 1080,
      slots_raw: [{ id: "a", type: "shape", x_px: 333, y_px: 10, width_px: 111, height_px: 111 }],
    });
    const box = document.layers.find((l) => l.id === "a")!.box;
    expect(box.x).toBe(333);
    expect(box.width).toBe(111);
  });
  it("passthrough reaches the canvas, and what was compiled wins over it", () => {
    const { document } = rawToDocument({
      canvas_width: 100,
      canvas_height: 100,
      slots_raw: [],
      oim_id: "oim_mine",
      passthrough: { backgroundType: "color", backgroundColor: "#123456", oim_id: "oim_theirs" },
    });
    expect(JSON.stringify(document.canvas)).toContain("#123456");
    expect(document.id).toBe("oim_mine");
  });
});

describe("compileRaw reads undefined as absent, like the JSON the backend received", () => {
  const input = { canvas_width: 800, canvas_height: 600 };
  it("an undefined maxWidth is derived, not written as undefined", () => {
    const slot = { id: "t", type: "text", width_px: 200, height_px: 40, style: { maxWidth: undefined } };
    const out = compileRaw({ ...input, slots_raw: [slot] }, { round: true });
    expect((out.slots as any[])[0].style.maxWidth).toBe("27.5cqw");
  });
  it("an auto-width text is capped by the canvas, not left without a width", () => {
    const slot = { id: "t", type: "text", width_px: 200, height_px: 40, is_auto_width: true };
    const out = compileRaw({ ...input, slots_raw: [slot] }, { round: true });
    expect((out.slots as any[])[0].style.maxWidth).toBe("100.0cqw");
    const doc = rawToDocument({ ...input, slots_raw: [slot] }).document as any;
    expect(doc.layers.find((l: any) => l.text)?.text.maxWidth).toBe(800);
  });
  it("a turned box keeps a position off the canvas; an upright one is clamped", () => {
    const label = { id: "v", type: "text", x_px: -56, y_px: 262, width_px: 204, height_px: 20, style: { rotation: 270 } };
    const flat = { id: "f", type: "text", x_px: -56, y_px: 262, width_px: 204, height_px: 20 };
    const out = compileRaw({ ...input, slots_raw: [label, flat] }, { round: true });
    expect((out.slots as any[]).map((s) => s.position[0])).toEqual([-7, 0]);
    const doc = rawToDocument({ ...input, slots_raw: [label] }).document as any;
    expect(doc.layers.find((l: any) => l.text)?.box.x).toBeCloseTo(-56);
  });
  it("an undefined alias does not stop the long name from being read", () => {
    const slot = { id: "t", type: "text", x_px: undefined, x: 400, width_px: 10, height_px: 10 };
    const out = compileRaw({ ...input, slots_raw: [slot] }, { round: true });
    expect((out.slots as any[])[0].position[0]).toBe(50);
  });
  it("an undefined style alias does not shadow the full name", () => {
    expect(canonizeStyle({ size: undefined, fontSize: "3cqw" })).toEqual({ fontSize: "3cqw" });
    expect(canonizeStyle({ bold: undefined, fontWeight: 700 })).toEqual({ fontWeight: 700 });
  });
  it("an undefined canvas_width lets the width alias stand", () => {
    const out = compileRaw({ canvas_width: undefined, width: 800, canvas_height: 600, slots_raw: [] } as any);
    expect((out.canvas as any).natural_width).toBe(800);
  });
  it("undefined root fields are not written", () => {
    const out = compileRaw({ ...input, slots_raw: [], min_player: undefined, palettes: undefined }, { round: true });
    expect(out).not.toHaveProperty("min_player");
    expect(out).not.toHaveProperty("palettes");
  });
});
