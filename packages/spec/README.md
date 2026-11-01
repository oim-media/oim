# oim-spec — el contrato del formato

Esto **no** es una biblioteca. Es la definición del formato `.oim`, en datos,
para que una implementación en cualquier lenguaje pueda ser correcta sin leer
el TypeScript.

```
BINARY_SPEC.md    Especificación binaria del contenedor PNG, compresión y firma.
CANONICAL_SPEC.md Especificación canónica de metadatos (slots, estilos, tipos y opciones).
schema/           JSON Schema de los metadatos. Generado, nunca editado a mano.
vectors/          Ficheros .oim de ejemplo con su resultado esperado.
```

## Por qué existe

Los dos repositorios habían copiado el mismo código en vez de compartirlo, y
las copias derivaron: `grupos.ts` acumuló 546 líneas distintas entre el player
y el editor, `layerComposition.ts` 775. Un player en Swift o en Rust repetiría
ese error una vez por lenguaje.

Un contrato en TypeScript solo sirve a TypeScript. Este directorio es la parte
que sobrevive al lenguaje.

## Quién manda hoy

Hoy la fuente de verdad sigue siendo `packages/core/src/schema.ts`: el JSON de
`schema/` se **genera** desde ese Zod, y una prueba falla si alguien edita el
Zod sin regenerarlo. Es deliberado — un contrato generado no puede derivar de
su implementación, que es justo el fallo que esto cierra.

El día que exista una segunda implementación, la dirección se invierte: el JSON
pasa a ser la fuente y el TypeScript uno más de los que lo cumplen. No antes:
mantener a mano una especificación que nadie más lee es cómo se acumulan
contratos que mienten.

## Regenerar

```
pnpm --filter @oim-media/core test -- -u
```

## Comprobar si el contrato y los archivos han derivado

```
node tools/contract-summary.mjs          # informe legible
node tools/contract-summary.mjs --json   # los mismos datos, para otra herramienta
node tools/contract-summary.mjs --write  # deja contract-summary.json

node tools/canonical-check.mjs           # la firma: rehace la forma canonica
                                         # y verifica los vectores de verdad
```

Una prueba vigila que el JSON Schema siga al Zod, pero **nada comparaba el
contrato con archivos firmados de verdad**. Ese hueco ya había dejado pasar
cuatro divergencias, encontradas a mano el 18 de septiembre de 2026; la peor,
`reedicion` —quién puede reeditar la obra— que va en todos los archivos y no
está declarada en ninguna parte.

El guion informa, no arregla ni falla. Convertir la deriva en una prueba roja
es el final correcto, pero primero hay que resolverla: una prueba que nace en
rojo enseña a todo el mundo a ignorarla.

## `content` y el principal `*` (desde 1.2.0)

En las capas de medio (imagen, Lottie, vector), `content` puede guardar el
medio principal bajo la clave `"*"` y solo las excepciones bajo su código de
idioma:

    "content": { "*": "oim-media:abc", "pt": "oim-media:def" }

Regla de lectura: si `content` tiene `"*"`, el idioma pedido usa **su propia
clave si existe, aunque esté vacía**; si no existe, usa `"*"`. No hay más
respaldos. Sin `"*"` (todo archivo anterior a 1.2.0, y todo texto), la regla
de siempre: el idioma pedido, luego `en`, `es`, `default` y la primera clave,
## `reedicion` y `name` en la raíz (desde 1.4.0)

Los dos iban en **todos** los archivos publicados y en **ninguna** versión del
contrato. Un lector construido leyendo solo el contrato no podía saber que
existían.

`reedicion` era el peor de los dos porque **decide un permiso**:

    "reedicion": "publico" | "solo_autor" | "sellado"

Un valor desconocido cae a `solo_autor`, **nunca a `publico`**: el valor por
defecto de un sistema de permisos se elige por lo que pasa cuando algo va mal.
Un lector que lo ignorase trataría como reeditable una obra que no lo es.

Viaja junto a `immutable_lock`, y no es redundancia: `reedicion` es la
declaración —viaja dentro del archivo, cualquiera que lo abra sabe qué quiso su
autor— e `immutable_lock` es lo que el backend guarda y aplica. Una declaración
sin aplicación es una sugerencia; una aplicación sin declaración es una puerta
cerrada sin cartel. `reeditPermission.ts` es la fuente canónica de esa regla, y
escribe los dos campos a la vez para que no puedan separarse.

`name` es el título de la obra. No confundir con `slot.name` ni con
`fonts[].name`.

