/**
 * OIM/OVM Metadata Schema — Zod validation
 *
 * Validates the structure of .ovmdata / .oim metadata JSON
 * before it reaches the render layer. Rejects tampered or
 * malformed metadata at the demuxer boundary.
 *
 * ============================================================================
 * ZOD SCHEMA MAINTENANCE & EVOLUTION CONTRACT:
 * 1. Backward Compatibility: Always mark new interactive fields, visual filters,
 *    or animation properties as `.optional()` (e.g. `shader_fx`, custom filters).
 *    Do NOT introduce required fields without fallback defaults.
 * 2. Syncing Pipeline: When adding new features (e.g., custom WebGL shaders, CSS effects),
 *    first define their type and validation rules in this file. Then run:
 *      `pnpm run build` (so @oim-media/core updates dist/ and TypeScript/React/Studio packages reflect it).
 * 3. Graceful Fallbacks: Ensure the renderers (`ImageEngine` / `VideoEngine`) check for
 *    the presence of optional fields and fall back gracefully if missing, preventing
 *    older/legacy OIM assets from breaking.
 * ============================================================================
 */
import { z } from "zod";
import { EMBEDDED_FONT_NAME, EMBEDDED_FONT_MAX_BYTES, EMBEDDED_FONTS_MAX_ENTRIES } from "./embeddedFonts.js";

// El tope vive en `limits.ts`, sin dependencias, para que el player pueda
// importarlo sin arrastrar zod -que es por lo que acabo copiado como literal-.
// Se reexporta aqui porque formaba parte de la superficie publica del paquete.
export { MAX_SLOTS } from "./limits.js";
import { MAX_SLOTS, MARK_NAME, MAX_MARKS } from "./limits.js";
import { CSS_COLOR_PATTERN, DYNAMIC_COLOR_ROLES, type DynamicColorRole } from "./dynamic-colors.js";
import { GRAIN_BLENDS } from "./generative/proceduralNoise.js";
import { TEXTURE_PRESETS, EFFECT_BLENDS } from "./effects/types.js";

// Palette names in `palettes` (1.20.0): a letter, then up to 23 of [a-z0-9-].
export const PALETTE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,23}$/;

/**
 * Un fotograma clave: como esta la capa en un instante.
 *
 * `o` —la opacidad— se declaraba `max(1)` y los archivos publicados llegan a
 * 1.367. No es que los archivos esten mal: los valores los produce una curva
 * de interpolacion que REBOTA, y una curva que rebota se pasa del destino
 * antes de volver. El tope estaba puesto pensando en el valor de llegada, no
 * en el camino.
 *
 * Se sube a 2 en vez de quitarlo: el rebote no llega ni de lejos al doble, y
 * un tope que no acota nada tampoco sirve. Medido el 18 de septiembre de 2026
 * sobre 300 valores de cinco obras publicadas; el mayor fue 1.367.
 *
 * `o` va aqui de 0 a 1, a diferencia de la opacidad de `interactiveStateSchema`
 * que va de 0 a 100. Son unidades distintas en el mismo formato, y esta escrito
 * porque no se puede deducir.
 */
/** A curve: a CSS keyword or a cubic-bezier 4-tuple. Keyframes and reveals share it. */
export const keyframeEasingSchema = z.union([
  z.enum(["linear", "ease-in", "ease-out", "ease-in-out", "steps(1, end)"]),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
]);
export type KeyframeEasing = z.infer<typeof keyframeEasingSchema>;

export const keyframeSchema = z.object({
  t: z.number().min(0).max(60),
  o: z.number().min(0).max(2).optional(),
  s: z.number().min(0).max(10).optional(),
  r: z.number().min(-3600).max(3600).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  b: z.number().min(0).max(50).optional(),
  e: keyframeEasingSchema.optional(),
});

// Style object — restricts CSS-like properties to safe values
/**
 * Una accion entre capas: que le hace esta capa a otra al activarse.
 *
 * Estaba en el formato desde antes y NO en el contrato: viajaba dentro de
 * `style`, que este esquema declara abierto. Un lector escrito en otro lenguaje
 * veia un diccionario opaco y tenia que deducir la interactividad LEYENDO EL
 * PLAYER — justo la divergencia que un contrato compartido existe para evitar.
 */
/**
 * 1.22.0: how a layer appears when an action shows it, and disappears when one
 * hides it (the same effect reversed). Absent: a 300 ms fade in, 250 ms out.
 */
export const revealSchema = z.object({
  effect: z.enum(["fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale"]),
  duration: z.number().min(0).max(2000),
  easing: keyframeEasingSchema.optional(),
});
export type Reveal = z.infer<typeof revealSchema>;
export type RevealEffect = Reveal["effect"];

export const stateActionSchema = z.object({
  target: z.string().min(1).max(128),
  // 1.22.0: `play` replays the target's animation; it shows nothing and is
  // never reverted when a hover ends.
  type: z.enum(["show", "hide", "toggle", "setText", "play"]),
  value: z.string().max(10000).optional(),
});

/**
 * Un estado interactivo: como se ve la capa y que hace.
 *
 * `opacity` va de 0 a 100, igual que la opacidad de capa y que lo que el player
 * espera —divide entre 100 para el CSS—. Declararlo aqui destapo que el editor
 * guardaba 0..1: una opacidad de hover del 50% acababa pintando 0.005.
 *
 * `scale` va en la MISMA unidad, y averiguarlo costo un fallo visible. Se
 * declaraba `max(10)` —multiplicador— mientras el editor escribia porcentaje y
 * el player pasaba el numero a un CSS que multiplica: un `103` agrandaba la
 * capa ciento tres veces al pasar el raton, en obras ya publicadas.
 *
 * Lo llamativo es que las dos unidades convivian en este mismo objeto, y la
 * unica razon de que `opacity` estuviera bien es que alguien la comparo con un
 * archivo real. A `scale` nadie, hasta el 18 de septiembre de 2026: nueve
 * valores medidos sobre dieciseis archivos, todos entre 96 y 106, ninguno por
 * debajo de 10.
 *
 * El player mantiene un puente para `<= 10` (`escalaComoFactor`), por si queda
 * algun multiplicador de los que el contrato permitia. Este tope de 1000 es
 * generoso a proposito: 10x en porcentaje.
 */
