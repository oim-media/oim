/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Configuration of a layer with infinite motion.
 */
export interface InfiniteLayer {
  speedPxSec: number; // 0 = still
  direction: "left_to_right" | "right_to_left";
  mirror: boolean; // second copy, mirrored
  pauseOnHover: boolean;
}

/**
 * Render plan for an infinite layer.
 */
export interface LayerPlan {
  /** true = the content must be wrapped in a track. Only if it moves. */
  duplicate: boolean;
  /**
   * How many pieces the track carries: 0 if it is still, otherwise as many as
   * needed to cover the canvas for the whole lap (`unit + canvas`).
   *
   * FOUR with mirroring, not two, because the displacement is -50% of the
   * track. With `A | mirror(A)`, at the end of the lap you see `mirror(A)` where
   * you started by seeing `A`, and on restart it JUMPS. The unit that repeats is
   * not the copy, it is the PAIR: with `A | mirror(A) | A | mirror(A)`, at -50%
   * the third piece is where the first one was, and they are identical.
   *
   * It was found by watching the loop in the viewer: the jump showed on every lap.
   * The design said "two copies, the second mirrored, -50%", which is only
   * continuous WITHOUT mirroring.
   */
  copies: number;
  /** Styles of the container that is animated. Empty if the layer is still. */
  container: Record<string, string>;
  /**
   * Styles carried by BOTH copies.
   *
   * It exists because the track is `display: flex; width: max-content`: inside a
   * container of indefinite width, a copy with a percentage width collapses and
   * the two end up overlapping instead of side by side. Fixing the flex basis in
   * pixels prevents that.
   *
   * It lives in the plan and not on each side ON PURPOSE: when the editor resolved
   * it on its own and the player did not, we again had two behaviours: the correct
   * preview and the broken published file. If the width is part of the plan,
   * neither one can forget it.
   */
  copy: Record<string, string>;
  /**
   * Styles carried by the ODD copies (the 2nd and the 4th). Empty if there is no
   * mirroring: these are the ones that are reflected.
   */
  secondCopy: Record<string, string>;
}

/** Class of the track that is animated. Both the player and the editor set it: if
 *  each one invented its own, the CSS below would only work in one of the two. */
export const TRACK_CLASS = "oim-parallax-track";

/** @deprecated use TRACK_CLASS; removed in 2.0.0. Set alongside it, so pages styling the old name keep working. */
export const LEGACY_TRACK_CLASS = "oim-parallax-pista";

/** How far each piece reaches under the next one, in layer pixels. */
const SEAM_OVERLAP_PX = 1;

/**
 * ALL the CSS the effect needs. Injected once per shadow root or document.
 *
 * It sits next to `infiniteLayerPlan` ON PURPOSE: the function emits
 * `--oim-parallax-hover` and this sheet is the only thing that gives it meaning.
 * When the generator and its consumer live in different files, one of them falls
 * behind and the result is a setting that adjusts nothing -exactly what happened
 * to `damping` and `seamlessTile` in the old engine.
 *
 * The displacement is exactly ONE UNIT -`--oim-parallax-unit`-, not a
 * percentage: the number of pieces depends on the canvas, so a fixed -50% would
 * only be correct when the track measures exactly two units.
 *
 * `--oim-parallax-hover` is only read INSIDE `:hover`, so its value "paused"
 * means "pause while the cursor is over it"; without the variable, the default
 * `running` leaves the animation as it was.
 */
export const CSS_PARALLAX = `@keyframes oim-parallax-infinite {
  0% { transform: translateX(0px); }
  100% { transform: translateX(calc(-1 * var(--oim-parallax-unit, 0px))); }
}
.${TRACK_CLASS}, .${LEGACY_TRACK_CLASS} { display: flex; width: max-content; will-change: transform; }
.${TRACK_CLASS}:hover, .${LEGACY_TRACK_CLASS}:hover { animation-play-state: var(--oim-parallax-hover, running); }
@media (prefers-reduced-motion: reduce) {
  .${TRACK_CLASS}, .${LEGACY_TRACK_CLASS} { animation: none !important; }
}`;

/**
 * Translates an infinite layer's configuration into pure CSS styles.
 *
 * Principle:
 * - If the layer is still (speed <= 0) or the width is invalid, it is neither
 *   duplicated nor animated, so the DOM is not altered and fixed elements are not duplicated.
 * - If it moves, the duration is computed exactly as width / speed.
 * - Mirroring only affects the second copy, never the container.
 *
 * @param cfg Configuration of the infinite layer
 * @param pieceWidthPx Width of the element or artboard in pixels
 */
