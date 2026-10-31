/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Which style keys real `.oim` files actually carry -- and which the contract
 * declares, and which the player reads.
 *
 * The contract declares 24 style keys; the player reads far more, because
 * `styleSchema` is `.passthrough()` and everything that grew after it was
 * written simply travelled undeclared. Deciding what to declare needs a third
 * number that neither the schema nor the player can give: what files USE.
 *
 * ## The trap this tool exists to avoid
 *
 * "No published file uses this key" does NOT mean the key is dead. It can
 * equally mean the key is NEW -- added to the player after the last file was
 * published. The two cases look identical in the data and call for opposite
 * actions: retire one, declare the other.
 *
 * So every file is dated from its own metadata, and the report states the
 * newest date it saw. Any key introduced after that date is outside what this
 * corpus can judge, and the report says so instead of guessing.
 *
 *   node tools/style-usage.mjs <fichero-o-url> [...]
 *   node tools/style-usage.mjs --vectors        # los vectores del contrato
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync, inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const specRoot = join(here, "..");
const playerSrc = join(specRoot, "..", "player-oim", "src");

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
          // Buffer, not Uint8Array: the base64 branch needs `toString`, and a
          // plain Uint8Array silently fails all three shapes, which reads as
          // "the file has no OIM chunk".
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

/** Every style key a file carries, across all of its slots. */
function styleKeysOf(metadata) {
  const keys = new Set();
  const slots = metadata.slots ?? metadata.elements ?? metadata.layers ?? [];
  for (const slot of slots) {
    for (const key of Object.keys(slot?.style ?? {})) keys.add(key);
  }
  return keys;
}

/**
 * The keys the player reads off a style object.
 *
 * `(?<![.\w])` matters: without it `element.style.backgroundImage` -- a WRITE
 * to the DOM -- counts as a read of the format, and the figure comes out
 * inflated by a third.
 */
function keysThePlayerReads() {
  const pattern = /(?<![.\w])(?:style|st)\.([A-Za-z_][A-Za-z0-9_]*)/g;
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
        const text = readFileSync(full, "utf-8");
        for (const m of text.matchAll(pattern)) found.add(m[1]);
      }
    }
  };
  walk(playerSrc);
  return found;
}

async function load(source) {
  if (source.startsWith("http")) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${response.status} ${source}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return readFileSync(source);
}

const schema = JSON.parse(readFileSync(join(specRoot, "schema", "oim.schema.json"), "utf-8"));
const declared = new Set(Object.keys(schema.$defs.style.properties));
const read = keysThePlayerReads();

let sources = process.argv.slice(2);
if (sources.includes("--vectors") || sources.length === 0) {
  const dir = join(specRoot, "vectors");
  sources = readdirSync(dir).filter((f) => f.endsWith(".oim.png")).map((f) => join(dir, f));
}

const usage = new Map(); // key -> how many files carry it
const files = [];

for (const source of sources) {
  let metadata;
  try {
    metadata = extractMetadata(await load(source));
  } catch (error) {
    console.error(`  no se pudo leer ${source}: ${error.message}`);
    continue;
  }
  if (!metadata) {
    console.error(`  sin chunk OIM legible: ${source}`);
    continue;
  }
  const keys = styleKeysOf(metadata);
  for (const key of keys) usage.set(key, (usage.get(key) ?? 0) + 1);
  files.push({
    name: basename(source),
    // `signed_at` is inside the signature; `timestamp` is not and can be
    // rewritten. Prefer the one that cannot lie.
    date: (metadata.signed_at ?? metadata.timestamp ?? "").slice(0, 10) || "sin fecha",
    slots: (metadata.slots ?? metadata.elements ?? metadata.layers ?? []).length,
    styleKeys: keys.size,
  });
}

const used = new Set(usage.keys());
const newest = files.map((f) => f.date).filter((d) => d !== "sin fecha").sort().pop() ?? "desconocida";

console.log(`\nArchivos medidos: ${files.length}`);
for (const f of files) {
  console.log(`  ${f.date}  ${String(f.slots).padStart(3)} slots  ${String(f.styleKeys).padStart(3)} claves  ${f.name}`);
}

console.log(`\nClaves de style`);
console.log(`  declaradas en el contrato        ${declared.size}`);
console.log(`  leidas por el player             ${read.size}`);
console.log(`  presentes en estos archivos      ${used.size}`);

const toDeclare = [...used].filter((k) => !declared.has(k)).sort((a, b) => usage.get(b) - usage.get(a));
console.log(`\nEn los archivos y SIN declarar: ${toDeclare.length}`);
console.log(`  (ordenadas por cuantos archivos las traen -- declarar de arriba abajo)`);
for (const key of toDeclare.slice(0, 25)) {
  console.log(`    ${String(usage.get(key)).padStart(3)}/${files.length}  ${key}`);
}
if (toDeclare.length > 25) console.log(`    … y ${toDeclare.length - 25} mas`);

const unusedByFiles = [...read].filter((k) => !used.has(k) && !declared.has(k)).sort();
console.log(`\nEl player las lee, ningun archivo las trae: ${unusedByFiles.length}`);
console.log(`  NO son necesariamente restos muertos. El archivo mas reciente medido es`);
console.log(`  de ${newest}: cualquier clave anadida despues no puede juzgarse con este`);
console.log(`  corpus. Fechar la clave antes de retirarla.`);
console.log(`    ${unusedByFiles.slice(0, 20).join(", ")}${unusedByFiles.length > 20 ? ", …" : ""}`);

const dead = [...declared].filter((k) => !read.has(k) && !used.has(k)).sort();
if (dead.length > 0) {
  console.log(`\nDeclaradas, ni leidas ni usadas: ${dead.length}`);
  console.log(`    ${dead.join(", ")}`);
}
console.log("");
