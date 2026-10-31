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
  | 'verified_sin_autoria'
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
   * Idiomas presentes en el archivo.
   *
   * No es una lista declarada: el player la deduce de las claves de contenido
   * de cada capa, asi que refleja lo que de verdad esta traducido. Ya existia
   * en el prototipo; faltaba en el contrato.
   */
  readonly languages: string[];
  /** El idioma que se esta mostrando ahora mismo. */
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
