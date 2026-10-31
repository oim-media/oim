/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Proves a diff only touched comments: every changed .ts/.js file must print
// the same code (parsed, then printed without comments) as at the base ref.
// Usage: node tools/comments-only.mjs [base-ref]   (default: main)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../packages/core/package.json", import.meta.url));
const ts = require("typescript");
const base = process.argv[2] ?? "main";

const printer = ts.createPrinter({ removeComments: true });
const code = (text, file) =>
  printer.printFile(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false)).split("\n");

const changed = execFileSync("git", ["diff", "--name-only", base, "--", "*.ts", "*.js", "*.mjs"], { encoding: "utf8" })
  .split("\n").filter(Boolean).filter(existsSync);

let bad = 0;
for (const file of changed) {
  const before = execFileSync("git", ["show", `${base}:${file}`], { encoding: "utf8" });
  const a = code(before, file), b = code(readFileSync(file, "utf8"), file);
  const i = a.findIndex((line, k) => line !== b[k]);
  if (i === -1 && a.length === b.length) continue;
  bad++;
  const at = i === -1 ? Math.min(a.length, b.length) : i;
  console.error(`${file}: code changed at printed line ${at + 1}:\n  - ${a[at]}\n  + ${b[at]}`);
}
console.log(`${changed.length} files checked, ${bad} with code changes`);
process.exit(bad ? 1 : 0);
