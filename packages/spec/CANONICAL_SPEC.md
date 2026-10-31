# Especificación Canónica de Metadatos OIM (Open Interactive Media)

**Versión del Contrato:** 1.13.0  
**Fecha:** 2026-10-10 (revisado contra `packages/core/src/schema.ts`; la fuente de verdad es el esquema, este documento lo resume)  
**Estado:** Normativo / Vigente  
**Licencia:** Apache-2.0  
**Autoridad:** Xue Studios LLC & Equipo de Arquitectura OIM

---

## 1. Resumen y Objetivos de la Especificación Canónica

El formato **`.oim`** define una especificación de imagen interactiva multiplataforma. La capa de metadatos (denominada históricamente `oimdata` o `oimdata.json`, inyectada en el chunk `OIM_Data` del contenedor PNG) utiliza un **lenguaje canónico fuertemente tipado y serializable**.

### Principios del Diseño Canónico

1. **Independencia Total de Motores Web (Plataformas Nativas):**
   - El formato **prohíbe el CSS libre o arbitrario** (`custom_loop_css`, `custom_keyframes`, cadenas de estilo libres).
   - Todo atributo visual o dinámico está parametrizado en tipos canónicos (números, enums, tuplas o arrays). Esto permite que implementaciones nativas en **iOS (SwiftUI / Core Animation)**, **Android (Jetpack Compose / RenderNode)**, **Desktop (Rust / Tauri / Skia)** o Web Components puedan pintar e interactuar con fidelidad 1:1 sin requerir un navegador web incrustado.
2. **Un Solo Nombre por Concepto (Cero Ambigüedad):**
   - El compilador canonicaliza atajos y nombres duplicados antes de firmar:
     - `size` ➔ `fontSize`
     - `font` ➔ `fontFamily`
     - `color` ➔ `fillColor`
     - `bold: true` ➔ `fontWeight: 700`
     - `italic: true` ➔ `fontStyle: "italic"`
     - `underline: true` ➔ `textDecoration: "underline"`
     - `fontSizeOverrides` ➔ unificado dentro del mapa `fontSizes`.
3. **Determinismo y Seguridad (Sandbox Zero-Trust):**
   - Sin inyección de CSS arbitrario, se erradican vectores de ataque como `@import`, peticiones de red encubiertas vía `url()`, o rupturas del aislamiento de Shadow DOM.

---

4. **Portable o no entra** (10 oct 2026): todo efecto visual se construye con primitivas que cualquier motor gráfico tiene baratas —opacidad, traslación, escala, rotación y recorte rectangular, por unidad (letra, palabra, línea o capa)—. Lo que solo existe en un navegador (desenfoque por letra, sombras animadas, `clip-path` libres) no entra, y lo que ya está se retira o se reescribe.

---

## 2. Tipos Canónicos de Capa (`slot.type`)

Todo elemento interactivo dentro del array `slots` declara obligatoriamente un tipo canónico:

| Tipo (`type`) | Propósito | Características Canónicas |
|---|---|---|
| `text` | Texto dinámico multilingüe | Soporta `content` localizado, tamaños por idioma (`fontSizes`) y líneas precalculadas (`textRuns`). |
| `image` | Mapa de bits secundario o incrustado | PNG, WebP o base64 contenido en `content`. |
| `lottie` | Animación vectorial Lottie | JSON vectorial embebido o referencia local (`allow-lottie`). |
| `geo` / `shape` | Geometría vectorial pura | Regulada por `style.geoShape` o `svgRawXml`. |
| `draw` / `svg` | Trazos vectoriales libres | Soporta paths SVG estándar (`svgRawXml`, `customBlobPath`). |
| `artistic-text` | Texto 3D con extrusión paramétrica | Extrusión vectorial (`extrusionDepth`, `extrusionAngle`, `curveAmount`). |
| `pattern` | Patrón repetitivo procedural | Presets canónicos (`clouds`, `bubbles`, `grid`, `waves`, `stars`, etc.). |
| `filter` | Capa de ajuste de color / filtro óptico | Ajustes numéricos normalizados (`filterBrightness`, `filterContrast`, `filterBlur`). |
| `container` | Caja o marco delimitador | Soporta geometría, rellenos, bordes, sombras y clipping. |
| `group` | Nodo jerárquico contenedor | Agrupa capas hijas vía `groupId`. Controla el recorte (`overflow`) y transformaciones globales. |
| `component` | Instancia de componente compuesto | Agrupación encapsulada de diseño modular. |
| `mask` | Máscara de recorte o troquelado | Recorte por forma base o troqueles vectoriales múltiples (`cuts`). |
| `zone` | Zona de anclaje contextual | Delimitador para anclar slots a regiones relativas de la imagen. |

