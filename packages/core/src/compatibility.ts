/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que un lector sepa DECIR lo que no entiende de un archivo.
 *
 * El formato ya degrada bien: `.passthrough()` deja pasar las claves
 * desconocidas, asi que un `.oim` escrito por un editor nuevo no revienta en un
 * player viejo. Pero degrada EN SILENCIO, y ese silencio es el problema.
 *
 * Medido el 27/08/2026: el esquema declara cuatro capabilities
 * -`vector_parallax`, `infinite_parallax`, `path_morph`, `physics_2d`- y el
 * player implementa DOS. `path_morph` y `physics_2d` no aparecen ni una vez en
 * su codigo. Un archivo que las declarara se pintaria mal sin que nada lo
 * dijera, y su autor no tendria forma de distinguir «el player no sabe hacer
 * esto» de «lo hice mal».
 *
 * ## Por que no se rechaza el archivo
 *
 * Porque el formato degrada a PNG por diseno: un `.oim` que no se puede leer
 * del todo sigue siendo una imagen valida, y eso es una red que Rive y Lottie
 * no tienen. Rechazar cambiaria una perdida parcial por una perdida total.
 *
 * Se pinta lo que se sabe y se DICE lo que no. La mitad amable de la
 * compatibilidad ya existia; esto es la otra mitad.
 *
 * ## Dos preguntas distintas
 *
 * `min_player` es un corte grueso: el formato cambio de una forma que un lector
 * anterior no puede reconstruir. `capabilities` es fino: el formato es el
 * mismo, pero el documento usa un efecto que este lector no implementa.
 *
 * Un archivo puede estar bien de version y aun asi pedir algo que falta.
 */

/**
 * La version del CONTRATO, no la de ningun paquete.
 *
 * `@oim-media/core` puede publicar diez versiones sin que el formato cambie, y el
 * formato puede cambiar sin que se toque el player. Atar ambos numeros haria
 * que una correccion interna pareciera una ruptura del formato.
 */
