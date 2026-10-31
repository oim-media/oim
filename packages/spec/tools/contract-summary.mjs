/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dumps what the OIM contract declares, what the vectors actually carry, and
 * where the two disagree.
 *
 * Why this exists: the contract is generated from Zod and a test guards that
 * pair, but nothing compares the contract against real signed files. On
 * 18 September 2026 that gap had already produced four divergences, found by
 * hand. The worst: `reedicion` -- which decides who may re-edit a work -- is
 * written into every file and read by the player, yet is declared nowhere in
 * the schema. A second implementation reading only the contract would not
 * know the field exists.
 *
 * It reports; it does not fix and it does not fail. Turning the drift into a
 * failing test is the right end state, but the drift has to be resolved
 * first -- a test that is born red teaches everyone to ignore it.
 *
 *   node tools/contract-summary.mjs            # human-readable report
 *   node tools/contract-summary.mjs --json     # machine-readable, same data
 *   node tools/contract-summary.mjs --write    # writes contract-summary.json
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync, inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const specRoot = join(here, "..");

/** Root keys the signing backend strips before it signs (core/utils.py). */
const UNSIGNED_KEYS = ["signature", "key_version", "timestamp", "creator_user_id"];

/**
 * Reads the OIM payload out of a PNG.
 *
 * Deliberately a plain chunk walk rather than an import from @oim-media/core: this
 * tool has to be able to disagree with the implementation. Sharing the parser
 * would mean a bug in the parser hides itself from the report.
 *
 * Three chunk types carry it, because different generators picked different
 * ones: tEXt (raw or base64 deflate), zTXt (one compression byte) and iTXt
 * (a compression flag, a method byte and a language tag).
 */
function readOimChunk(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let metadata = null;
  let idatBytes = 0;
  let offset = 8; // the 8-byte PNG signature

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, length });
    if (type === "IDAT") idatBytes += length;

    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      const nul = data.indexOf(0);
      const keyword = String.fromCharCode(...data.subarray(0, nul));
      if (keyword === "OIM_Data" || keyword === "OIM_JSON_DATA") {
        const skip = type === "tEXt" ? 1 : type === "zTXt" ? 2 : 3;
        const payload = data.subarray(nul + skip);
        metadata = decompress(payload);
      }
    }

    offset += 12 + length;
    if (type === "IEND") break;
  }
  return { chunks, metadata, idatBytes, fileBytes: bytes.length };
}

function decompress(payload) {
  const attempts = [
    () => inflateRawSync(payload),
    () => inflateSync(payload),
    () => inflateRawSync(Buffer.from(payload.toString("latin1"), "base64")),
  ];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt().toString("utf-8"));
    } catch {
      // Next shape. A chunk that decodes under none of them is reported as
      // unreadable rather than silently skipped.
    }
  }
  return null;
}

/** A property's declared shape, flattened to one readable line. */
function describe(property) {
  if (!property || typeof property !== "object") return "?";
  if (property.enum) return `enum: ${property.enum.join(", ")}`;
  if (property.$ref) return property.$ref.replace("#/$defs/", "→ ");
  const parts = [property.type ?? "?"];
  if (property.maxItems) parts.push(`máx ${property.maxItems} elementos`);
  if (property.maxLength) parts.push(`máx ${property.maxLength} caracteres`);
  if (property.items?.maxLength) parts.push(`cada uno máx ${property.items.maxLength} caracteres`);
  if (property.items?.$ref) parts.push(`de ${property.items.$ref.replace("#/$defs/", "")}`);
  return parts.join(" · ");
}

