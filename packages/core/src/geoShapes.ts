/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Geometry of the catalogue shapes, in the editor's `viewBox 0 0 100 100`.
 *
 * CANONICAL: the editor and the player both use this module; never fork it.
 *
 * **It exists because these numbers already diverged.** They were written by
 * hand on both sides: the editor's triangle was inset 5% on each side and the
 * player's was full bleed; not one of the star's ten points matched. The same
 * file looked different depending on where it was opened.
 */

export type ShapeDrawing =
  | { tipo: "polygon"; puntos: [number, number][] }
  /** `rellenable: false` para los trazos abiertos: la linea. */
  | { tipo: "path"; d: string; rellenable: boolean };

export const GEO_SHAPES: Record<string, ShapeDrawing> = {
  triangle: { tipo: "polygon", puntos: [[50, 5], [95, 90], [5, 90]] },
  star: {
    tipo: "polygon",
    puntos: [[50, 2], [62, 38], [100, 38], [69, 59], [80, 95], [50, 73], [20, 95], [31, 59], [0, 38], [38, 38]],
  },
  arrow: { tipo: "polygon", puntos: [[5, 40], [60, 40], [60, 20], [95, 50], [60, 80], [60, 60], [5, 60]] },
  diamond: { tipo: "polygon", puntos: [[50, 5], [95, 50], [50, 95], [5, 50]] },
  hexagon: { tipo: "polygon", puntos: [[25, 5], [75, 5], [95, 50], [75, 95], [25, 95], [5, 50]] },
  // El circulo es un arco y no un poligono: aproximarlo con puntos le pondria
  // facetas visibles al agrandarlo.
  circle: { tipo: "path", d: "M 50,5 A 45,45 0 1,1 49.999,5 Z", rellenable: true },
  heart: {
    tipo: "path",
    d: "M 50,88 C 10,60 -5,30 15,12 C 30,-2 50,5 50,25 C 50,5 70,-2 85,12 C 105,30 90,60 50,88 Z",
    rellenable: true,
  },
  // Abierta: rellenarla la convertiria en una barra.
  line: { tipo: "path", d: "M 5,50 L 95,50", rellenable: false },
  // Forma generativa: blob orgánico continuo
  blob: {
    tipo: "path",
    d: "M 50,10 C 75,10 92,25 90,50 C 88,75 75,90 50,90 C 25,90 10,75 10,50 C 10,25 25,10 50,10 Z",
    rellenable: true,
  },
  // Forma generativa: garabato / subrayado editorial abierto
  scribble: {
    tipo: "path",
    d: "M 5,80 Q 25,65 50,75 T 95,70 Q 75,85 50,82 T 5,88",
    rellenable: false,
  },
  // Contract 1.19.0: twelve shapes that work as photo frames. Only M, L, C and
  // Z with absolute coordinates, so every number in `d` is an x,y in 0-100.
  pill: {
    tipo: "path",
    d: "M 30,25 L 70,25 C 83.8,25 95,36.2 95,50 C 95,63.8 83.8,75 70,75 L 30,75 C 16.2,75 5,63.8 5,50 C 5,36.2 16.2,25 30,25 Z",
    rellenable: true,
  },
  octagon: { tipo: "polygon", puntos: [[30, 5], [70, 5], [95, 30], [95, 70], [70, 95], [30, 95], [5, 70], [5, 30]] },
  pentagon: { tipo: "polygon", puntos: [[50, 5], [94.7, 37.5], [77.6, 90], [22.4, 90], [5.3, 37.5]] },
  cross: {
    tipo: "polygon",
    puntos: [[35, 5], [65, 5], [65, 35], [95, 35], [95, 65], [65, 65], [65, 95], [35, 95], [35, 65], [5, 65], [5, 35], [35, 35]],
  },
  // The crescent: the outer arc is the left half of a circle, the inner one bulges back into it.
  moon: {
    tipo: "path",
    d: "M 50,5 C 25.15,5 5,25.15 5,50 C 5,74.85 25.15,95 50,95 C 30,80 30,20 50,5 Z",
    rellenable: true,
  },
  cloud: {
    tipo: "path",
    d: "M 25,85 C 8,85 5,62 22,58 C 14,40 35,32 45,42 C 48,22 75,20 78,42 C 96,40 97,66 80,68 C 80,78 78,85 68,85 Z",
    rellenable: true,
  },
  drop: {
    tipo: "path",
    d: "M 50,5 C 62,25 80,45 80,65 C 80,81.5 66.5,95 50,95 C 33.5,95 20,81.5 20,65 C 20,45 38,25 50,5 Z",
    rellenable: true,
  },
  // Asymmetric on purpose: a mirrored bolt would hide a photo flip.
  bolt: { tipo: "polygon", puntos: [[62, 5], [18, 58], [46, 58], [34, 95], [82, 40], [55, 40], [72, 5]] },
  bubble: {
    tipo: "path",
    d: "M 20,5 L 80,5 C 88.3,5 95,11.7 95,20 L 95,57 C 95,65.3 88.3,72 80,72 L 42,72 L 22,93 L 28,72 L 20,72 C 11.7,72 5,65.3 5,57 L 5,20 C 5,11.7 11.7,5 20,5 Z",
    rellenable: true,
  },
  flower: {
    tipo: "path",
    d: "M 65.6,41.0 C 85.5,35.7 97.5,39.9 95.0,50.0 C 97.5,60.1 85.5,64.3 65.6,59.0 C 80.1,73.5 82.5,86.1 72.5,89.0 C 65.0,96.2 55.3,87.9 50.0,68.0 C 44.7,87.9 35.0,96.2 27.5,89.0 C 17.5,86.1 19.9,73.5 34.4,59.0 C 14.5,64.3 2.5,60.1 5.0,50.0 C 2.5,39.9 14.5,35.7 34.4,41.0 C 19.9,26.5 17.5,13.9 27.5,11.0 C 35.0,3.8 44.7,12.1 50.0,32.0 C 55.3,12.1 65.0,3.8 72.5,11.0 C 82.5,13.9 80.1,26.5 65.6,41.0 Z",
    rellenable: true,
  },
  // Twelve tips, alternating radius 45 and 34.
  burst: {
    tipo: "polygon",
    puntos: [
      [95, 50], [82.8, 58.8], [89, 72.5], [74, 74], [72.5, 89], [58.8, 82.8], [50, 95], [41.2, 82.8],
      [27.5, 89], [26, 74], [11, 72.5], [17.2, 58.8], [5, 50], [17.2, 41.2], [11, 27.5], [26, 26],
      [27.5, 11], [41.2, 17.2], [50, 5], [58.8, 17.2], [72.5, 11], [74, 26], [89, 27.5], [82.8, 41.2],
    ],
  },
  arch: {
    tipo: "path",
    d: "M 5,95 L 5,50 C 5,25.15 25.15,5 50,5 C 74.85,5 95,25.15 95,50 L 95,95 Z",
    rellenable: true,
  },
};

