/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StateAction {
  target: string;
  type: string;
  value?: unknown;
}

export interface InteractiveState {
  scale?: number;
  rotation?: number;
  opacity?: number;
  color?: string;
  transitionDuration?: number;
  actions?: StateAction[];
}

/**
 * Los states que un slot puede declarar.
 *
 * `hover` responde al puntero y se DESHACE al salir; `active` responde al clic
 * y NO se deshace: un alternado que se revirtiera solo no seria un alternado.
 * Esa asimetria es la razon de que cada uno se enganche por separado mas abajo.
 */
export interface SlotStates {
  hover?: InteractiveState;
  active?: InteractiveState;
}

export interface ResolvedActions {
  visibility: Record<string, boolean>;
  texts: Record<string, string>;
}

/**
 * De donde se leen los campos de interaccion de un slot.
 *
 * En un .oim REAL viajan dentro de `slot.style`, que es donde los pone
 * `buildSlotStyle` en el editor. Los slots escritos a mano los llevan en la
 * raiz. Se aceptan los dos.
 *
 * Existe esta funcion porque leerlos solo en la raiz fue el fallo con el que
 * nacio esta feature: el archivo estaba perfecto -isInteractive en true y
 * states.hover.actions con su destino- y el player no enganchaba nada. Las 194
 * pruebas pasaban porque todas construian el slot con la forma que el codigo
 * esperaba. Lo enseño el primer .oim real que se abrio.
 */
export function readInteraction(
  slot: {
    isInteractive?: boolean;
    states?: SlotStates;
    style?: { isInteractive?: boolean; states?: SlotStates };
  },
  id?: string
): { isInteractive: boolean; states: SlotStates | undefined } {
  const style = slot.style || {};
  const isInteractive = slot.isInteractive === true || style.isInteractive === true;
  const states = slot.states || style.states;

  warnIncompleteInteraction(isInteractive, states, id);

  return { isInteractive: isInteractive, states: states };
}

/**
 * Avisa por consola cuando lo que dice el archivo y lo que el player puede hacer
 * con el no coinciden.
 *
 * Existe porque el mode de fallo de esta feature es el silencio: un slot que se
 * declara interactivo y cuyos states el player no encuentra NO hace nada, y
 * quien abre el archivo no tiene forma de saber si el problema es el archivo, el
 * editor o el player. Ese silencio costo un dia y medio. Un actionEvent lo habria
 * señalado en el primer archivo abierto.
 *
 * No lanza ni corrige: el .oim ya esta firmado cuando llega aqui, y el player va
 * embebido en paginas de terceros. Solo informa.
 */
function warnIncompleteInteraction(
  isInteractive: boolean,
  states: SlotStates | undefined,
  id?: string
): void {
  const which = id ? '"' + id + '"' : 'sin id';

  if (isInteractive && !states) {
    console.warn(
      '[OimPlayer] El slot ' + which + ' se declara interactivo pero no trae states ' +
        '(`states`), ni en la raiz ni en `style`. No respondera al cursor.'
    );
    return;
  }

  // Lo que el player sabe hacer hoy: los styles y las acciones de `hover`, y
  // las ACCIONES de `active`. Un `active` con solo styles -scale, color- no
  // se aplica en ninguna parte, asi que cuenta como que no hace nada.
  const hasUsefulClick = (states?.active?.actions?.length ?? 0) > 0;

  if (isInteractive && states && !states.hover && !hasUsefulClick) {
    console.warn(
      '[OimPlayer] El slot ' + which + ' se declara interactivo y trae `states`, pero nada ' +
        'que el player sepa ejecutar: entiende `hover` y las acciones de `active`. ' +
        'No respondera.'
    );
    return;
  }

  if (!isInteractive && states && Object.keys(states).length > 0) {
    console.warn(
      '[OimPlayer] El slot ' + which + ' trae states (`states`) pero no esta marcado como ' +
        'interactivo (`isInteractive`). El player los ignora.'
    );
  }
}

