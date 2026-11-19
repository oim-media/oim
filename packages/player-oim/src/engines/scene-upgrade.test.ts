/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";

const calls = vi.hoisted(() => ({ ensure: 0 }));
vi.mock("../../../scene/src/runtime/upgrade-entry.js", async (real) => ({
  ...(await real<object>()),
  ensureUpgrade: async () => { calls.ensure++; },
}));
import { doc2, paintedEngine } from "./scene-engine.fixture";

describe("the upgrade script is fetched only for 1.x files", () => {
  it("a 2.0 file paints without asking for it", async () => {
    await paintedEngine(doc2([]));
    expect(calls.ensure).toBe(0);
  });

  it("a 1.x file asks for it", async () => {
    await paintedEngine({ slots: [], canvas: { width: 100, height: 100 } });
    expect(calls.ensure).toBe(1);
  });
});
