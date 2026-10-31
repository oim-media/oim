/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el aviso salte cuando toca y CALLE cuando no.
 *
 * Lo segundo importa tanto como lo primero. Un aviso que salta con los
 * archivos normales -los que no traen `min_player`, o sea todos los publicados
 * hasta hoy- se convierte en ruido de fondo, y entonces nadie lo lee el dia
 * que dice algo.
 */

import { describe, it, expect } from "vitest";
import {
  whatTheReaderCannotDo,
  describeMissing,
  CONTRACT_VERSION,
  PLAYER_CAPABILITIES,
  minVersionFor,
  BASE_CONTRACT_VERSION,
} from "./compatibility";

const lector = { version: "1.2.0", capabilities: ["vector_parallax", "infinite_parallax"] };
const mirar = (metadata: any) => whatTheReaderCannotDo(metadata, lector);

describe("cuando NO hay nada que decir", () => {
  it("un archivo sin min_player no exige nada", () => {
    expect(mirar({ slots: [] }).hayAlgoQueDecir).toBe(false);
  });

  it("una version anterior se lee sin ruido", () => {
    expect(mirar({ min_player: "1.0.0" }).hayAlgoQueDecir).toBe(false);
  });

  it("la version exacta tampoco", () => {
    expect(mirar({ min_player: "1.2.0" }).hayAlgoQueDecir).toBe(false);
  });

  it("una capacidad que si se implementa no se menciona", () => {
    expect(mirar({ capabilities: ["vector_parallax"] }).hayAlgoQueDecir).toBe(false);
  });

  /**
   * Un campo mal escrito no es una incompatibilidad. Si gritara por esto, el
   * aviso perderia su significado antes de servir para nada.
   */
  it.each(["", "1.2", "proxima", "v2.0.0", 3, null, {}])(
    "un min_player ilegible (%p) no inventa una advertencia",
    (v) => {
      expect(mirar({ min_player: v }).hayAlgoQueDecir).toBe(false);
    },
  );

  it("aguanta metadatos rotos", () => {
    expect(mirar(null).hayAlgoQueDecir).toBe(false);
    expect(mirar({ capabilities: "vector_parallax" }).hayAlgoQueDecir).toBe(false);
    expect(mirar({ capabilities: [null, 7, ""] }).hayAlgoQueDecir).toBe(false);
  });
});

describe("cuando SI hay algo que decir", () => {
  it("el archivo pide una version posterior", () => {
    const f = mirar({ min_player: "1.3.0" });
    expect(f.versionTooOld).toBe(true);
    expect(f.requiredVersion).toBe("1.3.0");
  });

  it("compara por numero, no por texto", () => {
    // "1.10.0" > "1.9.0" numericamente, pero al reves alfabeticamente. Es el
    // fallo clasico, y llega el dia que haya diez versiones menores.
    expect(whatTheReaderCannotDo({ min_player: "1.10.0" }, { version: "1.9.0", capabilities: [] }).versionTooOld).toBe(true);
    expect(whatTheReaderCannotDo({ min_player: "1.9.0" }, { version: "1.10.0", capabilities: [] }).versionTooOld).toBe(false);
  });

  it("nombra las capabilities que faltan", () => {
    const f = mirar({ capabilities: ["vector_parallax", "physics_2d", "path_morph"] });
    expect(f.missingCapabilities).toEqual(["path_morph", "physics_2d"]);
  });

  it("no repite una capacidad declarada dos veces", () => {
    expect(mirar({ capabilities: ["physics_2d", "physics_2d"] }).missingCapabilities).toEqual(["physics_2d"]);
  });

  /**
   * Las dos preguntas son independientes: un archivo puede estar bien de
   * version y aun asi pedir un efecto que este lector no implementa.
   */
  it("la version correcta no exime de las capabilities", () => {
    const f = mirar({ min_player: "1.0.0", capabilities: ["physics_2d"] });
    expect(f.versionTooOld).toBe(false);
    expect(f.hayAlgoQueDecir).toBe(true);
    expect(f.cannotRender).toBe(false);
  });

  it("capacidades requeridas satisfechas no impiden renderizar ni generan advertencia", () => {
    const f = mirar({ capabilities_required: ["vector_parallax"] });
    expect(f.missingRequiredCapabilities).toEqual([]);
    expect(f.cannotRender).toBe(false);
    expect(f.hayAlgoQueDecir).toBe(false);
  });

  it("capacidades requeridas faltantes marcan cannotRender y se listan por separado", () => {
    const f = mirar({
      capabilities: ["vector_parallax", "path_morph"],
      capabilities_required: ["physics_2d", "path_morph"],
    });
    expect(f.missingCapabilities).toEqual(["path_morph"]);
    expect(f.missingRequiredCapabilities).toEqual(["path_morph", "physics_2d"]);
    expect(f.cannotRender).toBe(true);
    expect(f.hayAlgoQueDecir).toBe(true);
  });

  it("describeMissing advierte con precisión cuando faltan capacidades requeridas", () => {
    const f = mirar({ capabilities_required: ["physics_2d"] });
    const texto = describeMissing(f);
    expect(texto).toContain("No se puede reproducir completamente");
    expect(texto).toContain("physics_2d");
  });
});

