export interface OimPlayerOptions {
  allowZoom?: boolean;
  showLanguageSelector?: boolean;
  showSlots?: boolean;
  allowLottie?: boolean;
  disableAnimations?: boolean;
  dropdownBlur?: boolean;
  fit?: 'contain' | 'cover';
  align?: 'center' | 'top' | 'bottom';
  variant?: 'hero' | string;
}

export type OimSecurityStatus =
  | 'no_metadata'
  | 'unsigned'
  | 'verified'
  | 'verified_authorless'
  /** Signed before the image seal existed: the metadata is OIM's, the image is not checked. */
  | 'image_unsealed'
  | 'invalid_signature'
  /** The image does not match the signed `image_hash`. The file is not shown. */
  | 'image_mismatch'
  | 'corrupt';

export interface OimPlayerInstance extends HTMLElement {
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

export const OimPlayer: {
  mount(
    containerId: string | HTMLElement,
    src: Blob | string,
    opts?: OimPlayerOptions
  ): OimPlayerInstance | null;
};

declare const _default: {
  version: string;
  description: string;
  OimPlayer: typeof OimPlayer;
};
export default _default;
