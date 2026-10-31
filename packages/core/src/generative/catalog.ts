/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeneratorSpec } from "./types.js";

export const GENERATOR_CATALOG: GeneratorSpec[] = [
  // 1. ONDAS Y TERRENOS (layer-stack)
  {
    id: "stacked-waves",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "wave", boundary: "shared" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 },
      { key: "frequency", kind: "range", group: "SHAPE", label: { es: "Frecuencia", en: "Frequency" }, min: 2, max: 12, step: 1, default: 4 },
      { key: "amplitude", kind: "range", group: "SHAPE", label: { es: "Amplitud", en: "Amplitude" }, min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: "balance", kind: "range", group: "SHAPE", label: { es: "Balance", en: "Balance" }, min: 0, max: 1, step: 0.05, default: 0.5 },
      {
        key: "anchor",
        kind: "enum",
        group: "DIRECTION",
        label: { es: "Anclaje", en: "Anchor" },
        options: [
          { value: "bottom", label: { es: "Abajo", en: "Bottom" } },
          { value: "top", label: { es: "Arriba", en: "Top" } },
          { value: "left", label: { es: "Izquierda", en: "Left" } },
          { value: "right", label: { es: "Derecha", en: "Right" } }
        ],
        default: "bottom"
      }
    ]
  },
  {
    id: "layered-waves",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "wave", boundary: "independent" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 },
      { key: "frequency", kind: "range", group: "SHAPE", label: { es: "Frecuencia", en: "Frequency" }, min: 2, max: 12, step: 1, default: 4 },
      { key: "amplitude", kind: "range", group: "SHAPE", label: { es: "Amplitud", en: "Amplitude" }, min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: "anchor", kind: "enum", group: "DIRECTION", label: { es: "Anclaje", en: "Anchor" }, options: [{ value: "bottom", label: { es: "Abajo", en: "Bottom" } }, { value: "top", label: { es: "Arriba", en: "Top" } }], default: "bottom" }
    ]
  },
  {
    id: "stacked-peaks",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "peak", boundary: "shared" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 },
      { key: "frequency", kind: "range", group: "SHAPE", label: { es: "Picos", en: "Peaks" }, min: 2, max: 12, step: 1, default: 4 },
      { key: "amplitude", kind: "range", group: "SHAPE", label: { es: "Altura", en: "Height" }, min: 0, max: 1, step: 0.05, default: 0.6 }
    ]
  },
  {
    id: "layered-peaks",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "peak", boundary: "independent" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 },
      { key: "frequency", kind: "range", group: "SHAPE", label: { es: "Picos", en: "Peaks" }, min: 2, max: 12, step: 1, default: 4 }
    ]
  },
  {
    id: "stacked-steps",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "step", boundary: "shared" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 },
      { key: "frequency", kind: "range", group: "SHAPE", label: { es: "Escalones", en: "Steps" }, min: 2, max: 12, step: 1, default: 5 }
    ]
  },
  {
    id: "layered-steps",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "step", boundary: "independent" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Capas", en: "Layers" }, min: 1, max: 12, step: 1, default: 5 }
    ]
  },
  {
    id: "zigzag-chevron",
    layers: [{ primitive: "layer-stack", fixed: { interpolation: "zigzag", boundary: "independent" } }],
    schema: [
      { key: "layers", kind: "range", group: "SHAPE", label: { es: "Franjas", en: "Bands" }, min: 1, max: 12, step: 1, default: 6 }
    ]
  },

  // 2. DISPERSIONES Y ORGÁNICOS (scatter, blob, mesh)
  {
    id: "circle-scatter",
    layers: [{ primitive: "scatter", fixed: { element: "circle" } }],
    schema: [
      { key: "count", kind: "range", group: "SHAPE", label: { es: "Círculos", en: "Circles" }, min: 1, max: 40, step: 1, default: 3 },
      { key: "sizeMin", kind: "range", group: "SHAPE", label: { es: "Tamaño Mín", en: "Min Size" }, min: 10, max: 100, step: 5, default: 60 },
      { key: "sizeMax", kind: "range", group: "SHAPE", label: { es: "Tamaño Máx", en: "Max Size" }, min: 60, max: 300, step: 10, default: 180 },
      { key: "minDistance", kind: "range", group: "SHAPE", label: { es: "Distancia Mín", en: "Min Distance" }, min: 0, max: 100, step: 5, default: 40 }
    ]
  },
  {
    id: "rose-petals",
    layers: [{ primitive: "scatter", fixed: { element: "petal" } }],
    schema: [
      { key: "count", kind: "range", group: "SHAPE", label: { es: "Pétalos", en: "Petals" }, min: 1, max: 40, step: 1, default: 12 },
      { key: "sizeMin", kind: "range", group: "SHAPE", label: { es: "Tamaño Mín", en: "Min Size" }, min: 10, max: 100, step: 5, default: 30 }
    ]
  },
  {
    id: "blob-scene",
    layers: [{ primitive: "blob", fixed: {} }],
    schema: [
      { key: "count", kind: "range", group: "SHAPE", label: { es: "Blobs", en: "Blobs" }, min: 1, max: 6, step: 1, default: 2 },
      { key: "points", kind: "range", group: "SHAPE", label: { es: "Complejidad", en: "Complexity" }, min: 5, max: 14, step: 1, default: 8 },
      { key: "irregularity", kind: "range", group: "SHAPE", label: { es: "Deformación", en: "Irregularity" }, min: 0, max: 1, step: 0.05, default: 0.5 },
      {
        key: "anchor",
        kind: "enum",
        group: "DIRECTION",
        label: { es: "Anclaje", en: "Anchor" },
        options: [
          { value: "center", label: { es: "Centro", en: "Center" } },
          { value: "corner-tl", label: { es: "Esquina Sup-Izq", en: "Top-Left" } },
          { value: "corner-tr", label: { es: "Esquina Sup-Der", en: "Top-Right" } },
          { value: "corner-bl", label: { es: "Esquina Inf-Izq", en: "Bottom-Left" } },
          { value: "corner-br", label: { es: "Esquina Inf-Der", en: "Bottom-Right" } }
        ],
        default: "corner-tr"
      }
    ]
  },
  {
    id: "low-poly-grid",
    layers: [{ primitive: "mesh", fixed: {} }],
    schema: [
      { key: "resolution", kind: "range", group: "SHAPE", label: { es: "Resolución", en: "Resolution" }, min: 3, max: 20, step: 1, default: 8 },
      { key: "distortion", kind: "range", group: "SHAPE", label: { es: "Distorsión", en: "Distortion" }, min: 0, max: 1, step: 0.05, default: 0.6 },
      { key: "borderWidth", kind: "range", group: "SHAPE", label: { es: "Borde", en: "Border" }, min: 0, max: 4, step: 0.5, default: 0.5 }
    ]
  },

  // 3. RADIALES Y GRADIENTES (radial, gradient, iso-grid)
  {
    id: "bullseye-gradient",
    layers: [{ primitive: "radial", fixed: { kind: "rings" } }],
    schema: [
      { key: "count", kind: "range", group: "SHAPE", label: { es: "Anillos", en: "Rings" }, min: 3, max: 48, step: 1, default: 16 }
    ]
  },
  {
    id: "wintery-sunburst",
    layers: [{ primitive: "radial", fixed: { kind: "rays" } }],
    schema: [
      { key: "count", kind: "range", group: "SHAPE", label: { es: "Rayos", en: "Rays" }, min: 3, max: 48, step: 1, default: 16 }
    ]
  },
  {
    id: "radiant-gradient",
    layers: [{ primitive: "gradient", fixed: { kind: "radial" } }],
    schema: [
      { key: "softness", kind: "range", group: "SHAPE", label: { es: "Suavidad", en: "Softness" }, min: 0, max: 1, step: 0.05, default: 0.8 }
    ]
  },
  {
    id: "blurry-gradient",
    layers: [{ primitive: "gradient", fixed: { kind: "linear" } }],
    schema: [
      { key: "angle", kind: "range", group: "SHAPE", label: { es: "Ángulo", en: "Angle" }, min: 0, max: 360, step: 15, default: 135 }
    ]
  },
  {
    id: "protruding-cubes",
    layers: [{ primitive: "iso-grid", fixed: { hollow: false } }],
    schema: [
      { key: "cols", kind: "range", group: "SHAPE", label: { es: "Columnas", en: "Columns" }, min: 4, max: 20, step: 1, default: 8 },
      { key: "extrude", kind: "range", group: "SHAPE", label: { es: "Extrusión", en: "Extrusion" }, min: 0, max: 1, step: 0.05, default: 0.6 }
    ]
  },
  {
    id: "hollowed-boxes",
    layers: [{ primitive: "iso-grid", fixed: { hollow: true } }],
    schema: [
      { key: "cols", kind: "range", group: "SHAPE", label: { es: "Columnas", en: "Columns" }, min: 4, max: 20, step: 1, default: 8 }
    ]
  },

  // 4. COMPUESTOS (Nuevos fondos dinámicos)
  {
    id: "luz-difusa",
    layers: [
      { primitive: "gradient", fixed: { kind: "linear" } },
      { primitive: "radial", fixed: { kind: "radial" }, blend: "screen", opacidad: 0.8, desenfoque: 20 }
    ],
    grano: { intensidad: 0.15 },
    schema: [
      { key: "angle", kind: "range", group: "SHAPE", label: { es: "Ángulo Base", en: "Base Angle" }, min: 0, max: 360, step: 15, default: 135 },
      { key: "softness", kind: "range", group: "SHAPE", label: { es: "Difusión", en: "Diffusion" }, min: 0.1, max: 1, step: 0.05, default: 0.8 }
    ]
  },
  {
    id: "malla-suave",
    layers: [
      { primitive: "mesh", fixed: { borderWidth: 0 } },
      { primitive: "radial", fixed: { kind: "radial" }, blend: "soft-light", opacidad: 0.7 }
    ],
    schema: [
      { key: "resolution", kind: "range", group: "SHAPE", label: { es: "Resolución Malla", en: "Mesh Resolution" }, min: 3, max: 12, step: 1, default: 6 },
      { key: "distortion", kind: "range", group: "SHAPE", label: { es: "Fluidez", en: "Fluidity" }, min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: "softness", kind: "range", group: "SHAPE", label: { es: "Luz Radial", en: "Radial Light" }, min: 0.1, max: 1, step: 0.05, default: 0.7 }
    ]
  },
  {
    // Sin tilde a proposito: el id se persiste y se compara con `===`. "retícula"
    // tiene dos formas Unicode distintas (NFC y NFD) que NO son iguales como
    // cadena, asi que una capa que normalice diferente haria fallar
    // getGeneratorSpec y caer al fondo por defecto sin ningun error visible.
    id: "reticula",
    layers: [
      { primitive: "gradient", fixed: { kind: "linear" } },
      { primitive: "iso-grid", fixed: { hollow: true }, blend: "screen", opacidad: 0.85 }
    ],
    grano: { intensidad: 0.18 },
    schema: [
      { key: "cols", kind: "range", group: "SHAPE", label: { es: "Densidad Rejilla", en: "Grid Density" }, min: 4, max: 24, step: 1, default: 10 },
      { key: "angle", kind: "range", group: "SHAPE", label: { es: "Inclinación Luz", en: "Light Angle" }, min: 0, max: 360, step: 15, default: 120 }
    ]
  },
  {
    id: "polvo",
    layers: [
      { primitive: "gradient", fixed: { kind: "radial" } },
      { primitive: "scatter", fixed: { element: "circle" }, blend: "lighten", opacidad: 0.65 }
    ],
    grano: { intensidad: 0.28 },
    schema: [
      { key: "count", kind: "range", group: "VARIANTS", label: { es: "Partículas", en: "Particles" }, min: 10, max: 80, step: 5, default: 35 },
      { key: "sizeMin", kind: "range", group: "SHAPE", label: { es: "Tamaño Mín", en: "Min Size" }, min: 2, max: 20, step: 1, default: 4 },
      { key: "sizeMax", kind: "range", group: "SHAPE", label: { es: "Tamaño Máx", en: "Max Size" }, min: 10, max: 50, step: 2, default: 20 }
    ]
  }
];

export function getGeneratorSpec(id: string): GeneratorSpec | undefined {
  return GENERATOR_CATALOG.find((g) => g.id === id);
}