describe("como se cuenta", () => {
  it("calla cuando no hay nada", () => {
    expect(describeMissing(mirar({}))).toBe("");
  });

  it("dice que se pinto lo que se pudo, no que fallo", () => {
    const texto = describeMissing(mirar({ min_player: "2.0.0", capabilities: ["physics_2d"] }));
    expect(texto).toContain("Se pinto lo que se pudo");
    expect(texto).toContain("2.0.0");
    expect(texto).toContain("physics_2d");
  });
});

describe("lo que el player declara implementar", () => {
  /**
   * `path_morph` y `physics_2d` estan en el enum del esquema y NO en el codigo
   * del player: cero apariciones, medido. Declararlas seria prometer lo que no
   * se hace, que es el silencio que todo esto viene a romper.
   */
  it("no promete path_morph ni physics_2d", () => {
    expect(PLAYER_CAPABILITIES).not.toContain("path_morph");
    expect(PLAYER_CAPABILITIES).not.toContain("physics_2d");
  });

  it("la version del contrato se puede comparar", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("minVersionFor", () => {
  /**
   * Hoy nada exige mas que la base, y eso es lo correcto: las cuatro
   * capabilities del esquema nacieron con la 1.0.0.
   */
  it("un documento de hoy exige la version base", () => {
    expect(minVersionFor({ slots: [] })).toBe(BASE_CONTRACT_VERSION);
    expect(minVersionFor({ capabilities: ["vector_parallax", "physics_2d"] })).toBe(BASE_CONTRACT_VERSION);
  });

  /**
   * La trampa que este diseno evita: escribir la version del editor en vez de
   * la que el documento necesita. Un documento que no usa nada nuevo NO puede
   * empezar a exigir una version posterior solo porque quien lo escribio era
   * mas moderno; dejaria fuera a lectores capaces de pintarlo, y el autor no
   * lo veria porque en su editor se ve bien.
   */
  it("no sube por el mero hecho de que el contrato haya avanzado", () => {
    expect(minVersionFor({ capabilities: ["vector_parallax"] }, { path_morph: "1.4.0" }))
      .toBe(BASE_CONTRACT_VERSION);
  });

  it("sube cuando el documento SI usa algo posterior", () => {
    expect(minVersionFor({ capabilities: ["path_morph"] }, { path_morph: "1.4.0" })).toBe("1.4.0");
  });

  it("con varias, se queda con la mayor", () => {
    const mapa = { a: "1.2.0", b: "1.10.0", c: "1.3.0" };
    expect(minVersionFor({ capabilities: ["a", "b", "c"] }, mapa)).toBe("1.10.0");
  });

  it("una capacidad desconocida no inventa una exigencia", () => {
    expect(minVersionFor({ capabilities: ["algo_que_no_existe"] }, { path_morph: "1.4.0" }))
      .toBe(BASE_CONTRACT_VERSION);
  });

  it("aguanta metadatos rotos", () => {
    expect(minVersionFor(null)).toBe(BASE_CONTRACT_VERSION);
    expect(minVersionFor({ capabilities: "no es lista" })).toBe(BASE_CONTRACT_VERSION);
  });
});
