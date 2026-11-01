# OIM (Open Interactive Media) Canonical Metadata Specification

**Contract version:** 1.13.0  
**Date:** 2026-10-10 (reviewed against `packages/core/src/schema.ts`; the source of truth is the schema, this document summarises it)  
**Status:** Normative / In force  
**License:** Apache-2.0  
**Authority:** Xue Studios LLC & the OIM Architecture Team

---

## 1. Summary and Objectives of the Canonical Specification

The **`.oim`** format defines a multi-platform interactive image specification. The metadata layer (historically called `oimdata` or `oimdata.json`, injected into the `OIM_Data` chunk of the PNG container) uses a **strongly typed, serialisable canonical language**.

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
3. **Determinism and security (zero-trust sandbox):**
   - With no arbitrary CSS injection, attack vectors such as `@import`, covert network requests via `url()`, or breaking out of Shadow DOM isolation are eradicated.

---

4. **Portable or not admitted** (10 Oct 2026): every visual effect is built from primitives that any graphics engine has cheaply — opacity, translation, scale, rotation and rectangular clipping, per unit (letter, word, line or layer). What exists only in a browser (per-letter blur, animated shadows, free `clip-path`) is not admitted, and what is already there is retired or rewritten.

---

## 2. Canonical Layer Types (`slot.type`)

Every interactive element in the `slots` array must declare a canonical type:

| Type (`type`) | Purpose | Canonical Characteristics |
|---|---|---|
| `text` | Dynamic multilingual text | Supports localised `content`, sizes per language (`fontSizes`) and precalculated lines (`textRuns`). |
| `image` | Secondary or embedded bitmap | PNG, WebP or base64 contained in `content`. |
| `lottie` | Lottie vector animation | Embedded vector JSON or local reference (`allow-lottie`). |
| `geo` / `shape` | Pure vector geometry | Governed by `style.geoShape` or `svgRawXml`. |
| `draw` / `svg` | Free vector strokes | Supports standard SVG paths (`svgRawXml`, `customBlobPath`). |
| `artistic-text` | 3D text with parametric extrusion | Vector extrusion (`extrusionDepth`, `extrusionAngle`, `curveAmount`). |
| `pattern` | Repeating procedural pattern | Canonical presets (`clouds`, `bubbles`, `grid`, `waves`, `stars`, etc.). |
| `filter` | Colour adjustment / optical filter layer | Normalised numeric adjustments (`filterBrightness`, `filterContrast`, `filterBlur`). |
| `container` | Bounding box or frame | Supports geometry, fills, borders, shadows and clipping. |
| `group` | Hierarchical container node | Groups child layers via `groupId`. Controls clipping (`overflow`) and global transformations. |
| `component` | Composite component instance | Encapsulated grouping of modular design. |
| `mask` | Clipping or die-cut mask | Clipping by a base shape or multiple vector cutouts (`cuts`). |
| `zone` | Contextual anchor zone | Delimiter for anchoring slots to relative regions of the image. |

---

## 3. Root Structure of the Slot (`slotSchema`)

```typescript
interface OimSlot {
  id: string;                       // Unique identifier (maximum 128 characters)
  name?: string;                     // Name assigned by the author (max 256 chars)
  type?: SlotType;                   // One of the canonical types in section 2
  languages?: string[];              // Languages in which it is shown (default: ["*"])
  pendingTranslation?: string[];     // Language codes pending translation
  align?: "left" | "center" | "right";
  position?: [number, number];       // Normalised coordinates [x, y] (percentage 0.0 to 100.0%)
  width_px?: number;                 // Virtual width in reference pixels
  height_px?: number;                // Virtual height in reference pixels
  content?: Record<string, string>;  // Language -> content dictionary (e.g. { "en": "Text" })
  style?: OimStyle;                  // Canonical style object (see section 4)
  parallax?: OimParallax;            // Parallax configuration (see section 5)
  interaction?: OimInteraction;      // Declared interactions
  tracking_data?: number[][];        // Tracking keyframes [time, x1..y4, cx, cy]
  zone_id?: string;                  // ID of the containing zone
}
```