export const interactiveStateSchema = z.object({
  scale: z.number().min(0).max(1000).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(100).optional(),
  transitionDuration: z.number().min(0).max(10000).optional(),
  actions: z.array(stateActionSchema).max(64).optional(),
}).passthrough();

/**
 * `hover` responde al puntero y se deshace al salir; `active` responde al clic
 * y NO se deshace. Un lector que solo implemente `hover` sigue siendo valido:
 * los dos son opcionales.
 */
export const slotStatesSchema = z.object({
  hover: interactiveStateSchema.optional(),
  active: interactiveStateSchema.optional(),
}).passthrough();

/**
 * Una línea de texto precalculada dentro de un textRun.
 * Permite que renderizadores no-web (Swift, Kotlin, Skia) pinten texto
 * sin requerir un motor de maquetación/shaping de párrafos complejo.
 */
export const textLineSchema = z.object({
  text: z.string().max(10000),
  width: z.number().min(0),
  yOffset: z.number(),
}).passthrough();

/** Cajas de línea precalculadas para un idioma específico. */
export const textRunByLangSchema = z.object({
  fontSize: z.number().min(0).optional(),
  lineHeight: z.number().min(0).optional(),
  lines: z.array(textLineSchema).max(500),
}).passthrough();

export const textRunsSchema = z.record(z.string(), textRunByLangSchema);

/**
 * A colour from a .oim. The pattern is the portable twin of `isSafeCssColor`
 * (see dynamic-colors.ts): hex, rgb/hsl, five keywords, and `var()` with a
 * fallback. It admits the dynamic colours on purpose -`var(--primary)` is in
 * real files- and it admits `none`, which the former `fillColor` regex
 * rejected although the editor writes it.
 */
export const cssColorSchema = z.string().max(128).regex(new RegExp(CSS_COLOR_PATTERN));
const cssColor = cssColorSchema;

/**
 * One gradient, as the OIM editor writes it. The portable twin of
 * `isSafeCssGradient`: a single linear/radial/conic function whose only inner
 * functions are colour ones. No `url()`, no second image.
 */
const P_COLOR_FN = String.raw`(?:rgba?|hsla?)\([0-9A-Za-z.,%/\s+-]*\)`;
const P_VAR = String.raw`var\(\s*--[A-Za-z0-9_-]+\s*(?:,(?:[0-9A-Za-z#.,%/\s+-]|${P_COLOR_FN})*)?\)`;
export const CSS_GRADIENT_PATTERN =
  String.raw`^(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[0-9A-Za-z#.,%/\s+-]|${P_COLOR_FN}|${P_VAR})*\)$`;

/** The 14 preset tiles of `patterns.ts`, the same list the editor's MCP offers. */
const PATTERN_PRESETS = [
  "clouds", "bubbles", "grid", "waves", "stars", "stripes", "dots",
  "zigzags", "bolt", "leaf", "drop", "moon", "crown", "heart",
] as const;

/** A vector cut inside a mask. Mirrors the editor's `MaskCut` type. */
export const maskCutSchema = z.object({
  id: z.string().max(128),
  x: z.number(),
  y: z.number(),
  width: z.number().min(0),
  height: z.number().min(0),
  shape: z.enum(["heart", "star", "circle", "rectangle", "hexagon", "blob", "custom"]),
  svgPath: z.string().max(20000).optional(),
  feather: z.number().min(0).max(100).optional(),
  strokeColor: cssColor.optional(),
  strokeWidth: z.number().min(0).max(100).optional(),
}).passthrough();

/**
 * A generative fill. Mirrors the editor's `GenerativeBackground`. The
 * generator is a slug, not an enum: generators are added over time and an
 * unknown one degrades to no fill in the player, it does not break the file.
 */
export const generativeFillSchema = z.object({
  generatorId: z.string().max(64).regex(/^[a-z0-9-]+$/),
  seed: z.number(),
  params: z.record(z.string().max(64), z.union([z.number(), z.string().max(256), z.boolean()])),
  colors: z.object({
    mode: z.enum(["monochrome", "palette"]),
    stops: z.array(cssColor).max(16),
    direction: z.enum(["forward", "reverse", "radial"]),
    background: cssColor,
    backgroundVisible: z.boolean(),
  }).passthrough(),
}).passthrough();

export const oimTextureEffectSchema = z.object({
  type: z.literal("texture"),
  preset: z.enum(TEXTURE_PRESETS),
  intensity: z.number().min(0).max(100).default(30),
  blend: z.enum(EFFECT_BLENDS).default("overlay"),
  scale: z.number().min(0.2).max(5).default(1.0).optional(),
  color: cssColor.optional(),
  colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  enabled: z.boolean().default(true).optional(),
});

export const oimDropShadowEffectSchema = z.object({
  type: z.literal("drop-shadow"),
  x: z.number().default(0).optional(),
  y: z.number().default(4).optional(),
  blur: z.number().min(0).max(200).default(12).optional(),
  spread: z.number().default(0).optional(),
  color: cssColor.default("rgba(0, 0, 0, 0.35)").optional(),
  colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  enabled: z.boolean().default(true).optional(),
});

export const oimBlurEffectSchema = z.object({
  type: z.literal("blur"),
  radius: z.number().min(0).max(100).default(8),
  enabled: z.boolean().default(true).optional(),
});

export const oimGlowEffectSchema = z.object({
  type: z.literal("glow"),
  color: cssColor.default("#f59e0b").optional(),
  colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  radius: z.number().min(0).max(100).default(16),
  intensity: z.number().min(0).max(100).default(50).optional(),
  enabled: z.boolean().default(true).optional(),
});

