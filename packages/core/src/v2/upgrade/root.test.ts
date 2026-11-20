/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { languagesOf } from "./root.js";

describe("languagesOf", () => {
  it("keeps the declared list", () => {
    expect(languagesOf({ languages: ["en", "es"] })).toEqual(["en", "es"]);
  });

  it("without a list, reads the languages the slots' content carries", () => {
    const meta = { slots: [{ content: { es: "Hola", en: "Hello" } }, { content: { "*": "<svg/>", fr: "Salut" } }] };
    expect(languagesOf(meta)).toEqual(["es", "en", "fr"]);
  });

  it("falls back to es when nothing says otherwise", () => {
    expect(languagesOf({ slots: [{ content: "plain" }] })).toEqual(["es"]);
  });
});
