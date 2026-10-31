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
    // La regla que protege el caso real: montana y cabana dentro del grupo,
    // inmoviles. Duplicarlas daria dos cabanas.
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
    // Un `animation-duration: Infinitys` no falla: no hace nada, en silencio.
    const p = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 0);
    expect(p.duplicate).toBe(false);
    const n = infiniteLayerPlan({ speedPxSec: -10, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(JSON.stringify(n)).not.toMatch(/NaN|Infinity/);
  });
});

describe("el CSS que da significado a lo que emite el generador", () => {
  // Sin estas pruebas, `--oim-parallax-hover` seria una variable que se escribe
  // y no lee nadie: un ajuste que no ajusta nada. Es el fallo de `damping` y de
  // `seamlessTile` en el motor viejo, y el reason de este rediseno.

  it("la variable de pausa se LEE en alguna parte del CSS", () => {
    expect(CSS_PARALLAX).toContain("var(--oim-parallax-hover");
  });

  it("y se lee dentro de :hover, no en la regla base", () => {
    // Leerla en la regla base pausaria la animacion SIEMPRE, no al pasar el
    // cursor. El valor "paused" solo tiene sentido dentro de `:hover`.
    const lineas = CSS_PARALLAX.split(String.fromCharCode(10));
    const reglaHover = lineas.find((l) => l.includes(":hover")) || "";
    expect(reglaHover).toContain("var(--oim-parallax-hover");
    const reglaBase = lineas.find((l) => l.includes(`.${TRACK_CLASS} {`)) || "";
    expect(reglaBase).not.toContain("--oim-parallax-hover");
  });

  it("los keyframes desplazan UNA UNIDAD, no un porcentaje fijo", () => {
    // Un -50% solo seria correcto si la pista midiera siempre dos unidades, y
    // el numero de piezas depende del lienzo. La unidad viaja en una variable.
    expect(CSS_PARALLAX).toContain("var(--oim-parallax-unidad");
    expect(CSS_PARALLAX).not.toContain("translateX(-50%)");
  });

  it("respeta prefers-reduced-motion", () => {
    // Un fondo que se desplaza sin parar es justo lo que esa preferencia pide
    // detener, y no cuesta nada.
    expect(CSS_PARALLAX).toContain("prefers-reduced-motion");
  });

  it("el generador y el CSS usan la MISMA clase", () => {
    expect(CSS_PARALLAX).toContain(`.${TRACK_CLASS}`);
  });
});

describe("el ancho de las copies tambien lo decide el plan", () => {
  // Cuando el editor lo resolvio por su cuenta y el player no, volvimos a tener
  // dos comportamientos: vista previa correcta y archivo publicado roto. El
  // ancho es parte del plan para que ninguno de los dos pueda olvidarlo.

  it("cada copy fija su ancho en pixeles, no en porcentaje", () => {
    // La pista es `width: max-content`: dentro de un container de ancho
    // indefinido, un ancho en porcentaje colapsa y las dos copies se
    // superponen en vez de quedar lado a lado.
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
  // El editor pasa `document` y el player pasa un shadow root. Un Document
  // admite UN solo elemento raiz, asi que appendChild sobre el lanza
  // HierarchyRequestError y deja el editor en blanco. La firma aceptaba
  // Document y el codigo no lo soportaba.

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
  // Con `A | espejo(A)` y un desplazamiento de -50%, al final de la vuelta ves
  // `espejo(A)` donde empezaste viendo `A`, y al reiniciar SALTA. Se vio en el
  // visor: el bucle daba un tiron en cada vuelta.
  //
  // La unidad que se repite no es la copy, es la PAREJA.

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
    // La velocidad en px/s tiene que seguir significando lo mismo. Sin este
    // factor, activar el espejo doblaria la velocidad sin tocar el ajuste.
    const sin = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: false, pauseOnHover: false }, 800);
    const con = infiniteLayerPlan({ speedPxSec: 40, direction: "right_to_left", mirror: true, pauseOnHover: false }, 800);
    expect(sin.container["animation-duration"]).toBe("20s");
    expect(con.container["animation-duration"]).toBe("40s");
  });
});

describe("cuantas piezas: las que pida el lienzo, no un numero fijo", () => {
  // La capa manda el TAMANO de la pieza -es el arte, y repetirlo es el efecto-.
  // El lienzo manda CUANTAS: las que hagan falta para cubrirlo durante toda la
  // vuelta. Es lo que hacen los motores 2D, y lo que faltaba: el numero estaba
  // fijo en 2 o 4, que solo acierta cuando la capa mide lo mismo que el lienzo.

  const cfg = (mirror: boolean) => ({
    speedPxSec: 40, direction: "right_to_left" as const, mirror, pauseOnHover: false,
  });

  it("una capa estrecha monta piezas de sobra para tapar el lienzo", () => {
    // 180 de pieza en 800 de lienzo: con 4 piezas la pista mide 720 y quedan
    // 80 px sin cubrir. Es el hueco lateral que se veia en el editor.
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
    // 180 px a 40 px/s son 4.5s; con espejo la vuelta son 360 px, o sea 9s.
    expect(infiniteLayerPlan(cfg(false), 180, 800).container["animation-duration"]).toBe("4.5s");
    expect(infiniteLayerPlan(cfg(true), 180, 800).container["animation-duration"]).toBe("9s");
  });

  it("sin ancho de lienzo se comporta como antes, sin romper a quien no lo pase", () => {
    const p = infiniteLayerPlan(cfg(false), 800);
    expect(p.copies).toBe(2);
  });
});

describe("las copies se solapan: sin rendija en la union", () => {
  // Medido el 3 oct 2026 en el visor: cada copy a x1,936 cae en un pixel de
  // pantalla fraccionario, el navegador pinta medio transparente el ultimo
  // pixel de una y el primero de la siguiente, y por la rendija asoma el
  // fondo -una linea vertical de 1 px que viaja con la escena-. Solapar 1 px
  // la quita; se comprobo a mano en el navegador antes de escribir esto.

  /** Donde acaba el punto `x` de la pieza segun sus estilos (origen 0 0). */
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
    // Su borde izquierdo (x = 0) acaba a la derecha y el derecho en el origen.
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
  // 4 Oct 2026, library: an image slot is a column flex with
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
