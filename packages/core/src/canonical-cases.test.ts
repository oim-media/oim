/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The case lives in packages/spec/canonical-cases.json so every implementation
// (TypeScript, Rust, Dart) rebuilds the same signed bytes from the same input.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { serializeCanonical } from "./canonical.js";

const CASE = JSON.parse(readFileSync(join(__dirname, "..", "..", "spec", "canonical-cases.json"), "utf8"));

it("serializeCanonical matches the shared known-answer case", () => {
  expect(new TextDecoder().decode(serializeCanonical(CASE.input))).toBe(CASE.expected);
});
