/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Genera el contrato del formato en JSON Schema, y vigila que no derive.
 *
 * `schema.ts` define el formato `.oim` en Zod, que solo sirve a TypeScript.
 * Un player en Swift, Kotlin o Rust no puede leerlo: tendria que traducirlo a
 * mano, y esa traduccion es una copy. Las copies derivan -medido en este
 * mismo proyecto: `grupos.ts` acumulo 546 lineas distintas entre el player y
 * el editor, `layerComposition.ts` 775-. Un contrato en JSON Schema es la
 * parte que sobrevive al lenguaje.
 *
 * Pero generar un fichero y comprometerlo crea EXACTAMENTE el problema que
 * esto viene a cerrar: otra copy, que puede quedarse vieja. Por eso el
 * generador y la guardia son la misma prueba. Si alguien edita el Zod y no
 * regenera, esto falla; el JSON no puede mentir sobre el TypeScript.
 *
 * Regenerar tras un cambio deliberado del esquema:
 *
 *     pnpm --filter @oim-media/core test -- -u
 *
 * `io: "input"` porque el esquema describe lo que se LEE de un fichero ya
 * escrito, no lo que produce una transformacion. Hoy ambos coinciden -no hay
 * `.transform()` ni `.default()` en `schema.ts`- y esa coincidencia es una
 * propiedad que conviene no perder por accidente: la prueba la fija.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { CONTRACT_VERSION, minVersionFor, BASE_CONTRACT_VERSION } from "./compatibility";
import {
  OimMetadataSchema,
  OvmMetadataSchema,
  slotSchema,
  styleSchema,
  contentSchema,
  keyframeSchema,
  positionSchema,
  zoneSchema,
  interactionSchema,
  parallaxSchema,
  parallaxInfiniteSchema,
  trackingKeyframeSchema,
  embeddedFontSchema,
  cssColorSchema,
  maskCutSchema,
  generativeFillSchema,
} from "./schema";

/**
 * Nombres de las definiciones compartidas.
 *
 * `slot` aparece tres veces en los metadatos -`slots`, `elements`, `layers`-.
 * Sin esto Zod lo inlinea las tres, y el contrato pasa de 668 lineas a 2384
 * con tres copies de la misma definicion: el problema que este directorio
 * viene a cerrar, reproducido dentro del propio fichero.
 *
 * Con `reused: "ref"` se emite una sola vez, pero Zod la nombra `__schema3`.
 * Un contrato que otro lenguaje va a leer no puede tener nombres asi.
 */
const NOMBRES: [z.ZodType, string][] = [
  [slotSchema, "slot"],
  [styleSchema, "style"],
  [contentSchema, "content"],
  [keyframeSchema, "keyframe"],
  [positionSchema, "position"],
  [zoneSchema, "zone"],
  [interactionSchema, "interaction"],
  [parallaxSchema, "parallax"],
  [parallaxInfiniteSchema, "parallaxInfinite"],
  [trackingKeyframeSchema, "trackingKeyframe"],
  [embeddedFontSchema, "embeddedFont"],
  // 1.8.0: one colour definition shared by every colour key, instead of
  // sixteen free strings.
  [cssColorSchema, "cssColor"],
  [maskCutSchema, "maskCut"],
  [generativeFillSchema, "generativeFill"],
];
for (const [esquema, id] of NOMBRES) z.globalRegistry.add(esquema, { id });

// La version sale de `compatibilidad.ts`, que es quien la usa para decidir si
// un lector puede con un archivo. Tenerla escrita aqui tambien era la misma
// duplicacion que este directorio existe para cerrar: el JSON y el codigo
// habrian podido anunciar versiones distintas.

const BASE = "https://oim.media/spec";

