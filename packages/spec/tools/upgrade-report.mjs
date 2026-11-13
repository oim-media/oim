/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runs `upgrade(v1) -> v2` over real files and says what it could not carry.
 *
 * The conformance vectors are the gate; this is the same check for any other
 * corpus (a folder of published pieces), which is where the cases the vectors
 * do not cover turn up.
 *
 *   node tools/upgrade-report.mjs <file-or-folder> [...]
 *   node tools/upgrade-report.mjs --vectors
 *
 * Needs the core built (`pnpm --filter @oim-media/core build`). Exits 1 when
 * any file leaves a key unhandled or yields an invalid 2.0 document.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync, inflateSync } from "node:zlib";
import { documentSchema, upgrade } from "../../core/dist/v2/index.js";

const specRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same reader as style-usage.mjs: the three shapes an OIM text chunk has had.
function extractMetadata(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      const nul = data.indexOf(0);
      const keyword = String.fromCharCode(...data.subarray(0, nul));
      if (keyword === "OIM_Data" || keyword === "OIM_JSON_DATA") {
        const skip = type === "tEXt" ? 1 : type === "zTXt" ? 2 : 3;
        const payload = data.subarray(nul + skip);
        for (const attempt of [
          () => inflateRawSync(payload),
          () => inflateSync(payload),
          () => inflateRawSync(Buffer.from(Buffer.from(payload).toString("latin1"), "base64")),
        ]) {
          try {
            return JSON.parse(attempt().toString("utf-8"));
          } catch { /* next shape */ }
        }
      }
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return null;
}

function filesOf(source) {
  if (statSync(source).isDirectory()) {
    return readdirSync(source).filter((f) => f.endsWith(".png")).sort().map((f) => join(source, f));
  }
  return [source];
}

let sources = process.argv.slice(2);
if (sources.includes("--vectors") || sources.length === 0) sources = [join(specRoot, "vectors")];
const files = sources.flatMap(filesOf);

const count = new Map(); // unhandled key -> files that carry it
let clean = 0;
let unreadable = 0;

for (const file of files) {
  const metadata = extractMetadata(readFileSync(file));
  if (!metadata) {
    unreadable++;
    console.log(`  ?   ${basename(file)}: no readable OIM chunk`);
    continue;
  }
  const result = upgrade(metadata);
  const parsed = documentSchema.safeParse(result.document);
  const invalid = parsed.success ? [] : parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
  for (const key of result.unhandled) count.set(key, (count.get(key) ?? 0) + 1);
  if (result.unhandled.length === 0 && invalid.length === 0) {
    clean++;
    continue;
  }
  console.log(`  no  ${basename(file)}`);
  if (result.unhandled.length) console.log(`        unhandled (${result.unhandled.length}): ${result.unhandled.slice(0, 12).join(", ")}${result.unhandled.length > 12 ? ", ..." : ""}`);
  for (const issue of invalid) console.log(`        invalid: ${issue}`);
}

if (count.size) {
  console.log("\nUnhandled keys, by how many files carry them:");
  for (const [key, n] of [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${String(n).padStart(4)}  ${key}`);
  }
}
console.log(`\n${files.length} files: ${clean} ok, ${files.length - clean - unreadable} with problems, ${unreadable} unreadable.`);
process.exit(clean === files.length ? 0 : 1);
