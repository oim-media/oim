# OIM (Open Interactive Media) Canonical Metadata Specification

**Contract version:** 1.27.0  
**Date:** 2026-11-02 (reviewed against `packages/core/src/schema.ts`; the source of truth is the schema, this document summarises it)  
**Status:** Normative / In force  
**License:** Apache-2.0  
**Authority:** Xue Studios LLC & the OIM Architecture Team

---

## 1. Summary and Objectives of the Canonical Specification

The **`.oim`** format defines a multi-platform interactive image specification. The metadata layer (historically called `oimdata` or `oimdata.json`, injected into the `OIM_Data` chunk of the PNG container) uses a **strongly typed, serialisable canonical language**.

> **Note on OVM (`.ovm`):** The interactive video format (`ovm.schema.json` and `@oim-media/player-ovm`) is currently a **reserved placeholder pending specification**. The normative specification below governs **OIM (`.oim`)**.

### Canonical Design Principles

1. **Total independence from web engines (native platforms):**
   - The format **prohibits free or arbitrary CSS** (`custom_loop_css`, `custom_keyframes`, free style strings).
   - Every visual or dynamic attribute is parameterised in canonical types (numbers, enums, tuples or arrays). This allows native implementations on **iOS (SwiftUI / Core Animation)**, **Android (Jetpack Compose / RenderNode)**, **Desktop (Rust / Tauri / Skia)** or Web Components to paint and interact with 1:1 fidelity without requiring an embedded web browser.
2. **One name per concept (zero ambiguity):**
   - The compiler canonicalises shortcuts and duplicate names before signing:
     - `size` ➔ `fontSize`
     - `font` ➔ `fontFamily`
     - `color` ➔ `fillColor`
     - `bold: true` ➔ `fontWeight: 700`
     - `italic: true` ➔ `fontStyle: "italic"`
     - `underline: true` ➔ `textDecoration: "underline"`
     - `fontSizeOverrides` ➔ unified inside the `fontSizes` map.
     - `reedicion` (`"publico" | "solo_autor" | "sellado"`) ➔ `reedit` (`"public" | "author_only" | "sealed"`, 1.23.0; legacy files are normalised on read via `normalizeLegacyKeys`).
3. **Determinism and security (zero-trust sandbox):**
   - With no arbitrary CSS injection, attack vectors such as `@import`, covert network requests via `url()`, or breaking out of Shadow DOM isolation are eradicated.
4. **Portable or not admitted:**
   - Every visual effect is built from primitives that any graphics engine has cheaply — opacity, translation, scale, rotation and rectangular clipping, per unit (letter, word, line or layer). What exists only in a browser (per-letter blur, animated shadows, free `clip-path`) is not admitted, and what was already there is retired or rewritten into portable primitives (`glitchLayers`, `entranceFrameAt`, `revealFrames`).

---

## 2. Canonical Layer Types (`slot.type`)

Every interactive element in the `slots` array declares a canonical type:

| Type (`type`) | Purpose | Canonical Characteristics |
|---|---|---|
| `text` | Dynamic multilingual text | Supports localised `content`, sizes per language (`fontSizes`), widths per language (`maxWidths`), text marks (`marks`) and precalculated lines (`textRuns`). |
| `image` | Secondary or embedded bitmap | Embedded `data:image/*` URI in `content`, framing (`objectFit`, `imageCrop`), mirroring (`flipX`, `flipY`), filters and accessible `alt`/`decorative`. |
| `lottie` | Lottie vector animation | Embedded vector JSON. |
| `geo` / `shape` | Pure vector geometry or photo frame | Governed by `style.geoShape` (24 catalog shapes including 12 photo-frame silhouettes), custom `svgPath`/`svgViewBox`, or `fillType: "image"` (`fillImage`, `fillImageCrop`, `fillImageFlipX`, `fillImageFlipY`). |
| `draw` / `svg` | Free vector strokes | Supports standard SVG paths (`svgRawXml`, `svgPath`, `svgViewBox`, `customBlobPath`). |
| `artistic-text` | 3D text with parametric extrusion | Vector extrusion (`extrusionDepth`, `extrusionAngle`, `curveAmount`, `curveType`). |
| `pattern` | Repeating procedural pattern | Canonical presets (`clouds`, `bubbles`, `grid`, `waves`, `stars`, `stripes`, `dots`, `zigzags`, `bolt`, `leaf`, `drop`, `moon`, `crown`, `heart`). |
| `filter` | Colour adjustment / optical filter layer | Named presets (`filterPreset`) and normalised numeric adjustments (`filterBrightness`, `filterContrast`, `filterSaturate`, `filterHueRotate`, `filterBlur`). |
| `container` | Bounding box or frame | Supports geometry, fills, borders, shadows and clipping. |
| `group` | Hierarchical container node | Groups child layers via `style.groupId`. Controls clipping (`slotClipping`) and scene loops (`style.sceneLoop`). |
| `component` | Composite component instance | Encapsulated grouping of modular design. |
| `mask` | Clipping or die-cut mask | Clipping by a base shape (`maskShape`, `maskMode`) or multiple vector cutouts (`cuts`). |
| `zone` | Contextual anchor zone | Delimiter for anchoring slots to relative regions of the image. |

