/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Decision (14 Nov): a 1.x zone becomes a 2.0 group WITHOUT its flow. A zone was a
// flex box that laid its layers out and ignored their x/y; 2.0 groups have no
// layout, so the zone keeps its box and paint and each layer stays at its own x/y.
// A file that relied on the flow paints differently. No editor creates zones and
// no conformance vector uses them; if zones come back, groups get a layout block.
import { toCanvasUnits } from "./box.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object } from "./context.js";
import { isColor } from "./paints.js";

export const FLOW_KEYS = ["display", "flexDirection", "justifyContent", "alignItems", "gap", "padding"];

const percent = (value: unknown, of: number): number => (typeof value === "number" && Number.isFinite(value) ? (value / 100) * of : 0);

function zoneGroup(ctx: UpgradeContext, value: unknown, index: number): DraftLayer {
  const zone: V1Object = { ...(asObject(value) ?? {}) };
  const style: V1Object = { ...(asObject(zone.style) ?? {}) };
  ctx.register(zone, `zones[${index}]`);
  ctx.register(style, `zones[${index}].style`);
  ctx.take(zone, "style");
  const id = String(ctx.take(zone, "id") ?? `zone-${index + 1}`);
  const pos = Array.isArray(zone.position) ? zone.position : [0, 0];
  const size = Array.isArray(zone.size) ? zone.size : [100, 100];
  ctx.take(zone, "position");
  ctx.take(zone, "size");
  for (const key of FLOW_KEYS) ctx.retire(style, key);

  const { width: W, height: H } = ctx.canvas;
  const box = { x: percent(pos[0], W), y: percent(pos[1], H), width: percent(size[0], W), height: percent(size[1], H) };
  const group: DraftLayer = { id, type: "group", box, children: [] };

  const blur = /^blur\((\d+(?:\.\d+)?)px\)$/.exec(String(ctx.take(style, "backdropFilter") ?? "").trim());
  if (blur) group.effects = [{ kind: "backdrop", blur: Number(blur[1]) }];

  // A group paints nothing of its own: the zone's background is a shape at its bottom.
  const background = ctx.take(style, "background");
  const corners = toCanvasUnits(ctx.take(style, "borderRadius"), W);
  if (isColor(background)) {
    const plate: DraftLayer = { id: `${id}__background`, type: "shape", box: { ...box }, geometry: { kind: "rect" }, fills: [{ kind: "color", value: background }] };
    if (corners) plate.corners = corners;
    group.children!.push(plate);
  }
  return group;
}

/**
 * The root `zones` as groups, at the bottom of the stack (1.x put them before
 * every layer), each holding the layers whose `zone_id` names it, in their order.
 */
export function convertZones(ctx: UpgradeContext, meta: V1Object, layers: DraftLayer[], zoneOf: Map<DraftLayer, string>): DraftLayer[] {
  const list = ctx.take(meta, "zones");
  if (!Array.isArray(list) || list.length === 0) return layers;
  const groups = list.map((value, index) => zoneGroup(ctx, value, index));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const rest = layers.filter((layer) => {
    const group = byId.get(zoneOf.get(layer) ?? "");
    if (group) group.children!.push(layer);
    return !group;
  });
  return [...groups, ...rest];
}
