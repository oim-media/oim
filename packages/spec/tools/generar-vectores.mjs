/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Genera la matriz canónica de 20 vectores de conformidad con la TUBERIA REAL.
 *
 * `/v1/oim/compile` normaliza los slots a `cqw` y `/v1/oim/package` sanea,
 * firma y empotra. Producirlos a mano habria dado ficheros que se parecen a un
 * .oim; producirlos asi da .oim de verdad, con su firma valida y su saneado
 * aplicado — que es justo lo que un segundo lector tiene que saber leer.
 *
 * La imagen base se reutiliza de un vector existente y pesa unos 3 KB. Los
 * .oim publicados pesan megabytes porque llevan su lienzo rasterizado dentro;
 * una suite de conformidad no puede pesar eso, y la imagen no es lo que se
 * comprueba.
 *
 *   node tools/generar-vectores.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractOIM } from "../../core/dist/binary.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const VECTORES = join(AQUI, "..", "vectors");
const API = process.env.OIM_API || "https://api.oim.media";
// /v1/oim/package requires a key: signing is for keyed callers only.
const CLAVE = process.env.OIM_API_KEY;
if (!CLAVE) {
  console.error("OIM_API_KEY is required to sign vectors");
  process.exit(1);
}

/** Los vectores que no genera este guion —vienen de una exportacion real—. */
const DESCRIPCIONES = {
  "interactive": "Un boton con accion de clic, esquinas por lado y dos idiomas. Exportado desde el editor, no generado aqui.",
};

