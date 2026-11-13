/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Five ways of moving things in 1.x (`animation`, `textAnimation*`, `reveal`,
// `states`, `trim*`) become one list. What reacts to the pointer by showing or
// hiding other layers is not animation: it goes to `interactions`.

import { admits } from "../layer-blocks.js";
import type { Animation, Interaction } from "../schema.js";
import { asObject, type DraftLayer, type UpgradeContext, type V1Object, type V1Slot } from "./context.js";

type Track = NonNullable<Animation["tracks"]>[number];
type Property = Track["property"];

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** The letter each property has in a 1.x keyframe, and its value at rest. */
const KEYFRAME_PROPERTIES: [letter: string, property: Property, rest: number][] = [
  ["o", "opacity", 1],
  ["s", "scale", 1],
  ["r", "rotation", 0],
  ["x", "x", 0],
  ["y", "y", 0],
  ["b", "blur", 0],
];

/** What 1.x wrote into one `transform`: a frame that left one out drew it at rest. */
const IN_TRANSFORM = new Set<Property>(["x", "y", "scale", "rotation"]);

/**
 * 1.x keyframes carry every property at once, in seconds. Each property that
 * ever leaves its rest value becomes a track, with time from 0 to 1. Position,
 * scale and rotation take every frame (at rest where the frame is silent, as
 * 1.x drew it); opacity and blur take only the frames that name them.
 */
function tracksOf(keyframes: unknown[], duration: number): Track[] {
  const frames = keyframes.map(asObject).filter((f): f is V1Object => !!f && finite(f.t) !== undefined);
  // 1.x ran a timeline only from two keyframes up.
  if (frames.length < 2) return [];
  const tracks: Track[] = [];
  for (const [letter, property, rest] of KEYFRAME_PROPERTIES) {
    const named = frames.filter((f) => finite(f[letter]) !== undefined);
    if (!named.some((f) => f[letter] !== rest)) continue;
    const own = IN_TRANSFORM.has(property) ? frames : named;
    const points = own.map((f) => {
      const point: Track["keyframes"][number] = { t: Math.min(1, Math.max(0, (f.t as number) / duration)), v: finite(f[letter]) ?? rest };
      if (f.e !== undefined) point.e = f.e as never;
      return point;
    });
    // A lone opacity or blur keyframe: the browser ran to it from the layer's own value, and back.
    if (points.length === 1) {
      const at = points[0].t;
      if (at > 0) points.unshift({ t: 0, v: rest });
      if (at < 1) points.push({ t: 1, v: rest });
    }
    tracks.push({ property, keyframes: points });
  }
  return tracks;
}

const TEXT_TARGET: Record<string, "words" | "lines"> = { "rise-words": "words", "reveal-mask": "lines" };

/**
 * The look a layer takes under the pointer. Each track runs from the layer's
 * own value to the state's, which 1.x set outright (it did not add to it).
 * Only hover: 1.x never drew the look of `active`.
 */
function hoverLook(ctx: UpgradeContext, state: V1Object, layer: DraftLayer): Animation | undefined {
  const tracks: Track[] = [];
  const to = (property: Property, own: number, target: number) => {
    if (target !== own) tracks.push({ property, keyframes: [{ t: 0, v: own }, { t: 1, v: target }] });
  };
  const scale = finite(state.scale);
  // 1.x wrote the scale as a percentage; a value of 10 or less is an old multiplier.
  if (scale !== undefined) to("scale", 1, scale > 10 ? scale / 100 : scale);
  const rotation = finite(state.rotation);
  if (rotation !== undefined) to("rotation", layer.box.rotation ?? 0, rotation);
  const opacity = finite(state.opacity);
  if (opacity !== undefined) to("opacity", layer.opacity ?? 1, opacity / 100);
  // No track can carry a colour.
  if (state.color) ctx.note("style.states.hover.color: a hover colour is not carried to 2.0");
  if (tracks.length === 0) return undefined;
  // In milliseconds, as the editor wrote it (the 1.x player read it as seconds).
  // None of its own: the player's transition decides (0).
  return { on: "hover", tracks, duration: Math.max(0, finite(state.transitionDuration) ?? 0) };
}

const ACTIONS = new Set(["show", "hide", "toggle", "setText", "play"]);

function stateInteraction(state: V1Object, on: "hover" | "press"): Interaction | undefined {
  const actions = (Array.isArray(state.actions) ? state.actions : [])
    .map(asObject)
    .filter((a): a is V1Object => !!a && typeof a.target === "string" && typeof a.type === "string" && ACTIONS.has(a.type))
    .map((a) => ({ type: a.type as never, target: a.target as string, ...(typeof a.value === "string" ? { value: a.value } : {}) }));
  return actions.length > 0 ? { on, actions } : undefined;
}

export function convertAnimations(ctx: UpgradeContext, slot: V1Slot, layer: DraftLayer): void {
  const { raw, style } = slot;
  const animations: Animation[] = [];
  const interactions: Interaction[] = [];

  const animation = asObject(ctx.take(style, "animation"));
  if (animation) {
    const said = finite(animation.duration);
    const delay = finite(animation.delay);
    // A timeline with no duration of its own ran for 8 seconds, and never waited:
    // the delay was the named loop's alone.
    const seconds = said || 8;
    const tracks = Array.isArray(animation.keyframes) && seconds > 0 ? tracksOf(animation.keyframes, seconds) : [];
    // Keyframes loop for ever unless an action starts them, which is how every player runs them.
    if (tracks.length > 0) animations.push({ on: animation.trigger === "action" ? "action" : "loop", tracks, duration: seconds * 1000 });
    if (typeof animation.loop === "string" && animation.loop !== "none" && animation.loop !== "custom") {
      // No duration of its own: the preset decides it (0).
      animations.push({ on: "loop", preset: animation.loop, duration: said && said > 0 ? said * 1000 : 0, ...(delay && delay > 0 ? { delay: delay * 1000 } : {}) });
    }
    if (typeof animation.hover === "string" && animation.hover !== "none" && animation.hover !== "custom") {
      animations.push({ on: "hover", preset: animation.hover, duration: 200 });
    }
    // Raw CSS inside the file, retired in 1.9.0: no player applies it.
    for (const key of ["custom_loop_css", "custom_keyframes", "custom_hover_css"]) {
      if (animation[key]) ctx.note(`style.animation.${key}: raw CSS is not carried to 2.0`);
    }
  }

  const textType = ctx.take(style, "textAnimationType");
  const speed = finite(ctx.take(style, "textAnimationSpeed"));
  const textDelay = finite(ctx.take(style, "textAnimationDelay"));
  const intensity = finite(ctx.take(style, "textAnimationIntensity"));
  const cursor = ctx.take(style, "typewriterCursor");
  if (layer.type === "text" && typeof textType === "string" && textType && textType !== "none") {
    const params: Record<string, unknown> = {};
    if (speed !== undefined) params.speed = speed;
    if (intensity !== undefined) params.intensity = intensity;
    // The typewriter drew its cursor unless told not to: a `false` must survive.
    if (typeof cursor === "boolean") params.cursor = cursor;
    animations.push({
      on: "load",
      target: TEXT_TARGET[textType] ?? "chars",
      preset: textType,
      ...(Object.keys(params).length > 0 ? { params } : {}),
      // The length of a text entrance depends on its text; the preset decides it.
      duration: 0,
      ...(textDelay ? { delay: textDelay * 1000 } : {}),
    });
  }

  const reveal = asObject(ctx.take(style, "reveal"));
  if (reveal && typeof reveal.effect === "string") {
    animations.push({
      on: "enter",
      preset: reveal.effect,
      duration: finite(reveal.duration) ?? 300,
      ...(reveal.easing !== undefined ? { easing: reveal.easing as never } : {}),
    });
  }

  const trimStart = finite(ctx.take(style, "trimStart"));
  const trimEnd = finite(ctx.take(style, "trimEnd"));
  const trimDuration = finite(ctx.take(style, "trimDuration"));
  // 1.x trimmed only markup it drew itself (an SVG, or HTML) that had a stroke
  // width, and only when the trim hid something or was animated.
  const share = (percent: number) => Math.min(1, Math.max(0, percent / 100));
  const start = share(trimStart ?? 0);
  const end = share(trimEnd ?? 100);
  const seconds = Math.max(0, trimDuration ?? 0);
  const content = raw.content;
  const texts = typeof content === "string" ? [content] : Object.values(asObject(content) ?? {});
  const drawn = slot.type !== "image" && texts.some((t) => typeof t === "string" && /(<|&lt;)svg|<span|<div|<a|<img/i.test(t));
  if (layer.type === "shape" && layer.geometry && drawn && style.strokeWidth) {
    // The trim at rest lives in the geometry: it is drawn even where nothing animates.
    if (start > 0 || end < 1) layer.geometry.trim = { ...(start > 0 ? { start } : {}), ...(end < 1 ? { end } : {}) };
    // Drawn over time: the stroke grows from its start to its end at rest.
    if (seconds > 0) {
      animations.push({ on: "load", duration: seconds * 1000, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: start }, { t: 1, v: end }] }] });
    }
  }

  // The slot's own states won over the style's, and counted only on a layer marked interactive.
  const ownStates = asObject(ctx.take(raw, "states"));
  const states = ownStates ?? asObject(ctx.take(style, "states")) ?? {};
  const interactive = raw.isInteractive === true || style.isInteractive === true;
  ctx.take(raw, "isInteractive");
  for (const [name, on] of [["hover", "hover"], ["active", "press"]] as const) {
    const state = asObject(states[name]);
    if (!state) continue;
    const look = interactive && on === "hover" ? hoverLook(ctx, state, layer) : undefined;
    if (look) animations.push(look);
    const acts = stateInteraction(state, on);
    if (acts) interactions.push(acts);
  }

  const interaction = asObject(ctx.take(raw, "interaction"));
  const target = asObject(interaction?.target);
  if (interaction?.action_type === "toggle_elements" && target) {
    const ids = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
    const actions = [
      ...ids(target.show_slots).map((id) => ({ type: "show" as const, target: id })),
      ...ids(target.hide_slots).map((id) => ({ type: "hide" as const, target: id })),
    ];
    if (actions.length > 0) interactions.push({ on: "press", actions });
  }
  // The flag only said "this layer reacts"; the interactions themselves say it now.
  ctx.take(style, "isInteractive");

  const parallax = asObject(ctx.take(raw, "parallax")) ?? asObject(ctx.take(style, "parallax"));
  ctx.take(style, "parallax");
  const sceneLoop = asObject(ctx.take(style, "sceneLoop"));
  const loopDepth = finite(ctx.take(style, "loopDepth"));
  const motion: NonNullable<DraftLayer["motion"]> = {};
  if (parallax && parallax.enabled !== false) motion.parallax = parallax as never;
  if (sceneLoop || loopDepth !== undefined) motion.sceneLoop = { ...(sceneLoop as object), ...(loopDepth !== undefined ? { depth: loopDepth } : {}) } as never;
  if (Object.keys(motion).length > 0) layer.motion = motion;

  // What only a video layer used.
  ctx.retire(raw, "tracking_data");
  // Whatever is left of a CSS animation string is not a moving pattern (the
  // fill converter took that one): raw CSS, which 2.0 does not carry.
  const css = ctx.take(style, "cssAnimation");
  if (typeof css === "string" && css && !/^background-animation-/.test(css)) ctx.note("style.cssAnimation: raw CSS is not carried to 2.0");

  if (animations.length > 0) layer.animations = animations;
  if (interactions.length > 0 && admits(layer.type, "interactions")) layer.interactions = interactions;
}
