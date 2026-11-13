/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { childrenByGroup } from "../../groups.js";
import type { LayerType } from "../layer-blocks.js";
import type { DraftLayer, UpgradeContext, V1Slot } from "./context.js";

/** The fifteen layer types of 1.x and the five they become. */
export const TYPE_OF: Record<string, LayerType> = {
  text: "text",
  "artistic-text": "text",
  geo: "shape",
  shape: "shape",
  draw: "shape",
  svg: "shape",
  pattern: "shape",
  container: "shape",
  filter: "shape",
  mask: "shape",
  image: "image",
  lottie: "lottie",
  group: "group",
  component: "group",
  zone: "group",
};

/**
 * Moves each child inside its group. Membership is the core's own rule
 * (`childrenByGroup`, read from the child's `groupId`), so the 2.0 tree nests
 * exactly what every 1.x player nests. `childIds` only repeats it.
 */
export function buildTree(ctx: UpgradeContext, slots: V1Slot[], layers: DraftLayer[]): DraftLayer[] {
  const members = childrenByGroup(slots.map((s) => ({ ...s.raw, style: s.style })));
  const parentOf = new Map<string, string>();
  for (const [group, children] of members) for (const child of children) parentOf.set(child, group);

  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const top: DraftLayer[] = [];
  slots.forEach((slot, index) => {
    ctx.take(slot.style, "groupId");
    ctx.take(slot.style, "childIds");
    const layer = layers[index];
    const parent = byId.get(parentOf.get(layer.id) ?? "");
    if (parent && parent !== layer && parent.type === "group") (parent.children ??= []).push(layer);
    else top.push(layer);
  });
  return top;
}