export const CONTRACT_VERSION = "1.22.0";
// 1.22.0: per-layer reveal transition (`reveal`), `animation.trigger` and the `play` action.
// Additive, no capability: a reader without them fades and autoplays, as before.
// 1.21.0: colour roles for patterns, backgrounds and shadows (`backgroundPatternColorRole`,
// `backgroundPatternBgColorRole`, `fillPatternColorRole`, `fillPatternBgColorRole`,
// `shadowColorRole`, ...). A reader without them paints the fixed colours, as before.
// 1.20.0: named palettes (`palettes`, `defaultPalette`) and four text roles
// (`text-primary`, `text-secondary`, `text-muted`, `text-on-accent`). A reader
// without them paints the fixed colour of each layer, as before.
// 1.19.0: twelve more frame shapes, a custom SVG outline for a photo frame (`svgPath`)
// and mirroring the photo inside a frame (`fillImageFlipX`/`Y`). Declared by the
// `frame_shapes` capability: a reader without it paints the frame as a rectangle
// with the whole photo.
// 1.18.0: filters on image layers and image fills (`filterPreset`, `filterBlur`, ...).
// Declared by the `media_filters` capability: a reader without it paints the picture unfiltered.
// 1.17.0: a shape filled with a picture (`fillType: "image"`, `fillImage`,
// `fillImageCrop`). Declared by the `image_fill` capability: a reader without it
// paints `fillColor`.
// 1.16.0: `alt`/`decorative` per layer and `description` per document, for
// screen readers. Additive: a reader that does not know them stays silent.
// 1.15.0: `imageCrop` per image layer (crop.ts). Additive: a reader that does
// not know it shows the whole image with its objectFit.
// 1.14.0: `flipX`/`flipY` per layer (flip.ts). Additive: a reader that does
// not know them shows the layer unflipped, the style schema lets them pass.
// 1.13.0: three entrance text effects, `reveal-mask`, `scale-in` and
// `rise-words` (text-effects.ts). Additive and without a capability, like the
// grain in 1.10.0: a reader that does not know them shows the text still,
// which is an acceptable fallback.
// 1.11.0: text marks. A text layer's `content` may carry `{name}...{/name}`
// tags, with literal braces doubled (`{{`, `}}`), and `style.marks` defines
// each mark's closed style (colour or role, bold, italic, underline,
// highlight). Declared by the `text_marks` capability. The syntax has ONE
// interpretation, text-marks.ts; the backend's twin shares its test cases.
// 1.10.0: a layer's grain gains `grainSize` (1-100) and `grainBlend`
// (overlay | soft-light | multiply); `grain` and `grainIntensity` already
// existed. Additive and without a capability on purpose: a reader that does
// not know the grain paints the layer without it, which is an acceptable
// fallback, and requiring 1.10.0 would lock out readers that show everything
// else perfectly.
// 1.9.0: un .oim deja de llevar CSS en crudo. `custom_loop_css`,
// `custom_keyframes` y `custom_hover_css` se marcan retiradas y el player no
// las aplica: acababan en una hoja de estilo donde `@import`, `image-set()` o
// un `}` que escapaba de la regla pedian recursos a terceros o reescribian el
// player. El editor nunca las escribio. `cssAnimation` queda acotada a la
// unica forma que el editor escribe.
// 1.8.0: las claves de estilo declaradas en 1.6 dejan de ser texto libre. Los
// dieciseis colores comparten `cssColor` -gemelo portable de `isSafeCssColor`,
// admite `var()` y `none`-; roles, patron, direccion y animacion de texto pasan
// a `enum` con el vocabulario del editor; y los tres `z.any()` -`cuts`,
// `fillGenerative`, `fillGradient`- tienen forma. `fillGradient` ya no admite
// una segunda imagen: con ella un archivo podia pedir recursos a un tercero.
// 1.7.0: se retira `allowed_domains` (marcada, no borrada). El .oim es un
// sandbox: abrirlo no conecta con nadie y el player deja de mirar en que
// sitio se abre. Desaparece el veredicto `domain_blocked`.
// 1.6.0: se retiran del contrato `path_morph` y `physics_2d` de `capabilities`
// al no haber sido implementadas nunca por ningun lector o player, quedando
// acotado a las implementadas (`vector_parallax` e `infinite_parallax`).
// 1.5.0: se retiran los SIETE alias de `style` -`size`, `font`, `color`,
// `bold`, `italic`, `underline`, `fontSizeOverrides`-. Sin fase de
// deprecacion: los .oim publicados son de prueba, asi que no habia
// compatibilidad que proteger. El compilador ya emite solo los canonicos
// (`canonizar_estilo`), y `fillColor` hereda el patron que tenia `color` —
// que resultaba estar mejor especificado que ella. `style` baja de 46 a 39.
// 1.4.0: the root declares `reedicion` -- who may re-edit the work -- and
// `name`. Both were in every published file and in no version of the
// contract, so a reader built from the contract alone could not know they
// exist; `reedicion` decides a permission, which is the worst kind of field to
// leave undeclared. The same release MARKS `terms_accepted` and
// `redirect_membership_verified` as deprecated: they were left behind by
// `allow_external_urls` in 1.1.0 and their only readers cannot fire for a
// conforming file. Nothing is removed and no min_player rises: an old file
// stays valid and a reader that ignores all four behaves as before.
// 1.3.0: the root may carry `fonts`, the font files a work uses, subset and
// base64 woff2. It raises no min_player: a reader that ignores it still paints
// the family by asking Google, as it always did.
// 1.2.0: `content` may carry the principal under "*". A key of its own is
// final for that language, even when empty. The schema does not change
// (content is already a string record); the meaning of "*" does, and that is
// what a reader in another language needs to know.
// 1.1.0: se retira `allow_external_urls`. El player ya no carga URL externas
// -- un .oim se comparte, y una peticion a un tercero al abrirlo revela IP y
// navegador de quien lo mira. Ningun archivo la usaba (0 de 20 medidos) y el
// editor nunca la escribio. Los esquemas son `.passthrough()`, asi que un
// archivo antiguo que la traiga SIGUE siendo valido: el campo se ignora.

/**
 * La primera version del formato. Lo que no exige nada mas, exige esto.
 *
 * Separada de `CONTRACT_VERSION` porque son dos cosas distintas: aquella
 * sube cuando el formato cambia, esta no se mueve nunca.
 */
export const BASE_CONTRACT_VERSION = "1.0.0";

/**
 * Lo que el player implementa HOY, medido y no supuesto.
 *
 * `path_morph` y `physics_2d` estan en el enum del esquema pero no en el
 * codigo: cero apariciones. Se quedan fuera a proposito -declarar lo que no se
 * hace es exactamente el silencio que esto viene a romper-.
 */
export const PLAYER_CAPABILITIES = ["vector_parallax", "infinite_parallax", "text_marks", "image_fill", "media_filters", "frame_shapes"] as const;

export interface Reader {
  /** La version del contrato que este lector implementa. */
  version: string;
  capabilities: readonly string[];
}

export interface MissingSupport {
  /** Lo que el archivo exige, tal cual venia. `null` si no exige nada. */
  requiredVersion: string | null;
  /** El archivo pide una version del formato posterior a la del lector. */
  versionTooOld: boolean;
  /** Capacidades que el documento declara y el lector no implementa. */
  missingCapabilities: string[];
  /** Capacidades requeridas que el documento exige y el lector no implementa. */
  missingRequiredCapabilities: string[];
  /** ¿Falta alguna capacidad requerida o la versión es demasiado antigua para renderizar con fidelidad? */
  cannotRender: boolean;
  /** ¿Hay algo que decir? */
  hayAlgoQueDecir: boolean;
}

