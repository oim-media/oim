/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Who may re-edit a `.oim`.
 *
 * CANONICAL: it lives here and not in the editor because **the viewer needs
 * this rule too**, to decide which seal to show, and two implementations of
 * "what an unknown value means" is exactly the kind of divergence this
 * package exists to prevent.
 *
 * "Does the author allow re-editing?" and "who may?" are one question with
 * three answers. Both ends already existed: `immutable_lock` is "nobody", and
 * there was no way to say "anyone".
 */

export type ReeditPermission = "publico" | "solo_autor" | "sellado";

/** The value when the file says nothing. ALL current .oim files fall here. */
export const DEFAULT_PERMISSION: ReeditPermission = "solo_autor";

const VALID_PERMISSIONS: readonly ReeditPermission[] = ["publico", "solo_autor", "sellado"];

/**
 * Reads the permission from the metadata.
 *
 * **An unknown value falls back to `solo_autor`, never to `publico`.** This is the
 * rule that stops corrupt —or tampered— data from loosening a permission. A
 * permission system's default is chosen by what happens when something goes wrong,
 * not by what happens when it goes right.
 */
export function permissionOf(metadata: unknown): ReeditPermission {
  if (!metadata || typeof metadata !== "object") return DEFAULT_PERMISSION;
  const m = metadata as Record<string, unknown>;

  // The legacy lock wins over everything else: there are published files that carry
  // it, and none carries `reedicion` yet. If a file said `reedicion: "publico"` and
  // `immutable_lock: true`, the prudent choice is sealing.
  if (m.immutable_lock === true || m.immutable === true) return "sellado";

  const v = m.reedicion;
  return typeof v === "string" && (VALID_PERMISSIONS as readonly string[]).includes(v)
    ? (v as ReeditPermission)
    : DEFAULT_PERMISSION;
}

/**
 * The fields a `.oim` must carry to express this permission.
 *
 * **The inverse of `permissionOf`, and it lives here so the two cannot drift apart.** The
 * lock and the permission were two mechanisms for one idea: `permissionOf` already
 * translated `immutable_lock: true` to `"sellado"`, but when WRITING each side decided
 * on its own. The editor exported only the lock, with a label that also said something
 * else: «the JSON can no longer be modified after render», which is what the SIGNATURE
 * does, not this.
 *
 * Both fields are written, and that is not redundancy:
 *
 *   - `reedicion` travels INSIDE the file. It is the declaration: anyone who
 *     opens it knows what its author wanted, without asking anyone.
 *   - `immutable_lock` is what the backend stores in the registry. It is the
 *     enforcement: the only thing that can truly refuse to sign.
 *
 * A declaration without enforcement is a suggestion; enforcement without a
 * declaration is a locked door with no sign.
 */
export function permissionFields(permission: ReeditPermission): {
  reedicion: ReeditPermission;
  immutable_lock: boolean;
} {
  return { reedicion: permission, immutable_lock: permission === "sellado" };
}

export interface Verdict {
  permitido: boolean;
  /** Why not, so the person can be told without guessing. */
  reason?: "sellado" | "no_eres_el_autor";
}

/**
 * Can this person re-edit this document?
 *
 * `isAuthor` is `null` when it is not known (no session, or the registry was never
 * asked). In that case it is NOT granted: only the `publico` permission resolves
 * without knowing who you are, which is exactly what makes it useful for a library.
 */
export function canReedit(
  permission: ReeditPermission,
  isAuthor: boolean | null
): Verdict {
  if (permission === "sellado") return { permitido: false, reason: "sellado" };
  if (permission === "publico") return { permitido: true };
  return isAuthor === true
    ? { permitido: true }
    : { permitido: false, reason: "no_eres_el_autor" };
}

/**
 * Must this be rejected WITHOUT asking anyone?
 *
 * Only when the answer is certain. It is a different question from `canReedit`, and
 * confusing them breaks the most common case:
 *
 * - `sellado` → yes, nobody can, and that is known by reading the file.
 * - `publico` → no, anyone can.
 * - `solo_autor` → **NOT rejected here**, unless it is known for certain that you are
 *   not the author. And that is almost never known: the backend deletes
 *   `creator_user_id` from the canonical before signing (it is personal data), so a
 *   `.oim` does not carry within it who made it. The authoritative answer lives
 *   in the registry.
 *
 * Rejecting on `null` would block everyone, including their OWN files, because none
 * of the .oim files that exist today carries authorship within it.
 */
export function mustRejectWithoutAsking(
  permission: ReeditPermission,
  isAuthor: boolean | null
): Verdict {
  if (permission === "sellado") return { permitido: false, reason: "sellado" };
  if (permission === "solo_autor" && isAuthor === false) {
    return { permitido: false, reason: "no_eres_el_autor" };
  }
  return { permitido: true };
}

/**
 * Must the registry be asked about this document?
 *
 * **Public ones are NOT looked up, not even to read.** Without a registry row their
 * `oim_id` is free, and whoever first re-edits it «as their own» would create the row
 * with themselves as author. Being insert-only, that row can NEVER be overwritten:
 * it could seal someone else's document. If a public file never looks up its id,
 * nobody can claim it by that route.
 */
export function registryQuery(permission: ReeditPermission): boolean {
  return permission !== "publico";
}

/**
 * Which seal the file deserves.
 *
 * Today the viewer only tells «signed» from «unsigned», and with public files that label
 * starts promising too much: anyone can take one, change a figure, re-sign it, and it
 * would come out just as «verified». It is not a flaw in the model
 * —it is what public means— but the seal has to say so,
 * or it stops meaning anything.
 */
export function signatureStamp(permission: ReeditPermission): "verified" | "verified_sin_autoria" {
  return permission === "publico" ? "verified_sin_autoria" : "verified";
}
