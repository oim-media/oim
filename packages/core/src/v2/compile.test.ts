/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { canonizeStyle } from "./compile.js";

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