/**
 * Las formas que puede tener un marco con foto: todas menos la linea y el
 * garabato, que son trazos abiertos. El rectangulo va primero, porque es el
 * marco por defecto y no esta en GEO_SHAPES.
 */
export const FRAME_SHAPES: string[] = [
  "rectangle",
  ...Object.keys(GEO_SHAPES).filter((k) => k !== "line" && k !== "scribble"),
];

/**
 * Determina si una forma geométrica está en el catálogo oficial o es rect/rectangle.
 */
export function isKnownGeoShape(geoShape?: string): boolean {
  if (!geoShape) return false;
  if (geoShape === "rect" || geoShape === "rectangle") return true;
  return geoShape in GEO_SHAPES;
}

/**
 * El dibujo de una forma, o `undefined` si no se conoce.
 *
 * SIN valor por defecto a proposito. Cuando esto caia a "pinta el fondo y ya",
 * cinco formas del catalogo -corazon, rombo, hexagono, flecha y linea- se
 * publicaban como rectangulos de color, y en silencio. Quien llama tiene que
 * decidir que hacer con lo desconocido.
 *
 * El rectangulo NO esta en la tabla: no se dibuja con esta geometria sino con
 * el ancho, el alto y el radio de esquina en pixeles reales, porque un radio en
 * un viewBox estirado sale ovalado.
 */
export function shapeDrawing(geoShape?: string): ShapeDrawing | undefined {
  if (!geoShape) return undefined;
  if (geoShape === "rect" || geoShape === "rectangle") return undefined;
  return GEO_SHAPES[geoShape];
}

/** Los puntos de un poligono como atributo `points` de SVG. */
export function pointsToAttribute(puntos: [number, number][]): string {
  return puntos.map(([x, y]) => `${x},${y}`).join(" ");
}
