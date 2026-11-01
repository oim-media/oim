/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { disallowed } from "./licenses.mjs";

describe("production dependency licenses", () => {
  it("accepts the allowed licenses", () => {
    expect(disallowed({ MIT: [{ name: "zod" }], "Apache-2.0": [{ name: "x" }] })).toEqual([]);
  });

  it("rejects copyleft and unknown", () => {
    expect(disallowed({ "GPL-3.0": [{ name: "a" }], Unknown: [{ name: "b" }] })).toEqual([
      "a (GPL-3.0)",
      "b (Unknown)",
    ]);
  });
});
