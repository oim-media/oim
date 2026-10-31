# Especificación Binaria del Contenedor OIM (Open Interactive Media)

**Versión:** 1.0  
**Fecha:** 2026-09-22  
**Estado:** Normativo / Vigente  
**Autores:** Equipo de Arquitectura OIM

---

## 1. Resumen y Objetivos

Un archivo **`.oim`** (o **`.oim.png`**) es un documento multimedia enriquecido, interactivo y verificable que se transporta dentro de un archivo de imagen conforme a la especificación estándar **ISO/IEC 15948:2004 (PNG)**.

El objetivo de este diseño binario es:
1. **Compatibilidad Universal (Fallback Visual):** Cualquier visor de imágenes, navegador o cliente sin soporte para OIM puede decodificar y renderizar el archivo como una imagen PNG estática estándar de alta fidelidad.
2. **Cero Dependencia de Red (Self-Contained):** El documento encapsula toda su geometría vectorial, textos multilingües, animaciones, fuentes tipográficas tipográficas y metadatos interactivos dentro de la propia imagen.
3. **Integridad Criptográfica y Firma ECDSA (Zero-Trust):** El archivo integra una firma digital asimétrica que vincula indeleblemente los metadatos interactivos con los píxeles renderizados (chunks `IDAT`), impidiendo la sustitución o manipulación del lienzo o de las capas.

---

## 2. Anatomía del Contenedor Binario PNG

Todo archivo OIM comienza estrictamente con la firma de 8 bytes canónica de PNG:

```binary
89 50 4E 47 0D 0A 1A 0A  (\x89PNG\r\n\x1a\n)
```

### 2.1. Estructura de Chunks PNG

Cada chunk en el archivo PNG sigue la disposición estándar de 4 campos:

| Campo | Longitud | Descripción |
|---|---|---|
| **Length** | 4 bytes (Big-Endian) | Longitud del campo `Data` (excluye `Type` y `CRC`). |
| **Type** | 4 bytes (ASCII) | Identificador de 4 caracteres (ej. `IHDR`, `tEXt`, `IDAT`, `IEND`). |
| **Data** | *Length* bytes | Carga útil del chunk. |
| **CRC-32** | 4 bytes (Big-Endian) | Suma de comprobación CRC-32 calculada sobre `Type` + `Data`. |

### 2.2. Disposición e Inyección de Metadatos OIM

Los metadatos OIM se almacenan preferentemente en un chunk auxiliar de texto:

- **Tipo de Chunk:** `zTXt` (el que se escribe desde el 29 oct 2026). Los lectores aceptan además `tEXt` (archivos anteriores) e `iTXt`.
- **Clave del Chunk (Keyword):** `OIM_Data` (reconocida históricamente también `OIM_JSON_DATA`).
- **Ubicación en el archivo:**
  - **DESPUÉS** de `IHDR` (y chunks de cabecera de paleta/color si existen).
  - **ANTES** o **DESPUÉS** de los chunks de imagen `IDAT`.
  - **SIEMPRE ANTES** del chunk de cierre `IEND`.

> **Nota Crítica sobre Inyección:** La inserción del chunk de metadatos debe realizarse **quirúrgicamente a nivel de bytes** en el flujo binario del PNG sin re-renderizar ni recodificar los bloques `IDAT`, preservando el hash criptográfico exacto del lienzo.

---

## 3. Codificación y Compresión de la Carga Útil

La carga útil del chunk `zTXt` tiene la siguiente estructura:

```
[ Keyword: "OIM_Data" ] + [ Null Separator: 0x00 ] + [ Método: 0x00 ] + [ zlib(JSON), binario ]
```

Sin Base64: medido el 29 oct 2026, el archivo pesa un 12–23 % menos que con el
`tEXt` anterior (`"OIM_Data\0"` + Base64 de Deflate crudo), que los lectores
siguen aceptando.

