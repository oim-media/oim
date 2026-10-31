import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  OimMetadataSchema, OvmMetadataSchema, slotSchema, keyframeSchema, styleSchema,
  interactiveStateSchema, slotStatesSchema, stateActionSchema, MAX_SLOTS,
} from './schema';

describe('slotSchema', () => {
  it('accepts valid slot', () => {
    const result = slotSchema.safeParse({
      id: 'text-1',
      content: { es: 'Hola', en: 'Hello' },
      position: [50, 50],
      style: { fillColor: '#f59e0b', fontSize: '24px' },
    });
    expect(result.success).toBe(true);
  });

  it('validates slot with canonical parallax config', () => {
    const result = slotSchema.safeParse({
      id: 'parallax-layer-1',
      type: 'svg',
      parallax: {
        enabled: true,
        depth: 0.8,
        mode: 'mouse',
        axis: 'both',
        infinite: {
          enabled: true,
          speed_px_sec: 30,
          direction: 'right_to_left',
          seamless_tile: true,
          pause_on_hover: false,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts legacy parallax fields (damping, combined, gyroscope) without failing', () => {
    const result = slotSchema.safeParse({
      id: 'parallax-legacy',
      type: 'image',
      parallax: {
        enabled: true,
        depth: 0.5,
        mode: 'combined',
        damping: 0.1,
        autoDepthDistribution: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects slot without id', () => {
    const result = slotSchema.safeParse({ content: { es: 'Hola' } });
    expect(result.success).toBe(false);
  });

  it('rejects invalid color', () => {
    const result = slotSchema.safeParse({
      id: 'test',
      content: { es: 'test' },
      style: { fillColor: 'not-a-color' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects position out of range', () => {
    const result = slotSchema.safeParse({
      id: 'test',
      content: { es: 'test' },
      position: [150, 50],
    });
    expect(result.success).toBe(false);
  });
});

describe('OimMetadataSchema', () => {
  it('accepts valid OIM metadata', () => {
    const result = OimMetadataSchema.safeParse({
      version: '1.0',
      lang: ['es', 'en'],
      slots: [
        { id: 'title', content: { es: 'Título', en: 'Title' }, position: [50, 20] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts vector_parallax in metadata capabilities', () => {
    const result = OimMetadataSchema.safeParse({
      slots: [{ id: 'slot-1' }],
      capabilities: ['vector_parallax', 'infinite_parallax'],
      capabilities_required: ['vector_parallax'],
    });
    expect(result.success).toBe(true);
  });
});

describe('OvmMetadataSchema', () => {
  it('accepts valid OVM metadata', () => {
    const result = OvmMetadataSchema.safeParse({
      ovm_version: '1.0',
      metadata: { fps: 30, resolution: [1920, 1080] },
      slots: [{ id: 'subtitle', content: { es: 'Subtítulo' } }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects fps out of range', () => {
    const result = OvmMetadataSchema.safeParse({
      slots: [],
      metadata: { fps: 200 },
    });
    expect(result.success).toBe(false);
  });
});

describe('keyframeSchema validation', () => {
  it('accepts a minimal keyframe with only t', () => {
    const result = keyframeSchema.safeParse({ t: 10 });
    expect(result.success).toBe(true);
  });

  it('accepts all fields with a keyword easing', () => {
    const result = keyframeSchema.safeParse({
      t: 30,
      o: 0.5,
      s: 2,
      r: 180,
      x: 100,
      y: -50,
      b: 10,
      e: 'ease-in-out',
    });
    expect(result.success).toBe(true);
  });

  it('accepts cubic-bezier easing as a 4-number tuple', () => {
    const result = keyframeSchema.safeParse({
      t: 5,
      e: [0.25, 0.1, 0.25, 1.0],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative t', () => {
    const result = keyframeSchema.safeParse({ t: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range opacity or scale', () => {
    // A frame's opacity accepts values up to 2: a bouncing curve overshoots its
    // target before settling back, and published files reach 1.367. The cap was
    // set with the arrival value in mind, not the path. 1.1 is a REAL value and
    // must pass.
    expect(keyframeSchema.safeParse({ t: 10, o: 1.1 }).success).toBe(true);
    expect(keyframeSchema.safeParse({ t: 10, o: 1.367 }).success).toBe(true);
    expect(keyframeSchema.safeParse({ t: 10, o: 2.1 }).success).toBe(false);

    // `s` is the FRAME's scale and remains a multiplier: it was not changed.
    // Do not confuse it with `states.hover.scale`, which is a percentage.
    expect(keyframeSchema.safeParse({ t: 10, s: 11 }).success).toBe(false);
  });

  it('rejects a bezier tuple of invalid length', () => {
    const tooFew = keyframeSchema.safeParse({ t: 10, e: [0.1, 0.2, 0.3] });
    const tooMany = keyframeSchema.safeParse({ t: 10, e: [0.1, 0.2, 0.3, 0.4, 0.5] });
    expect(tooFew.success).toBe(false);
    expect(tooMany.success).toBe(false);
  });
});

describe('styleSchema keyframes validation', () => {
  it('accepts styleSchema with keyframes and duration', () => {
    const result = styleSchema.safeParse({
      animation: {
        duration: 5,
        keyframes: [
          { t: 0, o: 0 },
          { t: 5, o: 1, s: 1.5, e: 'ease-out' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects arrays with >240 keyframes', () => {
    const keyframes = Array.from({ length: 241 }, (_, i) => ({ t: Math.min(60, i * 0.2) }));
    const result = styleSchema.safeParse({
      animation: {
        keyframes,
      },
    });
    expect(result.success).toBe(false);
  });

  it('still accepts animations without keyframes', () => {
    const result = styleSchema.safeParse({
      animation: {
        duration: 3,
        loop: 'pulse',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('slotSchema — tipos de capa anadidos despues del schema original', () => {
  // Without this, the enum falls behind every time a layer is added and nobody
  // notices: nothing validates with Zod at runtime, so the only place the drift
  // can come to light is a test.
  const nuevos = ['filter', 'container', 'group', 'component', 'mask'] as const;

  for (const tipo of nuevos) {
    it(`acepta type "${tipo}"`, () => {
      const result = slotSchema.safeParse({ id: `slot-${tipo}`, type: tipo });
      expect(result.success).toBe(true);
    });
  }

  it('sigue rechazando un tipo inventado', () => {
    const result = slotSchema.safeParse({ id: 'slot-x', type: 'icon' });
    expect(result.success).toBe(false);
  });
});

/**
 * Interactivity, now in the contract.
 *
 * It travelled in the file for months, but inside `style`, which this
 * schema declares open. A reader written in Python or Swift saw an opaque
 * dictionary: to reproduce the behaviour it had to DEDUCE it by reading the
 * player, which is the divergence a contract exists to prevent.
 */
describe('la interactividad declarada', () => {
  it('acepta una capa interactiva con sus acciones', () => {
    const r = slotStatesSchema.safeParse({
      hover: { scale: 1.2, opacity: 80 },
      active: { actions: [{ target: "ficha", type: "toggle" }] },
    });
    expect(r.success).toBe(true);
  });

  /**
   * THE RANGE MATTERS, and this test exists because of a real bug. The editor
   * stored the state opacity as 0..1 and the player divides it by 100
   * (`stateStyles`), so a 50% ended up painting `opacity: 0.005`:
   * any layer with hover opacity became invisible. It was uncovered by
   * declaring the range here rather than in a behaviour test.
   */
  it('la opacidad va de 0 a 100, como la de capa', () => {
    expect(interactiveStateSchema.safeParse({ opacity: 100 }).success).toBe(true);
    expect(interactiveStateSchema.safeParse({ opacity: 0 }).success).toBe(true);
    expect(interactiveStateSchema.safeParse({ opacity: 101 }).success).toBe(false);
    expect(interactiveStateSchema.safeParse({ opacity: -1 }).success).toBe(false);
  });

  it('solo admite los cuatro tipos de accion que el player ejecuta', () => {
    for (const type of ["show", "hide", "toggle", "setText"]) {
      expect(stateActionSchema.safeParse({ target: "x", type }).success).toBe(true);
    }
    expect(stateActionSchema.safeParse({ target: "x", type: "navigate" }).success).toBe(false);
  });

  it('una accion sin destino no es una accion', () => {
    expect(stateActionSchema.safeParse({ type: "show" }).success).toBe(false);
    expect(stateActionSchema.safeParse({ target: "", type: "show" }).success).toBe(false);
  });

  /**
   * A .oim does not declare where a click takes you. These were removed from the
   * backend and the editor's mirror; the schema was the third place.
   */
  it('un slot ya no puede declarar una redireccion', () => {
    const r = slotSchema.safeParse({ id: "s1", link: "https://ejemplo.com", target: "_blank" });
    expect(r.success).toBe(true);           // it is not rejected: it is ignored
    expect(r.data).not.toHaveProperty("link");
    expect(r.data).not.toHaveProperty("target");
  });

  it('pero si su nombre, que es lo unico legible que lleva', () => {
    const r = slotSchema.safeParse({ id: "shape_text_k3j9x2m1p", name: "Boton1" });
    expect(r.success && r.data.name).toBe("Boton1");
  });

  it('admite textRuns estructurados por idioma en style', () => {
    const r = slotSchema.safeParse({
      id: "text-runs-1",
      type: "text",
      position: [10, 20],
      style: {
        fontSize: 24,
        textRuns: {
          es: {
            fontSize: 24,
            lineHeight: 28.8,
            lines: [
              { text: "Hola mundo", width: 120.5, yOffset: 0 },
              { text: "segunda linea", width: 140.2, yOffset: 28.8 },
            ],
          },
          en: {
            fontSize: 24,
            lines: [
              { text: "Hello world", width: 110.0, yOffset: 0 },
            ],
          },
        },
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.style?.textRuns?.es?.lines).toHaveLength(2);
      expect(r.data.style?.textRuns?.es?.lines[1].yOffset).toBe(28.8);
      expect(r.data.style?.textRuns?.en?.lines[0].text).toBe("Hello world");
    }
  });

  it('rechaza lineas de textRuns con tipos o anchos invalidos', () => {
    const r = slotSchema.safeParse({
      id: "text-runs-invalid",
      type: "text",
      style: {
        textRuns: {
          es: {
            lines: [
              { text: "Invalido", width: -5, yOffset: 0 }, // negative width is not allowed
            ],
          },
        },
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("el tope de slots", () => {
  it("vale 150, que es lo que el backend rechaza", () => {
    expect(MAX_SLOTS).toBe(150);
  });

  // It is the cap that makes everything else useful: if the schema does not bound
  // it, the contract does not publish it and the editor cannot warn in advance.
  it("el esquema acepta 150 slots y rechaza 151", () => {
    const slot = () => ({ id: "s", type: "text", position: [0, 0], content: {} });
    const conN = (n: number) => ({ slots: Array.from({ length: n }, slot) });
    expect(OimMetadataSchema.safeParse(conN(150)).success).toBe(true);
    expect(OimMetadataSchema.safeParse(conN(151)).success).toBe(false);
    expect(OvmMetadataSchema.safeParse(conN(150)).success).toBe(true);
    expect(OvmMetadataSchema.safeParse(conN(151)).success).toBe(false);
  });

  /**
   * `elements` is NOT inheritance: the player reads it in three places
   * (`this.metadata.slots || this.metadata.elements`) and the backend counts it
   * first (`media.py:396`). Bounding only `slots` left the contract promising a
   * cap that an equivalent field did not meet, and the contract is precisely what
   * exists so that a reader in another language can rely on it.
   *
   * `layers` is not read by anyone today, but it is declared and published: it is
   * bounded for consistency, so that the three fields that carry slots say the same.
   */
  it.each(["elements", "layers"] as const)(
    "el tope alcanza tambien a `%s`, que lleva los mismos slots",
    (campo) => {
      const slot = () => ({ id: "s", type: "text", position: [0, 0], content: {} });
      const conN = (n: number) => ({ slots: [], [campo]: Array.from({ length: n }, slot) });
      expect(OimMetadataSchema.safeParse(conN(150)).success).toBe(true);
      expect(OimMetadataSchema.safeParse(conN(151)).success).toBe(false);
      expect(OvmMetadataSchema.safeParse(conN(150)).success).toBe(true);
      expect(OvmMetadataSchema.safeParse(conN(151)).success).toBe(false);
    }
  );

  it("acepta todas las propiedades emitidas por serializeSlots de OIM-Studio", () => {
    const fullStyleSlot = {
      id: "slot-full-test",
      type: "text",
      style: {
        fontFamily: "Inter",
        fillColor: "#f59e0b",
        bold: true,
        italic: false,
        underline: false,
        textStrokeColor: "#000000",
        textStrokeWidth: 2,
        letterSpacing: "0.05em",
        lineHeight: 1.4,
        blendMode: "multiply",
        layerBlur: 10,
        filterPreset: "cyberpunk",
        filterBlur: 5,
        filterBrightness: 110,
        filterContrast: 120,
        filterSaturate: 130,
        filterHueRotate: 45,
        textAnimationType: "wave-chars",
        textAnimationSpeed: 0.05,
        textAnimationDelay: 0.2,
        maskMode: "window",
        maskCoverage: "canvas",
        maskShape: "circle",
        maskBgColor: "#000000",
        maskFeather: 15,
        maskInvert: true,
        grain: true,
        grainIntensity: 25,
        effect: "neon",
        effectColor: "#10b981",
        effectRadius: 12,
        artisticPreset: "retro-wave-3d",
        curveAmount: 20,
        curveType: "wave",
        extrusionDepth: 15,
        extrusionAngle: 45,
        extrusionColor: "#18181b",
        extrusionShading: true,
        outerStrokeColor: "#ffffff",
        outerStrokeWidth: 4,
        innerStrokeColor: "#000000",
        innerStrokeWidth: 1,
        fillPatternType: "dots",
        fillPatternColor: "#ffffff",
        fillPatternBgColor: "#000000",
        fillPatternSpeed: 10,
        fillPatternScale: 1.5,
        // It was "left_to_right", which the editor never writes here: that is the
        // INFINITE PARALLAX direction, another field. Pattern directions are
        // left/right/up/down/zoom-in/zoom-out/pulse/none (pattern-value.ts).
        fillPatternDirection: "left",
        rotation: 45,
        opacity: 80,
        isVisible: true,
      },
    };

    const result = slotSchema.safeParse(fullStyleSlot);
    expect(result.success).toBe(true);
  });

  it("valida el stack canónico de efectos en styleSchema y rechaza efectos inválidos", () => {
    const slotWithEffects = {
      id: "slot-effects-1",
      type: "geo",
      style: {
        effects: [
          { type: "texture", preset: "film-grain-35mm", intensity: 45, blend: "overlay", scale: 1.2, enabled: true },
          { type: "drop-shadow", color: "rgba(0, 0, 0, 0.5)", blur: 16, x: 0, y: 8, spread: 0, enabled: true },
          { type: "blur", radius: 4, enabled: false },
          { type: "glow", color: "#f59e0b", radius: 12, intensity: 60, enabled: true },
        ],
      },
    };

    const result = slotSchema.safeParse(slotWithEffects);
    expect(result.success).toBe(true);

    const slotWithInvalidEffect = {
      id: "slot-effects-2",
      type: "geo",
      style: {
        effects: [
          { type: "texture", preset: "non-existent-preset", intensity: 45, blend: "overlay" },
        ],
      },
    };
    const invalidResult = slotSchema.safeParse(slotWithInvalidEffect);
    expect(invalidResult.success).toBe(false);
  });

  it("valida tipos de animación de texto canónicos extendidos (glitch y typewriter)", () => {
    const validStyles = [
      { textAnimationType: "glitch-cyberpunk", textAnimationSpeed: 1.5, textAnimationDelay: 0, textAnimationIntensity: 60 },
      { textAnimationType: "glitch-slice", textAnimationSpeed: 2.0, textAnimationDelay: 0.1 },
      { textAnimationType: "typewriter", textAnimationSpeed: 20, typewriterCursor: true },
    ];
    for (const style of validStyles) {
      const res = styleSchema.safeParse(style);
      expect(res.success).toBe(true);
    }
  });

  it("valida configuración de textHighlight y dropCap", () => {
    const styleConHighlight = {
      textHighlight: {
        enabled: true,
        color: "rgba(245, 158, 11, 0.35)",
        style: "marker",
        paddingX: 4,
        paddingY: 2,
        borderRadius: 4,
      },
      dropCap: {
        enabled: true,
        lines: 3,
        fontFamily: "Lora",
        color: "#f59e0b",
        marginRight: 8,
      },
    };
    const res = styleSchema.safeParse(styleConHighlight);
    expect(res.success).toBe(true);
  });

  it("valida roles de color dinámico en patrones de capa y fondo", () => {
    const parsed = styleSchema.parse({
      fillPatternColorRole: "accent",
      fillPatternBgColorRole: "surface",
      backgroundPatternColorRole: "primary",
      backgroundPatternBgColorRole: "outline",
    });
    expect(parsed.fillPatternColorRole).toBe("accent");
    expect(parsed.fillPatternBgColorRole).toBe("surface");
    expect(parsed.backgroundPatternColorRole).toBe("primary");
    expect(parsed.backgroundPatternBgColorRole).toBe("outline");
  });

  it("rechaza roles de color inválidos en patrones", () => {
    expect(() => styleSchema.parse({ fillPatternColorRole: "invalid-role" })).toThrow();
    expect(() => styleSchema.parse({ backgroundPatternColorRole: "invalid-role" })).toThrow();
  });
});


describe('paletas con nombre (1.20.0)', () => {
  const pal = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { primary: '#fff' }]));
  const doc = (palettes: unknown) => OimMetadataSchema.safeParse({ slots: [], palettes });

  it('acepta seis paletas y rechaza siete', () => {
    expect(doc(pal(6)).success).toBe(true);
    expect(doc(pal(7)).success).toBe(false);
  });

  it('rechaza nombres fuera de ^[a-z][a-z0-9-]{0,23}$', () => {
    expect(doc({ Dark: {} }).success).toBe(false);
    expect(doc({ '1x': {} }).success).toBe(false);
    expect(doc({ dark: {} }).success).toBe(true);
  });

  it('el contrato JSON lleva el tope de seis paletas', () => {
    const json = z.toJSONSchema(OimMetadataSchema, { io: 'input' }) as any;
    expect(json.properties.palettes.maxProperties).toBe(6);
  });

  it('un documento sin palettes sigue validando', () => {
    expect(OimMetadataSchema.safeParse({ slots: [] }).success).toBe(true);
  });

  it('defaultPalette es texto libre; el resolutor decide si existe', () => {
    expect(OimMetadataSchema.safeParse({ slots: [], defaultPalette: 'dark', palettes: { dark: {} } }).success).toBe(true);
  });
});
