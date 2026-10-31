/**
 * Contrato de la API de OIM: dónde vive el backend, cómo se llaman sus
 * endpoints y qué forma tienen las medidas crudas que se le envían.
 *
 * Existe porque los tres plugins habían derivado por su cuenta. Dos de ellos
 * apuntaban a `http://localhost:8000` POR DEFECTO —o sea que publicados
 * habrían llamado a la máquina del propio usuario—, y uno enviaba el campo de
 * formulario con un nombre que el backend no lee, produciendo PNGs sin ningún
 * dato OIM dentro y devolviendo 200 OK.
 *
 * La regla: ningún plugin escribe una URL ni el nombre de un campo a mano.
 */

/** Producción. El defecto NUNCA es localhost: un plugin publicado con esa
 *  URL por defecto llama a la máquina de quien lo usa, no a la tuya. */
export const OIM_BACKEND_URL_DEFAULT = "https://api.oim.media";

/**
 * Rutas canónicas. Todas bajo `/v1/`: el host ya es `api.oim.media`, así que
 * el segmento `/api` era ruido.
 *
 * Antes convivían cuatro convenciones —`/v1/media/*`, `/api/v1/fonts/*`,
 * `/api/v1/oim/compile` y cuatro endpoints sin versionar, uno de ellos con el
 * nombre a medio traducir (`/upload-y-empaquetar`)—. Compilar y empaquetar,
 * que se llaman en secuencia, vivían en espacios de nombres distintos.
 *
 * Las rutas antiguas siguen respondiendo, con la cabecera `Deprecation`, pero
 * no aparecen en la documentación ni deben usarse en código nuevo.
 */
export const OIM_ENDPOINTS = {
  /** Traduce medidas en píxeles crudos a unidades adaptativas. ÚNICO
   *  compilador del sistema: ningún cliente normaliza por su cuenta. */
  compile: "/v1/oim/compile",
  /**
   * Fusiona la imagen base con los metadatos y devuelve el `.oim.png` como
   * binario en la propia respuesta.
   *
   * Hubo un `?temp=true` que en su lugar guardaba el archivo y devolvía un
   * enlace. El archivo vivía en el disco de UNA instancia del backend y la
   * descarga, al ser otra petición, podía caer en otra: con más de una
   * instancia fallaba con 404. No se repartió el estado, se eliminó.
   */
  package: "/v1/oim/package",
  /** Extrae los metadatos OIM de un PNG ya empaquetado. */
  extract: "/v1/oim/extract",
  sign: "/v1/media/sign-json",
  verifyAuthor: "/v1/media/verify-author",
  translate: "/v1/media/translate",
  publicKeys: "/v1/media/keys",
} as const;

/**
 * Nombres de los campos de `multipart/form-data` que espera `package`.
 *
 * El backend acepta varios alias (`metadata`/`data`/`json`), pero un cliente
 * nuevo debe usar estos: el plugin de Framer enviaba `metadata_json`, que no
 * es ninguno de ellos, y el backend lo leía como cadena vacía sin protestar.
 */
export const OIM_PACKAGE_FIELDS = {
  file: "file",
  metadata: "metadata",
} as const;

/**
 * Medidas crudas de un slot, en píxeles y relativas a la esquina superior
 * izquierda del lienzo.
 *
 * Los tres plugins ya emitían exactamente estos nombres, así que este tipo no
 * traduce nada: los congela. La alternativa que se barajó —una plantilla de
 * conversión por editor— habría sido traducir un formato a sí mismo.
 */
export interface OimRawSlotGeometry {
  x_px: number;
  y_px: number;
  width_px: number;
  height_px: number;
  font_size_px?: number;
}

/** Cuerpo de `POST /v1/oim/compile`. */
export interface OimCompileRequest {
  canvas_width: number;
  canvas_height: number;
  slots_raw: Array<OimRawSlotGeometry & {
    id: string;
    type?: string;
    content?: Record<string, string>;
    style?: Record<string, unknown>;
    align?: string;
    [extra: string]: unknown;
  }>;
  oim_id?: string;
  allowed_domains?: string[];
  immutable_lock?: boolean;
  /** Qué cliente compila. Sirve para diagnosticar divergencias por origen. */
  source?: string;
}

/**
 * Resuelve la URL del backend a partir de un override de entorno.
 *
 * Acepta vacío, undefined y espacios en blanco como "no configurado" — una
 * variable declarada pero sin valor es el caso que en la práctica rompe los
 * despliegues, y `||` sola ya lo cubre, pero no cubre `"  "`.
 */
export function resolveBackendUrl(override?: string | null): string {
  const limpio = (override || "").trim();
  return (limpio || OIM_BACKEND_URL_DEFAULT).replace(/\/+$/, "");
}

/** Construye una URL absoluta de endpoint. */
export function oimEndpoint(
  endpoint: keyof typeof OIM_ENDPOINTS,
  backendUrl?: string | null
): string {
  return `${resolveBackendUrl(backendUrl)}${OIM_ENDPOINTS[endpoint]}`;
}