---

## 3. Estructura Raíz del Slot (`slotSchema`)

```typescript
interface OimSlot {
  id: string;                       // Identificador único (máximo 128 caracteres)
  name?: string;                     // Nombre asignado por el autor (máx 256 chars)
  type?: SlotType;                   // Uno de los tipos canónicos de la sección 2
  languages?: string[];              // Idiomas en los que se muestra (default: ["*"])
  pendingTranslation?: string[];     // Códigos de idioma pendientes de traducción
  align?: "left" | "center" | "right";
  position?: [number, number];       // Coordenadas normalizadas [x, y] (porcentaje 0.0 a 100.0%)
  width_px?: number;                 // Ancho virtual en píxeles de referencia
  height_px?: number;                // Alto virtual en píxeles de referencia
  content?: Record<string, string>;  // Diccionario de idioma -> contenido (ej: { "es": "Texto" })
  style?: OimStyle;                  // Objeto de estilo canónico (ver sección 4)
  parallax?: OimParallax;            // Configuración de parallax (ver sección 5)
  interaction?: OimInteraction;      // Interacciones declaradas
  tracking_data?: number[][];        // Keyframes de tracking [tiempo, x1..y4, cx, cy]
  zone_id?: string;                  // ID de la zona contenedora
}
```

---

## 4. Contrato de Estilo Canónico (`styleSchema`)

### 4.1. Tipografía y Texto
- `fontFamily`: Cadena con el nombre de la fuente (máx 128 chars).
- `fontSize`: Número puro o porcentaje contenedor (ej: `24` o `"4.5cqw"`).
- `fontWeight`: **Siempre numérico** (`100` a `900`, `400` = normal, `700` = bold).
- `fontStyle`: `"normal" | "italic" | "oblique"`.
- `textDecoration`: `"none" | "underline"`.
- `textTransform`: `"none" | "uppercase" | "lowercase" | "capitalize"`.
- `textAlign`: `"left" | "center" | "right" | "justify"`.
- `lineHeight`: Factor multiplicador numérico (ej: `1.2`, `1.5`) o cadena acotada.
- `fontSizes`: Mapa de tamaños específicos por idioma `{ "es": "24px", "ja": "20px" }`.
- **Marcas de texto (1.11.0, capacidad `text_marks`):** `content` puede envolver frases en `{nombre}…{/nombre}`; las llaves literales van dobladas (`{{`, `}}`). `style.marks` define cada marca con un conjunto cerrado (`color`/`colorRole`, `bold`, `italic`, `underline`, `highlight{style, color, colorRole, paddingX, paddingY, borderRadius}`). Nombres `^[a-z][a-z0-9-]{0,23}$`, máximo 8 por capa, sin anidar. Una sola interpretación: `parseMarks`, `markStyle` (`@oim-media/core`). El backend no firma etiquetas mal formadas (`OIM_E_TEXT_MARKS_INVALID`).
- `dropCap` (capitular): `{ enabled, lines: 2|3, fontFamily?, color?, marginRight? }`. Tamaño con `dropCapStyle`; el resto del texto conserva sus marcas (`splitDropCap`).
- `textHighlight`: **retirado** (10 oct 2026). Resaltaba todo el texto; hoy es una marca que lo cubre. Se sigue leyendo para archivos ya publicados; no se escribe.
- `textRuns`: **Líneas precalculadas** para renderizadores nativos (iOS/Android/Desktop) que carecen de motor complejo de maquetación de párrafos:
  ```json
  "textRuns": {
    "es": {
      "fontSize": 24,
      "lineHeight": 28,
      "lines": [
        { "text": "Primera línea de texto", "width": 280, "yOffset": 0 },
        { "text": "Segunda línea ajustada", "width": 260, "yOffset": 28 }
      ]
    }
  }
  ```

