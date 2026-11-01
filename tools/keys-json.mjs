/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Publishes the player's embedded public keys as data: packages/spec/keys.json
// is generated from EMBEDDED_KEYS in packages/player-oim/src/render/keys.ts, so a
// reader in any language can verify signatures without parsing TypeScript.
// Usage: node tools/keys-json.mjs           (writes packages/spec/keys.json)
//        node tools/keys-json.mjs --check   (exit 1 if the file has drifted)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const KEYS_TS = "packages/player-oim/src/render/keys.ts";
const KEYS_JSON = "packages/spec/keys.json";
const FIELDS = ["kid", "jwk", "not_after", "verify_until"];

/** Reads EMBEDDED_KEYS out of keys.ts by transpiling it (the file has no imports). */
export function extractKeys(tsSource, ts) {
  const js = ts.transpileModule(tsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  return import(mod).then((m) => m.EMBEDDED_KEYS.map((k) => {
    if ("d" in k.jwk) throw new Error(`${k.kid}: a private component (d) must never be embedded`);
    const out = {};
    for (const f of FIELDS) if (k[f] !== undefined) out[f] = k[f];
    return out;
  }));
}

export function serialize(keys) {
  return `${JSON.stringify({ keys }, null, 2)}\n`;
}

async function current() {
  const require = createRequire(new URL("../packages/player-oim/package.json", import.meta.url));
  const ts = require("typescript");
  return extractKeys(readFileSync(KEYS_TS, "utf8"), ts);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const keys = await current();
  const text = serialize(keys);
  if (process.argv.includes("--check")) {
    const onDisk = readFileSync(KEYS_JSON, "utf8").replace(/\r\n/g, "\n");
    if (onDisk !== text) {
      console.error(`${KEYS_JSON} is out of date with ${KEYS_TS}; run node tools/keys-json.mjs`);
      process.exit(1);
    }
    console.log(`${KEYS_JSON} matches ${KEYS_TS}`);
  } else {
    writeFileSync(KEYS_JSON, text);
    console.log(`wrote ${KEYS_JSON} (${keys.length} keys)`);
  }
}
