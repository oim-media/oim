/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tagMatches } from "./versions.mjs";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");

describe("package versions follow the contract", () => {
  it("versions match the contract", () => {
    const contract = /CONTRACT_VERSION = "([\d.]+)"/.exec(read("packages/core/src/compatibility.ts"))[1];
    for (const p of ["core", "player-oim", "player-ovm", "spec"]) {
      const j = JSON.parse(read(`packages/${p}/package.json`));
      expect([j.name, j.version, j.private ?? false]).toEqual([`@oim-media/${p}`, contract, false]);
    }
    const viewerPkg = JSON.parse(read("apps/viewer-desktop/package.json"));
    const tauriConf = JSON.parse(read("apps/viewer-desktop/src-tauri/tauri.conf.json"));
    const cargoToml = read("apps/viewer-desktop/src-tauri/Cargo.toml");
    const cargoVersion = /^version\s*=\s*"([\d.]+)"/m.exec(cargoToml)?.[1];
    expect([viewerPkg.name, viewerPkg.version, viewerPkg.private]).toEqual([
      "@oim-media/viewer-desktop",
      contract,
      true,
    ]);
    expect(tauriConf.version).toBe(contract);
    // Tauri v2's asset handler injects a style-src nonce when `csp` is non-null,
    // which makes WebView2 ignore `'unsafe-inline'` and block `<oim-player>` styles.
    expect(tauriConf.app?.security?.csp).toBeNull();
    expect(cargoVersion).toBe(contract);
  });

  it("a release tag must name the contract version", () => {
    expect(tagMatches("v1.27.0", "1.27.0")).toBe(true);
    expect(tagMatches("v1.24.0", "1.27.0")).toBe(false);
  });
});