export const oimColorGradeEffectSchema = z.object({
  type: z.literal("color-grade"),
  preset: z.enum(["warm-vintage", "cool-cinema", "cyberpunk", "monochrome-contrast"]),
  intensity: z.number().min(0).max(100).default(50),
  enabled: z.boolean().default(true).optional(),
});

export const oimEffectSchema = z.discriminatedUnion("type", [
  oimTextureEffectSchema,
  oimDropShadowEffectSchema,
  oimBlurEffectSchema,
  oimGlowEffectSchema,
  oimColorGradeEffectSchema,
]);

/**
 * RETIRED (10 Oct 2026): whole-text highlight, superseded by text marks. The
 * editor no longer writes it (it turns it into a mark); kept so files already
 * published still validate and render. Do not remove.
 */
export const textHighlightSchema = z.object({
  enabled: z.boolean().default(true),
  color: cssColor.default("rgba(245, 158, 11, 0.35)"),
  style: z.enum(["marker", "box", "pill", "underline-thick"]).default("marker"),
  paddingX: z.number().min(0).max(64).optional(),
  paddingY: z.number().min(0).max(64).optional(),
  borderRadius: z.number().min(0).max(64).optional(),
});

/**
 * A text mark (contract 1.11.0): the style of the phrases a text wraps in
 * `{name}...{/name}`. A closed set of attributes, never free CSS; colours go
 * through `cssColor` and roles through DYNAMIC_COLOR_ROLES like every colour.
 * Spec: docs/superpowers/specs/2026-10-10-marcas-de-texto-design.md
 */
export const textMarkSchema = z.object({
  color: cssColor.optional(),
  colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  highlight: z.object({
    style: z.enum(["marker", "box", "pill", "underline-thick"]).optional(),
    color: cssColor.optional(),
    colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
    paddingX: z.number().min(0).max(64).optional(),
    paddingY: z.number().min(0).max(64).optional(),
    borderRadius: z.number().min(0).max(64).optional(),
  }).optional(),
});
export type TextMark = z.infer<typeof textMarkSchema>;

export const dropCapSchema = z.object({
  enabled: z.boolean().default(true),
  lines: z.union([z.literal(2), z.literal(3)]).default(2),
  fontFamily: z.string().max(128).optional(),
  color: cssColor.optional(),
  marginRight: z.number().min(0).max(64).optional(),
});

/**
 * A language code, defined once for the whole format.
 *
 * It used to be defined twice with different limits: 5 characters at the root
 * (`lang`) and 10 inside a slot (`languages`). Same kind of value, two rules,
 * neither of them commented. A document whose layers legitimately declared
 * `zh-Hant-TW` could not list that same language at the root, because ten
 * characters do not fit in five.
 *
 * Ten is the figure that survives: it holds the longest tag anyone actually
 * writes -- language, script and region, as in `zh-Hant-TW` -- while five only
 * reaches language plus region (`pt-BR`). It also has to hold `"*"`, the
 * wildcard that means "every language", which is why there is no minimum.
 *
 * BCP 47 permits longer tags than this. The cap is a sanity bound on a field
 * that arrives from outside, not an attempt to reimplement the standard.
 */
// Not exported: it is a building block of this schema, not part of the
// package's public surface. `superficie-publicada.test.ts` guards that line.
const languageCodeSchema = z.string().max(10);

