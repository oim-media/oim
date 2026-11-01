/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A release tag must name the contract version: publishing v1.22.1 while the
// contract still says 1.22.0 would ship packages that lie about what they read.
// Usage: node tools/versions.mjs <tag>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function tagMatches(tag, version) {
  return tag === `v${version}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = readFileSync("packages/core/src/compatibility.ts", "utf8");
  const contract = /CONTRACT_VERSION = "([\d.]+)"/.exec(src)[1];
  const tag = process.argv[2];
  if (!tagMatches(tag, contract)) {
    console.error(`tag ${tag} does not match CONTRACT_VERSION ${contract}`);
    process.exit(1);
  }
  console.log(`tag ${tag} matches the contract`);
}
