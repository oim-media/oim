/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { pictureOf } from "./image.js";

describe("pictureOf", () => {
  it("a picture that travels in the file is its own source", () => {
    expect(pictureOf({ src: "data:image/png;base64,AA==" }, "es")).toBe("data:image/png;base64,AA==");
  });

  it("the file's own base picture is not painted by its layer; the page paints it behind the layers", () => {
    expect(pictureOf({ src: "oim:base" }, "es")).toBeUndefined();
    expect(pictureOf({ src: { value: "oim:base", modes: {} } }, "es")).toBeUndefined();
  });

  it("a language can have its own picture; an empty one shows none", () => {
    const src = { value: "data:image/png;base64,AA==", modes: { en: "data:image/png;base64,BB==" } };
    expect(pictureOf({ src }, "en")).toBe("data:image/png;base64,BB==");
    expect(pictureOf({ src }, "fr")).toBe("data:image/png;base64,AA==");
    expect(pictureOf({ src: { value: "data:image/png;base64,AA==", modes: { en: "" } } }, "en")).toBeUndefined();
  });

  it("a reference that is not resolved paints nothing", () => {
    expect(pictureOf({ src: { ref: "missing" } as never }, "es")).toBeUndefined();
  });
});