---

## 3. Root Structure of the Slot (`slotSchema`)

```typescript
interface OimSlot {
  id: string;                       // Unique identifier (maximum 128 characters)
  name?: string;                    // Name assigned by the author (max 256 chars)
  type?: SlotType;                  // One of the canonical types in section 2
  languages?: string[];             // Languages in which it is shown (default: ["*"])
  pendingTranslation?: string[];    // Language codes pending translation
  align?: "left" | "center" | "right";
  position?: [number, number];      // Normalised coordinates [x, y] (percentage 0.0 to 100.0%)
  width_px?: number;                // Virtual width in reference pixels
  height_px?: number;               // Virtual height in reference pixels
  content?: Record<string, string>; // Language -> content dictionary (e.g. { "en": "Text" })
  style?: OimStyle;                 // Canonical style object (see section 4)
  parallax?: OimParallax;           // Parallax configuration (see section 5; may also travel in style.parallax)
  interaction?: OimInteraction;     // Declared interactions
  tracking_data?: number[][];       // Tracking keyframes [time, x1..y4, cx, cy]
  zone_id?: string;                 // ID of the containing zone
}
```

---

## 4. Canonical Style Contract (`styleSchema`)

### 4.1. Typography and Text
- `fontFamily`: String with the font name (max 128 chars).
- `fontSize`: Pure number or container percentage (e.g. `24` or `"4.5cqw"`).
- `fontWeight`: Numeric weight (`100` to `900`, `400` = normal, `700` = bold) or string keyword.
- `fontStyle`: `"normal" | "italic" | "oblique"`.
- `textDecoration`: `"none" | "underline"` (max 64 chars).
- `textAlign`: `"left" | "center" | "right" | "justify"`.
- `lineHeight`: Numeric multiplier factor (e.g. `1.2`, `1.5`) or a bounded string.
- `letterSpacing`: Numeric pixel spacing or `cqw` string.
- `maxWidth`: Container percentage string (e.g. `"80cqw"`, `"none"`) or numeric value.
- `fontSizes`: Map of size specific to each language `{ "es": "3.0cqw", "ja": "2.5cqw" }`.
- `maxWidths`: Map of maximum width specific to each language `{ "en": "60cqw" }`.
- `textRole`: Semantic hierarchy hint (`"auto" | "title" | "subtitle" | "body"`).
- **Text marks (1.11.0, `text_marks` capability):** `content` can wrap phrases in `{name}…{/name}`; literal braces are doubled (`{{`, `}}`). `style.marks` defines each mark with a closed set (`color`/`colorRole`, `bold`, `italic`, `underline`, `highlight{style, color, colorRole, paddingX, paddingY, borderRadius}`). Names `^[a-z][a-z0-9-]{0,23}$`, maximum 8 per layer, not nested. A single interpretation: `parseMarks`, `markStyle` (`@oim-media/core`). The backend does not sign malformed tags (`OIM_E_TEXT_MARKS_INVALID`).
- `dropCap`: `{ enabled, lines: 2|3, fontFamily?, color?, marginRight? }`. Size is set with `dropCapStyle`; the rest of the text keeps its marks (`splitDropCap`).
- `textHighlight`: **retired** (1.12.0). Kept read-only for published files; new writers use `marks`.
- `textRuns`: **Precalculated lines** for native renderers (iOS/Android/Desktop) that lack a complex paragraph layout engine:
  ```json
  "textRuns": {
    "es": {
      "fontSize": 24,
      "lineHeight": 28,
      "lines": [
        { "text": "First line of text", "width": 280, "yOffset": 0 },
        { "text": "Second line, adjusted", "width": 260, "yOffset": 28 }
      ]
    }
  }
  ```

