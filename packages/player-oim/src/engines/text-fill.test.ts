/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El fill de un text: degradado, patrón o fondo generativo.
 *
 * `getFillCss` contemplaba el text desde el principio —devuelve
 * `background-clip: text` para esos tres tipos— pero **nadie lo llamaba para
 * un slot de text**: su única llamada en todo el monorepo era para
 * `slotType === 'container'`. La rama existía y era inalcanzable.
 *
 * Eso explica que ningún `.oim` publicado use text con degradado mucho mejor
 * que «el editor no lo ofrecía»: es que nadie lo pintaba.
 *
 * **Lo que estas pruebas NO son.** happy-dom no maqueta ni compone: no se
 * puede ver aquí si el degradado sale dentado ni si el color llega al
 * descendente. Eso se midió en un navegador real —Poppins declara 1,396 em de
 * alto, así que con interlineado 1.2 su tinta se sale 0,098 em por lado— y así
 * seguirá teniendo que medirse.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { inkMargin, DEFAULT_LINE_HEIGHT } from "../core/typography";

function montar(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

const text = (style: any = {}) => ({
  id: "t", type: "text", align: "left",
  position: [50, 50], width_px: 300, height_px: 80,
  content: { es: "ejemplo jpg" },
  style: { fontSize: "48px", ...style },
});

async function slotDe(style: any): Promise<HTMLElement> {
  const { host, motor } = montar([text(style)]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
}

// Phase 3: the mask moved from the slot to the hover wrap, inside what animates.
async function hoverDe(style: any): Promise<HTMLElement> {
  return (await slotDe({ width: "300px", height: "80px", ...style })).querySelector(".oim-slot-hover-wrap") as HTMLElement;
}

describe("un text con fill de degradado", () => {
  const DEG = "linear-gradient(90deg, #1b3a6b, #e0457b)";

  it("recibe el degradado como fondo", async () => {
    const el = await hoverDe({ fillType: "gradient", fillGradient: DEG });
    expect(el.style.backgroundImage).toContain("linear-gradient");
  });

  /**
   * Los tres juntos son lo que convierte el text en una máscara: el fondo se
   * ve solo por donde hay glifo. Sin `color: transparent` se pintaría el text
   * ENCIMA de su propio degradado y no se vería ninguno.
   */
  it("se convierte en mascara: recorte al text y color transparente", async () => {
    const el = await hoverDe({ fillType: "gradient", fillGradient: DEG });
    expect(el.style.backgroundClip || (el.style as any).webkitBackgroundClip).toBe("text");
    expect(el.style.color).toBe("transparent");
  });
});

describe("el color plano NO se convierte en mascara", () => {
  /**
   * La mitad que suele olvidarse. Un fill sólido se pinta como color de
   * text normal: convertirlo en máscara le costaría el suavizado que conoce
   * la forma de la letra, y a cambio de nada.
   */
  it("un fill solido pinta el color, sin recorte", async () => {
    const el = await slotDe({ fillType: "color", fillColor: "#1b3a6b" });
    // happy-dom conserva el hexadecimal; un navegador lo normaliza a `rgb()`.
    // Se compara con lo que ESTE entorno produce, no con lo que produciria
    // Chrome, o la prueba estaria comprobando el entorno y no el motor.
    expect(el.style.color.toLowerCase()).toBe("#1b3a6b");
    expect(el.style.backgroundClip).not.toBe("text");
  });

  it("sin fillType no se toca nada", async () => {
    const el = await slotDe({});
    expect(el.style.backgroundClip).not.toBe("text");
    expect(el.style.color).not.toBe("transparent");
  });
});

describe("el inkMargin para la tinta de los descendentes", () => {
  /**
   * Con `background-clip: text` la pintura se recorta al área de fondo, que es
   * la caja de línea. La tinta de la «j», la «p» y la «g» sobresale de ella y
   * se queda SIN RELLENO —transparente—, y con un borde de text se ve el
   * contorno continuar donde el color ya no llega.
   */
  it("se anade cuando el text es una mascara", async () => {
    const el = await slotDe({ fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)" });
    const esperado = inkMargin(DEFAULT_LINE_HEIGHT) + "em";
    expect(el.style.paddingTop).toBe(esperado);
    expect(el.style.paddingBottom).toBe(esperado);
  });

  /**
   * `.oim-slot` declara `padding` con `!important`, y una regla de hoja gana a
   * un style en línea normal. Sin `important` aquí, el inkMargin no llegaría a
   * aplicarse y esta prueba pasaría igual mirando solo `style.paddingTop`.
   */
  it("va con important, o la hoja de styles lo pisa", async () => {
    const el = await slotDe({ fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)" });
    expect(el.style.getPropertyPriority("padding-top")).toBe("important");
    expect(el.style.getPropertyPriority("padding-bottom")).toBe("important");
  });

  /**
   * Y NO se añade cuando no hace falta: con interlineado holgado la tinta ya
   * cabe, y agrandar el área de fondo desplazaría un degradado vertical sin
   * motivo.
   */
  it("no se anade con un interlineado que ya da de si", async () => {
    const el = await slotDe({
      fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)", lineHeight: 1.6,
    });
    expect(el.style.paddingTop).toBe("");
  });

  /** Ni cuando el fill es sólido, que no recorta nada. */
  it("no se anade a un fill solido", async () => {
    const el = await slotDe({ fillType: "color", fillColor: "#111" });
    expect(el.style.paddingTop).toBe("");
  });
});

describe("the text mask lives inside what animates (phase 3, 13 Sept)", () => {
  // An animation inside a background-clip:text element forces the browser to
  // recompose the mask every frame: 120 gradient texts ran at 62.6 fps against
  // 144.2 with the mask on the hover wrap. The mask must move with the text.
  const DEG = "linear-gradient(90deg, #1b3a6b, #e0457b)";

  async function partes(style: any) {
    const { host, motor } = montar([text({ width: "300px", height: "80px", ...style })]);
    if (style.textAnimationType) {
      motor.disableAnimations = false;
    }
    await motor.renderSlots();
    return {
      slot: host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement,
      loop: host.shadowRoot!.querySelector('.oim-slot-loop-wrap') as HTMLElement,
      hover: host.shadowRoot!.querySelector('.oim-slot-hover-wrap') as HTMLElement,
    };
  }

  it("the gradient and the clip are on the hover wrap", async () => {
    const { hover } = await partes({ fillType: "gradient", fillGradient: DEG });
    expect(hover.style.backgroundImage).toContain("linear-gradient");
    expect(hover.style.backgroundClip || (hover.style as any).webkitBackgroundClip).toBe("text");
    expect(hover.style.color).toBe("transparent");
  });

  it("the slot and the loop wrap are no longer a mask", async () => {
    const { slot, loop } = await partes({ fillType: "gradient", fillGradient: DEG });
    for (const el of [slot, loop]) {
      expect(el.style.backgroundClip || (el.style as any).webkitBackgroundClip || "").not.toBe("text");
      expect(el.style.backgroundImage || "").not.toContain("linear-gradient");
    }
  });

  it("a solid fill is untouched: no mask anywhere", async () => {
    const { slot, hover } = await partes({ fillType: "color", fillColor: "#1b3a6b" });
    expect(hover.style.backgroundClip || "").not.toBe("text");
    expect(slot.style.backgroundClip || "").not.toBe("text");
  });

  it("gradient text gives height: 100% to loop and hover wrap, and centers hover wrap with flex column", async () => {
    const { loop, hover } = await partes({ fillType: "gradient", fillGradient: DEG });
    expect(loop.style.height).toBe("100%");
    expect(hover.style.height).toBe("100%");
    expect(hover.style.display).toBe("flex");
    expect(hover.style.flexDirection).toBe("column");
    expect(hover.style.justifyContent).toBe("center");
  });

  it("plain color text does not set 100% height or flex on loop and hover wrap", async () => {
    const { loop, hover } = await partes({ fillType: "color", fillColor: "#1b3a6b" });
    expect(loop.style.height).toBe("");
    expect(hover.style.height).toBe("");
    expect(hover.style.display).not.toBe("flex");
  });

  it("gradient text with wave-chars places character spans inside inner child, not directly under hoverWrap", async () => {
    const { hover } = await partes({
      fillType: "gradient",
      fillGradient: DEG,
      textAnimationType: "wave-chars",
    });
    // hoverWrap must have a single child: the inner text block
    expect(hover.children.length).toBe(1);
    const innerChild = hover.firstElementChild as HTMLElement;
    expect(innerChild).not.toBeNull();
    expect(innerChild.classList.contains("oim-slot-text")).toBe(true);

    // The character spans must be inside the inner child, NOT direct children of hoverWrap
    const spansInInner = innerChild.querySelectorAll("span");
    expect(spansInInner.length).toBeGreaterThan(0);
    const spansInHover = Array.from(hover.children).filter((el) => el.tagName === "SPAN");
    expect(spansInHover.length).toBe(0);
  });

  it("gradient text without defined size preserves origin/main behavior: mask stays on slotEl, not on hoverWrap", async () => {
    // Calling slotDe directly without style.width & style.height (unconstrained auto-sized slot)
    const slot = await slotDe({ fillType: "gradient", fillGradient: DEG });
    const hover = slot.querySelector(".oim-slot-hover-wrap") as HTMLElement;

    // Mask stays on slotEl
    expect(slot.style.backgroundImage).toContain("linear-gradient");
    expect(slot.style.backgroundClip || (slot.style as any).webkitBackgroundClip).toBe("text");
    expect(slot.style.color).toBe("transparent");

    // hoverWrap does not get the mask, nor 100% height, nor flex
    expect(hover.style.backgroundImage || "").not.toContain("linear-gradient");
    expect(hover.style.height || "").not.toBe("100%");
    expect(hover.style.display || "").not.toBe("flex");
    expect(hover.querySelector(".oim-slot-text")).toBeNull();
  });
});

