/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

const int maxDecompressedMetadataBytes = 10 * 1024 * 1024; // 10MB limit

/// Decodes base64 string and decompresses zlib/raw-deflate metadata into parsed JSON.
dynamic decodeAndDecompressJSON(
  String base64Str, {
  int maxBytes = maxDecompressedMetadataBytes,
}) {
  final cleanB64 = base64Str.replaceAll(RegExp(r'\s+'), '');

  // 1. Check for uncompressed base64 JSON
  try {
    final rawBytes = base64.decode(cleanB64);
    final rawText = utf8.decode(rawBytes, allowMalformed: true);
    if (rawText.trimLeft().startsWith('{')) {
      if (rawBytes.length > maxBytes) {
        throw FormatException('Metadata exceeds limit of 10MB (zip bomb detected)');
      }
      return jsonDecode(rawText);
    }
  } catch (e) {
    if (e is FormatException && e.message.contains('zip bomb detected')) {
      rethrow;
    }
    // Continue to zlib decoding
  }

  final bytes = base64.decode(cleanB64);
  return decompressAndParseBytes(bytes, maxBytes: maxBytes);
}

/// Decompresses raw/deflate bytes and parses as JSON.
dynamic decompressAndParseBytes(
  Uint8List bytes, {
  int maxBytes = maxDecompressedMetadataBytes,
}) {
  // Try standard zlib first, then raw deflate (wbits=-15)
  try {
    final decompressed = ZLibDecoder(raw: false).convert(bytes);
    if (decompressed.length > maxBytes) {
      throw FormatException('Metadata exceeds limit of 10MB (zip bomb detected)');
    }
    final text = utf8.decode(decompressed);
    return jsonDecode(text);
  } catch (e1) {
    if (e1 is FormatException && e1.message.contains('zip bomb detected')) {
      rethrow;
    }
    try {
      final decompressed = ZLibDecoder(raw: true).convert(bytes);
      if (decompressed.length > maxBytes) {
        throw FormatException('Metadata exceeds limit of 10MB (zip bomb detected)');
      }
      final text = utf8.decode(decompressed);
      return jsonDecode(text);
    } catch (e2) {
      if (e2 is FormatException && e2.message.contains('zip bomb detected')) {
        rethrow;
      }
      // If neither decompressed, check if it's already plain UTF-8 JSON text
      try {
        final text = utf8.decode(bytes);
        if (text.trimLeft().startsWith('{')) {
          return jsonDecode(text);
        }
      } catch (_) {}
      throw FormatException('Failed to decompress metadata via zlib or raw deflate: $e1 / $e2');
    }
  }
}