### 3.1. Flujo de Empaquetado (Serializer)

1. El objeto de metadatos OIM (conforme a `OimMetadataSchema`) se serializa a una cadena JSON codificada en **UTF-8**.
2. La cadena UTF-8 se comprime con **zlib** (RFC 1950: cabecera de 2 bytes, DEFLATE, Adler-32), nivel 9.
3. Se ensambla el chunk `zTXt`:
   - `Length`: `8` (clave) + `1` (byte nulo) + `1` (método) + `len(zlib)`
   - `Type`: `7A 54 58 74` (`zTXt`)
   - `Data`: `"OIM_Data\0\0"` + `<bytes_zlib>`
   - `CRC-32`: Calculado sobre `Type` y `Data`.

### 3.2. Flujo de Extracción y Descompresión (Reader)

Un `zTXt` se lee saltando el NUL y el byte de método y descomprimiendo con
zlib. Para el `tEXt` anterior, un decodificador conforme debe procesar la carga
útil con la siguiente tolerancia de fallos:
1. Extraer el valor del chunk tras el delimitador `0x00`.
2. Decodificar la cadena Base64 a bytes binarios.
3. Si la cadena en texto claro decodificada ya inicia con `{` (JSON sin comprimir de depuración/borrador), procesar directamente con `JSON.parse`.
4. Si contiene datos binarios comprimidos:
   - Intentar descomprimir con **Zlib Deflate** (`new DecompressionStream('deflate')` o `zlib.inflateSync`).
   - Si falla, intentar descomprimir con **Raw Deflate** (`new DecompressionStream('deflate-raw')` o `zlib.inflateRawSync`).
5. Decodificar los bytes resultantes con `TextDecoder("utf-8")` y parsear el JSON.

---

## 4. El Sello de Integridad de la Imagen (`image_hash`)

Para garantizar que un conjunto de metadatos interactivos válidos y firmados no pueda ser recortado y pegado sobre una imagen arbitraria (ataque de trasplante de lienzo), el formato implementa el sello de imagen sobre el stream IDAT:

### 4.1. Algoritmo de Cálculo

```
image_hash = SHA256( IDAT_payload_1 || IDAT_payload_2 || ... || IDAT_payload_n )
```

- Se recorren todos los chunks con tipo exacto `IDAT` en el orden estricto en que aparecen en el contenedor PNG.
- Se extrae exclusivamente la carga útil de cada chunk (`Data`, descartando los 4 bytes de longitud, 4 bytes de tipo `IDAT` y los 4 bytes de CRC).
- Se concatenan todos los bytes de datos de imagen cruda comprimida.
- Se calcula el digest **SHA-256** expresado en formato **hexadecimal minúsculo** (64 caracteres).

### 4.2. Campos en Metadatos
- `image_hash`: Cadena hexadecimal SHA-256 resultante.
- `image_hash_alg`: Literal `"sha256-idat"`.

---

## 5. Especificación de Firma Criptográfica ECDSA P-256

Un archivo `.oim` firmado garantiza la autoría, integridad y no repudio del diseño.

- **Criptosistema:** ECDSA sobre curva elíptica **NIST P-256** (secp256r1 / prime256v1).
- **Función Hash:** SHA-256.
- **Formato de Firma:** IEEE P1363 crudo (`r || s`, 32 bytes para $r$ + 32 bytes para $s$ = exactamente **64 bytes** binarios).
- **Serialización en JSON:** Base64 de los 64 bytes binarios en la propiedad `signature`. *(No se utiliza codificación ASN.1/DER).*

### 5.1. Reglas Canónicas de Serialización (JCS - JSON Canonicalization)

Para que cualquier implementación en cualquier lenguaje (TypeScript, Python, Rust, Go, Swift) verifique la firma de manera idéntica sin discrepancias de un solo byte, el payload a firmar o verificar se construye siguiendo estrictamente estas **7 Reglas**:

