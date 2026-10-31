/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeRawSlots } from "./normalize-raw-slots";

const meta = () => ({
  canvas_width: 800, canvas_height: 600, languages: ["es", "en"],
  slots_raw: [
    { id: "c", x_px: 400, y_px: 150, width_px: 600, height_px: 80, align: "center", content: { es: "c" } },
    { id: "r", x_px: 100, y_px: 300, width_px: 200, height_px: 60, align: "right", content: { es: "r" } },
    { id: "l", x_px: 100, y_px: 450, width_px: 200, height_px: 60, content: { es: "l" } },
  ],
});

// Variante W (worker y backend media.py:440): ancla en x_px e y_px tal cual.
const ESPERADO = { c: [50, 25], r: [12.5, 50], l: [12.5, 75] };

describe("normalizeRawSlots", () => {
  it("coloca cada capa segun la variante decidida", () => {
    const m: any = meta();
    normalizeRawSlots(m);
    const pos = Object.fromEntries(m.slots.map((s: any) => [s.id, s.position]));
    expect(pos).toEqual(ESPERADO);
  });

  it("la posicion no depende de align ni de width_px", () => {
    const testMeta: any = {
      canvas_width: 800,
      canvas_height: 600,
      slots_raw: [
        { id: "center_wide", x_px: 400, y_px: 150, width_px: 600, align: "center" },
        { id: "center_narrow", x_px: 400, y_px: 150, width_px: 100, align: "center" },
        { id: "right_wide", x_px: 400, y_px: 150, width_px: 600, align: "right" },
        { id: "left_default", x_px: 400, y_px: 150, width_px: 600, align: "left" },
      ],
    };
    normalizeRawSlots(testMeta);
    for (const s of testMeta.slots) {
      expect(s.position[0]).toBe(50);
      expect(s.position[1]).toBe(25);
    }
  });

  it("copia languages a lang y conserva el contenido y dimensiones", () => {
    const m: any = meta();
    normalizeRawSlots(m);
    expect(m.lang).toEqual(["es", "en"]);
    expect(m.slots[0].content.es).toBe("c");
    expect(m.slots[0].width_px).toBe(600);
    expect(m.slots[0].height_px).toBe(80);
    expect(m.slots[0].align).toBe("center");
    expect(m.slots[0].style).toMatchObject({ width: "600px", height: "80px" });
  });

  it("no toca un archivo que ya trae slots", () => {
    const m: any = { slots: [{ id: "ya" }], slots_raw: [{ id: "otro" }] };
    normalizeRawSlots(m);
    expect(m.slots).toEqual([{ id: "ya" }]);
  });

  it("los dos caminos usan la funcion y ninguno conserva su copia", () => {
    for (const f of [join(__dirname, "worker.ts"), join(__dirname, "..", "engines", "ImageEngine.ts")]) {
      const src = readFileSync(f, "utf8");
      expect(src.includes("normalizeRawSlots(")).toBe(true);
      expect(src.includes("slots_raw.map") || src.includes("slots_raw\n          .map")).toBe(false);
    }
  });
});
