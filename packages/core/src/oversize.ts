/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * How much to enlarge a parallax layer so that moving it never uncovers the
 * empty space behind it.
 *
 * The problem: a parallax layer follows the pointer. If its edge meets the
 * canvas edge (a horizon spanning side to side, a floor along the bottom),
 * moving it uncovers a strip as wide as the offset. It shows in the player
 * and not in the editor, because the editor moves nothing while you edit.
 *
 * CANONICAL: the editor and the player both use this module; never fork it.
 */

/** Como se mueve una capa. Igual que `ParallaxSlotItem.axis`. */
export type ParallaxAxis = "both" | "x_only" | "y_only";

/** La capa en pixeles del lienzo, con el origen arriba a la izquierda. */
export interface LayerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Tope del factor. Una capa pequeña pegada al borde pediria un factor enorme
 * -una de 20px que necesita 15px por lado saldria a 2.5- y agrandarla tanto la
 * convierte en otra cosa. Por encima de esto se prefiere que asome el recorte
 * antes que deformar la composicion: es un fallo visible y honesto en vez de
 * una capa que ya no es la que se dibujo.
 */
export const MAX_SCALE = 1.35;

/**
 * Desplazamiento maximo en pixeles de una capa con parallax de raton.
 *
 * `30` y no `60`: el motor multiplica `60 * depth` por la posicion normalizada
 * del raton, que esta ACOTADA a [-0.5, +0.5]. El comentario del controlador
 * dice "Max +- 60px" y es falso; el maximo es la mitad. Si algun dia se amplia
 * el rango del raton, este numero tiene que subir con el.
 */
export function maxOffset(depth: number): number {
  const d = Number(depth);
  if (!Number.isFinite(d)) return 0;
  return 30 * Math.abs(d);
}

/**
 * El factor de escala que necesita la capa, o `1` si no lo necesita.
 *
 * Solo se mira el eje en el que la capa SE MUEVE: una capa con `y_only` pegada
 * al borde izquierdo no descubre nada por ese lado.
 *
 * El factor es UNICO para los dos ejes -el mayor de los dos- y no uno por eje.
 * Escalar en x distinto que en y deforma la capa, y deformar los grupos de
 * parallax ya fue un fallo real de este editor.
 */
export function oversizeScale(
  caja: LayerBox,
  lienzo: CanvasSize,
  depth: number,
  eje: ParallaxAxis = "both",
  /**
   * La capa va envuelta en una pista de bucle infinito.
   *
   * Entonces NO se sobredimensiona, y no es un caso especial gratuito: la
   * pista ya resuelve el borde por construccion. `infiniteLayerPlan` calcula
   * las piezas como `ceil((unidad + lienzo) / unidad)` justamente para que la
   * capa cubra el lienzo durante toda la vuelta, asi que nunca deja ver el
   * fondo. Agrandarla no arregla nada y si hace daño: cada pieza se ve mas
   * grande de lo que se dibujo, y el numero de piezas se calculo para el
   * tamaño SIN escalar.
   *
   * Va aqui y no en cada motor porque el player y el editor deciden "esta capa
   * tiene pista" con condiciones DISTINTAS -el player mira la velocidad sin
   * mirar el modo; el editor mira el modo o `inf.enabled`- y esa diferencia ya
   * existe. Si ademas cada uno decidiera por su cuenta si sobredimensionar,
   * serian dos reglas en vez de una.
   */
  tienePistaInfinita: boolean = false
): number {
  if (tienePistaInfinita) return 1;
  const d = maxOffset(depth);
  if (d <= 0) return 1;
  if (!(caja.width > 0) || !(caja.height > 0)) return 1;

  const seMueveEnX = eje === "both" || eje === "x_only";
  const seMueveEnY = eje === "both" || eje === "y_only";

  /**
   * Lo que hay que anadir por un lado, o 0 si ese lado no esta anclado.
   *
   * `margen` es la distancia del borde de la capa al del lienzo; NEGATIVO si la
   * capa ya sobresale.
   *
   * Dos cosas distintas, y confundirlas fue el primer error de esta funcion:
   *
   * - **Anclado**: solo se corrige el lado que LLEGA al borde, `margen <= d`.
   *   Una capa a 300px del borde tiene un hueco de diseno; separarse un poco
   *   mas al moverse es el efecto, no un fallo.
   * - **Cuanto**: `d + margen`. Con la capa pegada (`margen = 0`) hace falta
   *   `d`; si ya sobresale 50px y solo se mueve 15, no hace falta NADA, y con
   *   la resta ingenua `d - margen` habria pedido 65.
   */
  const porUnLado = (margen: number) => (margen <= d ? Math.max(0, d + margen) : 0);
  const falta = (margenA: number, margenB: number) =>
    Math.max(porUnLado(margenA), porUnLado(margenB));

  const faltaX = seMueveEnX
    ? falta(caja.left, lienzo.width - (caja.left + caja.width))
    : 0;
  const faltaY = seMueveEnY
    ? falta(caja.top, lienzo.height - (caja.top + caja.height))
    : 0;

  if (faltaX <= 0 && faltaY <= 0) return 1;

  // La escala es centrada, asi que crece `width * (s - 1) / 2` por cada lado.
  const escala = Math.max(1 + (2 * faltaX) / caja.width, 1 + (2 * faltaY) / caja.height);
  return Math.min(MAX_SCALE, Number(escala.toFixed(4)));
}
