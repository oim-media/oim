/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { infiniteLayerPlan, CSS_PARALLAX, TRACK_CLASS, ensureParallaxKeyframes } from "./parallaxCss";

describe("parallaxCss - infiniteLayerPlan", () => {
  it("a still layer is not duplicated or animated", () => {
    // The rule that protects the real case: a mountain and a cabin inside the group,
    // still. Duplicating them would give two cabins.
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.duplicate).toBe(false);
    expect(p.container).toEqual({});
    expect(p.secondCopy).toEqual({});
  });

  it("the duration comes from the width and the speed, not from a magic number", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(p.duplicate).toBe(true);
    expect(p.container["animation-duration"]).toBe("20s"); // 800 / 40
  });

  it("two layers with different speeds give different durations: that is the depth", () => {
    const cielo = infiniteLayerPlan({ speedPxSec: 15, direction: "right_to_left", mirror: false, pauseOnHover: false }, 600);
    const arboles = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 600);
    expect(cielo.container["animation-duration"]).toBe("40s");
    expect(arboles.container["animation-duration"]).toBe("15s");
  });

  it("the direction changes the sense, not the duration", () => {
    const a = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    const b = infiniteLayerPlan({ speedPxSec: 40, direction: "left_to_right", mirror: false, pauseOnHover: false }, 800);
    expect(a.container["animation-duration"]).toBe(b.container["animation-duration"]);
    expect(a.container["animation-direction"]).not.toBe(b.container["animation-direction"]);
  });

  it("the mirror only affects the second copy", () => {
    const mirrored = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    const plain = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(mirrored.secondCopy["transform"]).toContain("scaleX(-1)");
    expect(plain.secondCopy["transform"] || "").not.toContain("scaleX(-1)");
  });

  it("pauseOnHover spends no JavaScript", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: true }, 800);
    expect(p.container["--oim-parallax-hover"]).toBe("paused");
  });

  it("a negative speed or a zero width do not produce NaN or Infinity", () => {
    // An `animation-duration: Infinitys` does not throw: it does nothing, silently.
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 0);
    expect(p.duplicate).toBe(false);
    const n = infiniteLayerPlan({ speedPxSec: -10, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(JSON.stringify(n)).not.toMatch(/NaN|Infinity/);
  });
});

describe("the CSS that gives meaning to what the generator emits", () => {
  // Without these tests, `--oim-parallax-hover` would be a variable that is written
  // and read by nobody: a setting that adjusts nothing. It is the failure of `damping`
  // and `seamlessTile` in the old engine, and the reason for this redesign.

  it("the pause variable is READ somewhere in the CSS", () => {
    expect(CSS_PARALLAX).toContain("var(--oim-parallax-hover");
  });

  it("and it is read inside :hover, not in the base rule", () => {
    // Reading it in the base rule would pause the animation ALWAYS, not on hover.
    // The value "paused" only makes sense inside `:hover`.
    const lineas = CSS_PARALLAX.split(String.fromCharCode(10));
    const reglaHover = lineas.find((l) => l.includes(":hover")) || "";
    expect(reglaHover).toContain("var(--oim-parallax-hover");
    const reglaBase = lineas.find((l) => l.includes(`.${TRACK_CLASS} {`)) || "";
    expect(reglaBase).not.toContain("--oim-parallax-hover");
  });

  it("the keyframes shift ONE UNIT, not a fixed percentage", () => {
    // A -50% would only be correct if the track always measured two units, and
    // the number of pieces depends on the canvas. The unit travels in a variable.
    expect(CSS_PARALLAX).toContain("var(--oim-parallax-unidad");
    expect(CSS_PARALLAX).not.toContain("translateX(-50%)");
  });

  it("respeta prefers-reduced-motion", () => {
    // A background that scrolls non-stop is exactly what that preference asks to
    // stop, and it costs nothing.
    expect(CSS_PARALLAX).toContain("prefers-reduced-motion");
  });

  it("the generator and the CSS use the SAME class", () => {
    expect(CSS_PARALLAX).toContain(`.${TRACK_CLASS}`);
  });
});

