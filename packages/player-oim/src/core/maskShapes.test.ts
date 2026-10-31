import { describe, it, expect } from "vitest";
import { MASK_SHAPE_PATHS } from "./layerComposition";

/**
 * El player NO comparte modulo con el editor: su tabla de siluetas es una
 * copy literal de la de OIM-Studio (src/lib/layerComposition.ts), donde los
 * poligonos se derivan de `PUNTOS_GEO`.
 *
 * Esa copy ya se desincronizo una vez: el editor gano triangle, line, arrow y
 * diamond y el player no, de mode que una mascara triangular se veia triangulo
 * al disenarla y CIRCULO al reproducirla. El lookup cae a `circle` cuando no
 * conoce un nombre, y lo hace sin avisar, asi que el fallo solo aparecia
 * mirando el resultado.
 *
 * Estas pruebas no pueden comparar contra el editor -son repos distintos- pero
 * si fijan el contrato: si alguien anade una figura alli y olvida esta tabla,
 * hay que actualizar tambien esta lista, y ese paso obliga a mirar aqui.
 */
const FIGURAS_ESPERADAS = [
  "circle",
  "rectangle",
  "triangle",
  "star",
  "line",
  "arrow",
  "diamond",
  "hexagon",
  "heart",
  "blob",
];

describe("MASK_SHAPE_PATHS", () => {
  it("conoce todas las siluetas que el editor ofrece", () => {
    for (const figura of FIGURAS_ESPERADAS) {
      expect(MASK_SHAPE_PATHS[figura], `falta la silueta "${figura}"`).toBeTruthy();
    }
  });

  it("no tiene siluetas de mas que el editor no sepa producir", () => {
    // Una silueta que solo existe aqui no se puede elegir desde el editor:
    // es codigo muerto que aparenta ser una opcion.
    expect(Object.keys(MASK_SHAPE_PATHS).sort()).toEqual([...FIGURAS_ESPERADAS].sort());
  });

  it("cada silueta es un trazado cerrado y no una cadena cualquiera", () => {
    for (const [figura, d] of Object.entries(MASK_SHAPE_PATHS)) {
      expect(d.startsWith("M"), `"${figura}" no empieza con M`).toBe(true);
      expect(d.trim().endsWith("Z"), `"${figura}" no cierra con Z`).toBe(true);
    }
  });
});
