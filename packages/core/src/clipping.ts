/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quien recorta y quien no.
 *
 * ## El fallo, medido en un navegador real el 27/08/2026
 *
 * Un texto se recortaba sus propios descendentes -la «j», la «p», la «g»-.
 * No por la caja del slot: los slots de texto NO traen altura -se comprobo
 * sobre tres `.oim` publicados: ni `height_px` ni `style.height`- y el motor
 * ya les pone `height: auto`.
 *
 * Se recortaban por la CAJA DE LINEA. Cuando `line-height x tamano` es menor
 * que el alto que declara la fuente, la tinta sobresale de la caja, y
 * `overflow: hidden` la corta. Medido a 48 px con `line-height: 1.2`:
 *
 *     Poppins            corta 0,70 px por abajo
 *     Playfair Display   corta 0,20 px
 *     Montserrat, Inter, Georgia, Arial    no cortan
 *
 * Depende de la fuente y crece con el tamano. Las dos que cortan son las que
 * usan los archivos reales.
 *
 * ## Por que no se arregla subiendo el interlineado
 *
 * Porque el interlineado lo elige el autor. Un titular apretado a 1.0 es una
 * decision de diseno legitima, y el player no puede corregirla: cambiaria el
 * documento. Lo que si puede es no CORTAR lo que decidio dibujar.
 *
 * Un texto no tiene nada que recortar. Su caja es `width: max-content` y
 * `height: auto`, o sea que ya se ajusta a su contenido; lo unico que sobra de
 * ella es la tinta que legitimamente excede la caja de linea. Cortarla no
 * protege de nada y pierde parte de una letra.
 *
 * ## Lo que si tiene que seguir recortando
 *
 * El grupo de parallax. Su recorte es el que hace el efecto: la pista se
 * desplaza y la caja es la ventana por la que se ve. Sin `hidden` se veria la
 * cinta entera y el bucle dejaria de existir. Por eso gana a todo lo demas.
 */

export type Clipping = 'visible' | 'hidden';

export interface WhoClips {
  /** `slot.type === 'text'`, el mismo criterio que usa la sombra. */
  isText: boolean;
  /** Su recorte ES el efecto: la caja es la ventana del bucle. */
  isParallaxGroup: boolean;
  /** Sombra o filtro se pintan FUERA de la caja; recortarlos los amputa. */
  hasFilterOrShadow: boolean;
}

export function slotClipping(slot: WhoClips): Clipping {
  // Primero, porque es el unico caso en que recortar es el objetivo.
  if (slot.isParallaxGroup) return 'hidden';
  if (slot.isText) return 'visible';
  if (slot.hasFilterOrShadow) return 'visible';
  return 'hidden';
}
