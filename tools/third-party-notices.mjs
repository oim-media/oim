/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Writes THIRD_PARTY_NOTICES into a build output: the MIT license of a
// dependency the player ships (lottie-web) requires its notice to travel with it.
// Usage: node tools/third-party-notices.mjs <package-name> <outDir>
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [pkg, outDir] = process.argv.slice(2);
const report = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json", "--filter", pkg], { encoding: "utf8", shell: true }),
);

const sections = Object.entries(report).flatMap(([license, deps]) =>
  deps.map((d) => {
    const dir = d.paths[0];
    const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
    if (!file) throw new Error(`${d.name}: no LICENSE file in ${dir}`);
    return `${d.name}@${d.versions.join(", ")} (${license})\n\n${readFileSync(join(dir, file), "utf8").trim()}`;
  }),
);

writeFileSync(
  join(outDir, "THIRD_PARTY_NOTICES"),
  `${pkg} includes the following third-party software.\n\n${sections.join(`\n\n${"-".repeat(72)}\n\n`)}\n`,
);
console.log(`THIRD_PARTY_NOTICES: ${sections.length} dependencies`);