function contrato(esquema: z.ZodType, id: string, titulo: string) {
  const generado = z.toJSONSchema(esquema, { io: "input", reused: "ref" }) as Record<string, unknown>;
  // El orden importa: `$id` y la version deben leerse antes que las 21
  // propiedades, para que un humano que abra el fichero sepa que esta mirando.
  return cerrarTuplas(inlinarPrimitivos({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${BASE}/${CONTRACT_VERSION}/${id}.schema.json`,
    title: titulo,
    specVersion: CONTRACT_VERSION,
    ...generado,
  }));
}

/**
 * Devuelve al sitio las definiciones que son un primitivo pelado.
 *
 * `reused: "ref"` extrae TODO lo que se repite, incluido un `z.number()` suelto
 * que aparecia como `$defs.__schema0 = {"type":"number"}`. Una referencia a un
 * numero no ahorra nada y obliga a quien lea el contrato a saltar a otro sitio
 * para descubrir que era un numero. Solo se comparten las formas con nombre.
 */
function inlinarPrimitivos(esquema: any): any {
  const defs = esquema.$defs ?? {};
  const triviales = new Set(
    Object.keys(defs).filter((k) => {
      const claves = Object.keys(defs[k]);
      return claves.length === 1 && claves[0] === "type";
    }),
  );
  if (triviales.size === 0) return esquema;

  const sustituir = (nodo: any): any => {
    if (Array.isArray(nodo)) return nodo.map(sustituir);
    if (!nodo || typeof nodo !== "object") return nodo;
    const ref: string | undefined = nodo.$ref;
    if (ref) {
      const nombre = ref.replace("#/$defs/", "");
      // Las claves HERMANAS del `$ref` se conservan. Devolver solo el
      // primitivo borraba `deprecated` y `description`: marcar una clave como
      // retirada no dejaba ni rastro en el contrato publicado, y el fallo era
      // mudo -el fichero salia bien formado, solo sin la advertencia-.
      if (triviales.has(nombre)) {
        const { $ref: _descartado, ...hermanas } = nodo;
        return { ...defs[nombre], ...hermanas };
      }
    }
    return Object.fromEntries(Object.entries(nodo).map(([k, v]) => [k, sustituir(v)]));
  };

  const limpio = sustituir(esquema);
  for (const nombre of triviales) delete limpio.$defs[nombre];
  if (Object.keys(limpio.$defs).length === 0) delete limpio.$defs;
  return limpio;
}

/**
 * Cierra las tuplas, que Zod deja abiertas al traducir.
 *
 * `z.tuple([number, number])` exige EXACTAMENTE dos elementos, pero se emite
 * como `prefixItems` sin `minItems` ni `maxItems`, y en JSON Schema eso
 * significa «los dos primeros son asi, los demas lo que sea». Medido: el
 * contrato aceptaba `position: [10]` y `position: [10, 20, 30]`, que Zod
 * rechaza.
 *
 * Es la discrepancia mas cara posible, porque `position` decide donde se pinta
 * cada slot: un player en Swift validando contra el contrato habria aceptado
 * una posicion malformada que el player de TypeScript rechaza, y el resultado
 * habria sido un fichero que se ve distinto segun quien lo abra.
 *
 * `items: false` es la forma 2020-12 de prohibir elementos de mas. Si la tupla
 * tuviera resto, Zod ya emitiria `items` y aqui no se toca nada.
 */
function cerrarTuplas(nodo: any): any {
  if (Array.isArray(nodo)) return nodo.map(cerrarTuplas);
  if (!nodo || typeof nodo !== "object") return nodo;
  const salida: any = Object.fromEntries(
    Object.entries(nodo).map(([k, v]) => [k, cerrarTuplas(v)]),
  );
  if (Array.isArray(salida.prefixItems) && salida.items === undefined) {
    salida.minItems = salida.prefixItems.length;
    salida.items = false;
  }
  return salida;
}

function comoFichero(objeto: unknown): string {
  return JSON.stringify(objeto, null, 2) + "\n";
}

describe("el contrato en JSON Schema", () => {
  it("oim.schema.json esta al dia con schema.ts", async () => {
    await expect(comoFichero(contrato(OimMetadataSchema, "oim", "OIM document metadata")))
      .toMatchFileSnapshot("../../spec/schema/oim.schema.json");
  });

  it("ovm.schema.json esta al dia con schema.ts", async () => {
    await expect(comoFichero(contrato(OvmMetadataSchema, "ovm", "OVM document metadata")))
      .toMatchFileSnapshot("../../spec/schema/ovm.schema.json");
  });
});

describe("propiedades que el contrato promete a otros lenguajes", () => {
  /**
   * `slots` es el unico campo obligatorio del formato. Un player que no lo
   * exija aceptaria un `.oim` vacio como valido.
   */
  it("declara slots como obligatorio y nada mas", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.required).toEqual(["slots"]);
  });

  /**
   * `passthrough` es lo que permite que un `.oim` escrito por un editor NUEVO
   * no reviente en un player VIEJO: las claves que no conoce sobreviven. Es la
   * mitad amable de la compatibilidad -la otra mitad, avisar de que algo no se
   * entendio, la cubrira `min_player`-.
   */
  it("admite claves desconocidas, que es como sobrevive a versiones futuras", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.additionalProperties).not.toBe(false);
  });

  /**
   * La comprobacion que de verdad muerde, y que nacio de un fallo real: la
   * primera version de esta prueba comparaba `io: "input"` con `io: "output"`
   * dando por hecho que solo diferian si habia transformaciones. Diferian por
   * otra cosa.
   *
   * Zod emite `additionalProperties: false` en los objetos anidados cuando se
   * le pide la forma de SALIDA. Pero su comportamiento real al leer no es ese:
   * medido sobre `canvas`, un `.oim` con una clave desconocida dentro se
   * ACEPTA -Zod la descarta, no la rechaza-.
   *
   * Publicar el esquema de salida daria un contrato que miente: un player en
   * Swift validando contra el rechazaria ficheros que el player de TypeScript
   * pinta. Y el autor del fichero no tendria forma de saber cual de los dos
   * tiene razon.
   */
  it("no prohibe claves desconocidas en ningun objeto, porque Zod tampoco", () => {
    const conCanvasExtendido = {
      slots: [],
      canvas: { natural_width: 100, natural_height: 50, clave_de_una_version_futura: 7 },
    };
    // La implementacion de referencia lo acepta...
    expect(OimMetadataSchema.safeParse(conCanvasExtendido).success).toBe(true);

    // ...luego el contrato publicado no puede prohibirlo en ninguna parte.
    const cerrados: string[] = [];
    (function recorrer(nodo: any, ruta: string) {
      if (!nodo || typeof nodo !== "object") return;
      if (nodo.additionalProperties === false) cerrados.push(ruta || "(raiz)");
      for (const [clave, hijo] of Object.entries(nodo)) recorrer(hijo, ruta ? `${ruta}.${clave}` : clave);
    })(contrato(OimMetadataSchema, "oim", "x"), "");

    expect(cerrados).toEqual([]);
  });
});

describe("1.1.0 retira allow_external_urls sin romper lo ya publicado", () => {
  /**
   * La promesa de esta subida de version: retirar el campo NO invalida un
   * archivo que lo traiga. Los esquemas son `.passthrough()`, asi que el
   * campo simplemente deja de significar algo.
   *
   * Sin esta prueba, la promesa vive solo en un comentario.
   */
  it("un .oim de la era 1.0.0 con el campo sigue validando", () => {
    const antiguo = {
      version: "1.0.0",
      allow_external_urls: true,
      slots: [],
    };
    const r = OimMetadataSchema.safeParse(antiguo);
    expect(r.success).toBe(true);
  });

  it("pero el contrato ya no lo declara", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(Object.keys(s.properties)).not.toContain("allow_external_urls");
    expect(s.specVersion).toBe(CONTRACT_VERSION);
  });
});

describe("1.2.0: el principal bajo * no cambia el esquema", () => {
  it("un content con * y una excepcion valida", () => {
    expect(contentSchema.safeParse({ "*": "oim-media:a", pt: "oim-media:b" }).success).toBe(true);
  });

  it("el contrato declara la 1.2.0", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.specVersion).toBe(CONTRACT_VERSION);
  });
});

describe("1.4.0 cierra la deriva y marca lo retirado", () => {
  it("la raiz declara `reedicion`, y con sus tres valores", () => {
    // Era el peor hueco del contrato: decide un PERMISO -quien puede reeditar
    // la obra- y no estaba declarado en ninguna parte. Un player ajeno lo
    // ignoraba y trataba como reeditable algo que no lo es.
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.reedicion.enum).toEqual(["publico", "solo_autor", "sellado"]);
  });

  it("la raiz declara `name`", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.name).toBeDefined();
  });

  it("las dos que `allow_external_urls` dejo atras van marcadas, no borradas", () => {
    // Marcadas y no borradas a proposito: el backend las sigue honrando si un
    // archivo trae la clave retirada, asi que quitarlas del contrato lo haria
    // mentir en el otro sentido.
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.terms_accepted.deprecated).toBe(true);
    expect(s.properties.redirect_membership_verified.deprecated).toBe(true);
  });

  it("inlinar un primitivo no se lleva por delante lo que lo acompana", () => {
    // `reused: "ref"` saca a `$defs` todo primitivo repetido, y la propiedad
    // queda como `{ deprecated, description, $ref }`. El inlinador devolvia
    // SOLO el primitivo, asi que marcar una clave como retirada no dejaba
    // rastro en el contrato publicado. El fallo era mudo: el fichero salia
    // bien formado, solo que sin la advertencia.
    //
    // Hoy el esquema real pone la metadata ANTES de `.optional()` y no genera
    // ese `$ref`, asi que esta prueba es el unico sitio que recorre ese
    // camino. Sin ella, el arreglo se puede revertir sin que nada proteste.
    const conRef = z.object({
      marcada: z.boolean().optional().meta({ deprecated: true, description: "retirada" }),
      otra: z.boolean().optional(),
      tercera: z.boolean().optional(),
    });
    const s = contrato(conRef, "prueba", "x") as any;
    expect(s.properties.marcada.deprecated).toBe(true);
    expect(s.properties.marcada.description).toBe("retirada");
    expect(s.properties.marcada.type).toBe("boolean");
  });

  // Hasta 1.6.0 aqui se exigia lo contrario («NO va marcada: el player la
  // aplica de verdad»), porque asi era. En 1.7.0 el player deja de aplicarla
  // (sandbox, decision de producto del 24 sept 2026) y la prueba cambia con
  // el hecho: sandbox-sin-red.test.ts, en el player, fija que ya no se aplica.
  it("`allowed_domains` va marcada desde 1.7.0: el player ya no la aplica", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(s.properties.allowed_domains.deprecated).toBe(true);
  });
});

describe("1.12.0 marca lo que nadie usa, sin borrarlo (auditoria del 10 oct)", () => {
  const raiz = () => contrato(OimMetadataSchema, "oim", "x") as any;
  const estilo = () => {
    const r = raiz();
    const slot = r.properties.slots.items.$ref ? r.$defs[r.properties.slots.items.$ref.split("/").pop()] : r.properties.slots.items;
    const st = slot.properties.style;
    return st.$ref ? r.$defs[st.$ref.split("/").pop()] : st;
  };

  // 1.21.0 added colour roles in patterns and backgrounds; 1.22.0 added reveal, trigger and play.
  it("el contrato declara la 1.22.0", () => {
    expect(CONTRACT_VERSION).toBe("1.22.0");
  });

  // A repeated definition goes to $defs and the property keeps a $ref.
  const prop = (k: string) => {
    const r = raiz(); const v = estilo().properties[k];
    return v?.$ref ? { ...r.$defs[v.$ref.split("/").pop()], ...v } : v;
  };

  it("en el estilo: textTransform, verticalAlign, shader_fx, el grano por capa y blendMode", () => {
    for (const k of ["textTransform", "verticalAlign", "shader_fx", "grain", "grainIntensity", "grainSize", "grainBlend", "blendMode"]) {
      expect(prop(k)?.deprecated, k).toBe(true);
    }
  });

  it("blendMode queda cerrado a los nueve valores que ofrecia el editor", () => {
    expect([...prop("blendMode").enum].sort()).toEqual(
      ["color-burn", "color-dodge", "darken", "difference", "lighten", "multiply", "normal", "overlay", "screen"]);
  });

  it("en la raiz: elements, layers, grain y effects; slots no", () => {
    const p = raiz().properties;
    for (const k of ["elements", "layers", "grain", "effects"]) expect(p[k]?.deprecated, k).toBe(true);
    expect(p.slots.deprecated).toBeUndefined();
  });

  it("un archivo que aun lleve lo retirado sigue validando", () => {
    const r = OimMetadataSchema.safeParse({ slots: [{ id: "a", style: { blendMode: "multiply", textTransform: "uppercase", grain: true } }], grain: { enabled: true } });
    expect(r.success).toBe(true);
  });
});

describe("1.3.0 documenta las fuentes incrustadas sin exigirlas", () => {
  it("el contrato declara las fuentes incrustadas", () => {
    const s = contrato(OimMetadataSchema, "oim", "x") as any;
    expect(Object.keys(s.properties)).toContain("fonts");
  });

  it("usar fonts no sube min_player: un lector antiguo la ignora y pide la fuente a Google", () => {
    expect(minVersionFor({ capabilities: [] })).toBe(BASE_CONTRACT_VERSION);
  });
});

