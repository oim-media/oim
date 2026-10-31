/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Configuracion de una capa con movimiento infinito.
 */
export interface InfiniteLayer {
  speedPxSec: number; // 0 = quieta
  direction: "left_to_right" | "right_to_left";
  mirror: boolean; // segunda copy en espejo
  pauseOnHover: boolean;
}

/**
 * Plan de renderizado para una capa infinita.
 */
export interface LayerPlan {
  /** true = hay que envolver el contenido en una pista. Solo si se mueve. */
  duplicate: boolean;
  /**
   * Cuantas piezas lleva la pista: 0 si esta quieta, y si no, las que hagan
   * falta para cubrir el lienzo durante toda la vuelta (`unidad + lienzo`).
   *
   * CUATRO con espejo, y no dos, porque el desplazamiento es de -50% de la
   * pista. Con `A | espejo(A)` al final de la vuelta ves `espejo(A)` donde
   * empezaste viendo `A`, y al reiniciar SALTA. La unidad que se repite no es
   * la copy, es la PAREJA: con `A | espejo(A) | A | espejo(A)`, a -50% la
   * tercera pieza esta donde estaba la primera y son identicas.
   *
   * Se descubrio mirando el bucle en el visor: se veia el salto en cada vuelta.
   * El diseno decia "dos copies, la segunda en espejo, -50%", que solo es
   * continuo SIN espejo.
   */
  copies: number;
  /** Estilos del container que se anima. Vacio si la capa esta quieta. */
  container: Record<string, string>;
  /**
   * Estilos que llevan LAS DOS copies.
   *
   * Existe porque la pista es `display: flex; width: max-content`: dentro de un
   * container de ancho indefinido, una copy con ancho en porcentaje colapsa y
   * las dos acaban superpuestas en vez de una al lado de otra. Fijar la base de
   * flex en pixeles lo impide.
   *
   * Va en el plan y no en cada lado A PROPOSITO: cuando el editor lo resolvio
   * por su cuenta y el player no, volvimos a tener dos comportamientos: la
   * vista previa correcta y el archivo publicado roto. Si el ancho es parte del
   * plan, ninguno de los dos puede olvidarlo.
   */
  copy: Record<string, string>;
  /**
   * Estilos que llevan las copies IMPARES (la 2a y la 4a). Vacio si no hay
   * espejo: son las que se reflejan.
   */
  secondCopy: Record<string, string>;
}

/** Clase de la pista que se anima. La ponen el player y el editor: si cada uno
 *  inventara la suya, el CSS de abajo solo funcionaria en uno de los dos. */
export const TRACK_CLASS = "oim-parallax-pista";

/** How far each piece reaches under the next one, in layer pixels. */
const SEAM_OVERLAP_PX = 1;

/**
 * TODO el CSS que el efecto necesita. Se inyecta una vez por shadow root o
 * documento.
 *
 * Va junto a `infiniteLayerPlan` A PROPOSITO: la funcion emite
 * `--oim-parallax-hover` y esta hoja es lo unico que le da significado. Cuando
 * el generador y su consumidor viven en archivos distintos, uno de los dos se
 * queda atras y el resultado es un ajuste que no ajusta nada -es exactamente lo
 * que le paso a `damping` y a `seamlessTile` en el motor viejo-.
 *
 * El desplazamiento es de UNA UNIDAD exacta -`--oim-parallax-unidad`-, no de un
 * porcentaje: el numero de piezas depende del lienzo, asi que un -50% fijo solo
 * seria correcto cuando la pista mide justo dos unidades.
 *
 * `--oim-parallax-hover` solo se lee DENTRO de `:hover`, asi que su valor
 * "paused" significa "pausa mientras el cursor este encima"; sin la variable,
 * el `running` por defecto deja la animacion como estaba.
 */
export const CSS_PARALLAX = `@keyframes oim-parallax-infinite {
  0% { transform: translateX(0px); }
  100% { transform: translateX(calc(-1 * var(--oim-parallax-unidad, 0px))); }
}
.${TRACK_CLASS} { display: flex; width: max-content; will-change: transform; }
.${TRACK_CLASS}:hover { animation-play-state: var(--oim-parallax-hover, running); }
@media (prefers-reduced-motion: reduce) {
  .${TRACK_CLASS} { animation: none !important; }
}`;

/**
 * Traduce la configuracion de una capa infinita a estilos CSS puros.
 *
 * Principio:
 * - Si la capa esta quieta (velocidad <= 0) o el ancho es invalido,
 *   no se duplica ni se anima para no alterar el DOM ni duplicate elementos fijos.
 * - Si se mueve, la duracion se calcula exactamente como ancho / velocidad.
 * - El espejo solo afecta a la segunda copy, nunca al container.
 *
 * @param cfg Configuracion de la capa infinita
 * @param anchoPiezaPx Ancho del elemento o artboard en pixeles
 */
