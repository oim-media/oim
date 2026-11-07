// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

// WOFF2 → sfnt (W3C WOFF 2.0, §4–5), so FontLoader can register the embedded
// fonts of files written before 1.27.0 ("woff2" is read forever). Brotli is the
// pure-Dart decoder; the glyf/loca transform is rebuilt here as the spec says.
// shortcut: a transformed hmtx (version 1) and font collections return null and
// the text falls back to the system font; upgrade if such a file ever shows up.

import 'dart:typed_data';
import 'package:brotli/brotli.dart';

const _knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

class _Reader {
  final ByteData d;
  int p;
  _Reader(Uint8List b, [this.p = 0]) : d = ByteData.sublistView(b);
  int u8() => d.getUint8(p++);
  int u16() => (p += 2, d.getUint16(p - 2)).$2;
  int i16() => (p += 2, d.getInt16(p - 2)).$2;
  int u32() => (p += 4, d.getUint32(p - 4)).$2;
  int base128() {
    var v = 0;
    for (var i = 0; i < 5; i++) {
      final b = u8();
      if (i == 0 && b == 0x80) throw const FormatException('leading zero');
      if (v & 0xFE000000 != 0) throw const FormatException('overflow');
      v = (v << 7) | (b & 0x7f);
      if (b & 0x80 == 0) return v;
    }
    throw const FormatException('base128 too long');
  }

  int u255() {
    final c = u8();
    if (c == 253) return u16();
    if (c == 255) return u8() + 253;
    if (c == 254) return u8() + 506;
    return c;
  }

  Uint8List bytes(int n) {
    final out = Uint8List.sublistView(d, p, p + n);
    p += n;
    return out;
  }
}

class _Table {
  final String tag;
  final int flags, origLength, length;
  _Table(this.tag, this.flags, this.origLength, this.length);
  bool get transformed => (tag == 'glyf' || tag == 'loca') ? flags >> 6 == 0 : flags >> 6 != 0;
}

/// The sfnt (TTF/OTF) inside a WOFF2 file, or null if it is not one this reader can rebuild.
Uint8List? woff2ToSfnt(Uint8List woff2) {
  try {
    final r = _Reader(woff2);
    if (r.u32() != 0x774F4632) return null; // 'wOF2'
    final flavor = r.u32();
    if (flavor == 0x74746366) return null; // 'ttcf'
    r.u32(); // length
    final numTables = r.u16();
    r.p = 48;
    final tables = <_Table>[];
    for (var i = 0; i < numTables; i++) {
      final flags = r.u8();
      final tag = (flags & 0x3f) == 63 ? String.fromCharCodes(r.bytes(4)) : _knownTags[flags & 0x3f];
      final orig = r.base128();
      final t = _Table(tag, flags, orig, 0);
      tables.add(_Table(tag, flags, orig, t.transformed ? r.base128() : orig));
    }
    if (tables.any((t) => t.transformed && t.tag != 'glyf' && t.tag != 'loca')) return null;
    final total = tables.fold<int>(0, (s, t) => s + t.length);
    final data = Uint8List.fromList(brotli.decode(woff2.sublist(r.p, r.p + ByteData.sublistView(woff2).getUint32(20))));
    if (data.length < total) return null;

    final out = <String, Uint8List>{};
    var off = 0;
    for (final t in tables) {
      out[t.tag] = Uint8List.sublistView(data, off, off + t.length);
      off += t.length;
    }
    final glyf = tables.where((t) => t.tag == 'glyf').firstOrNull;
    if (glyf != null && glyf.transformed) {
      final rebuilt = _rebuildGlyf(out['glyf']!);
      out['glyf'] = rebuilt.$1;
      out['loca'] = rebuilt.$2;
    }
    return _assemble(flavor, out);
  } catch (_) {
    return null;
  }
}

int _withSign(int flag, int base) => flag & 1 != 0 ? base : -base;

