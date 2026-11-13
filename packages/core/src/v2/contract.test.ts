/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The 2.0 draft as JSON Schema, generated from v2/schema.ts so the two cannot
// drift. Regenerate with `vitest run v2/contract -u`.
import { expect, it } from "vitest";
import { z } from "zod";
import { DOCUMENT_VERSION, documentSchema } from "./schema.js";

it("oim2.schema.json is up to date with v2/schema.ts", async () => {
  const generated = z.toJSONSchema(documentSchema, { io: "input", reused: "ref" }) as Record<string, unknown>;
  delete generated.$schema;
  const file =
    JSON.stringify(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: `https://oim.media/spec/${DOCUMENT_VERSION}/oim.schema.json`,
        title: "OIM document 2.0 (draft)",
        specVersion: DOCUMENT_VERSION,
        ...generated,
      },
      null,
      2,
    ) + "\n";
  await expect(file).toMatchFileSnapshot("../../../spec/schema/oim2.schema.json");
});