export const styleSchema = z.object({
  // Stack canónico de efectos unificados
  effects: z.array(oimEffectSchema).max(8).optional(),
  // CSS color: hex, rgb(), rgba(), hsl(), hsla(), `transparent` — max 64 chars
  // para cortar inyecciones largas.
  //
  // `transparent` se anadio tras medirlo: el editor lo escribe y los .oim
  // publicados lo llevan, pero el esquema lo rechazaba. Nadie se entero porque
  // hasta ahora nada validaba un fichero real contra este esquema. Es una
  // palabra clave exacta, asi que no ensancha la superficie que el limite de
  // 64 caracteres protege.
  // Factor sin unidad. Se declara aqui porque NO estaba: `z.object` lo
  // descartaba al validar aunque los .oim publicados lo traen -como cadena-, y
  // el contrato en JSON Schema tampoco lo mencionaba. El player lo aplica a
  // traves de `resolveLineHeight`, que acota al rango que ofrece el editor.
  lineHeight: z.union([z.number(), z.string().max(16)]).optional(),
  fontSize: z.union([z.string().max(16), z.number().min(0)]).optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  textDecoration: z.string().max(64).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): no renderer applied it; the case is written into the text." }).optional(),
  fontSizes: z.record(z.string(), z.string()).optional(),
  maxWidths: z.record(z.string(), z.string()).optional(),
  textRuns: textRunsSchema.optional(),
  outline: z.string().max(128).optional(),
  objectFit: z.enum(["contain", "cover", "fill", "none", "scale-down"]).optional(),
  // 1.15.0: which part of an image shows in its frame, always over "cover" (crop.ts).
  imageCrop: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(10),
  }).optional(),
  // 1.16.0: screen-reader text per language, and a flag that hides the layer from it.
  alt: z.record(languageCodeSchema, z.string().max(300)).optional(),
  decorative: z.boolean().optional(),
  verticalAlign: z.enum(["top", "center", "bottom", "mixed", "justify"]).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): no writer and no reader." }).optional(),
  animation: z.object({
    loop: z.enum(["none", "pulse", "float", "bounce", "spin", "glow", "custom"]).optional(),
    hover: z.enum(["none", "grow", "shrink", "lift", "glow", "custom"]).optional(),
    // Retired in 1.9.0: raw CSS that the player pasted into a stylesheet,
    // where `@import`, `image-set()` or a `}` escaping the rule could request
    // a third party or restyle the player. The editor never wrote them and no
    // file used them. `loop`/`hover: "custom"` now paint nothing.
    custom_loop_css: z.string().max(500).meta({
      deprecated: true,
      description: "Retired in 1.9.0: players do not apply raw CSS. A new writer must not write it.",
    }).optional(),
    custom_keyframes: z.string().max(2000).meta({
      deprecated: true,
      description: "Retired in 1.9.0: players do not apply raw CSS. A new writer must not write it.",
    }).optional(),
    custom_hover_css: z.string().max(500).meta({
      deprecated: true,
      description: "Retired in 1.9.0: players do not apply raw CSS. A new writer must not write it.",
    }).optional(),
    duration: z.number().min(0.1).max(20).optional(),
    delay: z.number().min(0).max(10).optional(),
    keyframes: z.array(keyframeSchema).max(240).optional(),
    // 1.22.0: "action" waits at the first keyframe until a `play` runs it once.
    trigger: z.enum(["load", "action"]).optional(),
  }).optional(),
  reveal: revealSchema.optional(),
  shader_fx: z.object({
    blur: z.number().min(0).max(10).optional(),
    grain: z.number().min(0).max(1).optional(),
    crt_curve: z.boolean().optional(),
  }).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): no writer and no reader." }).optional(),

  // La capa responde al puntero. Es la declaracion del AUTOR, y lo que decide
  // que un lector enganche algo: sin esto, `states` no significa nada.
  isInteractive: z.boolean().optional(),
  states: slotStatesSchema.optional(),

  // Texturas y efectos visuales de capa (estilo fffuel)
  // Retired in 1.12.0: a layer's grain is a texture in its `effects`. Kept so
  // files already published validate and render.
  grain: z.boolean().meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): a layer's grain is a texture in style.effects." }).optional(),
  grainIntensity: z.number().min(1).max(100).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): see grain." }).optional(),
  // 1.10.0: the grain's size (1 finest - 100 coarsest; grainFrequency maps it)
  // and how it blends with the layer. Monochrome by design: no colour field.
  grainSize: z.number().min(1).max(100).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): see grain." }).optional(),
  grainBlend: z.enum(GRAIN_BLENDS).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): see grain." }).optional(),
  effect: z.enum(["none", "neon", "shadow"]).optional(),
  effectColor: cssColor.optional(),
  effectRadius: z.number().min(0).max(100).optional(),

  // ==========================================================================
  // Las veintidós que TODOS los archivos traen.
  //
  // Medido el 18 de septiembre de 2026 con `packages/spec/tools/style-usage.mjs`
  // sobre doce archivos -nueve obras publicadas mas tres demos-: estas
  // veintidos aparecen en los doce, sin excepcion, y ninguna estaba declarada.
  // El contrato describia 24 claves de estilo mientras el player leia 117.
  //
  // Se declaran estas primero justamente porque no admiten discusion: lo que
  // trae el 100% del corpus pertenece al formato.
  //
  // DOS CAUTELAS, las dos aprendidas mirando los valores reales antes de
  // escribir una sola linea:
  //
  //   1. Los colores pueden ser `var(--text)` o `var(--oim-color-accent, #...)`
  //      -los colores dinamicos-. El patron del campo `color` de mas arriba
  //      (hex/rgb/hsl/transparent) los RECHAZARIA. Por eso estos van como
  //      cadena acotada y sin patron: declarar de mas aqui invalida archivos
  //      que hoy funcionan.
  //   2. `blendMode` viaja tal cual a `mix-blend-mode` en CSS, asi que su
  //      conjunto de valores es el de CSS, no uno nuestro. Un enum seria
  //      inventarse un limite que el player no aplica.
  //
  // Los rangos numericos son holgados a proposito. Lo medido fue
  // `shadowBlur` 8..32, `shadowOpacity` 30..70 y `layerBlur` 0..40; acotar a
  // lo observado convertiria «nadie lo ha hecho todavia» en «esta prohibido».
  // ==========================================================================

  // Texto
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  fontFamily: z.string().max(128).optional(),

  // Geometria de la capa: admite `cqw` -porcentaje del ancho del contenedor-,
  // o valores numericos puros en unidades de usuario / viewBox.
  width: z.union([z.string().max(32), z.number().min(0)]).optional(),
  height: z.union([z.string().max(32), z.number().min(0)]).optional(),
  maxWidth: z.union([z.string().max(32), z.number().min(0)]).optional(),
  // Cuatro radios en una cadena: "0.0cqw 0.0cqw 0.0cqw 6.0cqw", o valor unico.
  borderRadius: z.union([z.string().max(128), z.number().min(0)]).optional(),

  // Relleno y trazo. Ver cautela 1 sobre el patron de color.
  // El patron lo hereda de `color`, el alias que sustituye: resultaba estar
  // MEJOR especificado que ella -validaba el formato mientras `fillColor`
  // admitia cualquier cadena de 64-. Retirar el alias sin quedarse su patron
  // habria cambiado un duplicado por un agujero.
  //
  // `transparent` esta dentro a proposito: el editor lo escribe.
  fillColor: cssColor.optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  textStrokeColor: cssColor.optional(),

  // Sombra. `shadowEnabled` manda: el resto solo cuenta si es cierto.
  shadowEnabled: z.boolean().optional(),
  shadowColor: cssColor.optional(),
  shadowColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  shadowBlur: z.number().min(0).max(200).optional(),
  shadowOffsetX: z.number().min(-500).max(500).optional(),
  shadowOffsetY: z.number().min(-500).max(500).optional(),
  shadowOpacity: z.number().min(0).max(100).optional(),

  // Composicion
  // Closed to the values the editor offered, then retired: the canvas and the
  // player isolate each layer, so it only ever showed in the static export.
  blendMode: z.enum(["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference"]).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): layer blend did not show in the editor or the player; readers draw the layer as normal." }).optional(),
  layerBlur: z.number().min(0).max(100).optional(),
  maskCoverage: z.string().max(32).optional(),
  maskInvert: z.boolean().optional(),

  // ==========================================================================
  // Cargas útiles funcionales (las 28 propiedades de dibujo y estilo)
  // ==========================================================================
  // Bordes y trazos
  strokeColor: cssColor.optional(),
  strokeWidth: z.number().min(0).optional(),
  textStrokeWidth: z.number().min(0).max(100).optional(),

  // Geometría y formas vectoriales
  // `scribble` was missing: the editor writes it and the player paints it
  // (ImageEngine, via `customBlobPath`), so a real file failed the contract.
  // 1.19.0: twelve shapes that work as photo frames (geoShapes.ts).
  geoShape: z.enum([
    "rectangle", "circle", "triangle", "star", "line", "arrow",
    "diamond", "hexagon", "heart", "blob", "scribble", "custom",
    "pill", "octagon", "pentagon", "cross", "moon", "cloud", "drop",
    "bolt", "bubble", "flower", "burst", "arch",
  ]).optional(),
  // 1.19.0: the outline of a custom SVG frame (frame-svg, editor). Only path
  // data: no markup, quotes or url(), so nothing but a path can enter a .oim.
  svgPath: z.string().max(20000).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/).optional(),
  // 1.19.0: the custom frame's coordinate box; four numbers only.
  svgViewBox: z.string().max(64).regex(/^-?\d+(\.\d+)?([\s,]+-?\d+(\.\d+)?){3}$/).optional(),
  svgRawXml: z.string().optional(),

  // Texto vectorial y relieve artístico (artistic-text)
  artisticPreset: z.enum([
    "neon-cyberpunk", "retro-wave-3d", "comic-pop-extrusion",
    "vintage-emboss", "chrome-metallic", "arcade-80s", "custom"
  ]).optional(),
  curveAmount: z.number().min(-100).max(100).optional(),
  curveType: z.enum(["arc", "wave", "arch"]).optional(),
  extrusionDepth: z.number().min(0).max(100).optional(),
  extrusionAngle: z.number().min(0).max(360).optional(),
  extrusionColor: cssColor.optional(),
  extrusionShading: z.boolean().optional(),
  outerStrokeColor: cssColor.optional(),
  outerStrokeWidth: z.number().min(0).optional(),
  innerStrokeColor: cssColor.optional(),
  innerStrokeWidth: z.number().min(0).optional(),

  // Máscara y troquelado
  maskMode: z.enum(["window", "cutout"]).optional(),
  maskShape: z.enum([
    "circle", "rectangle", "triangle", "star", "line", "arrow",
    "diamond", "hexagon", "heart", "blob", "custom"
  ]).optional(),
  maskBgColor: cssColor.optional(),
  maskStrokeColor: cssColor.optional(),
  maskStrokeWidth: z.number().min(0).optional(),

  // Filtros y CSS de animación
  filterPreset: z.enum([
    "none", "duotone", "grayscale", "sepia", "high-contrast", "vintage",
    "cool", "warm", "faded", "cinema", "nordic", "sunset", "noir",
    "dramatic", "cyberpunk", "pastel", "vhs"
  ]).optional(),
  // The ONLY shape the editor writes (App.tsx, the moving background pattern)
  // and the only one the player applies. A free string was raw CSS by name.
  cssAnimation: z.string().max(128)
    .regex(/^background-animation-(?:right|left|up|down|zoom-in|zoom-out|pulse|none) \d+(?:\.\d+)?s linear infinite$/)
    .optional(),
  filterBlur: z.number().min(0).max(100).optional(),
  filterBrightness: z.number().min(0).max(500).optional(),
  filterContrast: z.number().min(0).max(500).optional(),
  filterSaturate: z.number().min(0).max(500).optional(),
  filterHueRotate: z.number().min(0).max(360).optional(),

  // Animación de texto por caracteres (wave-chars, glitch, typewriter)
  textAnimationType: z.enum([
    "none",
    "typewriter",
    "fade-chars",
    "slide-up",
    "blur-chars", // RETIRED (10 Oct 2026): per-letter blur is not portable; kept so old files validate
    "bounce-chars",
    "wave-chars",
    "glitch-cyberpunk",
    "glitch-slice",
    // 1.13.0 (text effects, delivery B): portable entrances only.
    "reveal-mask",
    "scale-in",
    "rise-words"
  ]).optional(),
  textAnimationSpeed: z.number().min(0).max(200).optional(),
  textAnimationDelay: z.number().min(0).max(100).optional(),
  textAnimationIntensity: z.number().min(0).max(100).optional(),
  typewriterCursor: z.boolean().optional(),
  textHighlight: textHighlightSchema.optional(),
  dropCap: dropCapSchema.optional(),
  marks: z.record(z.string().regex(MARK_NAME), textMarkSchema)
    .refine((m) => Object.keys(m).length <= MAX_MARKS, { message: `At most ${MAX_MARKS} marks per layer` })
    .optional(),

  // Propiedades complementarias de relleno, patrones y máscaras
  customBlobPath: z.string().optional(),
  maskFeather: z.number().min(0).max(100).optional(),
  maskSvgPath: z.string().optional(),
  cuts: z.array(maskCutSchema).max(32).optional(),
  trimStart: z.number().min(0).max(100).optional(),
  trimEnd: z.number().min(0).max(100).optional(),
  trimDuration: z.number().min(0).max(100).optional(),
  groupId: z.string().max(128).optional(),
  rotation: z.number().optional(),
  // 1.14.0: mirror the layer on its own axes (lib flip.ts paints it).
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  opacity: z.number().min(0).max(100).optional(),
  isVisible: z.boolean().optional(),
  textGradientType: z.enum(["none", "linear", "metallic-chrome", "sunset-gold", "neon-glow"]).optional(),
  fillColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  strokeColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  colorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  textStrokeColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  effectColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  maskBgColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  maskStrokeColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  fillGenerative: generativeFillSchema.optional(),
  fillGradient: z.string().max(2048).regex(new RegExp(CSS_GRADIENT_PATTERN)).optional(),
  fillPatternType: z.enum(PATTERN_PRESETS).optional(),
  fillPatternColor: cssColor.optional(),
  fillPatternColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  fillPatternBgColor: cssColor.optional(),
  fillPatternBgColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  fillPatternSpeed: z.number().optional(),
  fillPatternScale: z.number().optional(),
  fillPatternDirection: z.enum(["right", "left", "up", "down", "zoom-in", "zoom-out", "pulse", "none"]).optional(),
  fillPatternSvgs: z.array(z.string().max(8000)).max(16).optional(),
  fillPatternColors: z.array(cssColor).max(16).optional(),
  fillPatternSizes: z.array(z.number()).max(16).optional(),
  fillPatternCounts: z.array(z.number()).max(16).optional(),
  fillPatternDispersions: z.array(z.number()).max(16).optional(),

  // Fondos y patrones de relleno
  backgroundType: z.enum(["color", "gradient", "pattern", "generative", "transparent", "image"]).optional(),
  backgroundPatternColor: cssColor.optional(),
  backgroundPatternColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  backgroundPatternBgColor: cssColor.optional(),
  backgroundPatternBgColorRole: z.enum(DYNAMIC_COLOR_ROLES as [DynamicColorRole, ...DynamicColorRole[]]).optional(),
  backgroundPatternColors: z.array(cssColor).max(16).optional(),
  // 1.17.0: a shape filled with a picture. `fillImage` travels embedded as a data:image URI,
  // like image-layer content (capped at the same 10MB); `fillImageCrop` frames it like `imageCrop`.
  fillType: z.enum(["none", "color", "gradient", "pattern", "generative", "image"]).optional(),
  fillImage: z.string().max(10000000).regex(/^data:image\//).optional(),
  fillImageCrop: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(10),
  }).optional(),
  // 1.19.0: mirror the photo inside the frame. The shape itself does not move.
  fillImageFlipX: z.boolean().optional(),
  fillImageFlipY: z.boolean().optional(),
}).passthrough();


