/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Reads a 1.x document as a 2.0 one. Pure: the input is never modified and
// nothing is signed. A 1.x file is verified with its own bytes first; this
// runs afterwards, in memory.

import { normalizeLegacyKeys } from "../legacyKeys.js";
import type { OimDocument } from "./schema.js";
import { convertAnimations } from "./upgrade/animations.js";
import { convertBox } from "./upgrade/box.js";
import { canvasEffects, convertEffects } from "./upgrade/effects.js";
import { convertGeometry } from "./upgrade/geometry.js";
import { RETIRED_STYLE_KEYS } from "./upgrade/keys.js";
import { convertMask } from "./upgrade/mask.js";
import { canvasFills, convertPaints } from "./upgrade/paints.js";
import { asObject, createContext, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./upgrade/context.js";
import { canvasOf, convertRoot, languagesOf, rolesOf } from "./upgrade/root.js";
import { convertText } from "./upgrade/text.js";
import { buildTree, TYPE_OF } from "./upgrade/tree.js";
import { convertVariables } from "./upgrade/variables.js";

export type UpgradeResult = {
  document: OimDocument;
  /** 1.x keys dropped on purpose, such as `root.signature`. */
  retired: string[];
  /** 1.x keys nobody converted. A complete upgrade leaves this empty. */
  unhandled: string[];
};

export type Converter = (ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer) => void;

/** One converter per block, in the order they run. */
// Order matters twice: the image block must exist before the effects decide
// where the colour filters go, and the mask runs last because it replaces the
// geometry, fill and stroke of the layer that takes that role.
const CONVERTERS: Converter[] = [
  convertBox,
  convertText,
  convertPaints,
  convertGeometry,
  convertEffects,
  convertAnimations,
  convertMask,
];

export function isV2(input: unknown): boolean {
  const version = asObject(input)?.oim;
  return typeof version === "string" && /^2\./.test(version);
}

// Short aliases retired in 1.12.0 and still present in old files.
const SLOT_ALIASES: [alias: string, key: string][] = [
  ["p", "position"],
  ["st", "style"],
  ["c", "content"],
  ["t", "tracking_data"],
];

function readSlot(ctx: UpgradeContext, value: unknown, index: number): V1Slot {
  const raw: V1Object = { ...(asObject(value) ?? {}) };
  for (const [alias, key] of SLOT_ALIASES) {
    if (raw[key] === undefined && raw[alias] !== undefined) raw[key] = raw[alias];
    delete raw[alias];
  }
  const style: V1Object = { ...(asObject(raw.style) ?? {}) };
  ctx.register(raw, "slot");
  ctx.register(style, "style");
  ctx.take(raw, "style");
  // `s` was a size nobody wrote; `zone_id` pointed at zones no file declares.
  ctx.retire(raw, "s");
  ctx.retire(raw, "zone_id");
  for (const key of RETIRED_STYLE_KEYS) ctx.retire(style, key);
  if (raw.id === undefined) raw.id = `layer-${index + 1}`;
  const type = typeof raw.type === "string" ? raw.type : "text";
  return { raw, style, type };
}

function startLayer(ctx: UpgradeContext, slot: V1Slot): DraftLayer {
  const { raw } = slot;
  const layer: DraftLayer = {
    id: String(ctx.take(raw, "id")),
    type: TYPE_OF[slot.type] ?? "shape",
    box: { x: 0, y: 0, width: 0, height: 0 },
  };
  ctx.take(raw, "type");
  if (!(slot.type in TYPE_OF)) ctx.note(`slot.type: unknown layer type "${slot.type}"`);

  const name = ctx.take(raw, "name");
  if (typeof name === "string" && name) layer.name = name;

  const languages = ctx.take(raw, "languages");
  if (Array.isArray(languages) && languages.length > 0) layer.languages = languages.filter((l) => typeof l === "string");

  const pending = ctx.take(raw, "pendingTranslation");
  if (Array.isArray(pending) && pending.length > 0) {
    layer.extensions = { ...layer.extensions, studio: { pendingTranslation: pending } };
  }
  return layer;
}

/** What a layer type cannot exist without, when no converter supplied it. */
function completeLayer(layer: DraftLayer): void {
  if (layer.type === "shape") layer.geometry ??= { kind: "rect" };
  if (layer.type === "text") layer.text ??= { content: {} };
  if (layer.type === "image") layer.image ??= { src: "oim:base" };
  if (layer.type === "group") layer.children ??= [];
  layer.children?.forEach(completeLayer);
}

export function upgrade(input: unknown): UpgradeResult {
  if (isV2(input)) return { document: input as OimDocument, retired: [], unhandled: [] };

  const meta: V1Object = normalizeLegacyKeys(asObject(input) ?? {});
  const ctx = createContext(canvasOf(meta), languagesOf(meta)[0], rolesOf(meta));
  ctx.register(meta, "root");

  const { document, slots: rawSlots } = convertRoot(ctx, meta);
  const slots = rawSlots.map((value, index) => readSlot(ctx, value, index));
  const layers = slots.map((slot) => {
    const layer = startLayer(ctx, slot);
    for (const convert of CONVERTERS) convert(ctx, slot, layer);
    return layer;
  });

  document.layers = buildTree(ctx, slots, layers);

  const variables = convertVariables(ctx, meta, document.languages);
  if (variables) document.variables = variables;

  const background = canvasFills(ctx, meta);
  if (background.length > 0) document.canvas = { ...document.canvas, fills: background };

  // Effects over the whole canvas become one last layer that covers it.
  const overall = canvasEffects(ctx, meta);
  if (overall.length > 0) {
    document.layers.push({
      id: "__canvas-effects",
      type: "shape",
      box: { x: 0, y: 0, width: ctx.canvas.width, height: ctx.canvas.height },
      geometry: { kind: "rect" },
      effects: overall,
    });
  }
  document.layers.forEach(completeLayer);

  return { document, ...ctx.finish() };
}