### 4.2. Colours, Dynamic Roles and Fills (`cssColor`)
Colours are validated against the strict `cssColor` pattern (hexadecimal `#RGB` / `#RRGGBB` / `#RRGGBBAA`, functions `rgb()`, `hsl()`, `"transparent"`, `"none"`, or dynamic colour tokens `var(--primary)`):
- **Dynamic colour roles (`DYNAMIC_COLOR_ROLES`):**
  `"primary" | "on-primary" | "secondary" | "on-secondary" | "surface" | "on-surface" | "outline" | "accent" | "text-primary" | "text-secondary" | "text-muted" | "text-on-accent"`.
- `fillColor`: Main fill colour (or glyph colour in text layers).
- `fillType`: `"none" | "color" | "gradient" | "pattern" | "generative" | "image"`.
- `colorRole` / `fillColorRole` / `strokeColorRole` / `textStrokeColorRole` / `shadowColorRole` / `effectColorRole` / `maskBgColorRole` / `maskStrokeColorRole`: Semantic dynamic theme roles.
- **Pattern colour roles (1.21.0):** `fillPatternColorRole`, `fillPatternBgColorRole`, `backgroundPatternColorRole`, `backgroundPatternBgColorRole`.
- `fillGradient`: Canonical linear, radial or conic gradient function (`CSS_GRADIENT_PATTERN`).
- `fillPatternType`: Repeating pattern preset:
  `"clouds" | "bubbles" | "grid" | "waves" | "stars" | "stripes" | "dots" | "zigzags" | "bolt" | "leaf" | "drop" | "moon" | "crown" | "heart"`.
- **Image fill and photo frames (1.17.0 / 1.19.0, `image_fill` and `frame_shapes` capabilities):**
  - `fillImage`: Embedded `data:image/*` URI (up to 10 MB).
  - `fillImageCrop`: `{ x: 0..100, y: 0..100, zoom: 1..10 }`.
  - `fillImageFlipX` / `fillImageFlipY`: `boolean` (mirrors the photo inside the frame without moving the frame).
- `fillGenerative`: Algorithmic procedural fill:
  ```typescript
  {
    generatorId: string;           // Identifier of the generative algorithm
    seed: number;                  // Deterministic seed
    params: Record<string, number | string | boolean>;
    colors: {
      mode: "monochrome" | "palette";
      stops: string[];             // Array of cssColor colours (max 16)
      direction: "forward" | "reverse" | "radial";
      background: string;
      backgroundVisible: boolean;
    }
  }
  ```

### 4.3. Shapes, Frames, Strokes and Borders
- `geoShape`:
  - Base shapes: `"rectangle" | "circle" | "triangle" | "star" | "line" | "arrow" | "diamond" | "hexagon" | "heart" | "blob" | "scribble" | "custom"`.
  - Frame shapes (1.19.0, `frame_shapes` capability): `"pill" | "octagon" | "pentagon" | "cross" | "moon" | "cloud" | "drop" | "bolt" | "bubble" | "flower" | "burst" | "arch"`.
- `svgPath`: Validated SVG path data (`^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$`, max 20,000 chars) for custom frames (`1.19.0`).
- `svgViewBox`: Four-number coordinate box (`^-?\d+(\.\d+)?([\s,]+-?\d+(\.\d+)?){3}$`, max 64 chars).
- `strokeColor`: Colour of the border or stroke.
- `strokeWidth`: Stroke thickness in canvas units (minimum 0).
- `strokeStyle`: `"solid" | "dashed" | "dotted"`.
- `borderRadius`: Uniform numeric radius or four-value spatial form (e.g. `8` or `"1.0cqw 2.0cqw 0.0cqw 0.5cqw"`).