## Lo retirado se marca, no se borra (desde 1.4.0)

`terms_accepted` y `redirect_membership_verified` llevan `deprecated: true` en
el JSON Schema, que es la forma **legible por una máquina** de decirlo: un
lector nuevo no tiene que interpretar un comentario para saber que no debe
escribirlas.

Las dejó atrás la 1.1.0 al retirar `allow_external_urls`: sus únicos lectores
—las rutas de firma del backend— están detrás de `if allow_external_urls`, una
clave que el contrato ya no declara, así que **la comprobación no puede
dispararse para un archivo conforme**.

Marcadas y no borradas a propósito. El backend las sigue honrando si un archivo
trae la clave retirada; quitarlas del contrato lo haría mentir en el otro
sentido, que es el mismo fallo con el signo cambiado.

**`allowed_domains` no está en esa lista, aunque se haya dicho lo contrario.**
Sigue viva y el reproductor la aplica: `worker.ts` la convierte en
`isDomainAllowed` y `securityVerdict` responde `domain_blocked`. Hay una prueba
que impide volver a darla por muerta.

Nada se elimina y `min_player` no sube: un archivo antiguo sigue siendo válido
y un lector que ignore las cuatro claves se comporta igual que antes.

## Fuentes incrustadas (desde 1.3.0)

La raíz puede llevar `fonts`: una entrada por variante de fuente que usa la
obra, recortada a los caracteres que puede mostrar.

    { "family": "Lora", "name": "oim-3f9a1c2b-Lora", "weight": 700,
      "style": "italic", "format": "woff2", "data": "<base64>" }

Un lector que la entienda registra cada entrada con el nombre de `name` y pinta
las capas de familia `family` con ese nombre primero. Un lector que no la
entienda la ignora: las capas siguen diciendo `family` y se pintan como antes.
Por eso `fonts` no sube `min_player`.

**Las fuentes en línea son comportamiento heredado** desde el 17 de septiembre
de 2026: el editor ya no las ofrece y todo archivo nuevo lleva sus fuentes
dentro. El reproductor de referencia mantiene su cargador de Google solo para
los archivos ya publicados, y un lector nuevo no tiene por qué implementarlo:
sin `fonts`, se pinta con la tipografía de repuesto del sistema. Un `.oim` no
pide nada a terceros al abrirse, que es lo mismo que decidió la 1.1.0 al
retirar `allow_external_urls`.

## El estilo deja de ser texto libre (desde 1.8.0)

La 1.6 declaró unas cuarenta claves de estilo que el editor ya escribía, pero
casi todas como cadena libre: declarar una clave sin decir qué admite
documenta que existe, no cómo se lee. La 1.8.0 les da forma:

- **Un solo tipo de color**, `cssColor`, para las dieciséis claves de color.
  Admite hex, `rgb()`/`hsl()`, `transparent`, `none`, `currentColor`,
  `inherit` y `var(--nombre)` con respaldo, porque los colores dinámicos van
  en archivos reales. Es el gemelo portable de `isSafeCssColor`, el saneado
  del player: una prueba exige que **todo lo que acepte el contrato lo acepte
  el player**, nunca al revés.
- **Vocabularios cerrados** donde el editor ya los cierra: roles de color,
  los 14 patrones, las 8 direcciones del patrón, el degradado y la animación
  del texto, y `geoShape` gana `scribble`, que se escribía y no se declaraba.
- **Los tres `any` tienen forma**: `cuts` (recortes de la máscara),
  `fillGenerative` (generador, semilla, parámetros y colores) y
  `fillGradient`.

`fillGradient` era el agujero serio. Termina en `background-image`, que
admite una lista de imágenes, así que
`linear-gradient(red, blue), url(https://tercero/baliza)` hacía que abrir el
archivo pidiera un recurso a un tercero. Ahora el contrato admite **un único**
degradado con funciones de color dentro, y el player descarta cualquier otra
cosa aunque el archivo no valide contra el contrato.

Medido el 24 de septiembre de 2026: los 42 archivos `.oim` que hay en disco,
incluidos los 20 vectores, validan contra la 1.8.0.

## Sin CSS en crudo (desde 1.9.0)

`animation.custom_loop_css`, `custom_keyframes` y `custom_hover_css` llevan
`deprecated: true` y **ningún reproductor debe aplicarlas**. `loop: "custom"`
y `hover: "custom"` no pintan nada.

