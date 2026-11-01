/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates the format contract as JSON Schema, and guards against it drifting.
 *
 * `schema.ts` defines the `.oim` format in Zod, which only serves TypeScript.
 * A player in Swift, Kotlin or Rust cannot read it: it would have to be translated
 * by hand, and that translation is a copy. Copies drift -measured in this same
 * project: `groups.ts` accumulated 546 lines that differed between the player and
 * the editor, `layerComposition.ts` 775-. A JSON Schema contract is the part that
 * survives the language.
 *
 * But generating a file and committing it creates EXACTLY the problem this is
 * meant to close: another copy, which can go stale. That is why the generator and
 * the guard are the same test. If someone edits the Zod and does not regenerate,
 * this fails; the JSON cannot lie about the TypeScript.
 *
 * Regenerate after a deliberate change to the schema:
 *
 *     pnpm --filter @oim-media/core test -- -u
 *
 * `io: "input"` because the schema describes what is READ from a file already
 * written, not what a transformation produces. Today both coincide -there is no
 * `.transform()` or `.default()` in `schema.ts`- and that coincidence is a
 * property worth not losing by accident: the test pins it.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { CONTRACT_VERSION, minVersionFor, BASE_CONTRACT_VERSION } from "./compatibility";
import {
  OimMetadataSchema,
  OvmMetadataSchema,
  slotSchema,
  styleSchema,
  contentSchema,
  keyframeSchema,
  positionSchema,
  zoneSchema,
  interactionSchema,
  parallaxSchema,
  parallaxInfiniteSchema,
  trackingKeyframeSchema,
  embeddedFontSchema,
  cssColorSchema,
  maskCutSchema,
  generativeFillSchema,
} from "./schema";

/**
 * Names of the shared definitions.
 *
 * `slot` appears three times in the metadata -`slots`, `elements`, `layers`-.
 * Without this, Zod inlines all three, and the contract goes from 668 lines to
 * 2384 with three copies of the same definition: the problem this directory is
 * meant to close, reproduced inside the file itself.
 *
 * With `reused: "ref"` it is emitted once, but Zod names it `__schema3`. A
 * contract that another language is going to read cannot have names like that.
 */
const NAMES: [z.ZodType, string][] = [
  [slotSchema, "slot"],
  [styleSchema, "style"],
  [contentSchema, "content"],
  [keyframeSchema, "keyframe"],
  [positionSchema, "position"],
  [zoneSchema, "zone"],
  [interactionSchema, "interaction"],
  [parallaxSchema, "parallax"],
  [parallaxInfiniteSchema, "parallaxInfinite"],
  [trackingKeyframeSchema, "trackingKeyframe"],
  [embeddedFontSchema, "embeddedFont"],
  // 1.8.0: one colour definition shared by every colour key, instead of
  // sixteen free strings.
  [cssColorSchema, "cssColor"],
  [maskCutSchema, "maskCut"],
  [generativeFillSchema, "generativeFill"],
];
for (const [zodSchema, id] of NAMES) z.globalRegistry.add(zodSchema, { id });

// The version comes from `compatibility.ts`, which is the one that uses it to
// decide whether a reader can handle a file. Writing it here too would be the
// same duplication this directory exists to close: the JSON and the code could
// have announced different versions.

const BASE = "https://oim.media/spec";