describe("the width of the copies is also decided by the plan", () => {
  // When the editor resolved it on its own and the player did not, we again had
  // two behaviours: a correct preview and a broken published file. The width is part
  // of the plan so that neither of the two can forget it.

  it("each copy sets its width in pixels, not in percent", () => {
    // The track is `width: max-content`: inside a container of undefined width, a
    // percentage width collapses and the two copies overlap instead of sitting side
    // by side.
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copy["flex"]).toBe("0 0 800px");
    expect(JSON.stringify(p.copy)).not.toContain("%");
  });

  it("a still layer brings no copy styles", () => {
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copy).toEqual({});
  });

  it("the width is the same for both: the mirror does not change it", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 640);
    expect(p.copy["flex"]).toBe("0 0 640px");
    expect(p.secondCopy["flex"]).toBeUndefined();
  });
});

describe("ensureParallaxKeyframes: where it leaves the sheet", () => {
  // The editor passes `document` and the player passes a shadow root. A Document
  // allows ONE single root element, so appendChild on it throws
  // HierarchyRequestError and leaves the editor blank. The signature accepted
  // Document and the code did not support it.

  it("in a Document the sheet goes to the <head>, not to the document", () => {
    document.getElementById("oim-parallax-styles")?.remove();
    ensureParallaxKeyframes(document);
    const sheet = document.getElementById("oim-parallax-styles");
    expect(sheet, "the sheet was not injected").toBeTruthy();
    expect(sheet!.parentNode, "the sheet must hang from the <head>").toBe(document.head);
  });

  it("in a shadow root the sheet hangs from the shadow root itself", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    ensureParallaxKeyframes(shadow);
    const sheet = shadow.getElementById("oim-parallax-styles");
    expect(sheet).toBeTruthy();
    expect(sheet!.parentNode).toBe(shadow);
  });

  it("does not duplicate the sheet when called twice", () => {
    document.getElementById("oim-parallax-styles")?.remove();
    ensureParallaxKeyframes(document);
    ensureParallaxKeyframes(document);
    expect(document.querySelectorAll("#oim-parallax-styles")).toHaveLength(1);
  });
});

describe("the mirror needs FOUR pieces, not two", () => {
  // With `A | mirror(A)` and a -50% offset, at the end of the lap you see
  // `mirror(A)` where you started seeing `A`, and on restart it JUMPS. Seen in the
  // viewer: the loop jerked on every lap.
  //
  // The unit that repeats is not the copy, it is the PAIR.

  it("without a mirror two pieces are enough", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(p.copies).toBe(2);
  });

  it("with a mirror four are needed", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copies).toBe(4);
  });

  it("a still layer carries none", () => {
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copies).toBe(0);
  });

  it("with a mirror the loop lasts twice as long, because it covers two pieces", () => {
    // The speed in px/s has to keep meaning the same. Without this
    // factor, enabling the mirror would double the speed without touching the setting.
    const plain = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    const mirrored = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(plain.container["animation-duration"]).toBe("20s");
    expect(mirrored.container["animation-duration"]).toBe("40s");
  });
});

