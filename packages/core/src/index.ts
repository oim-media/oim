export * from "./schema.js";
export * from "./binary.js";
export * from "./canonical.js";
export * from "./api.js";
// `./grupos.js`: la regla de pertenencia -quien es hijo de quien-. Es la
// unica parte de los grupos donde el editor y el player deben coincidir; si
// discrepan, el mismo archivo se pinta distinto segun quien lo abra.
export * from "./groups.js";
// `./tipografia.js`: el interlineado. Vive compartido porque el fallo ERA que
// el editor y el player no coincidian en el.
export * from "./typography.js";
// `./recorte.js`: quien recorta y quien no. Compartido porque el editor tenia
// el mismo fallo que el player -recortaba los glifos del texto- y dos
// implementaciones volverian a discrepar.
export * from "./clipping.js";
// `./compatibilidad.js`: que un lector sepa DECIR lo que no entiende. El
// formato ya degradaba bien; lo que faltaba era que no lo hiciera en silencio.
export * from "./compatibility.js";
export * from "./media-filters.js";
export * from "./flip.js";
export * from "./reveal.js";
export * from "./crop.js";
// Las cuatro reglas de formato que el editor tenia COPIADAS en
// `src/lib/parallax/`, con su propio fichero de bloqueo y su guardia de
// hashes: geometria de las formas, CSS del parallax, permiso de reedicion y
// sobredimensionado. Ninguna importa nada, asi que moverlas fue trivial; lo
// caro era la maquinaria que existia para mantener las dos copies iguales.
export * from "./geoShapes.js";
// frame-silhouette.ts: the outline a photo frame crops to, shared by player and editor (1.19.0).
export * from "./frame-silhouette.js";
export * from "./parallaxCss.js";
export * from "./reeditPermission.js";
export * from "./oversize.js";
// El relleno y el motor de patrones. `fill.ts` estaba duplicado con una
// divergencia REAL: el editor deducia el tipo desde el color y el player no,
// asi que una capa con `fillColor` y sin `fillType` se pintaba en uno y salia
// vacia en el otro. Se conserva la deduccion.
export * from "./fill.js";
export * from "./patterns.js";
export * from "./dynamic-colors.js";
// css-gradient.ts: whitelist for `fillGradient`, the other CSS a .oim hands the player.
export * from "./css-gradient.js";
export * from "./generative/proceduralNoise.js";
// `./artisticTextCurve.js`: el trazado del texto artistico curvado. Sexto caso
// del mismo patron: estaba escrito dos veces y las dos copias divergieron -el
// arco salia un 80% mas curvado al publicarse que al editarlo-.
export * from "./artisticTextCurve.js";
// `./artisticTextExtrusion.js`: the 3D extrusion. Seventh case: the editor
// darkened it and the player lightened it, from the same colour.
export * from "./artisticTextExtrusion.js";
// `./embeddedFonts.js`: fonts shipped inside the file, so a .oim no longer asks
// Google for its font every time someone opens it.
export * from "./embeddedFonts.js";
// fontFile.ts — whether an uploaded font may be embedded (staff catalog, part 3).
export * from "./fontFile.js";
// `./dimensions.js`: resolución de dimensiones hacia CSS/unidades de usuario.
export * from "./dimensions.js";
export * from "./effects/index.js";
// `./serialize.js` (mapLayersToOimSlots) se eliminó: era un tercer compilador
// de medidas, exportado como API pública de @oim-media/core pero sin ningún
// consumidor salvo su propio test. Anclaba la posición al CENTRO del slot
// (`anchorX += w/2`), mientras el compilador real —el del backend, en
// `/api/v1/oim/compile`— la ancla a la esquina superior izquierda. Un tercero
// que integrara contra este paquete habría obtenido todo desplazado media
// caja, sin ningún error que lo delatara.
export * from "./text-marks.js";
export * from "./drop-cap.js";
export * from "./text-effects.js";
export * from "./glitch.js";
