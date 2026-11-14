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
 * The states a slot can declare.
 *
 * `hover` responds to the pointer and is UNDONE on leaving; `active` responds to the click
 * and is NOT undone: a toggle that reverted by itself would not be a toggle.
 * That asymmetry is why each one is hooked up separately further down.
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
 * Where a slot's interaction fields are read from.
 *
 * In a REAL .oim they travel inside `slot.style`, which is where `buildSlotStyle`
 * in the editor puts them. Hand-written slots carry them at the root. Both are
 * accepted.
 *
 * This function exists because reading them only at the root was the failure this
 * feature was born with: the file was perfect (isInteractive set to true, and
 * states.hover.actions with its target), and the player hooked up nothing. The 194
 * tests passed because they all built the slot in the shape the code expected.
 * The first real .oim that was opened exposed it.
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
 * Warns in the console when what the file says and what the player can do with it
 * do not match.
 *
 * It exists because this feature's failure mode is silence: a slot that is declared
 * interactive and whose states the player cannot find does NOTHING, and whoever
 * opens the file has no way of knowing whether the problem is the file, the editor
 * or the player. That silence cost a day and a half. An actionEvent would have
 * flagged it on the first file opened.
 *
 * It does not throw or fix anything: the .oim is already signed by the time it
 * arrives here, and the player is embedded in third-party pages. It only reports.
 */
function warnIncompleteInteraction(
  isInteractive: boolean,
  states: SlotStates | undefined,
  id?: string
): void {
  const which = id ? '"' + id + '"' : 'no id';

  if (isInteractive && !states) {
    console.warn(
      '[OimPlayer] The slot ' + which + ' is declared interactive but has no states ' +
        '(`states`), neither at the root nor in `style`. It will not respond to the cursor.'
    );
    return;
  }

  // What the player knows how to do today: the styles and actions of `hover`, and
  // the ACTIONS of `active`. An `active` with only styles (scale, colour) is not
  // applied anywhere, so it counts as doing nothing.
  const hasUsefulClick = (states?.active?.actions?.length ?? 0) > 0;

  if (isInteractive && states && !states.hover && !hasUsefulClick) {
    console.warn(
      '[OimPlayer] The slot ' + which + ' is declared interactive and has `states`, but nothing ' +
        'that the player can run: it understands `hover` and the actions of `active`. ' +
        'It will not respond.'
    );
    return;
  }

  if (!isInteractive && states && Object.keys(states).length > 0) {
    console.warn(
      '[OimPlayer] The slot ' + which + ' has states (`states`) but is not marked as ' +
        'interactive (`isInteractive`). The player ignores them.'
    );
  }
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

export interface ActionRunner {
  /**
   * `disparador` travels because the engine announces it outwards (`oim:action`) and
   * the page needs to tell a click from a hover in order to filter cheaply.
   * It is not used here for anything: whoever hooks it up knows why, whoever runs it does not.
   */
  run: (actions: StateAction[], trigger?: string) => void;
  revert: (actions: StateAction[]) => void;
}

export type RegisterOutsideTap = (el: HTMLElement, onLeave: () => void) => void;

/**
 * Hooks a slot's states up to its pointer events.
 *
 * It lives here and not inside `renderSlots` so that it can be tested: the hook-up
 * is the part that makes `stateStyles` useful, and without extracting it the only way
 * to cover it would be to mount the whole engine.
 *
 * `write` is injected (in the player it is `queueUpdate`) so as not to couple this
 * to the engine's write batching.
 *
 * `actionRunner` is injected to decouple actions on other slots from the DOM lookup
 * in the shadow root.
 *
 * `onOutsideTap` is injected to register the tap outside on touch screens with a
 * single listener on the container.
 */
export function bindStates(
  el: HTMLElement,
  states: SlotStates | undefined,
  write: (el: HTMLElement, styles: Record<string, string>) => void,
  actionRunner?: ActionRunner,
  onOutsideTap?: RegisterOutsideTap
): void {
  if (!states) return;

  // The base value is captured BEFORE overwriting it, and only the first time.
  // Without this, leaving the hover restores nothing and the layer stays enlarged forever.
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

  // The CLICK, and why it is hooked up separately from the hover.
  //
  // `apply`/`leave` are a pair: what the pointer sets on entering, it removes on
  // leaving. A click has no exit (nobody "stops clicking"), so it goes through
  // `resolveActions` and NEVER through `leave`. That is exactly what distinguishes a
  // toggle from a "show": if it undid itself, it would toggle nothing.
  //
  // Only the ACTIONS. The styles of `active` (scale, colour) are a pressed state,
  // with its entry and its exit, and that is other work: applying them here would
  // leave them stuck on the layer forever.
  //
  // The click is NOT stopped here, and that is deliberate. It was born with
  // `stopPropagation`, copied from the engine's other click path
  // (`interaction.toggle_elements`); parity with something worse is not a reason.
  //
  // A .oim is embedded in other people's pages (the landing's own gallery is the
  // case: a card with its `onClick` and a live `<oim-player>` inside it).
  // Swallowing the click left the user pressing a thumbnail that toggles a layer
  // that is barely visible and does NOT open the detail page.
  //
  // `stopPropagation` is a claim of ownership: "this click is mine, nobody else
  // finds out". The player does not know what is around it, so it is not for it to
  // decide: it does its effect locally and lets the page take over.
  //
  // It is hooked up because the slot IS interactive, not because it has actions.
  // `bindStates` is only called when the slot already is (`ImageEngine.ts`,
  // `isInteractive && slotStates`), so checking the actions here was redundant and
  // left silent the case that asks for it most: a button that navigates the
  // PAGE, with no local effect at all. Without this it would have to declare a fake
  // action just so that the event would exist.
  //
  // With an empty list, the action run announces and touches nothing: `resolveActions([])`
  // returns no visibility to change.
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
 * `scale` travels as a PERCENTAGE, just like `opacity`: 100 is the natural size.
 *
 * It cost a visible failure in published works. The contract declared it as a
 * multiplier (0..10) and this function passed it as-is to a CSS property that
 * multiplies, while the editor wrote a percentage. A `103` enlarged the layer one
 * hundred and three times on hover.
 *
 * The telltale sign was on the line next to it: `opacity` WAS divided by 100.
 * Same function, same unit: one was caught and the other was not, because someone
 * compared `opacity` against a real file and nobody compared `scale`.
 *
 * Measured on sixteen files: nine `scale` values, all between 96 and 106, none below
 * 10. The percentage is not an interpretation,
 * it is the only thing that exists.
 *
 * The `<= 10` bridge is for a case that appears in no file but that the contract
 * allowed: a multiplier of the old kind. It costs one line and keeps a legitimate
 * `1.1` from shrinking to a hundredth of its size. It can be removed once it is
 * confirmed that none remain.
 */
export function scaleAsFactor(value: number): number {
  return value <= 10 ? value : value / 100;
}

export function stateStyles(e: InteractiveState): Record<string, string> {
  const s: Record<string, string> = {};
  if (e.scale !== undefined) s["--oim-slot-hover-scale"] = String(scaleAsFactor(e.scale));
  if (e.rotation !== undefined) s["--oim-rot"] = `${e.rotation}deg`;
  if (e.opacity !== undefined) s.opacity = String(e.opacity / 100);
  if (e.color) s.color = e.color;
  if (e.transitionDuration !== undefined) {
    s["--oim-transition-duration"] = `${e.transitionDuration}s`;
  }
  return s;
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
