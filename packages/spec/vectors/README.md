# Vectores de conformidad

Cada vector es un `.oim` real con el resultado que un lector debe producir al
abrirlo. El JSON Schema de `../schema/` dice qué **forma** tiene un `.oim`;
esto dice qué **resultado** sale de uno concreto.

```
<nombre>.oim.png        el fichero, firmado, tal y como lo produce el sistema
<nombre>.expected.json  lo que un lector conforme debe extraer de él
```

## La Matriz de 20 Vectores Normativos

Una suite reducida no distingue una implementación que **lee el formato** de una que **acierta por azar con un caso simple**. Esta matriz de 20 vectores cubre exhaustivamente todas las dimensiones del formato:

| # | Vector | Qué cubre |
|---|---|---|
| 1 | `basic-text` | El mínimo: contenedor PNG, chunk `zTXt`, zlib, dos idiomas, geometría en `cqw` |
| 2 | `groups-and-parallax` | Jerarquía simple (`childIds` / `groupId`) y profundidad (`parallax`) |
| 3 | `interactive` | `isInteractive`, `states.active.actions`, esquinas por lado y `min_player` |
| 4 | `multilang-cjk-rtl` | Cobertura multilingüe compleja: español, japonés (CJK: `こんにちは世界`) y árabe (RTL: `مرحبا بالعالم`) |
| 5 | `typography-styling` | Tipografía avanzada: `fontFamily`, `fontWeight`, `fontStyle: "italic"`, `textTransform`, `letterSpacing`, `lineHeight` |
| 6 | `nested-groups` | Jerarquía multinivel: grupo raíz conteniendo subgrupo con elementos hijos |
| 7 | `asymmetric-borders` | Radios de curvatura independientes por esquina (`borderRadius: "10px 25px 50px 0px"`) |
| 8 | `shadow-effects` | Sistema de sombras: `shadowEnabled`, `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY`, `shadowOpacity` |
| 9 | `color-blending-opacity` | Composición visual: opacidad de capa (`opacity: 70`) y modos de fusión (`blendMode: "multiply"`) |
| 10 | `strokes-and-borders` | Trazo vectorial y contornos: `borderWidth`, `borderColor`, `strokeStyle: "dashed"` |
| 11 | `parallax-infinite` | Efecto parallax continuo horizontal en bucle (`mode: "infinite_horizontal"`, `speed_px_sec`, `direction`) |
| 12 | `interactive-hover` | Estado interactivo de cursor: `states.hover` con `scale`, `rotation`, `opacity` |
| 13 | `interactive-chained-actions` | Múltiples acciones interactivas encadenadas al activar capa (`toggle`, `hide`) |
| 14 | `filter-effects` | Filtros visuales CSS: `filterBlur`, `filterBrightness`, `filterContrast`, `filterSaturate`, `filterHueRotate` |
| 15 | `text-runs-precalculated` | Maquetación precalculada para renderizadores nativos no-web (`textRuns` con `lines`, `width`, `yOffset`) |
| 16 | `multi-container-layout` | Varios slots de tipo `container` organizando la maqueta espacial del documento |
| 17 | `extreme-aspect-ratios` | Lienzo panorámico ultra-ancho (`1600x400`, relación 4:1) probando consistencia del contenedor |
| 18 | `transparent-background` | Fondo transparente estricto (`fillColor: "transparent"`) según la regla normativa de color |
| 19 | `layer-ordering-zindex` | Secuencia estricta de apilamiento con slots superpuestos en idénticas coordenadas |
| 20 | `full-monty-composite` | Documento maestro integral combinando multilingüe, interactividad activa/hover, grupos, parallax y sombras |

## Cómo se usa desde otro lenguaje

1. Abre el `.oim` como PNG y busca el chunk de metadatos: `zTXt` (clave `OIM_Data`; el que se escribe desde el 29 oct 2026), o `tEXt` / `iTXt` (claves `OIM_Data` o `OIM_JSON_DATA`).
2. Descomprime la carga útil: si viene en base64, decodifícalo primero; la descompresión es **deflate crudo** (sin cabecera zlib, RFC 1951) o zlib estándar.
3. Interpreta el resultado como JSON UTF-8: son los metadatos del documento.
4. Compara con `<nombre>.expected.json`, ignorando su campo `description`.

Lo que se compara es lo que dos implementaciones pueden discrepar de verdad: la
geometría **ya normalizada** a `cqw` o unidades de usuario, la jerarquía, la profundidad,
la tipografía y la interactividad declarada. No el metadato entero — un volcado completo se rompe
cada vez que el compilado añade un campo, y entonces se regenera sin mirar, que
es un vector que ya no comprueba nada.

## La firma

Los 20 vectores vienen firmados con la clave `v1`. La firma cubre la serialización canónica
de los metadatos y el hash criptográfico de los píxeles (`image_hash` sobre los chunks `IDAT`).
Un lector que verifique debe reconstruir esa forma canónica siguiendo las siete reglas
especificadas en el `README.md` de la raíz de `packages/spec`; uno que solo lea el formato
puede ignorarla, pero entonces no debe afirmar que valida autoría.

## Cómo se generaron

Con la tubería real, no a mano: `/v1/oim/compile` normaliza los slots a `cqw` y
`/v1/oim/package` sanea, firma y empotra.

```
node packages/spec/tools/generar-vectores.mjs
```

`interactive` es la excepción: salió de una exportación real del editor, y por
eso lleva cosas que el compilado solo no produce.

La imagen base pesa unos 3 KB y se reutiliza en todos. Un `.oim` publicado pesa
megabytes porque lleva su lienzo rasterizado dentro, y la imagen no es lo que
estos vectores comprueban.

## Que no se pudran

`packages/core/src/conformance-vectors.test.ts` los ejecuta en cada suite: si la
implementación de referencia cambia lo que produce, los vectores fallan. Es
circular a propósito y en una dirección — la referencia define el resultado, y
la prueba impide que se mueva sin que ellos se muevan con ella.

El día que exista un segundo lector y discrepe, hay un fichero concreto sobre el
que discutir en vez de dos opiniones.
