/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const SVG_NS = "http://www.w3.org/2000/svg";
let sequence = 0;

/** A silhouette as path data, its viewBox, and for a rectangle its corner radius as a fraction of the box. */
export type ClipSilhouette = { d: string; viewBox: string; rect?: { rx: number; ry: number }; evenodd?: boolean };

/** Path data for a silhouette given as polygon points or as a path. */
export const silhouettePath = (figure: { d?: string; points?: string }): string =>
  figure.d ?? "M " + figure.points!.split(" ").join(" L ") + " Z";

/**
 * A zero-size <svg> holding a clipPath in objectBoundingBox units, so the silhouette
 * maps onto whatever box references it, at any size. Returns the svg and the
 * `clip-path` value that references it.
 */
export function silhouetteClip(doc: Document, silhouette: ClipSilhouette): { svg: SVGSVGElement; clipPath: string } {
  const id = `oim-image-fill-${++sequence}`;
  const [x0, y0, width, height] = silhouette.viewBox.trim().split(/\s+/).map(Number);
  const scale = width === height ? `scale(${1 / width})` : `scale(${1 / width} ${1 / height})`;
  const transform = x0 || y0 ? `${scale} translate(${-x0} ${-y0})` : scale;

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const clip = doc.createElementNS(SVG_NS, "clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "objectBoundingBox");
  const shape = doc.createElementNS(SVG_NS, silhouette.rect ? "rect" : "path");
  if (silhouette.rect) {
    for (const [k, v] of [["x", "0"], ["y", "0"], ["width", "1"], ["height", "1"], ["rx", String(silhouette.rect.rx)], ["ry", String(silhouette.rect.ry)]]) shape.setAttribute(k, v);
  } else {
    shape.setAttribute("d", silhouette.d);
    shape.setAttribute("transform", transform);
    if (silhouette.evenodd) shape.setAttribute("clip-rule", "evenodd");
  }
  clip.appendChild(shape);
  svg.appendChild(clip);
  return { svg, clipPath: `url(#${id})` };
}
