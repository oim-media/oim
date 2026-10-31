/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface BlobParams {
  count?: number;
  points?: number;
  irregularity?: number;
  anchor?: "center" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";
  size?: number;
}

export const renderBlob: Primitive = (rawParams, ctx) => {
  const params = rawParams as BlobParams;
  const count = Math.max(1, Math.min(6, Number(params.count ?? 1)));
  const numPoints = Math.max(5, Math.min(14, Number(params.points ?? 8)));
  const irregularity = Math.max(0, Math.min(1, Number(params.irregularity ?? 0.5)));
  const anchor = params.anchor || "center";
  const baseSize = Math.max(100, Number(params.size ?? Math.min(ctx.width, ctx.height) * 0.45));

  const width = ctx.width;
  const height = ctx.height;

  let markup = "";

  for (let b = 0; b < count; b++) {
    const color = ctx.ramp(b, count);
    const size = baseSize * (1 - (b * 0.15));

    let tx = width / 2;
    let ty = height / 2;

    if (anchor === "corner-tl") {
      tx = 0;
      ty = 0;
    } else if (anchor === "corner-tr") {
      tx = width;
      ty = 0;
    } else if (anchor === "corner-bl") {
      tx = 0;
      ty = height;
    } else if (anchor === "corner-br") {
      tx = width;
      ty = height;
    }

    const angleStep = (Math.PI * 2) / numPoints;
    const points: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      const radiusNoise = (ctx.rng.next() - 0.5) * size * irregularity;
      const r = Math.max(20, size + radiusNoise);
      points.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r
      });
    }

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < numPoints; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % numPoints];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      pathD += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
    }
    pathD += " Z";

    markup += `
      <g transform="translate(${tx}, ${ty})">
        <path d="${pathD}" fill="${color}" opacity="${0.9 - b * 0.1}" />
      </g>
    `;
  }

  return markup;
};