### 4.2. Colores y Relleno (`cssColor`)
Los colores se validan bajo el patrón estricto `cssColor` (Hexadecimal `#RGB` / `#RRGGBB` / `#RRGGBBAA`, funciones `rgb()`, `hsl()`, `"transparent"`, `"none"`, o tokens de color dinámico `var(--primary)`):
- `fillColor`: Color principal de relleno (o color de glifo en capas de texto).
- `fillType`: `"none" | "color" | "gradient" | "pattern" | "generative"`.
- `colorRole` / `fillColorRole`: Rol semántico de tema dinámico (`"primary" | "secondary" | "accent" | "surface" | "text" | "background" | "panel"`).
- `fillGradient`: Función canónica de gradiente lineal, radial o cónico.
- `fillPatternType`: Preset de patrón repetitivo:
  `"clouds" | "bubbles" | "grid" | "waves" | "stars" | "stripes" | "dots" | "zigzags" | "bolt" | "leaf" | "drop" | "moon" | "crown" | "heart"`.
- `fillGenerative`: Relleno procedural algorítmico:
  ```typescript
  {
    generatorId: string;           // Identificador del algoritmo generativo
    seed: number;                  // Semilla determinista
    params: Record<string, any>;   // Parámetros numéricos o booleanos
    colors: {
      mode: "monochrome" | "palette";
      stops: string[];             // Array de colores cssColor
      direction: "forward" | "reverse" | "radial";
      background: string;
      backgroundVisible: boolean;
    }
  }
  ```

### 4.3. Formas, Trazos y Bordes
- `geoShape`: `"rectangle" | "circle" | "triangle" | "star" | "line" | "arrow" | "diamond" | "hexagon" | "heart" | "blob" | "scribble" | "custom"`.
- `strokeColor`: Color del borde o trazo.
- `strokeWidth`: Grosor del trazo en unidades de lienzo (mínimo 0).
- `strokeStyle`: `"solid" | "dashed" | "dotted"`.
- `borderRadius`: Radio uniforme numérico o cuádruple espacial (ej: `8` o `"0 8 8 0"`).

### 4.4. Sombras, Desenfoques y Mezcla
- `shadowEnabled`: `boolean`.
- `shadowColor`: Color de la sombra.
- `shadowBlur`: Radio de desenfoque de la sombra (0 a 200).
- `shadowOffsetX` / `shadowOffsetY`: Desplazamiento cartesiano (-500 a 500).
- `shadowOpacity`: Opacidad de la sombra (0 a 100%).
- `layerBlur`: Desenfoque de la capa (0 a 100).
- `blendMode`: Modo de composición (`"normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten"`).

### 4.5. Textura de Grano Analógico (`grain`)
Efecto analógico procedural fffuel integrado por capa o global:
- `grain`: `boolean` (activa la textura en la capa).
- `grainIntensity`: Intensidad (1 a 100).
- `grainSize`: Tamaño/frecuencia del grano (1 más fino, 100 más grueso).
- `grainBlend`: Modo de mezcla (`"overlay" | "soft-light" | "multiply"`).

