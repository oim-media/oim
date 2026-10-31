/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que puede hacer un .oim segun donde lo pongan.
 *
 * El mismo archivo vale para una rejilla de veinte miniaturas y para una vista
 * ampliada donde solo esta el, y no debe comportarse igual en las dos. Quien lo
 * sabe es la PAGINA: el player no ve fuera de si mismo, asi que no puede
 * deducir que hay mas archivos a la vista. Se declara, no se detecta.
 *
 * **Por que vive aqui y no en el constructor del motor.** Hace falta en dos
 * sitios —al construir, y al cambiar un atributo en caliente— y tenerlo escrito
 * dos veces es la clase de duplicado que acaba divergiendo en silencio: el
 * player se comportaria de una forma al montarse y de otra al reconfigurarse.
 */

export interface ResolvedMode {
  disableAnimations: boolean;
  disableActions: boolean;
}

export interface ModeOptions {
  disableAnimations?: boolean;
  disableActions?: boolean;
}

/** Lo minimo de un elemento anfitrion: leer sus atributos. */
export interface AttributeReader {
  getAttribute(name: string): string | null;
}

/**
 * Resuelve las dos banderas con esta precedencia, de mas fuerte a mas debil:
 *
 * 1. las opciones de `mount()` —la via del visor, que trae sus propios mandos—
 * 2. el atributo suelto (`disable-animations`, `disable-actions`)
 * 3. el preajuste `mode`
 * 4. el defecto: imagen quieta con su idioma
 *
 * No hay mode «personalizado»: es no poner `mode` y usar los atributos.
 */
export function resolveMode(
  host: AttributeReader,
  options: ModeOptions = {},
  prefersLessMotion = false,
): ResolvedMode {
  // Solo `completo` enciende. Un mode mal escrito -o inventado- no puede
  // encender nada: el defecto seguro es el que no sorprende.
  const fullMode = host.getAttribute('mode') === 'full';

  const decide = (option: boolean | undefined, attribute: string): boolean => {
    if (option !== undefined) return option === true;
    const attr = host.getAttribute(attribute);
    if (attr !== null) return attr === 'true';
    return !fullMode;
  };

  return {
    // El movimiento tiene ademas una señal del dispositivo, y gana siempre.
    disableAnimations: decide(options.disableAnimations, 'disable-animations') || prefersLessMotion,
    // Las acciones NO la tienen, y es deliberado: `prefers-reduced-motion` es
    // una preferencia vestibular -protege de mareos por movimiento- y quien la
    // activa sigue queriendo pulsar. Apagarle el clic le quitaria FUNCION, no
    // movimiento: una regresion de accesibilidad disfrazada de deferencia.
    disableActions: decide(options.disableActions, 'disable-actions'),
  };
}
