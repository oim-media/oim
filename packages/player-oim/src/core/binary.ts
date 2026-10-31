/**
 * Binary parsing for the player delegates to @oim-media/core — the single source of
 * truth for OIM chunk extraction and metadata decompression (plain JSON →
 * zlib deflate → raw deflate, matching the backend's wbits=-15 output).
 *
 * Imported via the module file (not the package index) so the player bundle
 * only inlines the binary logic and never drags in schema/zod.
 */
export { extractOIM, decodeAndDecompressJSON, decompressBytes } from '../../../core/src/binary.js';
export { serializeCanonical } from '../../../core/src/canonical.js';
