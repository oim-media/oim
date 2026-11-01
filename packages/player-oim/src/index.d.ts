/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Public types of `@oim-media/player-oim`. Written by hand, so it MUST match the
 * runtime exports of `index.ts`: `published-surface.test.ts` fails when it drifts.
 */

/** Options accepted by `OimPlayer.mount()`. They reach the engine as-is. */
export interface OimPlayerOptions {
  allowZoom?: boolean;
  /** @deprecated No effect; removed in 2.0.0. */
  showLanguageSelector?: boolean;
  showSlots?: boolean;
  allowLottie?: boolean;
  allowDynamicColors?: boolean;
  disableAnimations?: boolean;
  disableActions?: boolean;
  /** @deprecated No effect; removed in 2.0.0. */
  dropdownBlur?: boolean;
  fit?: 'contain' | 'cover';
  align?: 'center' | 'top' | 'bottom';
  placeholder?: string;
}

export type OimSecurityStatus =
  | 'no_metadata'
  | 'unsigned'
  | 'verified'
  | 'verified_authorless'
  /** Signed before the image seal existed: the metadata is OIM's, the image is not checked. */
  | 'image_unsealed'
  | 'invalid_signature'
  /** Authentic, but signed with a key the player no longer trusts (past its verify_until). */
  | 'expired_key'
  /** The image does not match the signed `image_hash`. The file is not shown. */
  | 'image_mismatch'
  | 'corrupt';

export interface OimPlayerInstance extends HTMLElement {
  src: Blob | string;
  lang: string;
  destroy(): void;
  getMetadata(): any;
  getSecurityStatus(): OimSecurityStatus | null;
  setLang(lang: string): void;
  /**
   * Languages present in the file.
   *
   * It is not a declared list: the player derives it from the content keys of
   * each layer, so it reflects what is actually translated. It already existed
   * in the prototype; it was missing from the contract.
   */
  readonly languages: string[];
  /** The language being shown right now. */
  readonly currentLang: string | null;
  setZoom(zoom: number): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  getEngine(): any;
}

declare const OimPlayer: {
  mount(
    containerId: string | HTMLElement,
    src: Blob | string,
    opts?: OimPlayerOptions
  ): OimPlayerInstance | null;
};

export { OimPlayer };
export default OimPlayer;

/** Same function as `OimPlayer.mount`. */
export declare const mount: typeof OimPlayer.mount;

/** The element prototype behind `<oim-player>`. Not meant to be instantiated. */
export declare const OimPlayerElement: object;