Eran CSS del archivo metido tal cual en una hoja de estilo. El filtro solo
reescribía `url(...)`, y había otras tres formas de pedir un recurso que
pasaban intactas: `@import "https://…"`, `image-set("https://…" 1x)` y un
`url` escrito con escape CSS (`\75rl(…)`). `custom_hover_css` ni siquiera
pasaba por el filtro y se pegaba dentro de `{ … }`, así que un `}` salía de la
regla y podía reescribir el reproductor entero, incluidos sus propios avisos.

El editor nunca las escribió y ningún archivo las usa: se retiran en vez de
perseguir la gramática de CSS con una lista negra. `cssAnimation` se queda,
acotada a la única forma que escribe el editor,
`background-animation-<dirección> <n>s linear infinite`.

## Paletas con nombre (desde 1.20.0)

La raíz del `.oim` puede traer `palettes` y `defaultPalette`:

- **`palettes`**: un mapa de nombre a paleta. Cada paleta asigna colores a los
  doce roles de `DYNAMIC_COLOR_ROLES` (los ocho de siempre más `text-primary`,
  `text-secondary`, `text-muted` y `text-on-accent`). Como mucho seis paletas.
  Un nombre cumple `^[a-z][a-z0-9-]{0,23}$`. Los colores no se validan en el
  contrato: el lector descarta los que no pasan `isSafeCssColor` y conserva el
  resto, igual que con un color de capa.
- **`defaultPalette`**: el nombre de la paleta por omisión. Si no nombra una
  paleta de `palettes`, el lector lo ignora.

**Orden de resolución** (`resolvePalette` en `@oim-media/core`):

1. La paleta pedida por el anfitrión (atributo `palette` del player).
2. Si el documento trae `dark` y `light`, la que pida `prefers-color-scheme`.
3. `defaultPalette`.
4. Ninguna: cada capa usa su color fijo.

El resultado se escribe en el visor como `--oim-palette-<rol>`, y
`resolveCssColor(rol, fijo)` emite `var(--oim-color-<rol>, var(--oim-palette-<rol>, fijo))`.
Las `--oim-color-*` del anfitrión siguen ganando a la paleta, y
`allow-dynamic-colors="false"` las anula todas.

Un archivo 1.20.0 leído por un player anterior se ve con los colores fijos de
cada capa. Nada se rompe.

## Conformance vectors

`vectors/` holds 20 signed `.oim` files and their expected reads. They are
generated by Xue Studios' signing service through the production pipeline and
committed to this repository; the generator itself is not part of it. See
[`vectors/README.md`](vectors/README.md).

## Precedente

Lottie separó su especificación de toda implementación en `lottie/lottie-spec`
—`/schema` partido por objeto, `/tests` con vectores— y dejó que cada player se
llamara como quisiera en su ecosistema (`lottie-web`, `lottie-ios`,
`com.airbnb.android:lottie`). No hay ningún ámbito `@lottie/*`: la identidad
vive en la especificación, no en el nombre del paquete.

## La forma canónica de la firma

Sin esta sección, una segunda implementación puede leer el formato entero y
aun así **no poder verificar una sola firma**. Es el único apartado del
contrato que bloquea por completo a un lector nuevo: todo lo demás se puede
ignorar y degradar, la firma no.

La firma es **ECDSA P-256 con SHA-256**, en formato crudo IEEE P1363 —`r || s`,
32 bytes cada uno, 64 en total— codificada en base64 dentro de `signature`.
No es DER: quien use una biblioteca que devuelva DER tiene que convertirla.

### Los bytes que se firman

No se firma el chunk, ni el JSON tal y como está escrito en el archivo. Se
firma el resultado de estas siete reglas, en este orden:

1. **Partir del objeto de metadatos** ya decodificado del chunk.
2. **Quitar de la raíz** `signature`, `key_version`, `timestamp` y
   `creator_user_id`. Solo de la raíz: si esos nombres aparecen anidados, se
   quedan.
3. **Normalizar los números**: redondear a **6 decimales** y, si el resultado
   no tiene parte fraccionaria, emitirlo como entero (`2.0000001` → `2`).
4. **Ordenar las claves** de todos los objetos, recursivamente, por punto de
   código Unicode. También dentro de los objetos que haya en los arrays.
5. **Serializar compacto**: sin espacios, separadores `,` y `:`.
6. **No escapar lo no-ASCII**: `año` se emite tal cual, no como `a\u00f1o`.
7. **Codificar en UTF-8**. Esos bytes son los que se firman y los que se
   verifican.

`signed_at` va **dentro** de la firma y `timestamp` **fuera**. No es un
descuido: `timestamp` se puede reescribir sin romper nada, y la comprobación de
caducidad de la clave necesita una fecha que no se pueda falsificar.

