/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * What a .oim may do depending on where it is placed.
 *
 * The same file is valid both for a grid of twenty thumbnails and for an
 * enlarged view where it is the only one, and it must not behave the same way
 * in both. The one who knows is the PAGE: the player cannot see beyond itself,
 * so it cannot infer that there are more files in view. It is declared, not
 * detected.
 *
 * **Why it lives here and not in the engine constructor.** It is needed in two
 * places -at construction, and when an attribute changes at runtime- and having
 * it written twice is the kind of duplication that silently diverges: the
 * player would behave one way when mounted and another when reconfigured.
 */

export interface ResolvedMode {
  disableAnimations: boolean;
  disableActions: boolean;
}

export interface ModeOptions {
  disableAnimations?: boolean;
  disableActions?: boolean;
}

/** The minimum a host element must provide: reading its attributes. */
export interface AttributeReader {
  getAttribute(name: string): string | null;
}

/**
 * Resolves the two flags with this precedence, from strongest to weakest:
 *
 * 1. the `mount()` options -the viewer's path, which brings its own controls-
 * 2. the standalone attribute (`disable-animations`, `disable-actions`)
 * 3. the `mode` preset
 * 4. the default: a still image with its language
 *
 * There is no "custom" mode: it means not setting `mode` and using the
 * attributes.
 */
export function resolveMode(
  host: AttributeReader,
  options: ModeOptions = {},
  prefersLessMotion = false,
): ResolvedMode {
  // Only `completo` turns things on. A misspelled or invented mode cannot
  // turn anything on: the safe default is the one that does not surprise.
  const fullMode = host.getAttribute('mode') === 'full';

  const decide = (option: boolean | undefined, attribute: string): boolean => {
    if (option !== undefined) return option === true;
    const attr = host.getAttribute(attribute);
    if (attr !== null) return attr === 'true';
    return !fullMode;
  };

  return {
    // Motion also has a device signal, and it always wins.
    disableAnimations: decide(options.disableAnimations, 'disable-animations') || prefersLessMotion,
    // Actions do NOT have it, and that is deliberate: `prefers-reduced-motion`
    // is a vestibular preference -it protects against motion sickness- and
    // whoever enables it still wants to press things. Turning off the click
    // would remove FUNCTION, not motion: an accessibility regression disguised
    // as deference.
    disableActions: decide(options.disableActions, 'disable-actions'),
  };
}
