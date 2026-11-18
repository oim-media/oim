/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Interaction } from "@oim-media/core/v2";

export interface StateAction {
  target: string;
  type: string;
  value?: unknown;
}

export interface ResolvedActions {
  visibility: Record<string, boolean>;
  texts: Record<string, string>;
}

/**
 * WCAG 2.5.8: the contact area of something interactive never drops below 24x24 px.
 *
 * It lives here, and not loose in `renderSlots`, for a concrete reason: it was
 * written in both places at once (here and in the engine), and that is the kind of
 * duplication this project has spent a whole day closing. Only the engine applies it,
 * when it builds the slot's box; `bindStates` does not touch the size, which is not
 * its concern.
 *
 * It applies because the slot is interactive, not because it has states: a trigger
 * layer can exist without `states` and still needs a surface to touch.
 */
export const MIN_HIT_AREA_PX = 24;

export function applyMinHitArea(el: HTMLElement): void {
  el.style.minWidth = `${MIN_HIT_AREA_PX}px`;
  el.style.minHeight = `${MIN_HIT_AREA_PX}px`;
}

/**
 * Resolves a list of actions against the current visibility of the slots.
 * Pure function: it does not touch the DOM. Same semantics as the editor's visibility resolver.
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

/**
 * Hooks a 2.0 layer's interactions to its pointer. A press runs its actions and
 * is never undone (a toggle that reverted by itself would toggle nothing); a hover
 * runs them on entering and reverts them on leaving. The click is not stopped: the
 * page around the file may want it too.
 */
export function bindInteractions(
  el: HTMLElement,
  interactions: readonly Interaction[] | undefined,
  run: (actions: StateAction[], revert: boolean) => void,
): void {
  if (!interactions?.length) return;
  applyMinHitArea(el);
  el.style.cursor = "pointer";
  for (const { on, actions } of interactions) {
    if (on === "press") el.addEventListener("click", () => run(actions, false));
    else {
      el.addEventListener("pointerenter", () => run(actions, false));
      el.addEventListener("pointerleave", () => run(actions, true));
    }
  }
}
