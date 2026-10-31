/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quien es hijo de quien. La regla en la que el editor y el player TIENEN que
 * coincidir.
 *
 * Vive aqui, y no en cada lado, porque es la unica parte de los grupos que si
 * discrepa se ve: si ambos no responden lo mismo a «que layers van dentro de
 * este grupo», el mismo archivo se pinta distinto segun quien lo abra, y su
 * autor no tiene forma de saber cual de los dos tiene razon.
 *
 * Lo que NO esta aqui es deliberado. El editor tiene operaciones de edicion
 * -disolver, sacar, duplicate, seleccionar- que el player nunca ejecuta, y cada
 * uno calcula el estilo de su envoltorio con datos distintos: el player recibe
 * la caja ya resuelta en pixeles y el editor arrastra opacidad, mezcla, filtro
 * y estado de vista previa. Son dos funciones distintas que compartian nombre,
 * no una copy que derivo. Unirlas obligaria a una a fingir lo que la otra
 * necesita.
 *
 * ## Por que el padre vive en `style`
 *
 * `RawSlot`, en el backend, es un modelo Pydantic con `extra='ignore'`: un
 * campo nuevo en la RAIZ del slot se descarta al firmar, en silencio. Asi se
 * perdio el parallax en todos los `.oim` publicados. Por eso se lee un solo
 * sitio, y ese sitio es `style`.
 *
 * ## Por que viaja una sola direccion
 *
 * El editor mantiene dos representaciones -el grupo lleva `childIds` y cada
 * hijo lleva `groupId`- porque necesita recorrer la jerarquia en ambos
 * sentidos. Al archivo viaja solo la segunda: dos copies de la misma verdad
 * dentro de un fichero firmado es como se rompio el grupo duplicado el 23 de
 * agosto. Al abrir, el editor deriva `childIds` de los `groupId`.
 *
 * ## Degrada en las dos direcciones
 *
 * Un archivo antiguo no trae `style.groupId` en ningun slot: el mapa sale
 * vacio y no se anida nada, el visor pinta lo de siempre. Un player antiguo
 * con un archivo nuevo ignora el campo y pinta los hijos sueltos, con sus
 * coordenadas de lienzo. En ningun caso desaparece una capa.
 */

/** ¿Este slot es un grupo? */
export function isGroup(slot: any): boolean {
  return !!slot && slot.type === 'group';
}

/**
 * El padre de un slot, tal y como lo escribe el editor.
 *
 * Se lee UN solo sitio -`style.groupId`- por lo explicado arriba sobre
 * `extra='ignore'`.
 */
export function slotParent(slot: any): string | null {
  const style = (slot && slot.style) || {};
  const id = style.groupId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Que slots van dentro de que grupo.
 *
 * Se recorre por el `groupId` del hijo, la unica direccion que viaja al
 * archivo. Un `groupId` que apunta a algo que no existe, o que no es un grupo,
 * no anida nada: el hijo se queda suelto donde estaba, que es el
 * comportamiento de siempre y nunca una capa que desaparece.
 *
 * Un grupo no puede ser hijo de si mismo ni de otro grupo -la regla la impone
 * el editor-, pero esto no puede confiar en un archivo que puede venir de
 * cualquier sitio: sin este corte, dos grupos que se apunten mutuamente
 * cuelgan el anidado.
 */
export function childrenByGroup(slots: any[]): Map<string, string[]> {
  const grupos = new Set<string>();
  for (const s of slots || []) {
    if (isGroup(s) && s.id) grupos.add(String(s.id));
  }

  const mapa = new Map<string, string[]>();
  for (const s of slots || []) {
    if (!s || !s.id || isGroup(s)) continue;
    const padre = slotParent(s);
    if (!padre || !grupos.has(padre)) continue;
    const lista = mapa.get(padre);
    if (lista) lista.push(String(s.id));
    else mapa.set(padre, [String(s.id)]);
  }
  return mapa;
}
