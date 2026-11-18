/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** A 2.0 geometry as the mask outline fields the composition reads: a named shape, or `custom` with its path. */
export function maskOutlineStyle(geometry: unknown): { maskShape?: string; maskSvgPath?: string } {
  const g = geometry as { kind?: string; name?: string; paths?: { d: string }[] } | undefined;
  const named: Record<string, string> = { rect: "rectangle", ellipse: "circle", line: "line" };
  const maskShape = g?.kind === "preset" ? g.name : g?.kind === "paths" ? "custom" : named[g?.kind ?? ""];
  return { maskShape, maskSvgPath: g?.kind === "paths" ? g.paths?.map((p) => p.d).join(" ") : undefined };
}