function build() {
  const schema = JSON.parse(readFileSync(join(specRoot, "schema", "oim.schema.json"), "utf-8"));
  const declared = Object.keys(schema.properties ?? {});

  const vectorsDir = join(specRoot, "vectors");
  const vectors = readdirSync(vectorsDir)
    .filter((f) => f.endsWith(".oim.png"))
    .sort()
    .map((file) => {
      const parsed = readOimChunk(readFileSync(join(vectorsDir, file)));
      const metadata = parsed.metadata ?? {};
      const oimChunk = parsed.chunks.find((c) => ["tEXt", "zTXt", "iTXt"].includes(c.type));
      return {
        file,
        fileBytes: parsed.fileBytes,
        oimChunkBytes: oimChunk ? oimChunk.length : 0,
        jsonBytes: Buffer.byteLength(JSON.stringify(metadata), "utf-8"),
        idatBytes: parsed.idatBytes,
        slots: (metadata.slots ?? metadata.elements ?? metadata.layers ?? []).length,
        rootKeys: Object.keys(metadata).sort(),
        signed: Boolean(metadata.signature),
        sealed: Boolean(metadata.image_hash),
        chunks: parsed.chunks.map((c) => `${c.type}(${c.length})`),
      };
    });

  const carried = [...new Set(vectors.flatMap((v) => v.rootKeys))].sort();
  const undeclared = carried.filter((k) => !declared.includes(k));
  const unused = declared.filter((k) => !carried.includes(k));
  // `deprecated` en el JSON Schema es la respuesta a «¿esto sigue vigente?».
  // Antes se preguntaba leyendo los comentarios; ahora lo dice el contrato, y
  // por eso las retiradas dejan de contarse como huecos sin probar: una clave
  // marcada NO necesita un vector que la ejerza.
  const retired = declared.filter((k) => schema.properties?.[k]?.deprecated === true);
  const untested = unused.filter((k) => !retired.includes(k));

  return {
    generatedAt: new Date().toISOString(),
    contract: {
      id: schema.$id,
      title: schema.title,
      rootKeyCount: declared.length,
      required: schema.required ?? [],
      acceptsUndeclaredKeys: schema.additionalProperties !== false,
      definitions: Object.keys(schema.$defs ?? {}).filter((d) => !d.startsWith("__")),
      keys: declared.sort().map((key) => ({
        key,
        shape: describe(schema.properties[key]),
        required: (schema.required ?? []).includes(key),
        signed: !UNSIGNED_KEYS.includes(key),
      })),
    },
    vectors,
    drift: {
      // Carried by real signed files, absent from the contract. This is the
      // direction that breaks a second implementation.
      undeclared,
      // Declared but no vector exercises it. Kept for compatibility with
      // anything already reading this field.
      unused,
      // Marked `deprecated` in the contract: a reader must not write them.
      retired,
      // Declared, live, and no vector exercises them. The real gap.
      untested,
    },
  };
}

function report(summary) {
  const { contract, vectors, drift } = summary;
  console.log(`\nContrato  ${contract.id}`);
  console.log(`          ${contract.rootKeyCount} claves en la raíz · obligatorias: ${contract.required.join(", ") || "ninguna"}`);
  console.log(`          admite claves no declaradas: ${contract.acceptsUndeclaredKeys ? "sí" : "no"}`);
  console.log(`          ${contract.definitions.length} sub-definiciones: ${contract.definitions.join(", ")}\n`);

  console.log("Vectores");
  for (const v of vectors) {
    const marks = [v.signed ? "firmado" : "SIN FIRMAR", v.sealed ? "sellado" : "SIN SELLAR"].join(" · ");
    console.log(
      `  ${v.file.padEnd(26)} ${String(v.fileBytes).padStart(6)} B` +
        ` · OIM ${String(v.oimChunkBytes).padStart(5)} B` +
        ` · JSON ${String(v.jsonBytes).padStart(5)} B` +
        ` · ${String(v.slots).padStart(2)} slots · ${marks}`
    );
  }

  console.log("\nDeriva");
  if (drift.undeclared.length === 0) {
    console.log("  · los vectores no llevan ninguna clave fuera del contrato");
  } else {
    console.log(`  · EN LOS ARCHIVOS, NO EN EL CONTRATO: ${drift.undeclared.join(", ")}`);
    console.log("    Una implementación que lea solo el contrato no sabrá que existen.");
  }
  if (drift.retired.length > 0) {
    console.log(`  · RETIRADAS, marcadas en el contrato: ${drift.retired.join(", ")}`);
    console.log("    Siguen declaradas para no romper lo ya publicado; un lector nuevo no debe escribirlas.");
  }
  if (drift.untested.length > 0) {
    console.log(`  · vigentes y sin vector que las ejerza: ${drift.untested.join(", ")}`);
    console.log("    Ningún archivo de prueba las usa: una implementación puede leerlas mal y pasar la conformidad.");
  }
  console.log("");
}

const summary = build();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else if (process.argv.includes("--write")) {
  const out = join(specRoot, "contract-summary.json");
  writeFileSync(out, JSON.stringify(summary, null, 2) + "\n", "utf-8");
  console.log(`Escrito: ${out}`);
} else {
  report(summary);
}
