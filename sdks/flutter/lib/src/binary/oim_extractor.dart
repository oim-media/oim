/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'zlib_decompressor.dart';

const List<int> pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

class OimExtractionResult {
  final Map<String, dynamic> metadata;
  final Uint8List imageBytes;
  final String? imageHash;

  OimExtractionResult({
    required this.metadata,
    required this.imageBytes,
    this.imageHash,
  });
}

/// Extracts OIM metadata JSON and IDAT hash from raw PNG bytes.
OimExtractionResult extractOIM(Uint8List pngBytes) {
  if (pngBytes.length < 8) {
    throw const FormatException('Invalid PNG: file is too small');
  }

  // Verify 8-byte PNG header
  for (int i = 0; i < 8; i++) {
    if (pngBytes[i] != pngSignature[i]) {
      throw const FormatException('Invalid PNG: signature does not match');
    }
  }

  final byteData = ByteData.sublistView(pngBytes);
  int offset = 8;
  Map<String, dynamic>? decodedMetadata;
  final idatChunks = <Uint8List>[];

  while (offset + 8 <= pngBytes.length) {
    final length = byteData.getUint32(offset, Endian.big);
    final typeOffset = offset + 4;
    final typeStr = String.fromCharCodes(pngBytes.sublist(typeOffset, typeOffset + 4));
    final dataOffset = typeOffset + 4;

    if (dataOffset + length + 4 > pngBytes.length) {
      break;
    }

    if (typeStr == 'tEXt') {
      final chunkData = pngBytes.sublist(dataOffset, dataOffset + length);
      final nullIdx = chunkData.indexOf(0);
      if (nullIdx != -1) {
        final keyword = latin1.decode(chunkData.sublist(0, nullIdx));
        if (keyword == 'OIM_Data' || keyword == 'OIM_JSON_DATA') {
          final rawValueBytes = chunkData.sublist(nullIdx + 1);
          // Try decompressing directly as raw deflate bytes first
          try {
            final parsed = decompressAndParseBytes(rawValueBytes);
            if (parsed is Map<String, dynamic>) {
              decodedMetadata = parsed;
            } else if (parsed is Map) {
              decodedMetadata = Map<String, dynamic>.from(parsed);
            }
          } catch (_) {
            // Fall back: treat raw value as base64 string
            final text = latin1.decode(rawValueBytes);
            final parsed = decodeAndDecompressJSON(text);
            if (parsed is Map<String, dynamic>) {
              decodedMetadata = parsed;
            } else if (parsed is Map) {
              decodedMetadata = Map<String, dynamic>.from(parsed);
            }
          }
        }
      }
    } else if (typeStr == 'zTXt') {
      final chunkData = pngBytes.sublist(dataOffset, dataOffset + length);
      final nullIdx = chunkData.indexOf(0);
      if (nullIdx != -1) {
        final keyword = latin1.decode(chunkData.sublist(0, nullIdx));
        if (keyword == 'OIM_Data' || keyword == 'OIM_JSON_DATA') {
          final compMethod = chunkData[nullIdx + 1];
          if (compMethod == 0) {
            final compressedBytes = chunkData.sublist(nullIdx + 2);
            final parsed = decompressAndParseBytes(compressedBytes);
            if (parsed is Map<String, dynamic>) {
              decodedMetadata = parsed;
            } else if (parsed is Map) {
              decodedMetadata = Map<String, dynamic>.from(parsed);
            }
          }
        }
      }
    } else if (typeStr == 'IDAT') {
      idatChunks.add(pngBytes.sublist(dataOffset, dataOffset + length));
    }

    // Move to next chunk: length (4) + type (4) + data (length) + CRC (4)
    offset += 12 + length;
  }

  if (decodedMetadata == null) {
    throw const FormatException('No OIM_Data metadata chunk found in PNG');
  }

  // Compute imageHash from concatenated IDAT chunks
  String? imageHash;
  if (idatChunks.isNotEmpty) {
    int totalLen = idatChunks.fold(0, (acc, c) => acc + c.length);
    final allIdat = Uint8List(totalLen);
    int at = 0;
    for (final c in idatChunks) {
      allIdat.setRange(at, at + c.length, c);
      at += c.length;
    }
    imageHash = sha256.convert(allIdat).toString();
  }

  return OimExtractionResult(
    metadata: decodedMetadata,
    imageBytes: pngBytes,
    imageHash: imageHash,
  );
}
