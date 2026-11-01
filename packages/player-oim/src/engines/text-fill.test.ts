/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The fill of a text: gradient, pattern or generative background.
 *
 * `getFillCss` handled text from the start: it returns `background-clip: text` for
 * those three types, but **nobody called it for a text slot**: its only call in the
 * whole monorepo was for `slotType === 'container'`. The branch existed and was
 * unreachable.
 *
 * That explains why no published `.oim` has gradient text: it was not offered by the
 * editor, and nobody was painting it either.
 *
 * **What these tests are NOT.** happy-dom does not lay out or composite: it cannot tell
 * here whether the gradient comes out jagged or whether the colour reaches the descender.
 * That was measured in a real browser: Poppins declares a 1.396 em height, so with a
 * line-height of 1.2 its ink spills 0.098 em to each side.
 * It will keep having to be measured that way.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { inkMargin, DEFAULT_LINE_HEIGHT } from "../../../core/src/typography.js";

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
   * The three together are what turns the text into a mask: the background shows
   * only where there is a glyph. Without `color: transparent` the text would be painted
   * ON TOP of its own gradient and none of it would show.
   */
  it("se convierte en mascara: recorte al text y color transparente", async () => {
    const el = await hoverDe({ fillType: "gradient", fillGradient: DEG });
    expect(el.style.backgroundClip || (el.style as any).webkitBackgroundClip).toBe("text");
    expect(el.style.color).toBe("transparent");
  });
});

describe("el color plano NO se convierte en mascara", () => {
  /**
   * The half that is often forgotten. A solid fill is painted as the normal text
   * colour: turning it into a mask would cost the smoothing that knows the shape of
   * the letter, and in return for nothing.
   */
  it("un fill solido pinta el color, sin recorte", async () => {
    const el = await slotDe({ fillType: "color", fillColor: "#1b3a6b" });
    // happy-dom keeps the hexadecimal; a browser normalizes it to `rgb()`.
    // It is compared with what THIS environment produces, not with what
    // Chrome would produce, or the test would be checking the environment and not the engine.
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
   * With `background-clip: text` the paint is cropped to the background area, which is
   * the line box. The ink of the "j", the "p" and the "g" sticks out of it and is left
   * WITHOUT FILL (transparent), and with a text border the outline is seen to continue
   * where the colour no longer reaches.
   */
  it("se anade cuando el text es una mascara", async () => {
    const el = await slotDe({ fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)" });
    const esperado = inkMargin(DEFAULT_LINE_HEIGHT) + "em";
    expect(el.style.paddingTop).toBe(esperado);
    expect(el.style.paddingBottom).toBe(esperado);
  });

  /**
   * `.oim-slot` declares `padding` with `!important`, and a sheet rule beats a normal
   * inline style. Without `important` here, the inkMargin would never get applied and
   * this test would pass anyway by only looking at `style.paddingTop`.
   */
  it("va con important, o la hoja de styles lo pisa", async () => {
    const el = await slotDe({ fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)" });
    expect(el.style.getPropertyPriority("padding-top")).toBe("important");
    expect(el.style.getPropertyPriority("padding-bottom")).toBe("important");
  });

  /**
   * And it is NOT added when it is not needed: with a generous line height the ink already
   * fits, and enlarging the background area would shift a vertical gradient.
   * for no reason.
   */
  it("no se anade con un interlineado que ya da de si", async () => {
    const el = await slotDe({
      fillType: "gradient", fillGradient: "linear-gradient(90deg,#000,#fff)", lineHeight: 1.6,
    });
    expect(el.style.paddingTop).toBe("");
  });

  /** Nor when the fill is solid, which clips nothing. */
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

