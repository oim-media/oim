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
  it("una capa quieta no se duplica ni se anima", () => {
    // The rule that protects the real case: a mountain and a cabin inside the group,
    // still. Duplicating them would give two cabins.
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.duplicate).toBe(false);
    expect(p.container).toEqual({});
    expect(p.secondCopy).toEqual({});
  });

  it("la duracion sale del ancho y la velocidad, no de un numero magico", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(p.duplicate).toBe(true);
    expect(p.container["animation-duration"]).toBe("20s"); // 800 / 40
  });

  it("dos layers con velocidades distintas dan duraciones distintas: eso es la profundidad", () => {
    const cielo = infiniteLayerPlan({ speedPxSec: 15, direction: "right_to_left", mirror: false, pauseOnHover: false }, 600);
    const arboles = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 600);
    expect(cielo.container["animation-duration"]).toBe("40s");
    expect(arboles.container["animation-duration"]).toBe("15s");
  });

  it("la direccion cambia el sentido, no la duracion", () => {
    const a = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    const b = infiniteLayerPlan({ speedPxSec: 40, direction: "left_to_right", mirror: false, pauseOnHover: false }, 800);
    expect(a.container["animation-duration"]).toBe(b.container["animation-duration"]);
    expect(a.container["animation-direction"]).not.toBe(b.container["animation-direction"]);
  });

  it("el espejo solo afecta a la segunda copy", () => {
    const con = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    const sin = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(con.secondCopy["transform"]).toContain("scaleX(-1)");
    expect(sin.secondCopy["transform"] || "").not.toContain("scaleX(-1)");
  });

  it("pauseOnHover no gasta JavaScript", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: true }, 800);
    expect(p.container["--oim-parallax-hover"]).toBe("paused");
  });

  it("una velocidad negativa o un ancho cero no producen NaN ni Infinity", () => {
    // An `animation-duration: Infinitys` does not throw: it does nothing, silently.
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 0);
    expect(p.duplicate).toBe(false);
    const n = infiniteLayerPlan({ speedPxSec: -10, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(JSON.stringify(n)).not.toMatch(/NaN|Infinity/);
  });
});

describe("el CSS que da significado a lo que emite el generador", () => {
  // Without these tests, `--oim-parallax-hover` would be a variable that is written
  // and read by nobody: a setting that adjusts nothing. It is the failure of `damping`
  // and `seamlessTile` in the old engine, and the reason for this redesign.

  it("la variable de pausa se LEE en alguna parte del CSS", () => {
    expect(CSS_PARALLAX).toContain("var(--oim-parallax-hover");
  });

  it("y se lee dentro de :hover, no en la regla base", () => {
    // Reading it in the base rule would pause the animation ALWAYS, not on hover.
    // The value "paused" only makes sense inside `:hover`.
    const lineas = CSS_PARALLAX.split(String.fromCharCode(10));
    const reglaHover = lineas.find((l) => l.includes(":hover")) || "";
    expect(reglaHover).toContain("var(--oim-parallax-hover");
    const reglaBase = lineas.find((l) => l.includes(`.${TRACK_CLASS} {`)) || "";
    expect(reglaBase).not.toContain("--oim-parallax-hover");
  });

  it("los keyframes desplazan UNA UNIDAD, no un porcentaje fijo", () => {
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

  it("el generador y el CSS usan la MISMA clase", () => {
    expect(CSS_PARALLAX).toContain(`.${TRACK_CLASS}`);
  });
});

describe("el ancho de las copies tambien lo decide el plan", () => {
  // When the editor resolved it on its own and the player did not, we again had
  // two behaviours: a correct preview and a broken published file. The width is part
  // of the plan so that neither of the two can forget it.

  it("cada copy fija su ancho en pixeles, no en porcentaje", () => {
    // The track is `width: max-content`: inside a container of undefined width, a
    // percentage width collapses and the two copies overlap instead of sitting side
    // by side.
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copy["flex"]).toBe("0 0 800px");
    expect(JSON.stringify(p.copy)).not.toContain("%");
  });

  it("una capa quieta no trae estilos de copy", () => {
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copy).toEqual({});
  });

  it("el ancho es el mismo para las dos: el espejo no lo cambia", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 640);
    expect(p.copy["flex"]).toBe("0 0 640px");
    expect(p.secondCopy["flex"]).toBeUndefined();
  });
});

describe("ensureParallaxKeyframes: donde deja la hoja", () => {
  // The editor passes `document` and the player passes a shadow root. A Document
  // allows ONE single root element, so appendChild on it throws
  // HierarchyRequestError and leaves the editor blank. The signature accepted
  // Document and the code did not support it.

  it("en un Document la hoja va al <head>, no al documento", () => {
    document.getElementById("oim-parallax-styles")?.remove();
    ensureParallaxKeyframes(document);
    const hoja = document.getElementById("oim-parallax-styles");
    expect(hoja, "no se inyecto la hoja").toBeTruthy();
    expect(hoja!.parentNode, "la hoja debe colgar del <head>").toBe(document.head);
  });

  it("en un shadow root la hoja cuelga del propio shadow root", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    ensureParallaxKeyframes(shadow);
    const hoja = shadow.getElementById("oim-parallax-styles");
    expect(hoja).toBeTruthy();
    expect(hoja!.parentNode).toBe(shadow);
  });

  it("no duplica la hoja al llamarla dos veces", () => {
    document.getElementById("oim-parallax-styles")?.remove();
    ensureParallaxKeyframes(document);
    ensureParallaxKeyframes(document);
    expect(document.querySelectorAll("#oim-parallax-styles")).toHaveLength(1);
  });
});

