/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The cases live in packages/spec/action-cases.json so every player
// (web, Flutter) resolves an action list the same way.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveActions, type StateAction } from "./states.js";

type Case = {
  name: string;
  actions: StateAction[];
  current: Record<string, boolean>;
  expected: { visibility: Record<string, boolean>; texts: Record<string, string> };
};
const CASES: Case[] = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "spec", "action-cases.json"), "utf8"));

describe("resolveActions shared cases", () => {
  it("has cases", () => expect(CASES.length).toBeGreaterThan(5));
  for (const c of CASES) {
    it(c.name, () => expect(resolveActions(c.actions, c.current)).toEqual(c.expected));
  }
});