// Content object — dictionary of language → text
export const contentSchema = z.record(z.string(), z.string().max(10000000)); // Allow up to 10MB for base64 images

// Position — normalized [x, y] array
export const positionSchema = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

// Tracking keyframe — [time, x1..y4, cx, cy]
export const trackingKeyframeSchema = z.array(z.number()).min(2);

// Zone definition — Lottie-style named bounding box
export const zoneSchema = z.object({
  id: z.string().min(1).max(128),
  position: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]), // [x, y]
  size: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]),     // [width, height]
  style: z.record(z.string(), z.any()).optional(),
});

// Single slot/element definition
export const interactionSchema = z.object({
  action_type: z.enum(["toggle_elements", "none"]),
  target: z.object({
    hide_slots: z.array(z.string().max(128)),
    show_slots: z.array(z.string().max(128)),
  }).optional(),
});

export const parallaxInfiniteSchema = z.object({
  enabled: z.boolean().default(false),
  speed_px_sec: z.number().min(-500).max(500).default(20),
  direction: z.enum(["left_to_right", "right_to_left"]).default("right_to_left"),
  seamless_tile: z.boolean().default(true),
  pause_on_hover: z.boolean().default(false),
}).passthrough();

export const parallaxSchema = z.object({
  enabled: z.boolean().default(true),
  depth: z.number().min(-2.0).max(2.0).default(0.5),
  mode: z.enum(["mouse", "scroll", "infinite_horizontal"]).catch("mouse").default("mouse"),
  axis: z.enum(["both", "x_only", "y_only"]).default("both"),
  infinite: parallaxInfiniteSchema.optional(),
}).passthrough();

