import { extractOIM } from './binary.js';
import { normalizeRawSlots } from './normalize-raw-slots.js';
import {
  verifyMetadataSignature,
  validateOimMetadata,
  securityVerdict,
  isRefused,
  ALTERED_FILE_ERROR,
  keyExpiredForFile
} from './security.js';
import { useKeysEndpoint } from './keys.js';

self.onmessage = async function (e: MessageEvent) {
  const { id, blob, origin, keysUrl } = e.data;
  // There is no `window` here: the page's OIM_PLAYER_CONFIG never reaches this
  // scope, so the address travels in the message.
  useKeysEndpoint(keysUrl);
  try {
    const extracted = await extractOIM(blob);
    if (!extracted.metadata) {
      self.postMessage({
        id,
        success: true,
        metadata: { slots: [] },
        isSigValid: false,
        security: 'no_metadata'
      });
      return;
    }

    const errs = validateOimMetadata(extracted.metadata);
    if (errs.length > 0) {
      throw new Error('Corrupted or tampered OIM file: ' + errs[0]);
    }

    const isSigned = !!(extracted.metadata.signature && extracted.metadata.key_version);
    const isSigValid = await verifyMetadataSignature(extracted.metadata, origin);
    const keyExpired = isSigned && isSigValid ? await keyExpiredForFile(extracted.metadata) : false;

    // Same verdict as the main thread (security.ts), on the ORIGINAL metadata.
    const security = securityVerdict({ isSigned, isSigValid, keyExpired, metadata: extracted.metadata, imageHash: extracted.imageHash });
    if (isRefused(security)) {
      self.postMessage({ id, success: false, refused: true, security, error: ALTERED_FILE_ERROR + ': ' + security });
      return;
    }

    if (!isSigValid) {
      extracted.metadata = { slots: [] };
    } else if (security === 'unsigned' || security === 'expired_key') {
      extracted.metadata = { slots: [], elements: [], layers: [] };
    } else {
      // Normalize Python backend format AFTER signature validation.
      normalizeRawSlots(extracted.metadata);
    }

    self.postMessage({
      id,
      success: true,
      metadata: extracted.metadata,
      isSigValid,
      security
    });
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err.message || String(err)
    });
  }
};
export {};
