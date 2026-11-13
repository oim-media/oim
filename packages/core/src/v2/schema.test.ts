/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { DOCUMENT_VERSION, documentSchema } from "./schema.js";

const base = { oim: DOCUMENT_VERSION, canvas: { width: 1080, height: 1350 }, languages: ["es"] };
const doc = (layers: unknown[]) => ({ ...base, layers });
const issues = (d: unknown) => {
  const parsed = documentSchema.safeParse(d);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};
const ok = (d: unknown) => expect(issues(d)).toEqual([]);
const bad = (d: unknown) => expect(documentSchema.safeParse(d).success).toBe(false);
const box = { x: 0, y: 0, width: 100, height: 40 };
const rect = { id: "a", type: "shape", box, geometry: { kind: "rect" } };

describe("document 2.0", () => {
  it("accepts a shape with a bound fill, a stroke, a shadow and an entrance", () =>
    ok(doc([{
      id: "card", type: "shape", box, geometry: { kind: "rect" }, corners: 24,
      fills: [{ kind: "color", value: { var: "accent" } }],
      strokes: [{ paint: { kind: "color", value: "#18181B" }, width: 2 }],
      effects: [{ kind: "shadow", blur: 40, y: 12, opacity: 0.3 }],
      animations: [{ on: "load", preset: "fade-up", duration: 600 }],
    }])));

  it("a layer with no optional block is valid: absent means default", () => ok(doc([rect])));

  it("rejects a block on a type that does not admit it", () => {
    bad(doc([{ id: "g", type: "group", box, children: [], fills: [{ kind: "color", value: "#000" }] }]));
    bad(doc([{ id: "i", type: "image", box, image: { src: "data:image/png;base64,AA" }, text: { content: { es: "x" } } }]));
    bad(doc([{ ...rect, children: [] }]));
  });

  it("rejects an unknown key, and accepts anything under extensions", () => {
    bad(doc([{ ...rect, shadowEnabled: false }]));
    ok(doc([{ ...rect, extensions: { studio: { locked: true } } }]));
  });

  it("a value is a literal, a binding, or a literal with per-mode exceptions", () => {
    const text = (size: unknown) =>
      doc([{ id: "t", type: "text", box, text: { content: { es: "Hola" }, font: { family: "Inter", size } } }]);
    ok(text(64));
    ok(text({ var: "title-size" }));
    ok(text({ value: 64, modes: { en: 56 } }));
    bad(text({ var: 3 }));
    bad(text({ value: 64 }));
  });

  it("an animation carries a preset or tracks, never both nor neither", () => {
    const anim = (a: object) => doc([{ ...rect, animations: [{ on: "load", duration: 300, ...a }] }]);
    ok(anim({ preset: "fade-up" }));
    ok(anim({ tracks: [{ property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] }));
    bad(anim({}));
    bad(anim({ preset: "fade-up", tracks: [{ property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] }));
    bad(anim({ tracks: [{ property: "color", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] }));
  });

  it("a text range target is only valid on text layers", () => {
    const entrance = { on: "load", target: "chars", preset: "fade-up", duration: 300 };
    bad(doc([{ ...rect, animations: [entrance] }]));
    ok(doc([{ id: "t", type: "text", box, text: { content: { es: "Hola" } }, animations: [entrance] }]));
  });

  it("children nest", () =>
    ok(doc([{ id: "g", type: "group", box, children: [{ id: "g2", type: "group", box, children: [rect] }] }])));

  it("opacity is 0 to 1", () => {
    ok(doc([{ ...rect, opacity: 0.5 }]));
    bad(doc([{ ...rect, opacity: 50 }]));
  });

  it("layer ids are unique across the whole tree", () =>
    bad(doc([rect, { id: "g", type: "group", box, children: [rect] }])));

  it("only a 2.x version is a 2.0 document", () => {
    bad({ ...doc([rect]), oim: "1.27.9" });
  });
});