---

## 4. Canonical Style Contract (`styleSchema`)

### 4.1. Typography and Text
- `fontFamily`: String with the font name (max 128 chars).
- `fontSize`: Pure number or container percentage (e.g. `24` or `"4.5cqw"`).
- `fontWeight`: **Always numeric** (`100` to `900`, `400` = normal, `700` = bold).
- `fontStyle`: `"normal" | "italic" | "oblique"`.
- `textDecoration`: `"none" | "underline"`.
- `textTransform`: `"none" | "uppercase" | "lowercase" | "capitalize"`.
- `textAlign`: `"left" | "center" | "right" | "justify"`.
- `lineHeight`: Numeric multiplier factor (e.g. `1.2`, `1.5`) or a bounded string.
- `fontSizes`: Map of size specific to each language `{ "es": "24px", "ja": "20px" }`.
- **Text marks (1.11.0, `text_marks` capability):** `content` can wrap phrases in `{name}…{/name}`; literal braces are doubled (`{{`, `}}`). `style.marks` defines each mark with a closed set (`color`/`colorRole`, `bold`, `italic`, `underline`, `highlight{style, color, colorRole, paddingX, paddingY, borderRadius}`). Names `^[a-z][a-z0-9-]{0,23}$`, maximum 8 per layer, not nested. A single interpretation: `parseMarks`, `markStyle` (`@oim-media/core`). The backend does not sign malformed tags (`OIM_E_TEXT_MARKS_INVALID`).
- `dropCap` (drop cap): `{ enabled, lines: 2|3, fontFamily?, color?, marginRight? }`. Size is set with `dropCapStyle`; the rest of the text keeps its marks (`splitDropCap`).
- `textHighlight`: **retired** (10 Oct 2026). It highlighted all the text; today it is a mark that covers it. It is still read for files already published; it is not written.
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

### 4.2. Colours and Fill (`cssColor`)
Colours are validated against the strict `cssColor` pattern (hexadecimal `#RGB` / `#RRGGBB` / `#RRGGBBAA`, functions `rgb()`, `hsl()`, `"transparent"`, `"none"`, or dynamic colour tokens `var(--primary)`):
- `fillColor`: Main fill colour (or glyph colour in text layers).
- `fillType`: `"none" | "color" | "gradient" | "pattern" | "generative"`.
- `colorRole` / `fillColorRole`: Semantic dynamic theme role (`"primary" | "secondary" | "accent" | "surface" | "text" | "background" | "panel"`).
- `fillGradient`: Canonical linear, radial or conic gradient function.
- `fillPatternType`: Repeating pattern preset:
  `"clouds" | "bubbles" | "grid" | "waves" | "stars" | "stripes" | "dots" | "zigzags" | "bolt" | "leaf" | "drop" | "moon" | "crown" | "heart"`.
- `fillGenerative`: Algorithmic procedural fill:
  ```typescript
  {
    generatorId: string;           // Identifier of the generative algorithm
    seed: number;                  // Deterministic seed
    params: Record<string, any>;   // Numeric or boolean parameters
    colors: {
      mode: "monochrome" | "palette";
      stops: string[];             // Array of cssColor colours
      direction: "forward" | "reverse" | "radial";
      background: string;
      backgroundVisible: boolean;
    }
  }
  ```

### 4.3. Shapes, Strokes and Borders
- `geoShape`: `"rectangle" | "circle" | "triangle" | "star" | "line" | "arrow" | "diamond" | "hexagon" | "heart" | "blob" | "scribble" | "custom"`.
- `strokeColor`: Colour of the border or stroke.
- `strokeWidth`: Stroke thickness in canvas units (minimum 0).
- `strokeStyle`: `"solid" | "dashed" | "dotted"`.
- `borderRadius`: Uniform numeric radius or four-value spatial form (e.g. `8` or `"0 8 8 0"`).

