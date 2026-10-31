/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El interlineado: cuanto ocupa de alto una linea de texto.
 *
 * Vive aqui porque el fallo ES que el editor y el player no coincidian. Medido
 * el 27 de agosto de 2026, habia CUATRO opiniones sobre la misma propiedad:
 *
 *   - el editor pinta con `lineHeight ?? 1.25` en el lienzo;
 *   - el player no tenia ni una linea que nombrara `lineHeight`, pero un
 *     bucle generico volcaba CADA clave de `style` como propiedad CSS, asi
 *     que el valor del archivo llegaba al elemento sin validar -un `0`
 *     colapsaba las lineas, un `99` tapaba el documento- y una capa que no lo
 *     traia se quedaba con el `normal` del navegador, que segun la fuente
 *     ronda 1.15-1.2 y no es un numero fijo. Ese ultimo es el caso comun, y
 *     la divergencia de verdad;
 *   - los `.oim` publicados traen `"1.2"`, y como CADENA, no como numero;
 *   - `styleSchema` ni siquiera declaraba el campo, asi que `z.object` lo
 *     descartaba al validar y el contrato publicado no lo mencionaba.
 *
 * La consecuencia se veia: la caja del texto salia mas baja de lo que el
 * editor habia previsto y los descendentes -la «j», la «p», la «g»- quedaban
 * cortados por el `overflow: hidden` del slot.
 *
 * ## Por que se acota en vez de descartar
 *
 * El control del editor declara `min="0.5" max="3"`, pero `<input
 * type="number">` no impide teclear fuera de rango: el atributo solo bloquea
 * el envio de un formulario, y aqui no hay ninguno. Un archivo puede traer 99.
 *
 * Acotar conserva la intencion -quien escribio 5 queria «muy alto» y recibe el
 * maximo que el editor ofrece-. Descartar y volver al 1.25 daria un resultado
 * que nadie pidio y que ademas se parece al de no haber escrito nada.
 *
 * ## Por que sin unidad
 *
 * Un `line-height` sin unidad es un factor y se hereda como factor: cada
 * descendiente lo multiplica por SU tamano de fuente. Con `px` o `em` se
 * hereda ya calculado, asi que un hijo mas pequeno recibiria el alto de linea
 * del padre y las lineas se separarian de mas.
 */

/** Lo que pinta el editor cuando la capa no dice nada. */
export const DEFAULT_LINE_HEIGHT = 1.25;

/** Los limites que declara el control del editor. */
export const MIN_LINE_HEIGHT = 0.5;
export const MAX_LINE_HEIGHT = 3;

/**
 * El interlineado de un estilo, como factor sin unidad.
 *
 * Acepta el numero y la cadena numerica porque los `.oim` publicados traen la
 * segunda. Cualquier otra cosa -vacio, texto, cero, negativo, infinito- vuelve
 * al valor por defecto: un cero colapsaria las lineas unas sobre otras, y un
 * texto ilegible es peor que uno con el interlineado de siempre.
 */
export function resolveLineHeight(style: any): number {
  const crudo = style && style.lineHeight;

  let valor: number;
  if (typeof crudo === 'number') valor = crudo;
  else if (typeof crudo === 'string' && crudo.trim() !== '') valor = Number(crudo);
  else return DEFAULT_LINE_HEIGHT;

  if (!Number.isFinite(valor) || valor <= 0) return DEFAULT_LINE_HEIGHT;

  return Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, valor));
}

/**
 * El alto que declara una fuente, en multiplos de su tamano, para la peor de
 * las que se midieron.
 *
 * Medido en un navegador real el 27/08/2026 con `fontBoundingBox`, a 48 px:
 *
 *     Poppins            1.396 em   <- la mayor
 *     Playfair Display   1.333
 *     Inter              1.229
 *     Montserrat         1.208
 *     Georgia            1.146
 *     Arial              1.104
 *
 * Se usa el maximo y no el promedio a proposito: quedarse corto deja media
 * letra sin color, y pasarse solo agranda un area invisible.
 */
export const MAX_FONT_HEIGHT = 1.4;

/**
 * Cuanto sobresale la tinta por ARRIBA y por ABAJO de la caja de linea, en
 * `em`, para un interlineado dado.
 *
 * ## Que arregla
 *
 * `background-clip: text` recorta la pintura al area de fondo del elemento, y
 * esa area es la caja de linea. Cuando la tinta de un descendente -la «j», la
 * «p», la «g»- sobresale de ella, esa parte de la letra se queda SIN RELLENO:
 * transparente. Con un borde de texto se ve clarisimo, porque el contorno
 * sigue donde el color ya no llega.
 *
 * Es el mismo hecho geometrico que ya causo otras dos cosas hoy -que
 * `overflow: hidden` cortara los glifos, y que el interlineado del editor y el
 * del player no coincidieran- vista por tercera vez. Un solo hecho, tres
 * sintomas que no se parecen.
 *
 * ## Por que devuelve CERO cuando ya cabe
 *
 * Anadir margen de mas no es gratis: agranda el area de fondo, y un degradado
 * VERTICAL se reparte sobre ella, asi que sus colores se desplazan. Con un
 * interlineado holgado la tinta ya cabe y no hay nada que compensar; devolver
 * un valor fijo cambiaria el degradado sin reason.
 */
export function inkMargin(altura: number): number {
  if (!Number.isFinite(altura) || altura <= 0) altura = DEFAULT_LINE_HEIGHT;
  const sobra = MAX_FONT_HEIGHT - altura;
  if (sobra <= 0) return 0;
  // Redondeado a la diezmilesima porque este numero acaba LITERAL en el CSS:
  // `1.4 - 1.25` da 0.15000000000000002 en coma flotante, y de ahi salia un
  // `padding-top: 0.07499999999999996em`. Es valido y es ridiculo, y cuatro
  // decimales de `em` son mas precision de la que ningun tamano de fuente
  // necesita.
  return Math.round((sobra / 2) * 10000) / 10000;
}