export function infiniteLayerPlan(
  cfg: InfiniteLayer,
  anchoPiezaPx: number,
  anchoLienzoPx: number = anchoPiezaPx
): LayerPlan {
  if (
    !cfg ||
    typeof cfg.speedPxSec !== "number" ||
    !Number.isFinite(cfg.speedPxSec) ||
    cfg.speedPxSec <= 0 ||
    typeof anchoPiezaPx !== "number" ||
    !Number.isFinite(anchoPiezaPx) ||
    anchoPiezaPx <= 0
  ) {
    return {
      duplicate: false,
      copies: 0,
      container: {},
      copy: {},
      secondCopy: {},
    };
  }

  // LA UNIDAD que se repite: una pieza sin espejo, la PAREJA con espejo. Con
  // `A | espejo(A)` la vuelta no cierra hasta pasar las dos, porque
  // espejo(A) != A.
  const piezasPorUnidad = cfg.mirror ? 2 : 1;
  const unidadPx = anchoPiezaPx * piezasPorUnidad;

  // CUANTAS PIEZAS: las que hagan falta para que la pista cubra el lienzo
  // durante TODA la vuelta, o sea `unidad + lienzo`. Es lo que hacen los
  // motores 2D -repeticiones = ancho de camara / ancho del tile- y lo que
  // faltaba aqui: el numero estaba fijo en 2 o 4, que solo acierta cuando la
  // capa mide justo lo que el lienzo.
  //
  // Sin esto, una capa mas estrecha que el lienzo deja bandas vacias a los
  // lados -el fallo que se veia en el editor- y una mas ancha monta piezas que
  // nadie ve.
  const lienzo = Number.isFinite(anchoLienzoPx) && anchoLienzoPx > 0 ? anchoLienzoPx : anchoPiezaPx;
  let copies = Math.ceil(lienzo / anchoPiezaPx) + piezasPorUnidad;
  // Con espejo el numero tiene que ser PAR: media pareja rompe la simetria y
  // vuelve el salto.
  if (cfg.mirror && copies % 2 !== 0) copies += 1;

  const duracion = unidadPx / cfg.speedPxSec;

  if (!Number.isFinite(duracion) || duracion <= 0) {
    return {
      duplicate: false,
      copies: 0,
      container: {},
      copy: {},
      secondCopy: {},
    };
  }

  const container: Record<string, string> = {
    // The track starts at the layer's left edge and keeps its width. An image
    // slot in the player is a column flex with `align-items: center`, and the
    // track is wider than the layer: centred, it stuck out on both sides and,
    // for half of every lap, the right part of the layer had no piece over it
    // (library, 4 Oct 2026). Ignored where the parent is not a flex box.
    "align-self": "flex-start",
    "flex-shrink": "0",
    "--oim-parallax-unidad": `${unidadPx}px`,
    "animation-name": "oim-parallax-infinite",
    "animation-duration": `${duracion}s`,
    "animation-timing-function": "linear",
    "animation-iteration-count": "infinite",
    "animation-direction": cfg.direction === "left_to_right" ? "reverse" : "normal",
  };

  if (cfg.pauseOnHover) {
    container["--oim-parallax-hover"] = "paused";
  }

  // `flex: 0 0 <ancho>px` en vez de `width`: dentro de la pista flex es la
  // unica forma de que el ancho no se negocie con el hermano.
  //
  // Each piece is also stretched SEAM_OVERLAP_PX to the right, under the next
  // one. Pieces that only touch leave a seam: scaled and moving, the joint
  // falls on a fractional screen pixel, the browser paints the last pixel of
  // one piece and the first of the next half transparent, and the background
  // shows through as a 1 px line travelling with the scene (seen in the viewer
  // on 3 Oct 2026). Stretching instead of shifting keeps every column of the
  // art and keeps the unit exact; the scale is (w + 1) / w, invisible.
  const stretch = (anchoPiezaPx + SEAM_OVERLAP_PX) / anchoPiezaPx;
  const copy: Record<string, string> = {
    flex: `0 0 ${anchoPiezaPx}px`,
    "transform-origin": "0 0",
    transform: `scaleX(${stretch})`,
  };

  const secondCopy: Record<string, string> = {};
  if (cfg.mirror) {
    // Mirrored about the stretched width, so it still spans [0, w + 1]: its
    // left edge lands on the right and overlaps the next piece the same way.
    secondCopy["transform"] = `translateX(${anchoPiezaPx + SEAM_OVERLAP_PX}px) scaleX(-1) scaleX(${stretch})`;
  }

  return {
    duplicate: true,
    copies,
    container,
    copy,
    secondCopy,
  };
}

/**
 * Inyecta la hoja de estilos de parallax una sola vez por shadow root o documento.
 */
export function ensureParallaxKeyframes(raiz: ShadowRoot | Document | null): void {
  if (!raiz) return;
  const styleId = "oim-parallax-styles";
  if (raiz.getElementById(styleId)) return;

  // El destino NO es siempre `raiz`. En un shadow root si, pero un Document
  // admite un unico elemento raiz -ya tiene <html>- y un appendChild sobre el
  // lanza HierarchyRequestError: "Only one element on document allowed". En el
  // editor eso dejaba la pantalla EN BLANCO en cualquier proyecto.
  //
  // No lo vio nadie: la firma acepta `Document`, asi que TypeScript daba el
  // codigo por bueno; y happy-dom permite ese appendChild, asi que la prueba de
  // idempotencia pasaba. El entorno de pruebas era mas permisivo que el
  // navegador, que es la forma mas traicionera de este fallo: no es que faltara
  // la prueba, es que la prueba mentia.
  const destino: Node = (raiz as Document).head || raiz;

  const styleEl = (raiz.ownerDocument || (raiz as Document)).createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = CSS_PARALLAX;
  destino.appendChild(styleEl);
}