/** `1.2.10` -> [1, 2, 10]. Cualquier cosa que no sea eso, `null`. */
function partes(version: unknown): [number, number, number] | null {
  if (typeof version !== "string") return null;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * ¿`a` es posterior a `b`? Si alguna no se puede leer, NO.
 *
 * Una version ilegible no debe convertirse en una advertencia: un archivo
 * puede traer cualquier cosa ahi, y gritar por un campo mal escrito enseñaria
 * a ignorar el aviso justo cuando importe.
 */
function esPosterior(a: unknown, b: unknown): boolean {
  const pa = partes(a), pb = partes(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

/**
 * Lo que este lector no puede honrar de este archivo.
 *
 * Un archivo sin `min_player` no exige nada: son todos los publicados hasta
 * hoy, y tratarlos como sospechosos convertiria el aviso en ruido de fondo.
 */
export function whatTheReaderCannotDo(metadata: any, lector: Reader): MissingSupport {
  const exigida = metadata && typeof metadata.min_player === "string" ? metadata.min_player : null;

  const declaradas: unknown[] = Array.isArray(metadata?.capabilities) ? metadata.capabilities : [];
  const missingCapabilities = declaradas
    .filter((c): c is string => typeof c === "string" && c !== "")
    .filter((c) => !lector.capabilities.includes(c))
    .filter((c, i, todas) => todas.indexOf(c) === i)
    .sort();

  const requeridas: unknown[] = Array.isArray(metadata?.capabilities_required)
    ? metadata.capabilities_required
    : [];
  const missingRequiredCapabilities = requeridas
    .filter((c): c is string => typeof c === "string" && c !== "")
    .filter((c) => !lector.capabilities.includes(c))
    .filter((c, i, todas) => todas.indexOf(c) === i)
    .sort();

  const versionTooOld = esPosterior(exigida, lector.version);
  const cannotRender = versionTooOld || missingRequiredCapabilities.length > 0;

  return {
    requiredVersion: exigida,
    versionTooOld,
    missingCapabilities,
    missingRequiredCapabilities,
    cannotRender,
    hayAlgoQueDecir: versionTooOld || missingCapabilities.length > 0 || missingRequiredCapabilities.length > 0,
  };
}

/** Una linea legible para la consola de quien incrusta el player. */
export function describeMissing(falta: MissingSupport): string {
  const partes: string[] = [];
  if (falta.versionTooOld) {
    partes.push(`el archivo pide la version ${falta.requiredVersion} del formato`);
  }
  if (falta.missingRequiredCapabilities && falta.missingRequiredCapabilities.length > 0) {
    partes.push(`requiere ${falta.missingRequiredCapabilities.join(", ")}`);
  }
  if (falta.missingCapabilities && falta.missingCapabilities.length > 0) {
    partes.push(`usa ${falta.missingCapabilities.join(", ")}`);
  }

  if (partes.length === 0) return "";
  const prefijo = falta.missingRequiredCapabilities && falta.missingRequiredCapabilities.length > 0
    ? "No se puede reproducir completamente"
    : "Se pinto lo que se pudo";
  return `${prefijo}: ${partes.join(" y ")}.`;
}

/**
 * Desde que version del contrato existe cada capacidad.
 *
 * **Hoy esta vacio a proposito, y eso es correcto:** las cuatro capabilities que
 * declara el esquema -`vector_parallax`, `infinite_parallax`, `path_morph`,
 * `physics_2d`- nacieron con la 1.0.0. Lo que no esta aqui vale la version
 * base.
 *
 * Existe vacio porque la alternativa es la trampa: escribir en `min_player` la
 * version con la que se compilo el editor. Eso funciona hoy y se rompe el dia
 * que el contrato llegue a la 1.1.0, porque un documento que no usa nada nuevo
 * empezaria a exigir 1.1.0 y dejaria fuera a lectores perfectamente capaces de
 * pintarlo. El fallo seria ademas invisible desde el editor: el archivo se ve
 * bien en quien lo escribio.
 *
 * `min_player` no es «con que se hizo», es «que hace falta para leerlo».
 */
export const VERSION_BY_CAPABILITY: Readonly<Record<string, string>> = { image_fill: "1.17.0", media_filters: "1.18.0", frame_shapes: "1.19.0" };

/** La mayor de dos versiones legibles; si alguna no lo es, la primera. */
function laMayor(a: string, b: string): string {
  return esPosterior(b, a) ? b : a;
}

/**
 * La version minima del contrato que hace falta para leer este documento.
 *
 * El mapa entra como parametro para poder probar el mecanismo sin inventarse
 * una capacidad futura en el codigo de produccion.
 */
export function minVersionFor(
  metadata: any,
  mapa: Readonly<Record<string, string>> = VERSION_BY_CAPABILITY,
): string {
  const declaradas: unknown[] = Array.isArray(metadata?.capabilities) ? metadata.capabilities : [];
  let minima = BASE_CONTRACT_VERSION;
  for (const c of declaradas) {
    if (typeof c !== "string") continue;
    const desde = mapa[c];
    if (typeof desde === "string") minima = laMayor(minima, desde);
  }
  return minima;
}