describe("el espejo necesita CUATRO piezas, no dos", () => {
  // With `A | mirror(A)` and a -50% offset, at the end of the lap you see
  // `mirror(A)` where you started seeing `A`, and on restart it JUMPS. Seen in the
  // viewer: the loop jerked on every lap.
  //
  // The unit that repeats is not the copy, it is the PAIR.

  it("sin espejo bastan dos piezas", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    expect(p.copies).toBe(2);
  });

  it("con espejo hacen falta cuatro", () => {
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copies).toBe(4);
  });

  it("una capa quieta no lleva ninguna", () => {
    const p = infiniteLayerPlan({ speedPxSec: 0, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(p.copies).toBe(0);
  });

  it("con espejo la vuelta dura el doble, porque recorre dos piezas", () => {
    // The speed in px/s has to keep meaning the same. Without this
    // factor, enabling the mirror would double the speed without touching the setting.
    const sin = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    const con = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(sin.container["animation-duration"]).toBe("20s");
    expect(con.container["animation-duration"]).toBe("40s");
  });
});

describe("cuantas piezas: las que pida el lienzo, no un numero fijo", () => {
  // The layer sets the SIZE of the piece: it is the art, and repeating it is the effect.
  // The canvas sets HOW MANY: as many as needed to cover it for the whole
  // lap. That is what 2D engines do, and what was missing: the number was
  // fixed at 2 or 4, which only works when the layer measures the same as the canvas.

  const cfg = (mirror: boolean) => ({
    speedPxSec: 40, direction: "right_to_left" as const, mirror, pauseOnHover: false,
  });

  it("una capa estrecha monta piezas de sobra para tapar el lienzo", () => {
    // 180 of piece on 800 of canvas: with 4 pieces the track measures 720 and
    // 80 px are left uncovered. That is the side gap that was seen in the editor.
    const p = infiniteLayerPlan(cfg(true), 180, 800);
    expect(p.copies * 180).toBeGreaterThanOrEqual(800 + 180 * 2);
    expect(p.copies % 2, "con espejo el numero debe ser par").toBe(0);
  });

  it("una capa del ancho del lienzo se queda en lo minimo de siempre", () => {
    expect(infiniteLayerPlan(cfg(false), 800, 800).copies).toBe(2);
    expect(infiniteLayerPlan(cfg(true), 800, 800).copies).toBe(4);
  });

  it("la pista siempre cubre lienzo + unidad, con y sin espejo", () => {
    for (const mirror of [false, true]) {
      for (const pieza of [120, 180, 300, 800, 1200]) {
        const p = infiniteLayerPlan(cfg(mirror), pieza, 800);
        const unidad = pieza * (mirror ? 2 : 1);
        expect(p.copies * pieza, `pieza=${pieza} espejo=${mirror}`).toBeGreaterThanOrEqual(800 + unidad);
      }
    }
  });

  it("la unidad viaja como variable CSS y vale una pieza, o la pareja con espejo", () => {
    expect(infiniteLayerPlan(cfg(false), 180, 800).container["--oim-parallax-unidad"]).toBe("180px");
    expect(infiniteLayerPlan(cfg(true), 180, 800).container["--oim-parallax-unidad"]).toBe("360px");
  });

  it("la duracion es la de la unidad: la velocidad sigue significando px/s", () => {
    // 180 px at 40 px/s is 4.5s; with the mirror the lap is 360 px, i.e. 9s.
    expect(infiniteLayerPlan(cfg(false), 180, 800).container["animation-duration"]).toBe("4.5s");
    expect(infiniteLayerPlan(cfg(true), 180, 800).container["animation-duration"]).toBe("9s");
  });

  it("sin ancho de lienzo se comporta como antes, sin romper a quien no lo pase", () => {
    const p = infiniteLayerPlan(cfg(false), 800);
    expect(p.copies).toBe(2);
  });
});

describe("las copies se solapan: sin rendija en la union", () => {
  // Measured in the viewer: each copy at x 1,936 lands on a fractional screen
  // pixel, so the browser paints the last pixel of one copy and the first of the
  // next half transparent, and through the gap the background shows: a 1 px vertical
  // line that travels with the scene. Overlapping by 1 px removes it; it was checked
  // by hand in the browser before writing this.

  /** Where the point `x` of the piece ends according to its styles (origin 0 0). */
  const place = (style: Record<string, string>, x: number): number => {
    expect(style["transform-origin"], "sin origen fijo el escalado se reparte a los dos lados").toBe("0 0");
    const fns = [...(style["transform"] || "").matchAll(/(translateX|scaleX)\(([-\d.e]+)(px)?\)/g)];
    return fns.reverse().reduce((v, [, fn, n]) => (fn === "scaleX" ? v * Number(n) : v + Number(n)), x);
  };
  const plan = (mirror: boolean) =>
    infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror, pauseOnHover: false }, 576);

  it("una copy cubre 1 px mas alla de su hueco, bajo la siguiente", () => {
    const p = plan(false);
    expect(place(p.copy, 0)).toBeCloseTo(0, 6);
    expect(place(p.copy, 576)).toBeCloseTo(577, 6);
  });

  it("la copy reflejada tambien se estira hacia la derecha, y sigue reflejada", () => {
    const p = plan(true);
    const reflected = { ...p.copy, ...p.secondCopy };
    // Its left edge (x = 0) ends up on the right and its right edge at the origin.
    expect(place(reflected, 0)).toBeCloseTo(577, 6);
    expect(place(reflected, 576)).toBeCloseTo(0, 6);
  });

  it("el solape no cambia la vuelta: la unidad sigue siendo el ancho de la pieza", () => {
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
