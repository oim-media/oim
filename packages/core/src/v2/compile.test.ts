/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "../compatibility.js";
import { canonizeStyle, compileRaw } from "./compile.js";

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