/**
 * WCAG 2.5.8: el area de contacto de algo interactivo nunca baja de 24x24 px.
 *
 * Vive aqui, y no suelto en `renderSlots`, por una razon concreta: estuvo
 * escrito en los dos sitios a la vez -aqui y en el motor- y esa es la clase de
 * duplicado que este proyecto lleva un dia entero cerrando. Lo aplica SOLO el
 * motor, cuando arma la caja del slot; `bindStates` no toca el tamaño,
 * que no es asunto suyo.
 *
 * Se aplica por ser interactivo, no por tener states: una capa disparadora
 * puede existir sin `states` y sigue necesitando superficie que tocar.
 */
export const MIN_HIT_AREA_PX = 24;

export function applyMinHitArea(el: HTMLElement): void {
  el.style.minWidth = `${MIN_HIT_AREA_PX}px`;
  el.style.minHeight = `${MIN_HIT_AREA_PX}px`;
}

export interface ActionRunner {
  /**
   * `disparador` viaja porque el motor lo anuncia hacia fuera (`oim:action`) y
   * la pagina necesita distinguir un clic de un hover para filtrar barato.
   * Aqui no se usa para nada: quien engancha sabe el porque, quien ejecuta no.
   */
  run: (actions: StateAction[], trigger?: string) => void;
  revert: (actions: StateAction[]) => void;
}

export type RegisterOutsideTap = (el: HTMLElement, onLeave: () => void) => void;

/**
 * Engancha los states de un slot a sus eventos de puntero.
 *
 * Vive aqui y no dentro de `renderSlots` para que se pueda probar: el enganche
 * es la parte que hace que `stateStyles` sirva de algo, y sin extraerlo la
 * unica forma de cubrirlo seria montar el motor entero.
 *
 * `escribir` se inyecta -en el player es `queueUpdate`- para no acoplar esto al
 * agrupador de escrituras del motor.
 *
 * `actionRunner` se inyecta para desacoplar las acciones sobre otros slots
 * de la busqueda DOM en el shadow root.
 *
 * `onOutsideTap` se inyecta para registrar la salida al tocar fuera en pantallas
 * tactiles con un unico escuchador en el container.
 */
export function bindStates(
  el: HTMLElement,
  states: SlotStates | undefined,
  write: (el: HTMLElement, styles: Record<string, string>) => void,
  actionRunner?: ActionRunner,
  onOutsideTap?: RegisterOutsideTap
): void {
  if (!states) return;

  // El valor base se captura ANTES de pisarlo, y solo la primera vez. Sin esto,
  // salir del hover no restaura nada y la capa se queda agrandada para siempre.
  const base: Record<string, string> = {};

  const apply = (state?: InteractiveState) => {
    const styles = stateStyles(state || {});
    for (const k of Object.keys(styles)) {
      if (base[k] === undefined) base[k] = el.style.getPropertyValue(k);
    }
    write(el, styles);
    if (state?.actions && state.actions.length > 0 && actionRunner) {
      actionRunner.run(state.actions, 'hover');
    }
  };

  const leave = () => {
    write(el, base);
    if (states.hover?.actions && states.hover.actions.length > 0 && actionRunner) {
      actionRunner.revert(states.hover.actions);
    }
  };

  // El CLIC, y por que se engancha aparte del hover.
  //
  // `aplicar`/`salir` son un par: lo que el puntero pone al entrar, lo quita al
  // salir. El clic no tiene salida —nadie "deja de hacer clic"—, asi que pasa
  // por `ejecutar` y NUNCA por `revertir`. Es justo lo que distingue un
  // alternado de un "mostrar": si se deshiciera solo, no alternaria nada.
  //
  // Solo las ACCIONES. Los styles de `active` -scale, color- son un estado
  // de pulsado, con su entrada y su salida, y eso es otro trabajo: aplicarlos
  // aqui los dejaria pegados para siempre en la capa.
  //
  // El clic NO se detiene aqui, y es deliberado. Nacio con `stopPropagation`,
  // copiado del otro camino de clic del motor (`interaction.toggle_elements`);
  // paridad con algo peor no es una razon.
  //
  // Un .oim va embebido en paginas ajenas —la galeria de la propia landing es
  // el caso: una tarjeta con su `onClick` y un `<oim-player>` vivo dentro—.
  // Tragarse el clic dejaba al usuario pulsando una miniatura que alterna una
  // capa que casi no se ve, y que NO abre la ficha.
  //
  // `stopPropagation` es una afirmacion de propiedad: «este clic es mio, nadie
  // mas se entera». El player no sabe que hay a su alrededor, asi que no le
  // toca decidirlo: hace su efecto local y deja mandar a la pagina.
  //
  // Se engancha por SER interactivo, no por tener acciones. `bindStates` solo
  // se llama cuando el slot ya lo es -`ImageEngine.ts`, `isInteractive &&
  // slotStates`-, asi que comprobar las acciones aqui sobraba y dejaba mudo el
  // caso que mas lo pide: un boton que el autor pone para que navegue la
  // PAGINA, sin ningun efecto local. Sin esto tendria que declarar una accion
  // falsa solo para que el evento existiera.
  //
  // Con la lista vacia, `ejecutar` anuncia y no toca nada: `resolveActions([])`
  // no devuelve ninguna visibilidad que cambiar.
  const clickActions = states.active?.actions;
  if (actionRunner) {
    el.addEventListener("click", () => {
      actionRunner.run(clickActions || [], 'click');
    });
    el.style.cursor = "pointer";
  }

  el.addEventListener("mouseenter", () => apply(states.hover));
  el.addEventListener("mouseleave", leave);

  el.addEventListener("pointerdown", (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    apply(states.hover);
    if (onOutsideTap) {
      onOutsideTap(el, leave);
    }
  });
}

