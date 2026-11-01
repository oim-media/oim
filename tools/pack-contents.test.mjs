/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALLOWED, unexpected } from "./pack-contents.mjs";

describe("tarball contents", () => {
  it("flags a source file in the core tarball", () => {
    expect(unexpected(["dist/index.js", "src/schema.ts"], ALLOWED.core)).toEqual(["src/schema.ts"]);
  });

  it("keeps the CDN demo site out of the player package", () => {
    expect(unexpected(["dist/oim-player.js", "dist/demo/paisaje.jpg", "dist/_headers"], ALLOWED["player-oim"])).toEqual([
      "dist/demo/paisaje.jpg",
      "dist/_headers",
    ]);
  });

  it("the built player carries the third-party notices", () => {
    const txt = readFileSync(fileURLToPath(new URL("../packages/player-oim/dist/THIRD_PARTY_NOTICES", import.meta.url)), "utf8");
    expect(txt).toMatch(/lottie-web@5\.\d+\.\d+/);
    expect(txt).toMatch(/Permission is hereby granted, free of charge/);
  });
});