### 4.4. Transform, Framing, Accessibility and Hierarchy
- `width` / `height`: Layer dimensions in `cqw` or user units.
- `rotation`: Rotation in degrees.
- `flipX` / `flipY` (1.14.0): Mirror the layer on its own horizontal/vertical axes (`flipScale`).
- `opacity`: Layer opacity (`0` to `100`).
- `isVisible`: Initial visibility (`boolean`).
- `groupId`: ID of the parent `group` slot (`slotParent`, `childrenByGroup`).
- `objectFit`: `"contain" | "cover" | "fill" | "none" | "scale-down"`.
- `imageCrop` (1.15.0): `{ x: 0..100, y: 0..100, zoom: 1..10 }` (`cropPlacement`, `cropCss`).
- `alt` (1.16.0): `Record<string, string>` (per-language accessible description, max 300 chars per entry).
- `decorative` (1.16.0): `boolean` (hides decorative imagery from assistive technology).

### 4.5. Unified Effects, Shadows and Media Filters
- `effects`: Modular array (`max(8)`) of discriminated effect objects (`oimEffectSchema`):
  - `texture`: `{ type: "texture", preset, intensity: 0..100, blend, scale?: 0.2..5, color?, colorRole?, enabled? }`.
  - `drop-shadow`: `{ type: "drop-shadow", x?, y?, blur?: 0..200, spread?, color?, colorRole?, enabled? }`.
  - `blur`: `{ type: "blur", radius: 0..100, enabled? }`.
  - `glow`: `{ type: "glow", color?, colorRole?, radius: 0..100, intensity?: 0..100, enabled? }`.
  - `color-grade`: `{ type: "color-grade", preset: "warm-vintage" | "cool-cinema" | "cyberpunk" | "monochrome-contrast", intensity: 0..100, enabled? }`.
- `shadowEnabled`, `shadowColor`, `shadowColorRole`, `shadowBlur` (`0..200`), `shadowOffsetX` (`-500..500`), `shadowOffsetY` (`-500..500`), `shadowOpacity` (`0..100`).
- `layerBlur`: Layer blur (`0..100`).
- **Media filters (1.18.0, `media_filters` capability):**
  - `filterPreset`: `"none" | "duotone" | "grayscale" | "sepia" | "high-contrast" | "vintage" | "cool" | "warm" | "faded" | "cinema" | "nordic" | "sunset" | "noir" | "dramatic" | "cyberpunk" | "pastel" | "vhs"`.
  - `filterBlur` (`0..100`), `filterBrightness` (`0..500`), `filterContrast` (`0..500`), `filterSaturate` (`0..500`), `filterHueRotate` (`0..360`).

### 4.6. Artistic Text and 3D Relief (`artistic-text`)
- `artisticPreset`: `"neon-cyberpunk" | "retro-wave-3d" | "comic-pop-extrusion" | "vintage-emboss" | "chrome-metallic" | "arcade-80s" | "custom"`.
- `extrusionDepth`: Geometric extrusion depth (`0` to `100`).
- `extrusionAngle`: Projection angle in degrees (`0` to `360`).
- `extrusionColor`: Colour of the extrusion volume.
- `extrusionShading`: Volumetric facet shading (`boolean`).
- `curveAmount`: Text curvature (`-100` to `100`).
- `curveType`: Curvature geometry (`"arc" | "wave" | "arch"`).
- `outerStrokeColor`, `outerStrokeWidth`, `innerStrokeColor`, `innerStrokeWidth`, `textGradientType`.

### 4.7. Animations, Keyframes and Reveal (`animation`, `reveal`)
- `animation.loop`: Loop preset (`"none" | "pulse" | "float" | "bounce" | "spin" | "glow" | "custom"`).
- `animation.hover`: Cursor preset (`"none" | "grow" | "shrink" | "lift" | "glow" | "custom"`).
- `animation.duration`: Duration in seconds (`0.1` to `20`).
- `animation.delay`: Initial delay in seconds (`0` to `10`).
- `animation.trigger` (1.22.0): `"load" | "action"` (`"action"` holds the layer at its first keyframe until triggered by a `"play"` state action).
- `animation.keyframes`: Structured array of keyframes (`keyframeSchema`, `max(240)`):
  ```typescript
  interface OimKeyframe {
    t: number;                      // Time in seconds (0 to 60)
    o?: number;                     // Opacity (0.0 to 2.0, allows elastic overshoot)
    s?: number;                     // Scale multiplier (0.0 to 10.0)
    r?: number;                     // Rotation in degrees (-3600 to 3600)
    x?: number;                     // X displacement in canvas coordinates
    y?: number;                     // Y displacement in canvas coordinates
    b?: number;                     // Blur (0 to 50)
    e?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "steps(1, end)" | [number, number, number, number];
  }
  ```
