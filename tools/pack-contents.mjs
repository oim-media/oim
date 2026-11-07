/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Pins what each published tarball may contain, so a source file, a test or
// the CDN demo site never ships by accident.
// Usage: node tools/pack-contents.mjs   (run after `pnpm build`)
import { pathToFileURL } from "node:url";
import { pnpm } from "./pnpm.mjs";

const BASE = [/^package\.json$/, /^README\.md$/, /^LICENSE$/, /^NOTICE$/];

export const ALLOWED = {
  core: [...BASE, /^dist\/.*\.(js|d\.ts|js\.map)$/],
  "player-oim": [...BASE, /^dist\/esm\/[\w.-]+\.js$/, /^dist\/oim-player\.js$/, /^dist\/vendor\/[\w.-]+\.js$/, /^dist\/THIRD_PARTY_NOTICES$/, /^src\/index\.d\.ts$/],
  "player-ovm": [...BASE, /^src\/[\w.-]+\.js$/],
  spec: [...BASE, /^(BINARY_SPEC|CANONICAL_SPEC)\.md$/, /^(marks|keyframe|action|pattern|text-effect|artistic-text)-cases\.json$/, /^keys\.json$/, /^schema\/[\w.-]+\.json$/, /^vectors\/.+/, /^tools\/parity(-core)?\.mjs$/],
};

/** Files that match none of the allowed patterns. */
export function unexpected(files, allowed) {
  return files.filter((f) => !allowed.some((re) => re.test(f)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  for (const [name, allowed] of Object.entries(ALLOWED)) {
    const out = pnpm(["pack", "--dry-run", "--json"], { cwd: `packages/${name}`, encoding: "utf8" });
    const files = JSON.parse(out).files.map((f) => f.path.split("\\").join("/"));
    for (const f of unexpected(files, allowed)) {
      bad++;
      console.error(`${name}: unexpected file in tarball: ${f}`);
    }
    if (name === "player-oim" && !files.includes("dist/THIRD_PARTY_NOTICES")) {
      bad++;
      console.error("player-oim: THIRD_PARTY_NOTICES missing from tarball");
    }
  }
  console.log(`${bad} tarball problems`);
  process.exit(bad ? 1 : 0);
}
