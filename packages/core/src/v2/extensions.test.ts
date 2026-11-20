/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, it } from "vitest";
import { unsupportedRequired } from "./extensions.js";

it("a document with no required extension has nothing unsupported", () => {
  expect(unsupportedRequired({})).toEqual([]);
  expect(unsupportedRequired({ extensionsUsed: ["x.fancy"] })).toEqual([]);
});

it("every required extension is unsupported: the reference reader implements none", () => {
  expect(unsupportedRequired({ extensionsRequired: ["x.fancy", "x.other"] })).toEqual(["x.fancy", "x.other"]);
});