- `reveal` (1.22.0): How a layer enters when shown by an action and exits when hidden (`revealSchema`):
  ```typescript
  interface OimReveal {
    effect: "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "scale";
    duration: number;               // Duration in ms (0 to 2000)
    easing?: KeyframeEasing;
  }
  ```
- `textAnimationType`: `"none" | "typewriter" | "wave-chars" | "glitch-cyberpunk" | "glitch-slice" | "fade-chars" | "slide-up" | "bounce-chars" | "reveal-mask" | "scale-in" | "rise-words" | "blur-chars"`, with `textAnimationSpeed` (`0..200`), `textAnimationDelay` (`0..100`), `textAnimationIntensity` (`0..100`) and `typewriterCursor`.
  - `fade-chars`, `slide-up`, `bounce-chars`, `reveal-mask`, `scale-in` and `rise-words` are entrance effects defined as portable data in `@oim-media/core` (`text-effects.ts`).
  - `glitch-cyberpunk` and `glitch-slice` are defined as portable layer primitives in `@oim-media/core` (`glitch.ts`).
  - `blur-chars` is **retired** (not portable): it still validates, and readers draw the text without animation.

---

## 5. Canonical Parallax (`parallaxSchema`)

Configuration for layers with spatial depth and reactive or continuous displacement (carried on `slot.parallax` or `slot.style.parallax`):

```typescript
interface OimParallax {
  enabled: boolean;                 // Default: true
  depth: number;                    // Focal depth (-2.0 to 2.0)
  mode: "mouse" | "scroll" | "infinite_horizontal";
  axis: "both" | "x_only" | "y_only";
  infinite?: {
    enabled?: boolean;              // Default: false (true when active)
    speedPxSec?: number;            // Continuous advance speed (-500 to 500 px/s; alias: speed_px_sec)
    direction?: "left_to_right" | "right_to_left";
    mirror?: boolean;               // Mirror alternate tiles (aliases: seamlessTile, seamless_tile)
    pauseOnHover?: boolean;         // Pause when the cursor rests on it (alias: pause_on_hover)
  };
}
```

> Note: On group layers that form an editable loop scene, `style.sceneLoop` (`{ speedPxSec, direction, mirror, pauseOnHover }`) and child `style.loopDepth` (`0..1`) preserve the scene parameters for re-editing, while each moving child layer carries its resolved `parallax` (`speedPxSec = scene.speedPxSec * loopDepth`) for the player (`infiniteLayerPlan`).

---

## 6. Interactivity and State Machine (`isInteractive`, `states`)

Allows declaring interactivity without writing JavaScript:

```typescript
interface OimInteractiveStates {
  hover?: OimStateConfig;           // State when the cursor rests on it or a touch is held (reverted on leave)
  active?: OimStateConfig;          // State when clicked or tapped (persists)
}

interface OimStateConfig {
  scale?: number;                   // Percentage scale (0 to 1000%, e.g. 105 = 105%)
  rotation?: number;                // Rotation (-360 to 360 degrees)
  opacity?: number;                 // Percentage opacity (0 to 100%)
  transitionDuration?: number;      // Transition time in ms (0 to 10000)
  actions?: OimStateAction[];       // Chained actions on other layers (max 64)
}

interface OimStateAction {
  target: string;                   // ID of the target slot (1 to 128 chars)
  type: "show" | "hide" | "toggle" | "setText" | "play"; // "play" added in 1.22.0
  value?: string;                   // Value to apply (e.g. new text if type is setText, max 10000 chars)
}
```

---

## 7. Root Document Metadata (`OimMetadataSchema`)

Top-level structure carried in the `OIM_Data` payload:

