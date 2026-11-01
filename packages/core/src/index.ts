export * from "./schema.js";
export * from "./binary.js";
export * from "./canonical.js";
export * from "./api.js";
// `./groups.js`: the membership rule (who is whose child). It is the
// only part of the groups where the editor and the player must agree; if
// they disagree, the same file is painted differently depending on who opens it.
export * from "./groups.js";
// `./typography.js`: line spacing. It is shared because the bug WAS that the
// editor and the player did not agree on it.
export * from "./typography.js";
// `./clipping.js`: who crops and who does not. Shared because the editor had
// the same bug as the player (it cropped the text glyphs), and two
// implementations would disagree again.
export * from "./clipping.js";
// `./compatibility.js`: letting a reader say what it does NOT understand. The
// format already degraded gracefully; what was missing was not doing it silently.
export * from "./compatibility.js";
export * from "./media-filters.js";
export * from "./flip.js";
export * from "./reveal.js";
export * from "./crop.js";
// The four format rules that the editor had COPIED into
// `src/lib/parallax/`, with its own lock file and its
// hash guard: shape geometry, parallax CSS, re-edit permission and
// oversizing. None of them imports anything, so moving them was trivial; what was
// costly was the machinery that existed to keep the two copies equal.
export * from "./geoShapes.js";
// frame-silhouette.ts: the outline a photo frame crops to, shared by player and editor (1.19.0).
export * from "./frame-silhouette.js";
export * from "./parallaxCss.js";
export * from "./reeditPermission.js";
export * from "./oversize.js";
// The fill and pattern engine. `fill.ts` was duplicated with a
// REAL divergence: the editor inferred the type from the colour and the player did not,
// so a layer with `fillColor` and no `fillType` was painted one way and came out
// empty the other. The inference is kept.
export * from "./fill.js";
export * from "./patterns.js";
export * from "./dynamic-colors.js";
// css-gradient.ts: whitelist for `fillGradient`, the other CSS a .oim hands the player.
export * from "./css-gradient.js";
export * from "./generative/proceduralNoise.js";
// `./artisticTextCurve.js`: the path of curved artistic text. Sixth case of the
// same pattern: it was written twice and the two copies diverged (the
// arc came out 80% more curved when published than when edited).
export * from "./artisticTextCurve.js";
// `./artisticTextExtrusion.js`: the 3D extrusion. Seventh case: the editor
// darkened it and the player lightened it, from the same colour.
export * from "./artisticTextExtrusion.js";
// `./embeddedFonts.js`: fonts shipped inside the file, so a .oim no longer asks
// Google for its font every time someone opens it.
export * from "./embeddedFonts.js";
// fontFile.ts — whether an uploaded font may be embedded (staff catalog, part 3).
export * from "./fontFile.js";
// `./dimensions.js`: resolving dimensions to CSS/user units.
export * from "./dimensions.js";
export * from "./effects/index.js";
// `./serialize.js` (mapLayersToOimSlots) was removed: it was a third compiler of
// measurements, exported as public API of @oim-media/core but with no
// consumer besides its own test. It anchored the position to the CENTER of the slot
// (`anchorX += w/2`), while the real compiler (the one in the backend, in
// `/api/v1/oim/compile`) anchors it to the top-left corner. A third party
// integrating against this package would have got everything shifted by half a
// box, with no error to reveal it.
export * from "./text-marks.js";
export * from "./drop-cap.js";
export * from "./text-effects.js";
export * from "./glitch.js";