export const slotSchema = z.object({
  id: z.string().min(1).max(128),
  // Los cinco ultimos son las layers anadidas despues de escribirse este
  // schema. Nada valida con Zod en tiempo de ejecucion —el player lee con
  // JSON.parse en binary.ts—, asi que ningun .oim se rechazaba por faltar;
  // el riesgo era el otro: @oim-media/core publica este tipo como su contrato, y un
  // tercero que lo tomara por bueno concluiria que una mascara no es un slot
  // valido. Mismo problema que el compilador huerfano que vivia en
  // serialize.ts: un tipo exportado que miente.
  type: z.enum([
    "text", "image", "lottie", "zone", "geo", "shape", "draw",
    "filter", "container", "group", "component", "mask", "svg", "pattern", "artistic-text"
  ]).optional(),
  // Which languages show this layer. `["*"]` -- the default -- means all of
  // them. Not to be confused with the root `languages`, which lists the
  // languages the DOCUMENT has: same name, different question.
  languages: z.array(languageCodeSchema).default(["*"]).optional(),
  pendingTranslation: z.array(languageCodeSchema).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  content: contentSchema.optional(), // Make optional since slot can be structural/empty
  style: styleSchema.optional(),
  position: positionSchema.optional(),
  parallax: parallaxSchema.optional(),
  tracking_data: z.array(trackingKeyframeSchema).optional(),
  width_px: z.number().optional(),
  height_px: z.number().optional(),
  zone_id: z.string().max(128).optional(), // target containment zone

  // El nombre que puso el AUTOR. Viaja al archivo desde el 22 de agosto y el
  // backend ya lo acepta; este esquema era el unico que iba por detras.
  //
  // Importa para quien integra: el `id` lo genera el editor al azar, asi que es
  // estable pero ilegible. El nombre es lo unico por lo que una pagina puede
  // reconocer una capa sin abrir el archivo. NO es unico.
  name: z.string().max(256).optional(),

  // `link` y `target` estuvieron aqui hasta el 29 de agosto de 2026. Un .oim no
  // declara a donde te lleva un clic: seria la unica via en la que decide el
  // ARCHIVO y no la PAGINA que lo embebe. Se quitaron del backend y del espejo
  // del editor el 28; este esquema era el tercer sitio.
  interaction: interactionSchema.optional(),
  
  // Abreviaciones para optimización extrema de tamaño (estilo Lottie)
  // Short aliases, retired in 1.12.0: no writer emits them and two names for
  // one concept mean two readings of a file (as 1.5.0 did with style).
  p: positionSchema.meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): use position." }).optional(),
  s: z.tuple([z.number(), z.number()]).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): no writer emits it." }).optional(),
  st: styleSchema.meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): use style." }).optional(),
  c: contentSchema.meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): use content." }).optional(),
  t: z.array(trackingKeyframeSchema).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): use tracking_data." }).optional(),
});