| Key | Type | Description |
|---|---|---|
| `oim` | `string` | Format version of the document (e.g. `"1.27.0"`), the contract version the backend signs against. |
| `min_player` | `string` | Minimum player version required to rebuild the document (`minVersionFor`). |
| `oim_id` | `string` | Unique document identifier for re-editing and registry checks (max 128 chars). |
| `media_type` | `"image" \| "video"` | Media type of the OIM document. |
| `name` | `string` | Official title of the work (max 256 chars). |
| `description` | `Record<string, string>` | Per-language summary of the whole document for screen readers (1.16.0, max 1000 chars per language). |
| `reedit` | `"public" \| "author_only" \| "sealed"` | Authorised cryptographic re-edit policy (1.23.0; replaces deprecated Spanish `reedicion`). |
| `immutable_lock` | `boolean` | Cryptographic seal flag (`true` when `reedit === "sealed"`). |
| `canvas` | `{ natural_width: number, natural_height: number }` | Base reference dimensions of the canvas. |
| `lang` / `languages` | `string[]` | Catalogue of BCP-47 language codes present in the document (max 10 chars per tag). |
| `palettes` | `Record<string, Partial<Record<DynamicColorRole, string>>>` | Up to 6 named colour palettes mapping semantic roles to CSS colours (1.20.0). |
| `defaultPalette` | `string` | Name of the active palette in `palettes` (1.20.0). |
| `slots` | `OimSlot[]` | Array of interactive layers (maximum `MAX_SLOTS` = 150). |
| `zones` | `OimZone[]` | Optional catalogue of named bounding box zones. |
| `capabilities` | `("vector_parallax" \| "infinite_parallax" \| "text_marks" \| "image_fill" \| "media_filters" \| "frame_shapes")[]` | Capabilities used by the document. |
| `capabilities_required` | same as `capabilities` | Capabilities the reader **must** implement to paint with fidelity (glTF pattern). |
| `fonts` | `EmbeddedFont[]` | Font variants embedded in base64 for offline rendering (1.3.0): subset, static (no `fvar`, `gvar`, `avar`, `HVAR`, `MVAR`; `STAT` may stay) WOFF, `format: "woff"`, written since 1.27.0; WOFF2 (`format: "woff2"`) is read forever. The content starts with the magic of its format (`wOFF` / `wOF2`). |
| `image_hash` | `string` | SHA-256 hash of the base image `IDAT` chunk payloads (`imageDataHash`). |
| `image_hash_alg` | `"sha256-idat"` | Image sealing algorithm identifier. |
| `signature` | `string` | ECDSA P-256 digital signature (Base64) over RFC 8785 canonical JSON (`serializeCanonical`). |
| `key_version` | `string` | Public key identifier in `keys.json` (e.g. `"v1"`, `"v2"`). |
| `signed_at` | `string` | ISO-8601 timestamp with time zone included inside the signed payload to enforce key expiry. |
| `timestamp` | `string` | ISO-8601 timestamp of package creation. |

---

## 8. Retired Keys (Read-Only for Backward Compatibility)

These keys remain declared with `deprecated: true` in `oim.schema.json` so already-published files continue to validate, but **no new writer may emit them**:
- **In `style`:** `textTransform`, `verticalAlign`, `shader_fx`, `blendMode` (closed to 9 values), `grain`/`grainIntensity`/`grainSize`/`grainBlend` (replaced by `style.effects` texture), `textHighlight` (replaced by `style.marks`), `animation.custom_loop_css`/`custom_keyframes`/`custom_hover_css` (retired in 1.9.0).
- **At the root:** `reedicion` (renamed to `reedit` in 1.23.0; mapped by `normalizeLegacyKeys`), `grain` and `effects` (background grain is baked into the base image, 1.12.0), `elements` and `layers` (`slots` is the single canonical name, 1.12.0), `allowed_domains` (retired in 1.7.0), `redirect_membership_verified` and `terms_accepted` (retired in 1.1.0).
- **In the slot:** `p`, `s`, `st`, `c`, `t` (short aliases retired in 1.12.0).

---

## 9. Verification and Conformance

Conformance of any generator or reader with this specification is validated automatically by running the canonical vector suite and JSON Schema agreement tests:

```bash
pnpm conformance
pnpm --filter @oim-media/core test
```
