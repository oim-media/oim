/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text breaks its lines where the editor's canvas breaks them.
 *
 * The player styled every slot with `text-wrap: balance`, which evens the
 * lines out instead of filling them: a paragraph that fits two lines of
 * 620 px on the canvas came out as two of ~390 px. Stacked texts (a
 * paragraph split in layers to colour part of it) then overlapped in the
 * library (9 Oct 2026). The editor wraps greedily; so does the player now.
 */

import { describe, it, expect } from "vitest";
import { getStylesText } from "./styles";

describe("text wrapping matches the canvas", () => {
  it("slots do not balance their lines", () => {
    const slotRule = getStylesText().split("\n").find((r) => r.startsWith(".oim-slot {")) ?? "";
    expect(slotRule).not.toBe("");
    expect(slotRule).not.toMatch(/text-wrap:\s*balance/);
  });

  it("nothing else in the stylesheet balances text", () => {
    expect(getStylesText()).not.toMatch(/text-wrap(-style)?:\s*balance/);
  });
});