describe("how many pieces: whatever the canvas requires, not a fixed number", () => {
  // The layer sets the SIZE of the piece: it is the art, and repeating it is the effect.
  // The canvas sets HOW MANY: as many as needed to cover it for the whole
  // lap. That is what 2D engines do, and what was missing: the number was
  // fixed at 2 or 4, which only works when the layer measures the same as the canvas.

  const cfg = (mirror: boolean) => ({
    speedPxSec: 40, direction: "right_to_left" as const, mirror, pauseOnHover: false,
  });

  it("a narrow layer mounts spare pieces to cover the canvas", () => {
    // 180 of piece on 800 of canvas: with 4 pieces the track measures 720 and
    // 80 px are left uncovered. That is the side gap that was seen in the editor.
    const p = infiniteLayerPlan(cfg(true), 180, 800);
    expect(p.copies * 180).toBeGreaterThanOrEqual(800 + 180 * 2);
    expect(p.copies % 2, "with a mirror the number must be even").toBe(0);
  });

  it("a layer as wide as the canvas stays at the usual minimum", () => {
    expect(infiniteLayerPlan(cfg(false), 800, 800).copies).toBe(2);
    expect(infiniteLayerPlan(cfg(true), 800, 800).copies).toBe(4);
  });

  it("the track always covers canvas + unit, with and without a mirror", () => {
    for (const mirror of [false, true]) {
      for (const piece of [120, 180, 300, 800, 1200]) {
        const p = infiniteLayerPlan(cfg(mirror), piece, 800);
        const unit = piece * (mirror ? 2 : 1);
        expect(p.copies * piece, `piece=${piece} espejo=${mirror}`).toBeGreaterThanOrEqual(800 + unit);
      }
    }
  });

  it("the unit travels as a CSS variable and is one piece, or the pair with a mirror", () => {
    expect(infiniteLayerPlan(cfg(false), 180, 800).container["--oim-parallax-unidad"]).toBe("180px");
    expect(infiniteLayerPlan(cfg(true), 180, 800).container["--oim-parallax-unidad"]).toBe("360px");
  });

  it("the duration is that of the unit: the speed still means px/s", () => {
    // 180 px at 40 px/s is 4.5s; with the mirror the lap is 360 px, i.e. 9s.
    expect(infiniteLayerPlan(cfg(false), 180, 800).container["animation-duration"]).toBe("4.5s");
    expect(infiniteLayerPlan(cfg(true), 180, 800).container["animation-duration"]).toBe("9s");
  });

  it("without a canvas width it behaves as before, without breaking callers that do not pass it", () => {
    const p = infiniteLayerPlan(cfg(false), 800);
    expect(p.copies).toBe(2);
  });
});

describe("the copies overlap: no gap at the seam", () => {
  // Measured in the viewer: each copy at x 1,936 lands on a fractional screen
  // pixel, so the browser paints the last pixel of one copy and the first of the
  // next half transparent, and through the gap the background shows: a 1 px vertical
  // line that travels with the scene. Overlapping by 1 px removes it; it was checked
  // by hand in the browser before writing this.

  /** Where the point `x` of the piece ends according to its styles (origin 0 0). */
  const place = (style: Record<string, string>, x: number): number => {
    expect(style["transform-origin"], "without a fixed origin the scaling is split between both sides").toBe("0 0");
    const fns = [...(style["transform"] || "").matchAll(/(translateX|scaleX)\(([-\d.e]+)(px)?\)/g)];
    return fns.reverse().reduce((v, [, fn, n]) => (fn === "scaleX" ? v * Number(n) : v + Number(n)), x);
  };
  const plan = (mirror: boolean) =>
    infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror, pauseOnHover: false }, 576);

  it("a copy covers 1 px beyond its gap, under the next one", () => {
    const p = plan(false);
    expect(place(p.copy, 0)).toBeCloseTo(0, 6);
    expect(place(p.copy, 576)).toBeCloseTo(577, 6);
  });

  it("the mirrored copy also stretches to the right, and stays mirrored", () => {
    const p = plan(true);
    const reflected = { ...p.copy, ...p.secondCopy };
    // Its left edge (x = 0) ends up on the right and its right edge at the origin.
    expect(place(reflected, 0)).toBeCloseTo(577, 6);
    expect(place(reflected, 576)).toBeCloseTo(0, 6);
  });

  it("the overlap does not change the loop: the unit is still the piece width", () => {
    expect(plan(false).container["--oim-parallax-unidad"]).toBe("576px");
    expect(plan(true).container["--oim-parallax-unidad"]).toBe("1152px");
    expect(plan(false).copy["flex"]).toBe("0 0 576px");
  });
});

describe("the track starts at the layer's left edge", () => {
  // Library: an image slot is a column flex with
  // `align-items: center`. The track is wider than the layer, so it was
  // centred and stuck out on both sides; for half of every lap the right part
  // of the layer had no piece over it (measured: track at -288 px in a
  // 580 px slot). It must start at the left edge and keep its width,
  // whatever its parent's alignment. happy-dom does no layout, so this checks
  // the styles; the layout was checked in the browser.
  it("aligns itself to the start and does not shrink", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 576);
    expect(p.container["align-self"]).toBe("flex-start");
    expect(p.container["flex-shrink"]).toBe("0");
  });
});
