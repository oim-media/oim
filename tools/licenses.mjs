/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Fails when a production dependency uses a license outside the allowlist:
// whatever the players bundle ships to every site that embeds them.
// Usage: node tools/licenses.mjs
import { pathToFileURL } from "node:url";
import { pnpm } from "./pnpm.mjs";

const ALLOWED = new Set([
  "MIT",
  "Apache-2.0",
  "Apache-2.0 OR MIT",
  "MIT OR Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
]);

/** `report` is the output of `pnpm licenses list --prod --json`. */
export function disallowed(report) {
  return Object.entries(report)
    .filter(([license]) => !ALLOWED.has(license))
    .flatMap(([license, pkgs]) => pkgs.map((p) => `${p.name} (${license})`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const json = pnpm(["licenses", "list", "--prod", "--json"], { encoding: "utf8" });
  const bad = disallowed(JSON.parse(json));
  for (const b of bad) console.error(`disallowed license: ${b}`);
  console.log(`${bad.length} disallowed production licenses`);
  process.exit(bad.length ? 1 : 0);
}