export function infiniteLayerPlan(
  cfg: InfiniteLayer,
  pieceWidthPx: number,
  canvasWidthPx: number = pieceWidthPx
): LayerPlan {
  if (
    !cfg ||
    typeof cfg.speedPxSec !== "number" ||
    !Number.isFinite(cfg.speedPxSec) ||
    cfg.speedPxSec <= 0 ||
    typeof pieceWidthPx !== "number" ||
    !Number.isFinite(pieceWidthPx) ||
    pieceWidthPx <= 0
  ) {
    return {
      duplicate: false,
      copies: 0,
      container: {},
      copy: {},
      secondCopy: {},
    };
  }

  // THE UNIT that repeats: one piece without mirroring, the PAIR with mirroring.
  // With `A | mirror(A)` the lap does not close until both have passed, because
  // mirror(A) != A.
  const piecesPerUnit = cfg.mirror ? 2 : 1;
  const unitPx = pieceWidthPx * piecesPerUnit;

  // HOW MANY PIECES: as many as needed for the track to cover the canvas during
  // the WHOLE lap, that is `unit + canvas`. This is what 2D engines do
  // -repetitions = camera width / tile width- and what was missing here: the
  // number was fixed at 2 or 4, which is only right when the layer measures
  // exactly the canvas.
  //
  // Without this, a layer narrower than the canvas leaves empty bands at the
  // sides -the fault seen in the editor- and a wider one builds pieces nobody sees.
  const canvas = Number.isFinite(canvasWidthPx) && canvasWidthPx > 0 ? canvasWidthPx : pieceWidthPx;
  let copies = Math.ceil(canvas / pieceWidthPx) + piecesPerUnit;
  // With mirroring the number must be EVEN: half a pair breaks the symmetry and
  // brings back the jump.
  if (cfg.mirror && copies % 2 !== 0) copies += 1;

  const duracion = unitPx / cfg.speedPxSec;

  if (!Number.isFinite(duracion) || duracion <= 0) {
    return {
      duplicate: false,
      copies: 0,
      container: {},
      copy: {},
      secondCopy: {},
    };
  }

  const container: Record<string, string> = {
    // The track starts at the layer's left edge and keeps its width. An image
    // slot in the player is a column flex with `align-items: center`, and the
    // track is wider than the layer: centred, it stuck out on both sides and,
    // for half of every lap, the right part of the layer had no piece over it
    // (library). Ignored where the parent is not a flex box.
    "align-self": "flex-start",
    "flex-shrink": "0",
    "--oim-parallax-unit": `${unitPx}px`,
    // Legacy name, same value: a page may read it from the inline style until 2.0.0.
    "--oim-parallax-unidad": `${unitPx}px`,
    "animation-name": "oim-parallax-infinite",
    "animation-duration": `${duracion}s`,
    "animation-timing-function": "linear",
    "animation-iteration-count": "infinite",
    "animation-direction": cfg.direction === "left_to_right" ? "reverse" : "normal",
  };

  if (cfg.pauseOnHover) {
    container["--oim-parallax-hover"] = "paused";
  }

  // `flex: 0 0 <width>px` instead of `width`: inside the flex track, this is the
  // only way for the width not to be negotiated with the sibling.
  //
  // Each piece is also stretched SEAM_OVERLAP_PX to the right, under the next
  // one. Pieces that only touch leave a seam: scaled and moving, the joint
  // falls on a fractional screen pixel, the browser paints the last pixel of
  // one piece and the first of the next half transparent, and the background
  // shows through as a 1 px line travelling with the scene (seen in the viewer
  // at the time). Stretching instead of shifting keeps every column of the
  // art and keeps the unit exact; the scale is (w + 1) / w, invisible.
  const stretch = (pieceWidthPx + SEAM_OVERLAP_PX) / pieceWidthPx;
  const copy: Record<string, string> = {
    flex: `0 0 ${pieceWidthPx}px`,
    "transform-origin": "0 0",
    transform: `scaleX(${stretch})`,
  };

  const secondCopy: Record<string, string> = {};
  if (cfg.mirror) {
    // Mirrored about the stretched width, so it still spans [0, w + 1]: its
    // left edge lands on the right and overlaps the next piece the same way.
    secondCopy["transform"] = `translateX(${pieceWidthPx + SEAM_OVERLAP_PX}px) scaleX(-1) scaleX(${stretch})`;
  }

  return {
    duplicate: true,
    copies,
    container,
    copy,
    secondCopy,
  };
}

/**
 * Injects the parallax style sheet once per shadow root or document.
 */
export function ensureParallaxKeyframes(raiz: ShadowRoot | Document | null): void {
  if (!raiz) return;
  const styleId = "oim-parallax-styles";
  if (raiz.getElementById(styleId)) return;

  // The target is NOT always `raiz`. In a shadow root it is, but a Document
  // accepts a single root element -it already has <html>- and an appendChild on
  // it throws HierarchyRequestError: "Only one element on document allowed". In
  // the editor that left the screen BLANK in every project.
  //
  // Nobody saw it: the signature accepts `Document`, so TypeScript passed the
  // code; and happy-dom allows that appendChild, so the idempotency test passed.
  // The test environment was more permissive than the browser, which is the
  // most treacherous form of this fault: the test was not missing, it was lying.
  const destino: Node = (raiz as Document).head || raiz;

  const styleEl = (raiz.ownerDocument || (raiz as Document)).createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = CSS_PARALLAX;
  destino.appendChild(styleEl);
}