### 4.6. Texto Artístico y Relieve 3D (`artistic-text`)
- `artisticPreset`: `"neon-cyberpunk" | "retro-wave-3d" | "comic-pop-extrusion" | "vintage-emboss" | "chrome-metallic" | "arcade-80s" | "custom"`.
- `extrusionDepth`: Profundidad de extrusión geométrica (0 a 100).
- `extrusionAngle`: Ángulo de proyección en grados (0 a 360).
- `extrusionColor`: Color del volumen de extrusión.
- `extrusionShading`: Sombreado volumétrico de facetas (`boolean`).
- `curveAmount`: Curvatura del texto (-100 a 100).
- `curveType`: Geometría de curvatura (`"arc" | "wave" | "arch"`).

### 4.7. Animaciones y Fotogramas Clave (`animation`)
- `animation.loop`: Preset de bucle (`"none" | "pulse" | "float" | "bounce" | "spin" | "glow" | "custom"`).
- `animation.hover`: Preset de cursor (`"none" | "grow" | "shrink" | "lift" | "glow" | "custom"`).
- `animation.duration`: Duración en segundos (0.1 a 20).
- `animation.delay`: Retardo inicial en segundos (0 a 10).
- `animation.keyframes`: Array estructurado de fotogramas clave (`keyframeSchema`):
  ```typescript
  interface OimKeyframe {
    t: number;                      // Tiempo normalizado (0 a 60 segundos)
    o?: number;                     // Opacidad (0.0 a 2.0, permite rebasamiento elástico)
    s?: number;                     // Escala multiplicadora (0.0 a 10.0)
    r?: number;                     // Rotación en grados (-3600 a 3600)
    x?: number;                     // Desplazamiento X en coordenadas de lienzo
    y?: number;                     // Desplazamiento Y en coordenadas de lienzo
    b?: number;                     // Desenfoque (0 a 50)
    e?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "steps(1, end)" | [number, number, number, number]; // Curva bezier
  }
  ```
- `textAnimationType`: `"none" | "typewriter" | "wave-chars" | "glitch-cyberpunk" | "glitch-slice" | "fade-chars" | "slide-up" | "bounce-chars" | "reveal-mask" | "scale-in" | "rise-words" | "blur-chars"`, con `textAnimationSpeed` (0–200), `textAnimationDelay` (0–100), `textAnimationIntensity` (0–100) y `typewriterCursor`.
  - `fade-chars`, `slide-up`, `bounce-chars` y, desde 1.13.0, `reveal-mask`, `scale-in` y `rise-words` son efectos de entrada definidos como datos en `@oim-media/core` (`text-effects.ts`): opacidad, desplazamiento en em, escala, rotación y, en `reveal-mask`, un recorte rectangular por palabra.
  - `blur-chars` está **retirado** (no portable): sigue validando, los lectores dibujan el texto quieto.
  - `glitch-*` está en revisión para pasar a primitivas portables (ver la auditoría del 10 oct).

---

## 5. Parallax Canónico (`parallaxSchema`)

Configuración de capas con profundidad espacial y desplazamiento reactivo:

```typescript
interface OimParallax {
  enabled: boolean;                 // Default: true
  depth: number;                    // Profundidad focal (-2.0 a 2.0)
  mode: "mouse" | "scroll" | "infinite_horizontal";
  axis: "both" | "x_only" | "y_only";
  infinite?: {
    speed_px_sec: number;           // Velocidad de avance continuo (-500 a 500 px/s)
    direction: "left_to_right" | "right_to_left";
    seamless_tile: boolean;         // Mosaico continuo sin corte
    pause_on_hover: boolean;        // Pausa al posar cursor o tocar
  };
}
```

---

## 6. Interactividad y Máquina de Estados (`isInteractive`, `states`)

Permite declarar interactividad sin escribir código JavaScript:

