/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Every on-demand script the CDN player can fetch must be pinned in the
 * bundle: its sha384 has to appear in `dist/oim-player.js`. The build injects
 * the hashes (vite.config.ts); this test fails if the vendor modes run after
 * the main build, because the hashes are then computed from nothing.
 *
 * Reads built artifacts, like dist-up-to-date.test.js.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = fs.readFileSync(path.join(root, "dist", "oim-player.js"), "utf8");
const vendorDir = path.join(root, "dist", "player", "v1", "vendor");

const sha384 = (file: string) =>
  "sha384-" + createHash("sha384").update(fs.readFileSync(file)).digest("base64");

describe("the bundle pins every on-demand vendor script", () => {
  it("there are vendor files to pin", () => {
    expect(fs.readdirSync(vendorDir).length).toBeGreaterThanOrEqual(4);
  });

  for (const file of fs.readdirSync(vendorDir)) {
    it(`${file} has its sha384 in dist/oim-player.js`, () => {
      expect(
        bundle.includes(sha384(path.join(vendorDir, file))),
        `the hash of ${file} is not in the bundle: the vendor build ran after the main build, or the define is missing.`
      ).toBe(true);
    });
  }
});
