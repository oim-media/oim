/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text marks: the one interpretation of `{name}…{/name}` and `{{` / `}}`.
 * The cases live in packages/spec/marks-cases.json so the backend's Python
 * validator is tested against the very same inputs.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseMarks, validateMarks, escapeMarks, plainText, marksSequence,
  toRanges, fromRanges, withoutMark, MARK_NAME, MAX_MARKS,
} from "./text-marks";

interface Case { name: string; text: string; known: string[]; valid: boolean; runs?: unknown[]; plain?: string }
const CASES: Case[] = JSON.parse(readFileSync(join(__dirname, "..", "..", "spec", "marks-cases.json"), "utf8"));

describe("shared cases", () => {
  it.each(CASES)("$name", (c) => {
    expect(validateMarks(c.text, c.known).ok).toBe(c.valid);
    if (c.runs) expect(parseMarks(c.text, c.known)).toEqual(c.runs);
    if (c.plain !== undefined) expect(plainText(c.text, c.known)).toBe(c.plain);
  });

  it.each(CASES.filter((c) => c.valid))("round trip through ranges: $name", (c) => {
    const { plain, ranges } = toRanges(c.text, c.known);
    expect(fromRanges(plain, ranges)).toBe(c.text);
  });
});

describe("text typed or pasted never becomes a mark", () => {
  it("escaped tags stay text", () => {
    expect(parseMarks(escapeMarks("{hl}x{/hl}"), ["hl"])).toEqual([{ text: "{hl}x{/hl}" }]);
    expect(validateMarks(escapeMarks("a { b } {/c}"), []).ok).toBe(true);
  });

  it("fromRanges escapes the plain text", () => {
    expect(fromRanges("{hl}", [])).toBe("{{hl}}");
  });
});

describe("marksSequence", () => {
  it("names in order of opening", () => {
    expect(marksSequence("{u}a{/u} {hl}b{/hl} {u}c{/u}", ["hl", "u"])).toEqual(["u", "hl", "u"]);
  });
});

describe("withoutMark", () => {
  it("removes one mark's tags and keeps its text, escapes and other marks", () => {
    const out = withoutMark("a{hl}b{/hl}c {u}d{/u} {{hl}}", "hl");
    expect(out).toBe("abc {u}d{/u} {{hl}}");
    expect(validateMarks(out, ["u"]).ok).toBe(true);
  });
});

describe("limits", () => {
  it("mark names", () => {
    expect(MARK_NAME.test("hl")).toBe(true);
    expect(MARK_NAME.test("a-1")).toBe(true);
    expect(MARK_NAME.test("Hl")).toBe(false);
    expect(MARK_NAME.test("1a")).toBe(false);
    expect(MARK_NAME.test("a".repeat(25))).toBe(false);
    expect(MAX_MARKS).toBe(8);
  });
});