```typescript
interface OimInteractiveStates {
  hover?: OimStateConfig;           // Estado al posar cursor o mantener toque
  active?: OimStateConfig;          // Estado al hacer clic o tap
}

interface OimStateConfig {
  scale?: number;                   // Escala porcentual (0 a 1000%, ej. 105 = 105%)
  rotation?: number;                // Rotación (-360 a 360 grados)
  opacity?: number;                 // Opacidad porcentual (0 a 100%)
  transitionDuration?: number;       // Tiempo de transición en ms (0 a 10000)
  actions?: OimStateAction[];       // Acciones encadenadas sobre otras capas
}

interface OimStateAction {
  target: string;                   // ID del slot objetivo
  type: "show" | "hide" | "toggle" | "setText";
  value?: string;                   // Valor a aplicar (ej. nuevo texto si type es setText)
}
```

---

## 7. Metadatos Raíz del Documento (`OimMetadataSchema`)

Estructura de nivel superior transportada en el payload `OIM_Data`:

| Clave | Tipo | Descripción |
|---|---|---|
| `oim` | `string` | Versión del formato del documento (ej. `"1.13.0"`), la del contrato con el que firma el backend. La versión mínima para leerlo la da `min_player`. |
| `min_player` | `string` | Versión mínima de player requerida para reproducir el documento. |
| `name` | `string` | Título oficial de la obra. |
| `reedicion` | `"publico" \| "solo_autor" \| "sellado"` | Política criptográfica de reedición autorizada. |
| `canvas` | `{ natural_width: number, natural_height: number }` | Dimensiones base de referencia del lienzo. |
| `lang` | `string[]` | Catálogo de códigos de idioma presentes (ej. `["es", "en", "ja"]`). |
| `slots` | `OimSlot[]` | Array de capas interactivas (máximo `MAX_SLOTS` = 150). `elements` y `layers` son sinónimos aceptados al leer; ningún escritor oficial los emite. |
| `capabilities` | `("vector_parallax" \| "infinite_parallax" \| "text_marks")[]` | Capacidades avanzadas utilizadas. |
| `capabilities_required` | igual que `capabilities` | Las que el lector **debe** implementar para pintar con fidelidad (patrón glTF). |
| `fonts` | `EmbeddedFont[]` | Fuentes tipográficas WOFF2 embebidas en base64 para render offline. |
| `grain` | `GrainConfig` | Textura de grano global para el lienzo completo. |
| `image_hash` | `string` | Hash SHA-256 de los bytes de imagen base (chunks `IDAT`). |
| `image_hash_alg` | `string` | Algoritmo de sellado (ej. `"sha256-idat"`). |
| `signature` | `string` | Firma digital asimétrica ECDSA P-256 (Base64). |
| `signed_at` | `string` | Marca temporal ISO-8601 con zona horaria de la firma. |

---

## 8. Retirado en 1.12.0 (auditoría del 10 oct 2026)

Siguen validando, ningún escritor nuevo debe emitirlos:
- **En `style`:** `textTransform`, `verticalAlign`, `shader_fx`, `blendMode` (cerrado a 9 valores), `grain`/`grainIntensity`/`grainSize`/`grainBlend` (pasan a ser una textura en `style.effects`).
- **En la raíz:** `grain` y `effects` (el grano del fondo va horneado), `elements` y `layers` (el único nombre es `slots`).
- **En el slot:** `p`, `s`, `st`, `c`, `t` (alias cortos; los lectores ya no los leen).

Además, el backend escribe `oim` con la versión del formato (antes `"true"`) y ya no escribe `version: "5.3"` ni `allowed_domains`. La textura de una capa se pinta sobre sus propios píxeles (`layerTextureMask`).

## 9. Verificación y Conformidad

La conformidad de cualquier generador o lector con esta especificación se valida automáticamente ejecutando la suite de vectores canónicos:

```bash
pnpm --filter @oim-media/core exec vitest run conformance
```
