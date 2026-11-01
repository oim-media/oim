/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extractKeys, serialize } from "./keys-json.mjs";

const require = createRequire(new URL("../packages/player-oim/package.json", import.meta.url));
const ts = require("typescript");
const tsSource = readFileSync(new URL("../packages/player-oim/src/render/keys.ts", import.meta.url), "utf8");
// A Windows checkout may write CRLF; the generator always writes LF.
const readKeysJson = () => readFileSync(new URL("../packages/spec/keys.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("spec keys.json", () => {
  it("is exactly what keys.ts embeds (run node tools/keys-json.mjs after changing keys)", async () => {
    const onDisk = readKeysJson();
    expect(onDisk).toBe(serialize(await extractKeys(tsSource, ts)));
  });

  it("notices when a key in keys.ts changes", async () => {
    const changed = tsSource.replace("kid: 'v1'", "kid: 'v9'");
    const onDisk = readKeysJson();
    expect(onDisk).not.toBe(serialize(await extractKeys(changed, ts)));
  });

  it("publishes only public components", async () => {
    const keys = JSON.parse(readFileSync(new URL("../packages/spec/keys.json", import.meta.url), "utf8")).keys;
    for (const k of keys) expect(Object.keys(k.jwk)).not.toContain("d");
  });

  it("refuses to publish a private component", async () => {
    const leaky = tsSource.replace("kty: 'EC',", "kty: 'EC', d: 'AAAA',");
    await expect(extractKeys(leaky, ts)).rejects.toThrow(/private component/);
  });
});