`creator_user_id` se excluye porque es dato personal, y un archivo firmado es
justo lo que su autor ya no puede borrar.

### El sello de la imagen

`image_hash` es el **SHA-256 en hexadecimal de la concatenación de las cargas
útiles de los chunks `IDAT`** del PNG —solo los datos, sin longitud, sin tipo y
sin CRC—, y `image_hash_alg` vale `sha256-idat`.

Como `image_hash` es un campo más de los metadatos, **la firma lo cubre**: con
la firma válida, el sello ya no se puede cambiar. Por eso el orden importa y no
se negocia: normalizar el PNG, calcular el sello, firmar, e insertar el chunk
**a nivel de bytes sin volver a codificar la imagen**. Un simple «volver a
guardar» después de firmar cambia el `IDAT` y el sello deja de casar para
siempre.

Los archivos anteriores al 11 de septiembre de 2026 no llevan sello y se
aceptan sin él.

### Dónde se rompía esto

Hasta el 20 de septiembre de 2026 las dos implementaciones de referencia
—`serialize_canonical` en Python y `serializeCanonical` en TypeScript—
coincidían **por construcción, no por acuerdo**, y discrepaban en tres
entradas. Con `packages/core/src/canonical.ts` como fuente única del lado
TypeScript, medido de nuevo el 24 de septiembre:

| Entrada | Python | TypeScript | Estado |
|---|---|---|---|
| `creator_user_id` en la raíz | lo quita | lo quita | **cerrada** |
| decimal con más de 6 cifras | redondea | redondea | **cerrada** |
| claves fuera del BMP | punto de código | punto de código | **cerrada** |
| decimal que al redondear queda entero | `2` | `2` | **cerrada el 24 sept** |

La cuarta la encontró la revisión del 24 de septiembre y era de **orden**
dentro de la regla 3: `clean_floats` preguntaba «¿es entero?» *antes* de
redondear, y en una sola pasada dejaba `2.0000001` como `2.0` y `1e-7` como
`0.0`, donde TypeScript emite `2` y `0`. El firmante no la sufría porque
aplica `clean_floats` dos veces; quien reimplementase el Python con una sola
pasada, sí. Ahora redondea primero, y
una prueba del firmante de referencia fija los bytes.

**Lo que manda es lo que se firma**: redondear a 6 decimales primero y, si el
resultado no tiene parte fraccionaria, emitirlo como entero. `-0` se emite
`0`. Ninguna firma existente cambia: con dos pasadas el resultado ya era ese.

Una nota sobre la cita: el comentario de `canonical.ts` menciona RFC 8785
(JCS), pero JCS ordena las claves por **unidades UTF-16**, no por punto de
código. OIM ordena por punto de código; solo se distinguen con claves fuera
del BMP. El contrato es este README, no la RFC.

### Qué comprueba el guion, y qué no

    node tools/canonical-check.mjs

Rehace las siete reglas y **verifica la firma real de cada vector** con la
clave pública v1 que lleva el reproductor dentro. No compara contra un digest
apuntado a mano: si las reglas estuvieran mal, la firma no validaría.

Con los 20 vectores de la matriz —generados por la tubería real y firmados
con la clave de producción— se volvió a quitar cada regla una por una:

| Regla quitada | Firmas que caen |
|---|---|
| 2 · exclusiones de la raíz | 20 de 20 |
| 6 · UTF-8 sin escapar | 8 de 20 |
| sello · SHA-256 de los `IDAT` | 19 de 19 sellados |
| 3 · números | **0** |
| 4 · orden de claves | **0** |

La regla 6 y el sello, que antes solo se sostenían con casos de respuesta
conocida, **ya los demuestra una firma**. Las reglas 3 y 4 no, y **ningún
vector firmado por nuestra tubería podrá hacerlo nunca**: el firmante escribe
el archivo a partir de sus propios bytes canónicos, así que lo que queda en
el chunk ya está redondeado y ordenado. Esas dos reglas solo se notan cuando
alguien **vuelve a serializar** los metadatos —un editor que reescriba el
chunk, otra biblioteca de JSON— y ahí es justo donde hacen falta.

Por eso siguen cubiertas con casos de respuesta conocida dentro del guion:
**pillan una regresión del guion, no demuestran que el firmante esté de
acuerdo**. Demostrarlo de verdad pediría un vector escrito a mano, con claves
desordenadas y un decimal largo, y firmado sobre su forma canónica: un
archivo que la tubería real no produce nunca.