function contractOf(zodSchema: z.ZodType, id: string, title: string) {
  const generated = z.toJSONSchema(zodSchema, { io: "input", reused: "ref" }) as Record<string, unknown>;
  // Order matters: `$id` and the version must be read before the 21
  // properties, so that a person opening the file knows what they are looking at.
  return closeTuples(inlinePrimitives({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${BASE}/${CONTRACT_VERSION}/${id}.schema.json`,
    title: title,
    specVersion: CONTRACT_VERSION,
    ...generated,
  }));
}

/**
 * Puts back inline the definitions that are a bare primitive.
 *
 * `reused: "ref"` extracts EVERYTHING that repeats, including a lone `z.number()`
 * that appeared as `$defs.__schema0 = {"type":"number"}`. A reference to a number
 * saves nothing and forces whoever reads the contract to jump elsewhere to find
 * out it was a number. Only named shapes are shared.
 */
function inlinePrimitives(zodSchema: any): any {
  const defs = zodSchema.$defs ?? {};
  const trivial = new Set(
    Object.keys(defs).filter((k) => {
      const keys = Object.keys(defs[k]);
      return keys.length === 1 && keys[0] === "type";
    }),
  );
  if (trivial.size === 0) return zodSchema;

  const substitute = (node: any): any => {
    if (Array.isArray(node)) return node.map(substitute);
    if (!node || typeof node !== "object") return node;
    const ref: string | undefined = node.$ref;
    if (ref) {
      const name = ref.replace("#/$defs/", "");
      // The SIBLING keys of the `$ref` are kept. Returning only the primitive
      // dropped `deprecated` and `description`: marking a key as retired left no
      // trace in the published contract, and the failure was silent -the file
      // came out well-formed, just without the warning-.
      if (trivial.has(name)) {
        const { $ref: _discarded, ...siblings } = node;
        return { ...defs[name], ...siblings };
      }
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, substitute(v)]));
  };

  const clean = substitute(zodSchema);
  for (const name of trivial) delete clean.$defs[name];
  if (Object.keys(clean.$defs).length === 0) delete clean.$defs;
  return clean;
}

/**
 * Closes the tuples, which Zod leaves open when translating.
 *
 * `z.tuple([number, number])` requires EXACTLY two elements, but it is emitted
 * as `prefixItems` without `minItems` or `maxItems`, and in JSON Schema that
 * means "the first two are like this, the rest can be anything". Measured: the
 * contract accepted `position: [10]` and `position: [10, 20, 30]`, which Zod
 * rejects.
 *
 * It is the most costly discrepancy possible, because `position` decides where
 * each slot is painted: a player in Swift validating against the contract would
 * have accepted a malformed position that the TypeScript player rejects, and the
 * result would have been a file that looks different depending on who opens it.
 *
 * `items: false` is the 2020-12 way of forbidding extra elements. If the tuple
 * had a rest element, Zod would already emit `items` and nothing here is touched.
 */
function closeTuples(node: any): any {
  if (Array.isArray(node)) return node.map(closeTuples);
  if (!node || typeof node !== "object") return node;
  const out: any = Object.fromEntries(
    Object.entries(node).map(([k, v]) => [k, closeTuples(v)]),
  );
  if (Array.isArray(out.prefixItems) && out.items === undefined) {
    out.minItems = out.prefixItems.length;
    out.items = false;
  }
  return out;
}

function comoFichero(objeto: unknown): string {
  return JSON.stringify(objeto, null, 2) + "\n";
}

describe("the contract in JSON Schema", () => {
  it("oim.schema.json is up to date with schema.ts", async () => {
    await expect(comoFichero(contractOf(OimMetadataSchema, "oim", "OIM document metadata")))
      .toMatchFileSnapshot("../../spec/schema/oim.schema.json");
  });

  it("ovm.schema.json is up to date with schema.ts", async () => {
    await expect(comoFichero(contractOf(OvmMetadataSchema, "ovm", "OVM document metadata")))
      .toMatchFileSnapshot("../../spec/schema/ovm.schema.json");
  });
});

describe("properties the contract promises to other languages", () => {
  /**
   * `slots` is the only required field of the format. A player that did not
   * require it would accept an empty `.oim` as valid.
   */
  it("declares slots as required and nothing else", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.required).toEqual(["slots"]);
  });

  /**
   * `passthrough` is what lets a `.oim` written by a NEW editor avoid crashing an
   * OLD player: the keys it does not know survive. It is the friendly half of
   * compatibility -the other half, warning that something was not understood, is
   * covered by `min_player`-.
   */
  it("accepts unknown keys, which is how it survives future versions", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.additionalProperties).not.toBe(false);
  });

  /**
   * The check that actually bites, and it was born from a real fault: the first
   * version of this test compared `io: "input"` with `io: "output"`, assuming they
   * differed only when there were transformations. They differed for another reason.
   *
   * Zod emits `additionalProperties: false` on nested objects when asked for the
   * OUTPUT shape. But its real behaviour when reading is not that: measured on
   * `canvas`, a `.oim` with an unknown key inside is ACCEPTED -Zod discards it,
   * it does not reject it-.
   *
   * Publishing the output schema would give a contract that lies: a player in
   * Swift validating against it would reject files that the TypeScript player
   * paints. And the author of the file would have no way of knowing which of the
   * two is right.
   */
  it("does not forbid unknown keys in any object, because Zod does not either", () => {
    const conCanvasExtendido = {
      slots: [],
      canvas: { natural_width: 100, natural_height: 50, clave_de_una_version_futura: 7 },
    };
    // The reference implementation accepts it...
    expect(OimMetadataSchema.safeParse(conCanvasExtendido).success).toBe(true);

    // ...so the published contract cannot forbid it anywhere.
    const closed: string[] = [];
    (function walk(node: any, route: string) {
      if (!node || typeof node !== "object") return;
      if (node.additionalProperties === false) closed.push(route || "(root)");
      for (const [key, child] of Object.entries(node)) walk(child, route ? `${route}.${key}` : key);
    })(contractOf(OimMetadataSchema, "oim", "x"), "");

    expect(closed).toEqual([]);
  });
});

describe("1.1.0 retires allow_external_urls without breaking what is already published", () => {
  /**
   * The promise of this version bump: retiring the field does NOT invalidate a
   * file that carries it. The schemas are `.passthrough()`, so the field simply
   * stops meaning anything.
   *
   * Without this test, the promise lives only in a comment.
 */
  it("a .oim from the 1.0.0 era with the field still validates", () => {
    const antiguo = {
      version: "1.0.0",
      allow_external_urls: true,
      slots: [],
    };
    const r = OimMetadataSchema.safeParse(antiguo);
    expect(r.success).toBe(true);
  });

  it("but the contract no longer declares it", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(Object.keys(s.properties)).not.toContain("allow_external_urls");
    expect(s.specVersion).toBe(CONTRACT_VERSION);
  });
});

describe("1.2.0: the principal under * does not change the schema", () => {
  it("a content with * and one valid exception", () => {
    expect(contentSchema.safeParse({ "*": "oim-media:a", pt: "oim-media:b" }).success).toBe(true);
  });

  it("the contract declares 1.2.0", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.specVersion).toBe(CONTRACT_VERSION);
  });
});

describe("1.4.0 closes the drift and marks what was retired", () => {
  it("the root declares `reedicion`, with its three values", () => {
    // It was the worst gap in the contract: it decides a PERMISSION -who may
    // re-edit the work- and was not declared anywhere. A foreign player ignored
    // it and treated as re-editable something that is not.
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.reedicion.enum).toEqual(["publico", "solo_autor", "sellado"]);
  });

  it("the root declares `reedit`, with its English values (contract 1.23.0)", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.reedit.enum).toEqual(["public", "author_only", "sealed"]);
  });

  it("the root declares `name`", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.name).toBeDefined();
  });

  it("the two that `allow_external_urls` left behind are marked, not deleted", () => {
    // Marked and not deleted on purpose: the backend still honors them if a file
    // carries the retired key, so removing them from the contract would make it
    // lie in the other direction.
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.terms_accepted.deprecated).toBe(true);
    expect(s.properties.redirect_membership_verified.deprecated).toBe(true);
  });

  it("inlining a primitive does not take down what accompanies it", () => {
    // `reused: "ref"` moves every repeated primitive to `$defs`, and the property
    // is left as `{ deprecated, description, $ref }`. The inliner returned ONLY
    // the primitive, so marking a key as retired left no trace in the published
    // contract. The failure was silent: the file came out well-formed, just
    // without the warning.
    //
    // Today the real schema puts the metadata BEFORE `.optional()` and does not
    // generate that `$ref`, so this test is the only place that walks that path.
    // Without it, the fix can be reverted and nothing will complain.
    const withRef = z.object({
      marcada: z.boolean().optional().meta({ deprecated: true, description: "retirada" }),
      other: z.boolean().optional(),
      tercera: z.boolean().optional(),
    });
    const s = contractOf(withRef, "probe", "x") as any;
    expect(s.properties.marcada.deprecated).toBe(true);
    expect(s.properties.marcada.description).toBe("retirada");
    expect(s.properties.marcada.type).toBe("boolean");
  });

  // Up to 1.6.0 the opposite was required here ("NOT marked: the player really
  // applies it"), because that was the case. In 1.7.0 the player stops applying
  // it (sandbox, a product decision) and the test changes with the fact:
  // sandbox-no-network.test.ts, in the player, pins that it is no longer applied.
  it("`allowed_domains` is marked from 1.7.0: the player no longer applies it", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.allowed_domains.deprecated).toBe(true);
  });
});

describe("1.12.0 marks what nobody uses, without deleting it (audit of 10 Oct)", () => {
  const root = () => contractOf(OimMetadataSchema, "oim", "x") as any;
  const styleSchema = () => {
    const r = root();
    const slot = r.properties.slots.items.$ref ? r.$defs[r.properties.slots.items.$ref.split("/").pop()] : r.properties.slots.items;
    const st = slot.properties.style;
    return st.$ref ? r.$defs[st.$ref.split("/").pop()] : st;
  };

  // 1.21.0 added colour roles in patterns and backgrounds; 1.22.0 added reveal, trigger and play.
  it("the contract declares 1.25.1", () => {
    expect(CONTRACT_VERSION).toBe("1.25.1");
  });

  // A repeated definition goes to $defs and the property keeps a $ref.
  const prop = (k: string) => {
    const r = root(); const v = styleSchema().properties[k];
    return v?.$ref ? { ...r.$defs[v.$ref.split("/").pop()], ...v } : v;
  };

  it("in style: textTransform, verticalAlign, shader_fx, per-layer grain and blendMode", () => {
    for (const k of ["textTransform", "verticalAlign", "shader_fx", "grain", "grainIntensity", "grainSize", "grainBlend", "blendMode"]) {
      expect(prop(k)?.deprecated, k).toBe(true);
    }
  });

  it("blendMode is closed to the nine values the editor offered", () => {
    expect([...prop("blendMode").enum].sort()).toEqual(
      ["color-burn", "color-dodge", "darken", "difference", "lighten", "multiply", "normal", "overlay", "screen"]);
  });

  it("at the root: elements, layers, grain and effects; slots does not", () => {
    const p = root().properties;
    for (const k of ["elements", "layers", "grain", "effects"]) expect(p[k]?.deprecated, k).toBe(true);
    expect(p.slots.deprecated).toBeUndefined();
  });

  it("a file that still carries what was retired keeps validating", () => {
    const r = OimMetadataSchema.safeParse({ slots: [{ id: "a", style: { blendMode: "multiply", textTransform: "uppercase", grain: true } }], grain: { enabled: true } });
    expect(r.success).toBe(true);
  });
});

describe("1.3.0 documents embedded fonts without requiring them", () => {
  it("the contract declares embedded fonts", () => {
    const s = contractOf(OimMetadataSchema, "oim", "x") as any;
    expect(Object.keys(s.properties)).toContain("fonts");
  });

  it("using fonts does not raise min_player: an old reader ignores it and fetches the font from Google", () => {
    expect(minVersionFor({ capabilities: [] })).toBe(BASE_CONTRACT_VERSION);
  });
});

