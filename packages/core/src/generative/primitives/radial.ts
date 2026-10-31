/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Primitive, RenderContext } from "../types.js";

export interface RadialParams {
  kind?: "rings" | "rays";
  count?: number;
  spacing?: number;
  centerX?: number;
  centerY?: number;
  distortion?: number;
}

export const renderRadial: Primitive = (rawParams, ctx) => {
  const params = rawParams as RadialParams;
  const kind = params.kind || "rings";
  const count = Math.max(3, Math.min(48, Number(params.count ?? 16)));
  const centerX = Math.max(0, Math.min(1, Number(params.centerX ?? 0.5))) * ctx.width;
  const centerY = Math.max(0, Math.min(1, Number(params.centerY ?? 0.5))) * ctx.height;
  const distortion = Math.max(0, Math.min(1, Number(params.distortion ?? 0.0)));

  let markup = "";

  if (kind === "rays") {
    const angleStep = (Math.PI * 2) / count;
    const maxRadius = Math.hypot(ctx.width, ctx.height);

    for (let i = 0; i < count; i++) {
      const color = ctx.ramp(i, count);
      const angle1 = i * angleStep;
      const angle2 = (i + 0.5 + (ctx.rng.next() - 0.5) * distortion) * angleStep;

      const x1 = centerX + Math.cos(angle1) * maxRadius;
      const y1 = centerY + Math.sin(angle1) * maxRadius;
      const x2 = centerX + Math.cos(angle2) * maxRadius;
      const y2 = centerY + Math.sin(angle2) * maxRadius;

      markup += `<polygon points="${centerX},${centerY} ${x1},${y1} ${x2},${y2}" fill="${color}" opacity="0.85" />`;
    }
  } else {
    // Concentric Rings / Fingerprint Waves
    const maxRadius = Math.hypot(Math.max(centerX, ctx.width - centerX), Math.max(centerY, ctx.height - centerY));

    for (let i = count; i >= 1; i--) {
      const color = ctx.ramp(i, count);
      const progress = i / count;
      const r = maxRadius * Math.pow(progress, 1.2);

      if (distortion > 0) {
        const pointsCount = 12;
        const angleStep = (Math.PI * 2) / pointsCount;
        let pathD = "";

        for (let p = 0; p < pointsCount; p++) {
          const angle = p * angleStep;
          const noise = (ctx.rng.next() - 0.5) * r * distortion * 0.3;
          const px = centerX + Math.cos(angle) * (r + noise);
          const py = centerY + Math.sin(angle) * (r + noise);
          pathD += p === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
        }
        pathD += " Z";
        markup += `<path d="${pathD}" fill="${color}" opacity="0.85" />`;
      } else {
        markup += `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="${color}" opacity="0.85" />`;
      }
    }
  }

  return markup;
};
