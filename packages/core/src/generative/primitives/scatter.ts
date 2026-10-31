/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface ScatterParams {
  count?: number;
  element?: "circle" | "blob" | "petal";
  sizeMin?: number;
  sizeMax?: number;
  minDistance?: number;
  distribution?: "uniform" | "edge" | "center";
}

interface PositionedElement {
  x: number;
  y: number;
  r: number;
}

export const renderScatter: Primitive = (rawParams, ctx) => {
  const params = rawParams as ScatterParams;
  const targetCount = Math.max(1, Math.min(40, Number(params.count ?? 3))); // Default 3 (Haikei standard)
  const element = params.element || "circle";
  const sizeMin = Math.max(10, Number(params.sizeMin ?? 60));
  const sizeMax = Math.max(sizeMin, Number(params.sizeMax ?? 180));
  const minDistance = Math.max(0, Number(params.minDistance ?? 40));
  const distribution = params.distribution || "uniform";

  const width = ctx.width;
  const height = ctx.height;

  const placed: PositionedElement[] = [];
  const maxAttempts = targetCount * 50;
  let attempts = 0;

  while (placed.length < targetCount && attempts < maxAttempts) {
    attempts++;
    let x = ctx.rng.next() * width;
    let y = ctx.rng.next() * height;

    if (distribution === "center") {
      const cx = width / 2;
      const cy = height / 2;
      const factor = Math.pow(ctx.rng.next(), 0.5);
      const angle = ctx.rng.next() * Math.PI * 2;
      x = cx + Math.cos(angle) * (width * 0.35 * factor);
      y = cy + Math.sin(angle) * (height * 0.35 * factor);
    } else if (distribution === "edge") {
      if (ctx.rng.next() > 0.5) {
        x = ctx.rng.next() > 0.5 ? ctx.rng.range(0, width * 0.25) : ctx.rng.range(width * 0.75, width);
      } else {
        y = ctx.rng.next() > 0.5 ? ctx.rng.range(0, height * 0.25) : ctx.rng.range(height * 0.75, height);
      }
    }

    const r = ctx.rng.range(sizeMin, sizeMax);

    // Muestreo con rechazo respetando minDistance
    let valid = true;
    for (const item of placed) {
      const dist = Math.hypot(x - item.x, y - item.y);
      if (dist < item.r + r + minDistance) {
        valid = false;
        break;
      }
    }

    if (valid) {
      placed.push({ x, y, r });
    }
  }

  let markup = "";
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const color = ctx.ramp(i, Math.max(1, placed.length));

    if (element === "petal") {
      const pathD = `M ${p.x} ${p.y} C ${p.x + p.r} ${p.y - p.r * 1.5}, ${p.x + p.r * 2} ${p.y}, ${p.x} ${p.y + p.r * 2} Z`;
      markup += `<path d="${pathD}" fill="${color}" stroke="${color}" opacity="0.85" />`;
    } else if (element === "blob") {
      const r0 = p.r * (0.8 + ctx.rng.next() * 0.4);
      const r1 = p.r * (0.8 + ctx.rng.next() * 0.4);
      const r2 = p.r * (0.8 + ctx.rng.next() * 0.4);
      const r3 = p.r * (0.8 + ctx.rng.next() * 0.4);

      const pathD = `M ${p.x} ${p.y - r0} C ${p.x + r1} ${p.y - r0}, ${p.x + r1} ${p.y + r2}, ${p.x} ${p.y + r2} C ${p.x - r3} ${p.y + r2}, ${p.x - r3} ${p.y - r0}, ${p.x} ${p.y - r0} Z`;
      markup += `<path d="${pathD}" fill="${color}" opacity="0.85" />`;
    } else {
      markup += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${color}" opacity="0.85" />`;
    }
  }

  return markup;
};
