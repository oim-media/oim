/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The player runs `upgrade` on every file it opens, and its bundle has no room
// for zod. Only type imports may reach the schema from the upgrade path.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const files = [
  join(__dirname, "upgrade.ts"),
  ...readdirSync(join(__dirname, "upgrade"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(__dirname, "upgrade", f)),
];

it("the upgrade path imports the schema and zod only as types", () => {
  const offending = files.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/^import\s+(?!type\s)[^;]*from\s+"([^"]+)"/gm)]
      .filter(([, from]) => from === "zod" || from.endsWith("/schema.js") || from === "./schema.js")
      .map(([line]) => `${file}: ${line}`),
  );
  expect(offending).toEqual([]);
});
