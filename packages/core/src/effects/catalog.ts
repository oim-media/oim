/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TexturePreset } from "./types.js";

export interface TextureDefinition {
  id?: TexturePreset;
  nameEs?: string;
  nameEn?: string;
  category?: "grain" | "halftone" | "surface";
  defaultBlend: "overlay" | "soft-light" | "multiply" | "screen";
  defaultIntensity: number;
  tileWidth: number;
  tileHeight: number;
  /** Generates or provides the self-contained data URI pattern with color and intensity */
  getDataUri: (color?: string, intensity?: number) => string;
}

function safeColorSvg(color?: string): string {
  const c = (color || "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) || /^rgba?\([\d.,\s%]+\)$/.test(c) ? c : "#ffffff";
}

function createGrainSvg(color = "#ffffff", opacity = 0.35, freq = 0.75, octaves = 3): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="luminanceToAlpha" result="a"/><feFlood flood-color="${c}"/><feComposite in2="a" operator="in"/></filter><rect width="128" height="128" filter="url(#g)" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createDustScratchesSvg(color = "#ffffff", opacity = 0.3): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="d"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="3" result="t1"/><feColorMatrix in="t1" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -15" result="scratches"/><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="t2"/><feColorMatrix in="t2" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -22" result="dust"/><feMerge result="m"><feMergeNode in="scratches"/><feMergeNode in="dust"/></feMerge><feColorMatrix in="m" type="luminanceToAlpha" result="a"/><feFlood flood-color="${c}"/><feComposite in2="a" operator="in"/></filter><rect width="256" height="256" filter="url(#d)" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createVintagePaperSvg(color = "#ffffff", opacity = 0.25): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="vp"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.04" numOctaves="4" result="t"/><feColorMatrix in="t" type="luminanceToAlpha" result="a"/><feFlood flood-color="${c}"/><feComposite in2="a" operator="in"/></filter><rect width="256" height="256" filter="url(#vp)" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createRoughCanvasSvg(color = "#ffffff", opacity = 0.3): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><filter id="rc"><feTurbulence type="fractalNoise" baseFrequency="0.35 0.35" numOctaves="3" result="t"/><feColorMatrix in="t" type="luminanceToAlpha" result="a"/><feFlood flood-color="${c}"/><feComposite in2="a" operator="in"/></filter><rect width="128" height="128" filter="url(#rc)" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createHalftoneDotsUri(color = "#ffffff", opacity = 0.25, spacing = 16, radius = 2.5): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spacing}" height="${spacing}"><circle cx="${spacing / 2}" cy="${spacing / 2}" r="${radius}" fill="${c}" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createScanlinesUri(color = "#ffffff", opacity = 0.2, spacing = 8, thickness = 1): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spacing}" height="${spacing}"><rect width="${spacing}" height="${thickness}" fill="${c}" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createConcentricRingsUri(color = "#ffffff", opacity = 0.25, spacing = 32): string {
  const c = safeColorSvg(color);
  const op = Math.max(0.01, Math.min(1, opacity));
  const rOuter = spacing / 2 - 1;
  const rInner = spacing / 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spacing}" height="${spacing}"><circle cx="${spacing / 2}" cy="${spacing / 2}" r="${rOuter}" fill="none" stroke="${c}" stroke-width="1.5" opacity="${op}"/><circle cx="${spacing / 2}" cy="${spacing / 2}" r="${rInner}" fill="none" stroke="${c}" stroke-width="1.5" opacity="${op}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const TEXTURE_CATALOG: Record<TexturePreset, TextureDefinition> = {
  "film-grain-35mm": {
    defaultBlend: "overlay",
    defaultIntensity: 35,
    tileWidth: 128,
    tileHeight: 128,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createGrainSvg(color, (intensity !== undefined ? intensity : 35) / 100, 0.75, 3),
  },
  "fine-noise": {
    defaultBlend: "overlay",
    defaultIntensity: 25,
    tileWidth: 128,
    tileHeight: 128,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createGrainSvg(color, (intensity !== undefined ? intensity : 25) / 100, 0.95, 2),
  },
  "dust-scratches": {
    defaultBlend: "screen",
    defaultIntensity: 30,
    tileWidth: 256,
    tileHeight: 256,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createDustScratchesSvg(color, (intensity !== undefined ? intensity : 30) / 100),
  },
  "vintage-paper": {
    defaultBlend: "multiply",
    defaultIntensity: 25,
    tileWidth: 256,
    tileHeight: 256,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createVintagePaperSvg(color, (intensity !== undefined ? intensity : 25) / 100),
  },
  "rough-canvas": {
    defaultBlend: "overlay",
    defaultIntensity: 30,
    tileWidth: 128,
    tileHeight: 128,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createRoughCanvasSvg(color, (intensity !== undefined ? intensity : 30) / 100),
  },
  "halftone-dots": {
    defaultBlend: "overlay",
    defaultIntensity: 25,
    tileWidth: 16,
    tileHeight: 16,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createHalftoneDotsUri(color, (intensity !== undefined ? intensity : 25) / 100, 16, 2.5),
  },
  "scanlines": {
    defaultBlend: "overlay",
    defaultIntensity: 20,
    tileWidth: 8,
    tileHeight: 8,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createScanlinesUri(color, (intensity !== undefined ? intensity : 20) / 100, 8, 1),
  },
  "concentric-rings": {
    defaultBlend: "soft-light",
    defaultIntensity: 25,
    tileWidth: 32,
    tileHeight: 32,
    getDataUri: (color = "#ffffff", intensity?: number) =>
      createConcentricRingsUri(color, (intensity !== undefined ? intensity : 25) / 100, 32),
  },
};
