/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El grupo como wrapper, no como caja vacía.
 *
 * Fase 3 de `docs/superpowers/specs/2026-08-23-el-grupo-como-nodo-design.md`.
 *
 * Hasta ahora el `.oim` traía el slot `group` y el player no sabía qué era —no
 * había ni una línea que mencionara `group`—, así que construía **un elemento
 * vacío con la caja del grupo, encima de sus hijos**. No pintaba nada, pero
 * ocupaba: peso muerto dentro de un archivo firmado.
 *
 * El modelo es el mismo que el del editor: un wrapper del tamaño del lienzo
 * y en su origen, con la transformada del grupo aplicada sobre su propio
 * centro. Los hijos van **dentro**, conservando sus coordenadas absolutas de
 * siempre. Así la opacidad, el filtro y la visibilidad del grupo alcanzan a lo
 * que hay dentro por CSS, sin que nadie las propague a mano.
 *
 * **Degrada en las dos direcciones, que es lo que decide si se puede publicar:**
 * un archivo antiguo no trae `style.groupId` en ningún slot, así que
 * `childrenByGroup` sale vacío y no se anida nada — el visor pinta lo de siempre.
 * Y un player antiguo con un archivo nuevo ignora el campo y pinta los hijos
 * sueltos, que es exactamente lo que se ve hoy: los hijos llevan sus
 * coordenadas de lienzo, no coordenadas relativas al grupo.
 */

/**
 * La regla de pertenencia se delega en `@oim-media/core`, fuente unica para el
 * player y el editor. Si cada uno respondiera por su cuenta a «que capas van
 * dentro de este grupo», el mismo archivo se pintaria distinto segun quien lo
 * abra, y su autor no tendria forma de saber cual tiene razon.
 *
 * Se importa el fichero del modulo y no el indice del paquete, igual que en
 * `binary.ts`: asi el bundle del player incorpora solo estas tres funciones y
 * nunca arrastra el esquema ni zod.
 */
export { isGroup, slotParent, childrenByGroup } from '../../../core/src/groups.js';

export interface CanvasBox { x: number; y: number; width: number; height: number; }
export interface CanvasSize { width: number; height: number; }

export interface WrapperStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  transformOrigin: string;
  pointerEvents: string;
}

/**
 * Cómo se coloca el wrapper.
 *
 * Cubre el lienzo entero y se ancla en su origen, para que los hijos —que
 * traen coordenadas de lienzo— caigan donde siempre. La transformada del grupo
 * (rotación, scale) se aplica sobre el **centro del grupo**, no sobre el
 * centro del lienzo: rotar un grupo tiene que girarlo sobre sí mismo.
 *
 * `pointer-events: none` porque el wrapper cubre TODO el lienzo: sin esto,
 * un grupo pequeño se tragaría los clics de cualquier capa que estuviera por
 * debajo en la pila. Los hijos lo vuelven a encender solos — `.oim-slot` ya
 * declara `pointer-events: auto`.
 *
 * La caja llega YA resuelta en píxeles de lienzo, no como el `position` crudo
 * del slot. Ese campo viene unas veces en 0..1 y otras en 0..100 según la
 * antigüedad del archivo, y `ImageEngine` ya lo normaliza junto con `width_px`
 * y `height_px` para colocar cualquier capa. Volver a interpretarlo aquí sería
 * una segunda lectura del mismo dato con su propio criterio — que es la forma
 * exacta que tienen de aparecer los fallos en este formato.
 */
export function wrapperStyle(
  box: CanvasBox,
  canvas: CanvasSize
): WrapperStyle {
  return {
    left: '0px',
    top: '0px',
    width: canvas.width + 'px',
    height: canvas.height + 'px',
    transformOrigin:
      (box.x + box.width / 2) + 'px ' + (box.y + box.height / 2) + 'px',
    pointerEvents: 'none'
  };
}