### 4.4. Shadows, Blurs and Blending
- `shadowEnabled`: `boolean`.
- `shadowColor`: Shadow colour.
- `shadowBlur`: Shadow blur radius (0 to 200).
- `shadowOffsetX` / `shadowOffsetY`: Cartesian offset (-500 to 500).
- `shadowOpacity`: Shadow opacity (0 to 100%).
- `layerBlur`: Layer blur (0 to 100).
- `blendMode`: Compositing mode (`"normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten"`).

### 4.5. Analogue Grain Texture (`grain`)
A procedural analogue effect built in per layer or globally:
- `grain`: `boolean` (enables the texture on the layer).
- `grainIntensity`: Intensity (1 to 100).
- `grainSize`: Grain size/frequency (1 finer, 100 coarser).
- `grainBlend`: Blend mode (`"overlay" | "soft-light" | "multiply"`).

### 4.6. Artistic Text and 3D Relief (`artistic-text`)
- `artisticPreset`: `"neon-cyberpunk" | "retro-wave-3d" | "comic-pop-extrusion" | "vintage-emboss" | "chrome-metallic" | "arcade-80s" | "custom"`.
- `extrusionDepth`: Geometric extrusion depth (0 to 100).
- `extrusionAngle`: Projection angle in degrees (0 to 360).
- `extrusionColor`: Colour of the extrusion volume.
- `extrusionShading`: Volumetric facet shading (`boolean`).
- `curveAmount`: Text curvature (-100 to 100).
- `curveType`: Curvature geometry (`"arc" | "wave" | "arch"`).

### 4.7. Animations and Keyframes (`animation`)
- `animation.loop`: Loop preset (`"none" | "pulse" | "float" | "bounce" | "spin" | "glow" | "custom"`).
- `animation.hover`: Cursor preset (`"none" | "grow" | "shrink" | "lift" | "glow" | "custom"`).
- `animation.duration`: Duration in seconds (0.1 to 20).
- `animation.delay`: Initial delay in seconds (0 to 10).
- `animation.keyframes`: Structured array of keyframes (`keyframeSchema`):
  ```typescript
  interface OimKeyframe {
    t: number;                      // Normalised time (0 to 60 seconds)
    o?: number;                     // Opacity (0.0 to 2.0, allows elastic overshoot)
    s?: number;                     // Scale multiplier (0.0 to 10.0)
    r?: number;                     // Rotation in degrees (-3600 to 3600)
    x?: number;                     // X displacement in canvas coordinates
    y?: number;                     // Y displacement in canvas coordinates
    b?: number;                     // Blur (0 to 50)
    e?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "steps(1, end)" | [number, number, number, number]; // Bezier curve
  }
  ```
- `textAnimationType`: `"none" | "typewriter" | "wave-chars" | "glitch-cyberpunk" | "glitch-slice" | "fade-chars" | "slide-up" | "bounce-chars" | "reveal-mask" | "scale-in" | "rise-words" | "blur-chars"`, with `textAnimationSpeed` (0–200), `textAnimationDelay` (0–100), `textAnimationIntensity` (0–100) and `typewriterCursor`.
  - `fade-chars`, `slide-up`, `bounce-chars` and, since 1.13.0, `reveal-mask`, `scale-in` and `rise-words` are entrance effects defined as data in `@oim-media/core` (`text-effects.ts`): opacity, offset in em, scale, rotation and, in `reveal-mask`, a rectangular per-word clip.
  - `blur-chars` is **retired** (not portable): it still validates, and readers draw the text without animation.
  - `glitch-*` is under review to move to portable primitives (see the 10 Oct audit).

---

## 5. Canonical Parallax (`parallaxSchema`)

Configuration for layers with spatial depth and reactive displacement:

```typescript
interface OimParallax {
  enabled: boolean;                 // Default: true
  depth: number;                    // Focal depth (-2.0 to 2.0)
  mode: "mouse" | "scroll" | "infinite_horizontal";
  axis: "both" | "x_only" | "y_only";
  infinite?: {
    speed_px_sec: number;           // Continuous advance speed (-500 to 500 px/s)
    direction: "left_to_right" | "right_to_left";
    seamless_tile: boolean;         // Continuous tiling without a cut
    pause_on_hover: boolean;        // Pause when the cursor rests on it or on touch
  };
}
```

---

## 6. Interactivity and State Machine (`isInteractive`, `states`)

Allows declaring interactivity without writing JavaScript:

```typescript
interface OimInteractiveStates {
  hover?: OimStateConfig;           // State when the cursor rests on it or a touch is held
  active?: OimStateConfig;          // State when clicked or tapped
}

interface OimStateConfig {
  scale?: number;                   // Percentage scale (0 to 1000%, e.g. 105 = 105%)
  rotation?: number;                // Rotation (-360 to 360 degrees)
  opacity?: number;                 // Percentage opacity (0 to 100%)
  transitionDuration?: number;      // Transition time in ms (0 to 10000)
  actions?: OimStateAction[];       // Chained actions on other layers
}

interface OimStateAction {
  target: string;                   // ID of the target slot
  type: "show" | "hide" | "toggle" | "setText";
  value?: string;                   // Value to apply (e.g. new text if type is setText)
}
```

---

## 7. Root Document Metadata (`OimMetadataSchema`)

Top-level structure carried in the `OIM_Data` payload:

| Key | Type | Description |
|---|---|---|
| `oim` | `string` | Format version of the document (e.g. `"1.13.0"`), the contract version the backend signs against. The minimum version needed to read it is given by `min_player`. |
| `min_player` | `string` | Minimum player version required to play the document. |
| `name` | `string` | Official title of the work. |
| `reedicion` | `"publico" \| "solo_autor" \| "sellado"` | Authorised cryptographic re-edit policy. |
| `canvas` | `{ natural_width: number, natural_height: number }` | Base reference dimensions of the canvas. |
| `lang` | `string[]` | Catalogue of language codes present (e.g. `["es", "en", "ja"]`). |
| `slots` | `OimSlot[]` | Array of interactive layers (maximum `MAX_SLOTS` = 150). `elements` and `layers` are accepted synonyms when reading; no official writer emits them. |
| `capabilities` | `("vector_parallax" \| "infinite_parallax" \| "text_marks")[]` | Advanced capabilities used. |
| `capabilities_required` | same as `capabilities` | Those the reader **must** implement to paint with fidelity (glTF pattern). |
| `fonts` | `EmbeddedFont[]` | WOFF2 font files embedded in base64 for offline rendering. |
| `grain` | `GrainConfig` | Global grain texture for the whole canvas. |
| `image_hash` | `string` | SHA-256 hash of the base image bytes (`IDAT` chunks). |
| `image_hash_alg` | `string` | Sealing algorithm (e.g. `"sha256-idat"`). |
| `signature` | `string` | ECDSA P-256 asymmetric digital signature (Base64). |
| `signed_at` | `string` | ISO-8601 timestamp with time zone of the signature. |

---

## 8. Retired in 1.12.0 (audit of 10 Oct 2026)

They still validate; no new writer may emit them:
- **In `style`:** `textTransform`, `verticalAlign`, `shader_fx`, `blendMode` (closed to 9 values), `grain`/`grainIntensity`/`grainSize`/`grainBlend` (they become a texture in `style.effects`).
- **At the root:** `grain` and `effects` (background grain is baked in), `elements` and `layers` (the only name is `slots`).
- **In the slot:** `p`, `s`, `st`, `c`, `t` (short aliases; readers no longer read them).

In addition, the backend writes `oim` with the format version (previously `"true"`) and no longer writes `version: "5.3"` or `allowed_domains`. A layer's texture is painted over its own pixels (`layerTextureMask`).

## 9. Verification and Conformance

Conformance of any generator or reader with this specification is validated automatically by running the canonical vector suite:

```bash
pnpm --filter @oim-media/core exec vitest run conformance
```
