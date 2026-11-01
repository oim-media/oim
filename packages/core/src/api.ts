/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OIM API contract: where the backend lives, how its endpoints are named and
 * what shape the raw measurements sent to it have.
 *
 * It exists because the three plugins had drifted on their own. Two of them pointed at
 * `http://localhost:8000` BY DEFAULT, so once published they would have called the user's
 * own machine, and one sent the form field under a name the backend does not read,
 * producing PNGs with no
 * OIM data inside and returning 200 OK.
 *
 * The rule: no plugin writes a URL or a field name by hand.
 */

/** Production. The default is NEVER localhost: a published plugin with that
 *  default URL calls the machine of whoever uses it, not yours. */
export const OIM_BACKEND_URL_DEFAULT = "https://api.oim.media";

/**
 * Canonical routes. All under `/v1/`: the host is already `api.oim.media`, so the
 * `/api` segment was noise.
 *
 * Four conventions used to coexist: `/v1/media/*`, `/api/v1/fonts/*`,
 * `/api/v1/oim/compile` and four unversioned endpoints, one of them with a half-translated
 * name (`/upload-y-empaquetar`). Compile and package, which are called in sequence, lived in
 * different namespaces.
 *
 * The old routes still respond, with the `Deprecation` header, but they do not appear in
 * the documentation and must not be used in new code.
 */
export const OIM_ENDPOINTS = {
  /** Translates raw pixel measurements into adaptive units. THE ONLY
   *  compiler in the system: no client normalizes on its own. */
  compile: "/v1/oim/compile",
  /**
   * Merges the base image with the metadata and returns the `.oim.png` as
   * a binary in the response itself.
   *
   * An earlier `?temp=true` saved the file instead and returned a link. The file lived
   * on the disk of ONE backend instance, and the download, being another request, could
   * land on another one: with more than one instance it failed with 404.
   * The state was not shared; it was removed.
   */
  package: "/v1/oim/package",
  /** Extracts the OIM metadata from an already packaged PNG. */
  extract: "/v1/oim/extract",
  sign: "/v1/media/sign-json",
  verifyAuthor: "/v1/media/verify-author",
  translate: "/v1/media/translate",
  publicKeys: "/v1/media/keys",
} as const;

/**
 * Names of the `multipart/form-data` fields that `package` expects.
 *
 * The backend accepts several aliases (`metadata`/`data`/`json`), but a new client
 * must use these: the Framer plugin sent `metadata_json`, which is none of them, and the
 * backend read it as an empty string without complaint.
 */
export const OIM_PACKAGE_FIELDS = {
  file: "file",
  metadata: "metadata",
} as const;

/**
 * Raw measurements of a slot, in pixels and relative to the top-left corner of the
 * canvas.
 *
 * The three plugins already emitted exactly these names, so this type translates nothing:
 * it freezes them. The alternative that was considered (a conversion template per editor)
 * would have meant translating a format into itself.
 */
export interface OimRawSlotGeometry {
  x_px: number;
  y_px: number;
  width_px: number;
  height_px: number;
  font_size_px?: number;
}

/** Body of `POST /v1/oim/compile`. */
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
  /** Which client compiles. Used to diagnose divergences by origin. */
  source?: string;
}

/**
 * Resolves the backend URL from an environment override.
 *
 * Accepts empty, undefined and whitespace as "not configured": a variable that is declared
 * but has no value is the case that in practice breaks deployments, and `||` alone already
 * covers it, but it does not cover `"  "`.
 */
export function resolveBackendUrl(override?: string | null): string {
  const limpio = (override || "").trim();
  return (limpio || OIM_BACKEND_URL_DEFAULT).replace(/\/+$/, "");
}

/** Builds an absolute endpoint URL. */
export function oimEndpoint(
  endpoint: keyof typeof OIM_ENDPOINTS,
  backendUrl?: string | null
): string {
  return `${resolveBackendUrl(backendUrl)}${OIM_ENDPOINTS[endpoint]}`;
}