// Configuración de textura de grano analógico procedural (Post-procesado / Lienzo)
export const grainConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intensity: z.number().min(1).max(100).default(15),
  baseFrequency: z.number().min(0.1).max(2.0).default(0.8),
  blendMode: z.enum(["overlay", "screen", "multiply", "soft-light"]).default("overlay"),
  // Optional tint. A player that does not know it paints the usual grey grain.
  color: z.string().max(64).regex(/^#[0-9a-fA-F]{3,8}$|^rgba?\([\d.,\s%]+\)$/).optional(),
}).passthrough();

// One embedded font variant. `data` is base64 woff2; the bound is the decoded
// ceiling expressed in base64 characters.
export const embeddedFontSchema = z.object({
  family: z.string().min(1).max(128),
  name: z.string().regex(EMBEDDED_FONT_NAME),
  weight: z.number().int().min(100).max(900),
  style: z.enum(["normal", "italic"]),
  format: z.literal("woff2"),
  data: z.string().max(Math.ceil(EMBEDDED_FONT_MAX_BYTES / 3) * 4),
});

// Top-level metadata for OIM (image)
export const OimMetadataSchema = z.object({
  // 1.16.0: what the whole document shows, per language, for screen readers.
  description: z.record(languageCodeSchema, z.string().max(1000)).optional(),
  oim: z.string().optional(),
  version: z.string().optional(),
  // La version MINIMA del contrato que hace falta para reconstruir este
  // documento. Se declara para que aparezca en el JSON Schema publicado: una
  // implementacion en otro lenguaje no puede honrar un campo que el contrato
  // no menciona. Ausente = no exige nada, que es el caso de todo lo publicado
  // hasta hoy.
  min_player: z.string().max(16).optional(),
  image: z.string().optional(),
  oim_id: z.string().max(128).optional(),      // Unique tracking ID for document re-editing
  media_type: z.enum(["image", "video"]).optional(), // Media type of the OIM document
  image_hash: z.string().max(64).optional(),    // Image seal: SHA-256 of the IDAT payloads, when image_hash_alg says so
  image_hash_alg: z.string().max(32).optional(), // "sha256-idat". Without it, image_hash is legacy and not enforced
  immutable_lock: z.boolean().optional(),      // Flag to seal the file from future edits
  // Who may re-edit the work. It travels INSIDE the file: whoever opens it
  // knows what its author wanted without asking anyone. `immutable_lock` is
  // the enforcement side and the two are written together
  // (`permissionFields`). An unknown value falls back to `solo_autor`, never
  // to `publico` -- see reeditPermission.ts, which is canonical.
  reedicion: z.enum(["publico", "solo_autor", "sellado"]).optional(),
  // The title of the work. Every published file carries it at the root and
  // the contract did not declare it, so a reader built from the contract
  // alone would not know to look for it. Not to be confused with `slot.name`
  // or `fonts[].name`.
  name: z.string().max(256).optional(),
  // Retired with `allow_external_urls` in 1.1.0. Their ONLY readers -- the
  // backend's signing routes -- sit behind `if allow_external_urls`, a key the
  // contract no longer declares, so the gate cannot fire for a conforming
  // file. They stay declared, and marked, because the backend still honours
  // them if a file carries the retired key: deleting them from the contract
  // would make it lie in the other direction.
  redirect_membership_verified: z.boolean().meta({
    deprecated: true,
    description: "Retired in 1.1.0 with allow_external_urls. A new reader must not write it.",
  }).optional(),
  terms_accepted: z.boolean().meta({
    deprecated: true,
    description: "Retired in 1.1.0 with allow_external_urls. A new reader must not write it.",
  }).optional(),
  // Retired in 1.7.0. A .oim is a sandbox: opening it contacts no one and the
  // player no longer checks which site it is opened on (it answered
  // `domain_blocked`; that verdict is gone). Kept declared, and marked,
  // because published files carry it: deleting it from the contract would
  // make it lie in the other direction.
  allowed_domains: z.array(z.string().max(253)).meta({
    deprecated: true,
    description: "Retired in 1.7.0: players do not enforce it. A new writer must not write it.",
  }).optional(),
  canvas: z.object({ natural_width: z.number().positive(), natural_height: z.number().positive() }).optional(), // Canvas dimensions
  // The languages this document carries.
  //
  // Files in the wild write `languages`; the player normalises it into `lang`
  // (normalize-raw-slots.ts) and everything downstream reads `lang`. Both are
  // declared because both are real: leaving `languages` out of the contract
  // meant an implementation in another language would not know to read the
  // name that files actually use, and would find the root empty.
  lang: z.array(languageCodeSchema).optional(),
  languages: z.array(languageCodeSchema).optional(),
  // Named palettes (1.20.0): a role -> colour map per name, at most six. The
  // colours are not checked here: resolvePalette discards the invalid ones and
  // keeps the rest, the same as a layer colour that does not pass.
  palettes: z.record(
    z.string().regex(PALETTE_NAME_PATTERN),
    // Keyed by the role enum, so the JSON schema carries propertyNames and
    // additionalProperties: false, and an unknown role is a parse error.
    z.partialRecord(z.enum(DYNAMIC_COLOR_ROLES as [string, ...string[]]), z.string().max(128)),
  // `.meta` puts the cap in the generated JSON Schema; `.refine` only checks at runtime.
  ).meta({ maxProperties: 6 }).refine((p) => Object.keys(p).length <= 6, { message: "At most 6 palettes per document" }).optional(),
  // Must name one of `palettes`; if not, readers ignore it (resolvePalette).
  defaultPalette: z.string().optional(),
  zones: z.array(zoneSchema).optional(),       // Catalog of bounding box zones
  slots: z.array(slotSchema).max(MAX_SLOTS),
  // Los tres campos llevan los MISMOS slots y por eso los tres se acotan.
  // `elements` no es herencia: el player lee `slots || elements` y el backend
  // cuenta `elements` primero. Acotar solo `slots` dejaba el contrato
  // prometiendo un tope que un campo equivalente no cumplia.
  elements: z.array(slotSchema).max(MAX_SLOTS).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): slots is the one name; readers still accept it." }).optional(),
  layers: z.array(slotSchema).max(MAX_SLOTS).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): slots is the one name; readers still accept it." }).optional(),
  capabilities: z.array(z.enum(["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"])).optional(),
  // Capacidades requeridas indispensables para reproducir fielmente el documento (patrón glTF).
  capabilities_required: z.array(z.enum(["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"])).optional(),
  // Fonts shipped inside the file (1.3.0). Optional and ignorable: a reader
  // that does not know it asks Google for the family, as before 1.3.0.
  fonts: z.array(embeddedFontSchema).max(EMBEDDED_FONTS_MAX_ENTRIES).optional(),
  // Retired in 1.12.0: the background grain is baked into the image.
  grain: grainConfigSchema.meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): the background grain is baked into the base image." }).optional(),
  effects: z.array(oimEffectSchema).max(8).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): the background grain is baked into the base image." }).optional(),
  signature: z.string().optional(),            // Cryptographic ECDSA signature
  key_version: z.string().optional(),          // Cryptographic key version used
  // Fecha exacta de la firma criptografica (dentro de la firma para verificar caducidad de claves)
  signed_at: z.string().datetime({ offset: true }).optional(),
  // `{ offset: true }` porque el backend escribe `2026-06-12T20:38:40.713579+00:00`
  // -isoformat de Python-, no la forma con `Z` que Zod exige por defecto. Los
  // CUATRO .oim de produccion que se probaron fallaban aqui.
  timestamp: z.string().datetime({ offset: true }).optional(), // ISO timestamp of package creation
}).passthrough();