const CASOS = [
  {
    nombre: "frame-shapes",
    descripcion: "Formas de marco (contrato 1.19.0): una nube con foto, un trazado SVG propio con foto (viewBox 24) y una estrella con la foto volteada.",
    canvas: [800, 600],
    slots: [
      {
        id: "marco-nube", name: "Marco nube", type: "geo",
        x_px: 80, y_px: 150, width_px: 280, height_px: 280,
        content: { es: "" },
        style: { geoShape: "cloud", fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", fillColor: "#d4d4d8" },
      },
      {
        id: "marco-svg", name: "Marco SVG propio", type: "geo",
        x_px: 440, y_px: 150, width_px: 280, height_px: 280,
        content: { es: "" },
        style: { fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", svgPath: "M12 2L22 22H2Z", svgViewBox: "0 0 24 24", fillColor: "#d4d4d8" },
      },
      {
        id: "marco-estrella", name: "Marco estrella volteado", type: "geo",
        x_px: 80, y_px: 380, width_px: 200, height_px: 200,
        content: { es: "" },
        style: { geoShape: "star", fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", fillImageFlipX: true, fillColor: "#d4d4d8" },
      },
    ],
  },
  {
    nombre: "media-filters",
    descripcion: "Filtros de medios (contrato 1.18.0): una foto en blanco y negro y un marco circular con desenfoque y trazo; el filtro solo toca la foto.",
    canvas: [800, 600],
    slots: [
      {
        id: "foto-bn", name: "Foto en blanco y negro", type: "image",
        x_px: 80, y_px: 150, width_px: 300, height_px: 200,
        content: { "*": "https://cdn.oim.media/demos/crop.png" },
        style: { objectFit: "cover", filterPreset: "grayscale" },
      },
      {
        id: "marco-blur", name: "Marco con desenfoque", type: "geo",
        x_px: 440, y_px: 150, width_px: 280, height_px: 280,
        content: { es: "" },
        style: { geoType: "circle", fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", fillColor: "#d4d4d8", filterBlur: 6, borderWidth: 4, borderColor: "#111111" },
      },
    ],
  },
  {
    nombre: "image-fill",
    descripcion: "Relleno de imagen (contrato 1.17.0): un circulo y una estrella rellenos con una foto incrustada, uno con `fillImageCrop`.",
    canvas: [800, 600],
    slots: [
      {
        id: "marco-circulo", name: "Marco circulo", type: "geo",
        x_px: 80, y_px: 150, width_px: 280, height_px: 280,
        content: { es: "" },
        style: { geoType: "circle", fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", fillColor: "#d4d4d8" },
      },
      {
        id: "marco-estrella", name: "Marco estrella", type: "geo",
        x_px: 440, y_px: 150, width_px: 280, height_px: 280,
        content: { es: "" },
        style: { geoType: "star", fillType: "image", fillImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGN4nh8IRwzEcQC5Ehpxr683xgAAAABJRU5ErkJggg==", fillImageCrop: { x: 20, y: 70, zoom: 2 }, fillColor: "#d4d4d8" },
      },
    ],
  },
  {
    nombre: "accessibility",
    descripcion: "Accesibilidad (contrato 1.16.0): `description` de la obra, `alt` por idioma en una imagen y `decorative` en una forma.",
    canvas: [800, 600],
    description: { es: "Cartel de prueba con una foto descrita", en: "Test poster with a described photo" },
    slots: [
      {
        id: "titulo", name: "Titulo", type: "text",
        x_px: 80, y_px: 40, width_px: 500, height_px: 80, font_size_px: 40,
        content: { es: "Hola", en: "Hello" },
        style: {},
      },
      {
        id: "foto", name: "Foto", type: "image",
        x_px: 100, y_px: 160, width_px: 300, height_px: 200,
        content: { "*": "https://cdn.oim.media/demos/crop.png" },
        style: { objectFit: "cover", alt: { es: "Un fiordo entre montañas", en: "A fjord between mountains" } },
      },
      {
        id: "adorno", name: "Adorno", type: "geo",
        x_px: 520, y_px: 160, width_px: 200, height_px: 200,
        content: { es: "" },
        style: { geoType: "circle", fillColor: "#264653", decorative: true },
      },
    ],
  },
  {
    nombre: "crop",
    descripcion: "Recorte de imagen (contrato 1.15.0): `imageCrop` encuadra sobre «cubrir» en x 20 %, y 70 % y zoom 2.",
    canvas: [800, 600],
    slots: [
      {
        id: "foto", name: "Foto", type: "image",
        x_px: 100, y_px: 100, width_px: 300, height_px: 200,
        content: { "*": "https://cdn.oim.media/demos/crop.png" },
        style: { objectFit: "cover", imageCrop: { x: 20, y: 70, zoom: 2 } },
      },
    ],
  },
  {
    nombre: "flip",
    descripcion: "Volteo de capa (contrato 1.14.0): `flipX` en una forma y `flipY` en otra rotada; se voltea en sus propios ejes.",
    canvas: [800, 600],
    slots: [
      {
        id: "horizontal", name: "Horizontal", type: "geo",
        x_px: 80, y_px: 150, width_px: 280, height_px: 180,
        content: { es: "" },
        style: { geoType: "triangle", fillColor: "#e76f51", flipX: true },
      },
      {
        id: "vertical", name: "Vertical", type: "geo",
        x_px: 440, y_px: 150, width_px: 280, height_px: 180,
        content: { es: "" },
        style: { geoType: "triangle", fillColor: "#264653", flipY: true, rotation: 20 },
      },
    ],
  },
  {
    nombre: "layer-blur",
    descripcion: "Desenfoque de capa: `layerBlur` en el estilo de un texto y de una forma.",
    canvas: [800, 600],
    slots: [
      {
        id: "titulo", name: "Titulo", type: "text",
        x_px: 80, y_px: 60, width_px: 400, height_px: 90, font_size_px: 40,
        content: { es: "Borroso", en: "Blurred" },
        style: { layerBlur: 4 },
      },
      {
        id: "fondo", name: "Fondo", type: "geo",
        x_px: 400, y_px: 200, width_px: 300, height_px: 300,
        content: { es: "" },
        style: { geoType: "circle", fillColor: "#3366cc", layerBlur: 12 },
      },
    ],
  },
  {
    nombre: "layer-grain",
    descripcion: "Grano por capa (contrato 1.10.0): intensidad, tamaño y mezcla en el estilo de un texto y de una forma.",
    canvas: [800, 600],
    slots: [
      {
        id: "titulo", name: "Titulo", type: "text",
        x_px: 80, y_px: 60, width_px: 400, height_px: 90, font_size_px: 40,
        content: { es: "Grano", en: "Grain" },
        style: { grain: true, grainIntensity: 30, grainSize: 70, grainBlend: "soft-light" },
      },
      {
        id: "circulo", name: "Circulo", type: "geo",
        x_px: 520, y_px: 200, width_px: 200, height_px: 200,
        content: { es: "" },
        style: { geoType: "circle", fillColor: "#3366cc", grain: true, grainIntensity: 20 },
      },
    ],
  },
  {
    nombre: "text-marks",
    descripcion: "Marcas de texto (contrato 1.11.0): dos marcas con rol de color y resaltado, una llave escapada y una marca que salta de linea.",
    canvas: [800, 600],
    slots: [
      {
        id: "parrafo", name: "Parrafo", type: "text",
        x_px: 60, y_px: 80, width_px: 600, height_px: 200, font_size_px: 28,
        content: {
          es: "Te iras. {hl}No te llevaras nada{/hl}. {u}Ni {{esto}}{/u}.\n{hl}Dos\nlineas{/hl}",
          en: "You will leave. {hl}You will take nothing{/hl}. {u}Not {{this}}{/u}.\n{hl}Two\nlines{/hl}",
        },
        style: {
          marks: {
            hl: { color: "#5a7d1f", colorRole: "accent", bold: true, highlight: { style: "marker", color: "rgba(217,249,157,.6)" } },
            u: { italic: true, underline: true },
          },
        },
      },
    ],
  },
  {
    nombre: "basic-text",
    descripcion: "Un solo texto en dos idiomas. El caso minimo: contenedor, zTXt, zlib y cqw.",
    canvas: [800, 600],
    slots: [{
      id: "titulo", name: "Titulo", type: "text",
      x_px: 80, y_px: 60, width_px: 400, height_px: 90, font_size_px: 40,
      content: { es: "Hola", en: "Hello" }, style: {},
    }],
  },
  {
    nombre: "groups-and-parallax",
    descripcion: "Un grupo con dos hijos y una capa con parallax. Cubre la jerarquia y la profundidad.",
    canvas: [800, 600],
    slots: [
      { id: "grupo", name: "Grupo", type: "group", x_px: 40, y_px: 40, width_px: 300, height_px: 200,
        content: { es: "" }, style: { childIds: ["hijo_a", "hijo_b"] } },
      { id: "hijo_a", name: "Hijo A", type: "geo", x_px: 60, y_px: 60, width_px: 100, height_px: 80,
        content: { es: "" }, style: { groupId: "grupo", fillColor: "#2563EB" } },
      { id: "hijo_b", name: "Hijo B", type: "geo", x_px: 200, y_px: 60, width_px: 100, height_px: 80,
        content: { es: "" }, style: { groupId: "grupo", fillColor: "#0f766e" } },
      { id: "fondo", name: "Fondo con profundidad", type: "geo", x_px: 400, y_px: 300,
        width_px: 300, height_px: 200, content: { es: "" },
        style: { fillColor: "#b91c1c", parallax: { enabled: true, depth: 0.8, mode: "mouse", axis: "both" } } },
    ],
  },
  {
    nombre: "multilang-cjk-rtl",
    descripcion: "Soporte multilingüe CJK y RTL con español, japonés y árabe.",
    canvas: [800, 600],
    slots: [{
      id: "texto_internacional", name: "Texto Multilingüe", type: "text",
      x_px: 50, y_px: 50, width_px: 400, height_px: 100, font_size_px: 32,
      content: { es: "Hola mundo", ja: "こんにちは世界", ar: "مرحبا بالعالم" }, style: {}
    }],
  },
  {
    nombre: "typography-styling",
    descripcion: "Tipografía avanzada: familia, peso, itálica, transformación y espaciado.",
    canvas: [800, 600],
    slots: [{
      id: "texto_estilizado", name: "Texto Estilizado", type: "text",
      x_px: 40, y_px: 40, width_px: 500, height_px: 100, font_size_px: 36,
      content: { es: "Diseño OIM" },
      style: {
        fontFamily: "Inter", fontWeight: 700, fontStyle: "italic",
        textTransform: "uppercase", letterSpacing: 2, lineHeight: 1.4
      }
    }],
  },
  {
    nombre: "nested-groups",
    descripcion: "Jerarquía multinivel: grupo raíz conteniendo subgrupo con elementos hijos.",
    canvas: [800, 600],
    slots: [
      { id: "grupo_padre", name: "Grupo Padre", type: "group", x_px: 20, y_px: 20, width_px: 400, height_px: 300, content: { es: "" }, style: { childIds: ["subgrupo"] } },
      { id: "subgrupo", name: "Subgrupo Hijo", type: "group", x_px: 30, y_px: 30, width_px: 350, height_px: 250, content: { es: "" }, style: { groupId: "grupo_padre", childIds: ["item_1"] } },
      { id: "item_1", name: "Elemento Anidado", type: "geo", x_px: 40, y_px: 40, width_px: 120, height_px: 80, content: { es: "" }, style: { groupId: "subgrupo", fillColor: "#10b981" } }
    ],
  },
  {
    nombre: "asymmetric-borders",
    descripcion: "Radios de curvatura independientes por cada esquina.",
    canvas: [800, 600],
    slots: [{
      id: "caja_curva", name: "Caja Asimétrica", type: "geo",
      x_px: 100, y_px: 100, width_px: 300, height_px: 150, content: { es: "" },
      style: { borderRadius: "10px 25px 50px 0px", fillColor: "#3b82f6" }
    }],
  },
  {
    nombre: "shadow-effects",
    descripcion: "Capa con sombra configurada con color, difuminado, offset y opacidad.",
    canvas: [800, 600],
    slots: [{
      id: "caja_sombra", name: "Caja con Sombra", type: "geo",
      x_px: 80, y_px: 80, width_px: 250, height_px: 150, content: { es: "" },
      style: {
        fillColor: "#ffffff", shadowEnabled: true, shadowColor: "#000000",
        shadowBlur: 20, shadowOffsetX: 8, shadowOffsetY: 12, shadowOpacity: 45
      }
    }],
  },
  {
    nombre: "color-blending-opacity",
    descripcion: "Opacidad de capa y modos de fusión de mezcla visual.",
    canvas: [800, 600],
    slots: [
      { id: "fondo_base", name: "Fondo Base", type: "geo", x_px: 50, y_px: 50, width_px: 300, height_px: 200, content: { es: "" }, style: { fillColor: "#ef4444" } },
      { id: "capa_blend", name: "Capa Blend", type: "geo", x_px: 150, y_px: 100, width_px: 300, height_px: 200, content: { es: "" }, style: { fillColor: "#3b82f6", opacity: 70, blendMode: "multiply" } }
    ],
  },
  {
    nombre: "strokes-and-borders",
    descripcion: "Contorno vectorial y bordes con estilo dashed y ancho personalizado.",
    canvas: [800, 600],
    slots: [{
      id: "rect_trazo", name: "Rectángulo con Trazo", type: "geo",
      x_px: 60, y_px: 60, width_px: 280, height_px: 160, content: { es: "" },
      style: { fillColor: "#f3f4f6", borderWidth: 4, borderColor: "#8b5cf6", strokeStyle: "dashed" }
    }],
  },
  {
    nombre: "parallax-infinite",
    descripcion: "Parallax continuo en bucle horizontal infinito.",
    canvas: [800, 600],
    slots: [{
      id: "cinta_infinita", name: "Cinta Infinita", type: "geo",
      x_px: 0, y_px: 400, width_px: 800, height_px: 120, content: { es: "" },
      style: {
        fillColor: "#0f172a",
        parallax: {
          enabled: true, depth: 0.5, mode: "infinite_horizontal", axis: "both",
          infinite: { enabled: true, speed_px_sec: 35, direction: "right_to_left" }
        }
      }
    }],
  },
  {
    nombre: "interactive-hover",
    descripcion: "Interactividad de puntero: escala y rotación dinámica al hacer hover.",
    canvas: [800, 600],
    slots: [{
      id: "tarjeta_hover", name: "Tarjeta Hover", type: "geo",
      x_px: 100, y_px: 100, width_px: 240, height_px: 140, content: { es: "" },
      style: {
        fillColor: "#4f46e5", isInteractive: true,
        states: { hover: { scale: 108, rotation: 3, opacity: 95 } }
      }
    }],
  },
  {
    nombre: "interactive-chained-actions",
    descripcion: "Acciones interactivas múltiples y encadenadas al activar capa.",
    canvas: [800, 600],
    slots: [
      { id: "alerta", name: "Alerta", type: "geo", x_px: 100, y_px: 50, width_px: 200, height_px: 60, content: { es: "" }, style: { fillColor: "#f59e0b" } },
      { id: "panel", name: "Panel Ocultable", type: "geo", x_px: 100, y_px: 130, width_px: 300, height_px: 180, content: { es: "" }, style: { fillColor: "#6b7280" } },
      {
        id: "interruptor", name: "Interruptor", type: "text",
        x_px: 100, y_px: 340, width_px: 180, height_px: 50, font_size_px: 20,
        content: { es: "Alternar" },
        style: {
          isInteractive: true,
          states: {
            active: {
              actions: [
                { target: "panel", type: "toggle" },
                { target: "alerta", type: "hide" }
              ]
            }
          }
        }
      }
    ],
  },
  {
    nombre: "filter-effects",
    descripcion: "Filtros visuales CSS: desenfoque, brillo, contraste, saturación y rotación de tono.",
    canvas: [800, 600],
    slots: [{
      id: "capa_filtrada", name: "Capa con Filtros", type: "geo",
      x_px: 120, y_px: 80, width_px: 300, height_px: 200, content: { es: "" },
      style: {
        fillColor: "#059669",
        filterBlur: 3, filterBrightness: 115, filterContrast: 125, filterSaturate: 140, filterHueRotate: 30
      }
    }],
  },
  {
    nombre: "text-runs-precalculated",
    descripcion: "Estructura precalculada de líneas de texto para renderizadores nativos y embebidos.",
    canvas: [800, 600],
    slots: [{
      id: "texto_precalculado", name: "Párrafo Precalculado", type: "text",
      x_px: 60, y_px: 60, width_px: 350, height_px: 120, font_size_px: 24,
      content: { es: "Primera línea\nSegunda línea" },
      style: {
        textRuns: {
          es: {
            fontSize: 24, lineHeight: 30,
            lines: [
              { text: "Primera línea", width: 140, yOffset: 0 },
              { text: "Segunda línea", width: 152, yOffset: 30 }
            ]
          }
        }
      }
    }],
  },
  {
    nombre: "multi-container-layout",
    descripcion: "Disposición con slots de tipo contenedor organizando el espacio de lienzo.",
    canvas: [800, 600],
    slots: [
      { id: "sidebar", name: "Sidebar", type: "container", x_px: 0, y_px: 0, width_px: 240, height_px: 600, content: { es: "" }, style: { fillColor: "#1e293b" } },
      { id: "contenido_principal", name: "Área Principal", type: "container", x_px: 250, y_px: 20, width_px: 530, height_px: 560, content: { es: "" }, style: { fillColor: "#f8fafc" } }
    ],
  },
  {
    nombre: "extreme-aspect-ratios",
    descripcion: "Lienzo ultra-ancho panorámico probando consistencia del contenedor.",
    canvas: [1600, 400],
    slots: [{
      id: "banner_texto", name: "Banner Panorámico", type: "text",
      x_px: 80, y_px: 100, width_px: 1200, height_px: 180, font_size_px: 64,
      content: { es: "Panorámica 4:1" }, style: { fillColor: "#e11d48" }
    }],
  },
  {
    nombre: "transparent-background",
    descripcion: "Capa con fondo transparente estricto según la regla de color normativo.",
    canvas: [800, 600],
    slots: [{
      id: "caja_transparente", name: "Caja Transparente", type: "geo",
      x_px: 150, y_px: 150, width_px: 300, height_px: 200, content: { es: "" },
      style: { fillColor: "transparent", borderWidth: 2, borderColor: "#0284c7" }
    }],
  },
  {
    nombre: "layer-ordering-zindex",
    descripcion: "Pila de capas superpuestas en idénticas coordenadas para verificar orden de pintado.",
    canvas: [800, 600],
    slots: [
      { id: "capa_fondo", name: "Capa Fondo (1)", type: "geo", x_px: 100, y_px: 100, width_px: 200, height_px: 200, content: { es: "" }, style: { fillColor: "#1e3a8a" } },
      { id: "capa_medio", name: "Capa Medio (2)", type: "geo", x_px: 120, y_px: 120, width_px: 200, height_px: 200, content: { es: "" }, style: { fillColor: "#3b82f6" } },
      { id: "capa_frente", name: "Capa Frente (3)", type: "geo", x_px: 140, y_px: 140, width_px: 200, height_px: 200, content: { es: "" }, style: { fillColor: "#93c5fd" } }
    ],
  },
  {
    nombre: "full-monty-composite",
    descripcion: "Documento maestro que integra interactividad, multilingüe, sombras, parallax y jerarquía.",
    canvas: [800, 600],
    slots: [
      {
        id: "comp_grupo", name: "Grupo Compuesto", type: "group",
        x_px: 50, y_px: 50, width_px: 700, height_px: 500, content: { es: "" },
        style: { childIds: ["comp_tarjeta", "comp_boton"] }
      },
      {
        id: "comp_tarjeta", name: "Tarjeta Compuesta", type: "geo",
        x_px: 60, y_px: 60, width_px: 400, height_px: 250, content: { es: "" },
        style: {
          groupId: "comp_grupo", fillColor: "#047857", borderRadius: "16px",
          shadowEnabled: true, shadowColor: "#000000", shadowBlur: 15, shadowOffsetY: 8, shadowOpacity: 40,
          parallax: { enabled: true, depth: 0.6, mode: "mouse", axis: "both" }
        }
      },
      {
        id: "comp_boton", name: "Botón Compuesto", type: "text",
        x_px: 80, y_px: 350, width_px: 240, height_px: 60, font_size_px: 24,
        content: { es: "Acción", en: "Action" },
        style: {
          groupId: "comp_grupo", fillColor: "#d97706", isInteractive: true,
          states: {
            hover: { scale: 104, opacity: 90 },
            active: { actions: [{ target: "comp_tarjeta", type: "toggle" }] }
          }
        }
      }
    ],
  },
  {
    nombre: "palettes",
    descripcion: "Paletas con nombre (contrato 1.20.0): dark y light, defaultPalette=dark, una capa de texto con text-primary y una superficie con surface.",
    canvas: [800, 600],
    palettes: {
      dark: { "text-primary": "#f4f4f5", surface: "#18181b" },
      light: { "text-primary": "#18181b", surface: "#fafafa" },
    },
    defaultPalette: "dark",
    slots: [
      {
        id: "superficie", name: "Superficie", type: "geo",
        x_px: 40, y_px: 40, width_px: 720, height_px: 520,
        content: { es: "" },
        style: { fillColor: "#71717a", fillColorRole: "surface" },
      },
      {
        id: "titular", name: "Titular", type: "text",
        x_px: 80, y_px: 200, width_px: 640, height_px: 120,
        font_size_px: 64, content: { es: "Paleta" },
        style: { fillColor: "#3f3f46", fillColorRole: "text-primary" },
      },
    ],
  },
  {
    nombre: "pattern-color-roles",
    descripcion: "Roles de color en patrones (contrato 1.21.0): fondo de patron con accent y surface, una capa de patron con accent y una sombra con accent al 30%.",
    canvas: [800, 600],
    palettes: {
      dark: { accent: "#a3e635", surface: "#18181b" },
      light: { accent: "#4d7c0f", surface: "#fafafa" },
    },
    defaultPalette: "dark",
    slots: [
      {
        id: "background-pattern-slot", name: "Fondo", type: "geo",
        x_px: 0, y_px: 0, width_px: 800, height_px: 600,
        content: { es: "" },
        style: {
          backgroundType: "pattern", backgroundPatternType: "dots",
          backgroundPatternColor: "#a3e635", backgroundPatternColorRole: "accent",
          backgroundPatternBgColor: "#18181b", backgroundPatternBgColorRole: "surface",
        },
      },
      {
        id: "patron", name: "Patron", type: "pattern",
        x_px: 100, y_px: 100, width_px: 300, height_px: 300,
        content: { es: "" },
        style: {
          fillPatternType: "dots", fillPatternColor: "#a3e635", fillPatternColorRole: "accent",
          shadowEnabled: true, shadowColor: "#000000", shadowColorRole: "accent", shadowOpacity: 30, shadowBlur: 12,
        },
      },
    ],
  },
  {
    nombre: "reveal-and-play",
    descripcion: "Revelado por capa y accion play (contrato 1.22.0): un panel oculto que entra deslizando hacia arriba, un icono cuya animacion espera a una accion y un boton que muestra el uno y reproduce el otro.",
    canvas: [800, 600],
    slots: [
      {
        id: "panel", name: "Panel", type: "geo",
        x_px: 80, y_px: 80, width_px: 400, height_px: 240,
        content: { es: "" },
        style: { fillColor: "#27272a", isVisible: false, reveal: { effect: "slide-up", duration: 400, easing: [0.22, 1, 0.36, 1] } },
      },
      {
        id: "icon", name: "Icono", type: "geo",
        x_px: 560, y_px: 120, width_px: 120, height_px: 120,
        content: { es: "" },
        style: { fillColor: "#f4f4f5", animation: { trigger: "action", duration: 0.6, keyframes: [{ t: 0, s: 1 }, { t: 0.5, s: 1.2, e: "ease-out" }, { t: 1, s: 1 }] } },
      },
      {
        id: "btn", name: "Boton", type: "text",
        x_px: 80, y_px: 420, width_px: 200, height_px: 60, font_size_px: 24,
        content: { es: "Abrir" },
        style: {
          isInteractive: true,
          states: { active: { actions: [{ target: "panel", type: "show" }, { target: "icon", type: "play" }] } },
        },
      },
    ],
  },
];

async function json(url, cuerpo) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error(`${url}: ${r.status} ${await r.text()}`);
  return r.json();
}

// `node tools/generar-vectores.mjs layer-grain` regenerates only that case:
// the others keep their files and signatures untouched.
const SOLO = process.argv.slice(2);
const casos = SOLO.length ? CASOS.filter((c) => SOLO.includes(c.nombre)) : CASOS;
if (SOLO.length && casos.length !== SOLO.length) throw new Error(`Casos desconocidos: ${SOLO.join(", ")}`);

const base = await (async () => {
  const bytes = readFileSync(join(VECTORES, "interactive.oim.png"));
  const { image } = await extractOIM(new Blob([bytes]));
  return Buffer.from(await image.arrayBuffer());
})();

for (const caso of casos) {
  const meta = await json(`${API}/v1/oim/compile`, {
    canvas_width: caso.canvas[0], canvas_height: caso.canvas[1], slots_raw: caso.slots,
    ...(caso.description ? { description: caso.description } : {}),
    ...(caso.palettes ? { palettes: caso.palettes, defaultPalette: caso.defaultPalette } : {}),
  });
  const form = new FormData();
  form.append("file", new Blob([base], { type: "image/png" }), "base.png");
  // The master key needs a verified author; vectors are signed as the signing
  // canary, which is exempt from the beta gate and the quota (not a person).
  const metadata = { ...(meta.metadata || meta), creator_user_id: "signing-canary" };
  form.append("metadata", JSON.stringify(metadata));
  const r = await fetch(`${API}/v1/oim/package`, {
    method: "POST", body: form, headers: { Authorization: `Bearer ${CLAVE}` },
  });
  if (!r.ok) throw new Error(`package: ${r.status} ${await r.text()}`);
  const salida = Buffer.from(await r.arrayBuffer());
  writeFileSync(join(VECTORES, `${caso.nombre}.oim.png`), salida);
  console.log(`  ${caso.nombre}.oim.png  ${salida.length} bytes`);
}

/**
 * El resultado esperado: lo que un lector conforme debe extraer.
 *
 * NO es el metadato entero. Un volcado completo se rompe cada vez que el
 * compilado añade un campo, y entonces se regenera sin mirar — un vector que se
 * actualiza a ciegas deja de comprobar nada. Aqui van los campos por los que
 * dos implementaciones pueden discrepar de verdad: la geometria normalizada, la
 * jerarquia, la profundidad, la tipografía, efectos visuales y la interactividad declarada.
 */
const DEL_ESTILO = [
  "width", "height", "fontSize", "borderRadius", "fillColor",
  "groupId", "childIds", "isInteractive", "states", "parallax",
  // 1.22.0: how a layer is revealed, whether its animation waits for a play action.
  "isVisible", "reveal", "animation",
  "fontFamily", "fontWeight", "fontStyle", "textTransform", "letterSpacing", "lineHeight",
  "shadowEnabled", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "shadowOpacity",
  "blendMode", "opacity", "borderWidth", "borderColor", "strokeStyle",
  "filterPreset", "filterBlur", "filterBrightness", "filterContrast", "filterSaturate", "filterHueRotate",
  "textRuns",
  "grain", "grainIntensity", "grainSize", "grainBlend",
  "layerBlur",
  "flipX", "flipY", "imageCrop", "alt", "decorative", "fillImage", "fillImageCrop",
  // 1.19.0: without these the frame-shapes vector would sign the shapes but
  // never check them.
  "fillType", "geoShape", "svgPath", "svgViewBox", "fillImageFlipX", "fillImageFlipY",
  // 1.21.0: colour roles of patterns, backgrounds and shadows.
  "fillPatternType", "fillPatternColor", "fillPatternColorRole", "fillPatternBgColor", "fillPatternBgColorRole",
  "backgroundType", "backgroundPatternType", "backgroundPatternColor", "backgroundPatternColorRole",
  "backgroundPatternBgColor", "backgroundPatternBgColorRole", "shadowColorRole",
];

function esperado(descripcion, m) {
  return {
    description: descripcion,
    canvas: m.canvas,
    languages: m.languages,
    signed: Boolean(m.signature),
    key_version: m.key_version,
    // 1.20.0: only present in the palettes vector, so older expectations are unchanged.
    ...(m.palettes ? { palettes: m.palettes, defaultPalette: m.defaultPalette } : {}),
    slots: (m.slots || []).map((s) => {
      const style = {};
      for (const k of DEL_ESTILO) if (s.style && s.style[k] !== undefined) style[k] = s.style[k];
      const fila = { id: s.id, type: s.type, position: s.position };
      if (s.name !== undefined) fila.name = s.name;
      if (s.content !== undefined) fila.content = s.content;
      if (s.parallax !== undefined) fila.parallax = s.parallax;
      if (Object.keys(style).length) fila.style = style;
      return fila;
    }),
  };
}

for (const f of readdirSync(VECTORES).filter((x) => x.endsWith(".oim.png")).sort()) {
  const { metadata } = await extractOIM(new Blob([readFileSync(join(VECTORES, f))]));
  const nombre = f.replace(".oim.png", "");
  const caso = CASOS.find((c) => c.nombre === nombre);
  const doc = esperado(caso ? caso.descripcion : DESCRIPCIONES[nombre], metadata);
  writeFileSync(join(VECTORES, `${nombre}.expected.json`), JSON.stringify(doc, null, 2) + "\n");
  console.log(`  ${nombre}.expected.json`);
}
