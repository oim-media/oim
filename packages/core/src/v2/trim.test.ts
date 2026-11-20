/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, it } from "vitest";
import { trimDash } from "./trim.js";

it("an untrimmed outline needs no dash", () => {
  expect(trimDash(undefined)).toBeUndefined();
  expect(trimDash({})).toBeUndefined();
  expect(trimDash({ start: 0, end: 1 })).toBeUndefined();
});

it("the drawn share is the dash, the start is the offset, on an outline of length 1", () => {
  expect(trimDash({ end: 0.25 })).toEqual({ dasharray: "0.25 2", dashoffset: 0 });
  expect(trimDash({ start: 0.5 })).toEqual({ dasharray: "0.5 2", dashoffset: -0.5 });
  expect(trimDash({ start: 0.2, end: 0.7 })).toEqual({ dasharray: "0.5 2", dashoffset: -0.2 });
});

it("an end before the start, or out of 0..1, is clamped and draws nothing rather than a negative dash", () => {
  expect(trimDash({ start: 0.8, end: 0.3 })).toEqual({ dasharray: "0 2", dashoffset: -0.8 });
  expect(trimDash({ start: -1, end: 5 })).toBeUndefined();
});