// Top-level metadata for OVM (video)
export const OvmMetadataSchema = z.object({
  ovm_version: z.string().optional(),
  version: z.string().optional(),
  ovm_id: z.string().max(128).optional(),      // Unique tracking ID for document re-editing
  image_hash: z.string().max(64).optional(),    // SHA-256 hash of original video/track
  immutable_lock: z.boolean().optional(),      // Flag to seal the file from future edits
  // Retired with `allow_external_urls` in 1.1.0. Their ONLY readers -- the
  // backend's signing routes -- sit behind `if allow_external_urls`, a key the
  // contract no longer declares, so the gate cannot fire for a conforming
  // file. They stay declared, and marked, because the backend still honours
  // them if a file carries the retired key: deleting them from the contract
  // would make it lie in the other direction.
  redirect_membership_verified: z.boolean().meta({
    deprecated: true,
    description: "Retired in 1.1.0 with allow_external_urls. A new reader must not write it.",
  }).optional(),
  terms_accepted: z.boolean().meta({
    deprecated: true,
    description: "Retired in 1.1.0 with allow_external_urls. A new reader must not write it.",
  }).optional(),
  allowed_domains: z.array(z.string().max(253)).optional(), // Allowed domains for hybrid locking
  metadata: z.object({
    fps: z.number().min(1).max(120).optional(),
    resolution: z.tuple([z.number(), z.number()]).optional(),
  }).optional(),
  zones: z.array(zoneSchema).optional(),       // Catalog of bounding box zones
  slots: z.array(slotSchema).max(MAX_SLOTS),
  // Los tres campos llevan los MISMOS slots y por eso los tres se acotan.
  // `elements` no es herencia: el player lee `slots || elements` y el backend
  // cuenta `elements` primero. Acotar solo `slots` dejaba el contrato
  // prometiendo un tope que un campo equivalente no cumplia.
  elements: z.array(slotSchema).max(MAX_SLOTS).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): slots is the one name; readers still accept it." }).optional(),
  layers: z.array(slotSchema).max(MAX_SLOTS).meta({ deprecated: true, description: "Retired in 1.12.0 (contract audit, 10 Oct 2026): slots is the one name; readers still accept it." }).optional(),
  capabilities: z.array(z.enum(["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"])).optional(),
  capabilities_required: z.array(z.enum(["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"])).optional(),
  signature: z.string().optional(),            // Cryptographic ECDSA signature
  key_version: z.string().optional(),          // Cryptographic key version used
  signed_at: z.string().datetime({ offset: true }).optional(),
  // `{ offset: true }` porque el backend escribe `2026-06-12T20:38:40.713579+00:00`
  // -isoformat de Python-, no la forma con `Z` que Zod exige por defecto. Los
  // CUATRO .oim de produccion que se probaron fallaban aqui.
  timestamp: z.string().datetime({ offset: true }).optional(), // ISO timestamp of package creation
}).passthrough();

// Union type for demuxer boundary
export const OIMOrOVMMetadata = z.union([OimMetadataSchema, OvmMetadataSchema]);

export type OIMMetadata = z.infer<typeof OimMetadataSchema>;
export type OVMMetadata = z.infer<typeof OvmMetadataSchema>;
export type Slot = z.infer<typeof slotSchema>;
