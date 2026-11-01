/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DefsRegistry } from "./types.js";

export function createDefsRegistry(): DefsRegistry {
  const gradientMap = new Map<string, string>();
  const definitions: string[] = [];
  let counter = 1;

  return {
    registerLinearGradient(stops, x1 = "0%", y1 = "0%", x2 = "100%", y2 = "100%"): string {
      const stopsKey = stops.map((s) => `${s.offset}:${s.color}:${s.opacity ?? 1}`).join(";");
      const key = `linear|${x1}|${y1}|${x2}|${y2}|${stopsKey}`;

      const existingId = gradientMap.get(key);
      if (existingId) {
        return existingId;
      }

      const id = `def-grad-${counter++}`;
      gradientMap.set(key, id);

      const stopsXml = stops
        .map((s) => `<stop offset="${s.offset}%" stop-color="${s.color}"${s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ""} />`)
        .join("");

      definitions.push(
        `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml}</linearGradient>`
      );

      return id;
    },

    registerRadialGradient(stops, cx = "50%", cy = "50%", r = "50%"): string {
      const stopsKey = stops.map((s) => `${s.offset}:${s.color}:${s.opacity ?? 1}`).join(";");
      const key = `radial|${cx}|${cy}|${r}|${stopsKey}`;

      const existingId = gradientMap.get(key);
      if (existingId) {
        return existingId;
      }

      const id = `def-grad-${counter++}`;
      gradientMap.set(key, id);

      const stopsXml = stops
        .map((s) => `<stop offset="${s.offset}%" stop-color="${s.color}"${s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ""} />`)
        .join("");

      definitions.push(
        `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsXml}</radialGradient>`
      );

      return id;
    },

    registerBlur(px: number): string {
      const key = `blur|${px}`;
      const existingId = gradientMap.get(key);
      if (existingId) {
        return existingId;
      }

      const id = `def-blur-${counter++}`;
      gradientMap.set(key, id);
      definitions.push(`<filter id="${id}"><feGaussianBlur stdDeviation="${px}"/></filter>`);
      return id;
    },

    registerGrain(intensity: number): string {
      const key = `grain|${intensity}`;
      const existingId = gradientMap.get(key);
      if (existingId) {
        return existingId;
      }

      const filterId = `def-grain-filter-${counter++}`;
      const patternId = `def-grain-pattern-${counter++}`;
      gradientMap.set(key, patternId);

      definitions.push(
        `<filter id="${filterId}"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/></filter>` +
        `<pattern id="${patternId}" width="128" height="128" patternUnits="userSpaceOnUse">` +
        `<rect width="128" height="128" filter="url(#${filterId})"/>` +
        `</pattern>`
      );

      return patternId;
    },

    serialize(): string {
      if (definitions.length === 0) return "";
      return `<defs>${definitions.join("")}</defs>`;
    }
  };
}

export interface SvgDocumentOptions {
  width: number;
  height: number;
  bleed?: number;
  defs: DefsRegistry;
  content: string;
  backgroundColor?: string;
}

export function buildSvgDocument(options: SvgDocumentOptions): string {
  const { width, height, bleed = 1, defs, content, backgroundColor } = options;
  const totalHeight = height + bleed;

  const defsXml = defs.serialize();
  const bgRect = backgroundColor ? `<rect width="100%" height="100%" fill="${backgroundColor}" />` : "";

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}" preserveAspectRatio="xMidYMid slice">${defsXml}${bgRect}${content}</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg.replace(/\s+/g, " ").trim())}`;
}