1. **Objeto Base:** Tomar el diccionario de metadatos OIM decodificado.
2. **Exclusiones de Raíz:** Excluir únicamente de la raíz los campos:
   - `signature`
   - `key_version`
   - `timestamp`
   - `creator_user_id` *(excluido por privacidad RGPD/Zero-Knowledge)*.  
   *(Nota: Si alguna de estas claves existe en objetos anidados o estilos, no se elimina).*
3. **Normalización Numérica:**
   - Si un número decimal tiene valor entero exacto (ej. `2.0` o `-0.0`), se formatea como entero (`2`, `0`).
   - Los números de coma flotante se formatean a un máximo de **6 cifras decimales** con redondeo simétrico estándar.
4. **Ordenación Léxica de Claves:** Todas las claves de los objetos (en la raíz y recursivamente en todos los niveles y dentro de arrays) se ordenan por punto de código Unicode ascendente.
5. **Serialización Compacta:** Sin espacios en blanco entre claves, dos puntos o comas: `{"a":1,"b":"dos"}`.
6. **Preservación UTF-8:** No escapar caracteres Unicode fuera de ASCII con secuencias `\uXXXX`. Se emiten directamente en UTF-8 nativo (ej. `"niño"` en lugar de `"ni\u00f1o"`).
7. **Digest:** Los bytes resultantes codificados en UTF-8 se pasan directamente a la función de verificación/firma SHA-256 + ECDSA P-256.

---

## 6. Manejo de Fuentes Incrustadas (`fonts`)

Desde la versión 1.3.0, el formato `.oim` es autónomo y no realiza llamadas a CDNs de terceros para renderizar tipografías:

- **Estructura del Array `fonts` en la Raíz:**
  ```json
  [
    {
      "family": "Bricolage Grotesque",
      "name": "oim-a9f81-BricolageGrotesque",
      "weight": 700,
      "style": "normal",
      "format": "woff2",
      "data": "<cadena_base64_del_binario_woff2_subseteado>"
    }
  ]
  ```
- **Subseteado Estricto:** Los binarios WOFF2 incrustados deben ser subseteados únicamente a los glifos presentes en los textos del proyecto para minimizar el peso total del PNG (típicamente de 4 KB a 18 KB por variante).
- **Registro en el Lector:**
  1. Decodificar `data` desde Base64.
  2. Registrar la fuente mediante `FontFace` (en navegadores) o registrar en el motor de fuentes del sistema nativo con el identificador único `name`.
  3. Vincular los slots que refieran a `family` con la variante resuelta.

---

## 7. Tabla Resumen de Campos y Compatibilidad

| Característica | Chunks / Clave | Formato | Mandatorio |
|---|---|---|---|
| **Imagen Base** | `IDAT` | PNG comprimido estándar | Sí |
| **Metadatos OIM** | `zTXt` (`OIM_Data`) | zlib(JSON), binario | Sí |
| **Sello IDAT** | `image_hash` | SHA-256 hex | Sí (desde v1.2) |
| **Firma Digital** | `signature` | Base64(ECDSA P1363 64B) | Opcional en borradores, Obligatorio en publicado |
| **Versión de Clave**| `key_version` | String (ej. `"v1"`) | Requerido si firmado |
| **Fecha de Firma**| `signed_at` | ISO-8601 UTC | Requerido si firmado |
| **Tipografías** | `fonts` | Array con WOFF2 Base64 | Recomendado |
| **Paletas con nombre** (1.20.0) | `palettes`, `defaultPalette` | Objeto nombre → (rol → color CSS); cadena | Opcional |

### Paletas con nombre (1.20.0)

`palettes` y `defaultPalette` son opcionales en la raíz del documento. Las
reglas de nombres, roles, límite de seis paletas y orden de resolución están en
`README.md` (sección «Paletas con nombre»). Un lector que no las conoce ignora
ambas claves y pinta los colores fijos de cada capa.