(Uint8List, Uint8List) _rebuildGlyf(Uint8List t) {
  final h = _Reader(t);
  h.u16(); // reserved
  final options = h.u16();
  final numGlyphs = h.u16();
  final indexFormat = h.u16();
  final sizes = [for (var i = 0; i < 7; i++) h.u32()];
  var at = h.p;
  _Reader stream(int i) {
    final s = _Reader(t, at);
    at += sizes[i];
    return s;
  }

  final nContours = stream(0), nPoints = stream(1), flagS = stream(2), glyphS = stream(3);
  final compS = stream(4), bboxS = stream(5), instrS = stream(6);
  final overlap = options & 1 != 0 ? Uint8List.sublistView(t, at, at + ((numGlyphs + 7) >> 3)) : null;
  final bitmapLen = ((numGlyphs + 31) >> 5) * 4;
  final bboxBitmap = bboxS.bytes(bitmapLen);
  bool hasBbox(int i) => bboxBitmap[i >> 3] & (0x80 >> (i & 7)) != 0;

  final glyf = BytesBuilder();
  final offsets = <int>[0];
  for (var g = 0; g < numGlyphs; g++) {
    final w = BytesBuilder();
    final n = nContours.i16();
    if (n == -1) {
      // Composite: copy its components, sizing each from its flags.
      final start = compS.p;
      var instructions = false;
      while (true) {
        final f = compS.u16();
        compS.p += 2 + (f & 0x1 != 0 ? 4 : 2) + (f & 0x8 != 0 ? 2 : f & 0x40 != 0 ? 4 : f & 0x80 != 0 ? 8 : 0);
        if (f & 0x100 != 0) instructions = true;
        if (f & 0x20 == 0) break;
      }
      final comp = Uint8List.sublistView(t, start, compS.p);
      final bb = ByteData(10)..setInt16(0, -1);
      for (var k = 0; k < 4; k++) {
        bb.setInt16(2 + k * 2, bboxS.i16());
      }
      w.add(bb.buffer.asUint8List());
      w.add(comp);
      if (instructions) {
        final len = glyphS.u255();
        w.add((ByteData(2)..setUint16(0, len)).buffer.asUint8List());
        w.add(instrS.bytes(len));
      }
    } else if (n > 0) {
      final ends = <int>[];
      var count = 0;
      for (var c = 0; c < n; c++) {
        count += nPoints.u255();
        ends.add(count - 1);
      }
      final xs = List<int>.filled(count, 0), ys = List<int>.filled(count, 0), on = List<bool>.filled(count, false);
      var x = 0, y = 0;
      for (var i = 0; i < count; i++) {
        var f = flagS.u8();
        on[i] = f >> 7 == 0;
        f &= 0x7f;
        int dx, dy;
        if (f < 10) {
          dx = 0;
          dy = _withSign(f, ((f & 14) << 7) + glyphS.u8());
        } else if (f < 20) {
          dx = _withSign(f, (((f - 10) & 14) << 7) + glyphS.u8());
          dy = 0;
        } else if (f < 84) {
          final b0 = f - 20, b1 = glyphS.u8();
          dx = _withSign(f, 1 + (b0 & 0x30) + (b1 >> 4));
          dy = _withSign(f >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
        } else if (f < 120) {
          final b0 = f - 84;
          dx = _withSign(f, 1 + ((b0 ~/ 12) << 8) + glyphS.u8());
          dy = _withSign(f >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyphS.u8());
        } else if (f < 124) {
          final a = glyphS.u8(), b = glyphS.u8(), c = glyphS.u8();
          dx = _withSign(f, (a << 4) + (b >> 4));
          dy = _withSign(f >> 1, ((b & 0x0f) << 8) + c);
        } else {
          final a = glyphS.u16(), b = glyphS.u16();
          dx = _withSign(f, a);
          dy = _withSign(f >> 1, b);
        }
        x += dx;
        y += dy;
        xs[i] = x;
        ys[i] = y;
      }
      final instrLen = glyphS.u255();
      final instr = instrS.bytes(instrLen);
      int xMin, yMin, xMax, yMax;
      if (hasBbox(g)) {
        xMin = bboxS.i16();
        yMin = bboxS.i16();
        xMax = bboxS.i16();
        yMax = bboxS.i16();
      } else {
        xMin = xs.reduce((a, b) => a < b ? a : b);
        xMax = xs.reduce((a, b) => a > b ? a : b);
        yMin = ys.reduce((a, b) => a < b ? a : b);
        yMax = ys.reduce((a, b) => a > b ? a : b);
      }
      final head = ByteData(10 + n * 2 + 2)
        ..setInt16(0, n)
        ..setInt16(2, xMin)
        ..setInt16(4, yMin)
        ..setInt16(6, xMax)
        ..setInt16(8, yMax);
      for (var c = 0; c < n; c++) {
        head.setUint16(10 + c * 2, ends[c]);
      }
      head.setUint16(10 + n * 2, instrLen);
      w.add(head.buffer.asUint8List());
      w.add(instr);
      // Flags, then x and y as short (±255) or word deltas; no repeat packing.
      final flags = BytesBuilder(), xb = BytesBuilder(), yb = BytesBuilder();
      var px = 0, py = 0;
      final firstOverlap = overlap != null && overlap[g >> 3] & (0x80 >> (g & 7)) != 0;
      for (var i = 0; i < count; i++) {
        var fl = on[i] ? 0x01 : 0;
        if (i == 0 && firstOverlap) fl |= 0x40;
        final dx = xs[i] - px, dy = ys[i] - py;
        px = xs[i];
        py = ys[i];
        if (dx == 0) {
          fl |= 0x10;
        } else if (dx.abs() <= 255) {
          fl |= 0x02 | (dx > 0 ? 0x10 : 0);
          xb.addByte(dx.abs());
        } else {
          xb.add((ByteData(2)..setInt16(0, dx)).buffer.asUint8List());
        }
        if (dy == 0) {
          fl |= 0x20;
        } else if (dy.abs() <= 255) {
          fl |= 0x04 | (dy > 0 ? 0x20 : 0);
          yb.addByte(dy.abs());
        } else {
          yb.add((ByteData(2)..setInt16(0, dy)).buffer.asUint8List());
        }
        flags.addByte(fl);
      }
      w.add(flags.takeBytes());
      w.add(xb.takeBytes());
      w.add(yb.takeBytes());
    }
    final bytes = w.takeBytes();
    glyf.add(bytes);
    final pad = (4 - bytes.length % 4) % 4;
    for (var i = 0; i < pad; i++) {
      glyf.addByte(0);
    }
    offsets.add(glyf.length);
  }
  final loca = ByteData((numGlyphs + 1) * (indexFormat == 0 ? 2 : 4));
  for (var i = 0; i <= numGlyphs; i++) {
    if (indexFormat == 0) {
      loca.setUint16(i * 2, offsets[i] >> 1);
    } else {
      loca.setUint32(i * 4, offsets[i]);
    }
  }
  return (glyf.takeBytes(), loca.buffer.asUint8List());
}

int _checksum(Uint8List b) {
  var sum = 0;
  final padded = Uint8List((b.length + 3) & ~3)..setAll(0, b);
  final d = ByteData.sublistView(padded);
  for (var i = 0; i < padded.length; i += 4) {
    sum = (sum + d.getUint32(i)) & 0xFFFFFFFF;
  }
  return sum;
}

Uint8List _assemble(int flavor, Map<String, Uint8List> tables) {
  final tags = tables.keys.toList()..sort();
  final n = tags.length;
  var pow2 = 1, log2 = 0;
  while (pow2 * 2 <= n) {
    pow2 *= 2;
    log2++;
  }
  var size = 12 + 16 * n;
  final offsets = <String, int>{};
  for (final tag in tags) {
    offsets[tag] = size;
    size += (tables[tag]!.length + 3) & ~3;
  }
  final out = Uint8List(size);
  final d = ByteData.sublistView(out)
    ..setUint32(0, flavor)
    ..setUint16(4, n)
    ..setUint16(6, pow2 * 16)
    ..setUint16(8, log2)
    ..setUint16(10, n * 16 - pow2 * 16);
  for (var i = 0; i < n; i++) {
    final tag = tags[i];
    var body = tables[tag]!;
    if (tag == 'head' && body.length >= 12) {
      body = Uint8List.fromList(body);
      ByteData.sublistView(body).setUint32(8, 0); // checkSumAdjustment, set below
      tables[tag] = body;
    }
    final rec = 12 + i * 16;
    for (var k = 0; k < 4; k++) {
      out[rec + k] = tag.codeUnitAt(k);
    }
    d
      ..setUint32(rec + 4, _checksum(body))
      ..setUint32(rec + 8, offsets[tag]!)
      ..setUint32(rec + 12, body.length);
    out.setAll(offsets[tag]!, body);
  }
  if (offsets.containsKey('head')) {
    d.setUint32(offsets['head']! + 8, (0xB1B0AFBA - _checksum(out)) & 0xFFFFFFFF);
  }
  return out;
}