/**
 * `scale` viaja en PORCENTAJE, igual que `opacity`: 100 es el tamaño natural.
 *
 * Costó un fallo visible en obras publicadas. El contrato lo declaraba como
 * multiplicador (0..10) y esta función lo pasaba tal cual a un CSS que
 * multiplica, mientras el editor escribía porcentaje. Un `103` agrandaba la
 * capa ciento tres veces al pasar el ratón.
 *
 * Lo delator estaba en la línea de al lado: `opacity` SÍ se dividía entre 100.
 * Misma función, misma unidad, uno cazado y el otro no — porque a `opacity`
 * alguien lo comparó con un archivo real y a `scale` nadie.
 *
 * Medido el 18 de septiembre de 2026 sobre dieciséis archivos: nueve valores
 * de `scale`, todos entre 96 y 106, ninguno por debajo de 10. El porcentaje no
 * es una interpretación, es lo único que existe.
 *
 * El puente de `<= 10` es para el caso que no aparece en ningún archivo pero
 * que el contrato permitía: un multiplicador de los de antes. Cuesta una línea
 * y evita que un `1.1` legítimo se encoja a la centésima parte. Se puede
 * retirar cuando se confirme que no queda ninguno.
 */
export function escalaComoFactor(valor: number): number {
  return valor <= 10 ? valor : valor / 100;
}

export function stateStyles(e: InteractiveState): Record<string, string> {
  const s: Record<string, string> = {};
  if (e.scale !== undefined) s["--oim-slot-hover-scale"] = String(escalaComoFactor(e.scale));
  if (e.rotation !== undefined) s["--oim-rot"] = `${e.rotation}deg`;
  if (e.opacity !== undefined) s.opacity = String(e.opacity / 100);
  if (e.color) s.color = e.color;
  if (e.transitionDuration !== undefined) {
    s["--oim-transition-duration"] = `${e.transitionDuration}s`;
  }
  return s;
}

/**
 * Resuelve una lista de acciones sobre la visibilidad actual de los slots.
 * Función pura: no toca el DOM. Misma semántica que `CanvasArea.tsx:790` en el editor.
 */
export function resolveActions(
  actions: StateAction[] | undefined,
  currentVisibility: Record<string, boolean>
): ResolvedActions {
  const visibility: Record<string, boolean> = {};
  const texts: Record<string, string> = {};

  if (!actions || actions.length === 0) {
    return { visibility, texts };
  }

  for (const act of actions) {
    const targetId = act.target;
    if (!targetId) continue;

    const currentVis = currentVisibility[targetId] !== undefined ? currentVisibility[targetId] : true;

    if (act.type === "show") {
      visibility[targetId] = true;
    } else if (act.type === "hide") {
      visibility[targetId] = false;
    } else if (act.type === "toggle") {
      visibility[targetId] = !currentVis;
    } else if (act.type === "setText") {
      texts[targetId] = act.value !== undefined && act.value !== null ? String(act.value) : "";
    }
  }

  return { visibility, texts };
}
