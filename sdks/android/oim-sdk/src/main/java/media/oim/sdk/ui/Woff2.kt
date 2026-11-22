/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import org.brotli.dec.BrotliInputStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs

// WOFF2 -> sfnt (W3C WOFF 2.0, sections 4-5): Android's Typeface cannot open WOFF2, and the editor
// embeds most fonts that way. Port of the Flutter SDK's woff2.dart, checked against the same fixtures.
// shortcut: a transformed hmtx (version 1) and font collections return null and the text falls back
// to the system font; upgrade if such a file ever shows up.

private val KNOWN_TAGS = listOf(
    "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
    "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS",
    "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc",
    "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
    "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
)

private class Woff2Reader(val b: ByteArray, var p: Int = 0) {
    fun u8(): Int = b[p++].toInt() and 0xFF
    fun u16(): Int = (u8() shl 8) or u8()
    fun i16(): Int = u16().toShort().toInt()
    fun u32(): Long = (u16().toLong() shl 16) or u16().toLong()
    fun base128(): Int {
        var v = 0L
        repeat(5) { i ->
            val c = u8()
            require(!(i == 0 && c == 0x80)) { "leading zero" }
            require(v and 0xFE000000L == 0L) { "overflow" }
            v = (v shl 7) or (c and 0x7F).toLong()
            if (c and 0x80 == 0) return v.toInt()
        }
        throw IllegalArgumentException("base128 too long")
    }
    fun u255(): Int = when (val c = u8()) {
        253 -> u16()
        255 -> u8() + 253
        254 -> u8() + 506
        else -> c
    }
    fun bytes(n: Int): ByteArray = b.copyOfRange(p, p + n).also { p += n }
}

private class Woff2Table(val tag: String, val flags: Int, val length: Int) {
    val transformed get() = if (tag == "glyf" || tag == "loca") flags shr 6 == 0 else flags shr 6 != 0
}

/** The sfnt (TTF/OTF) inside a WOFF2 file, or null if it is not one this reader can rebuild. */
internal fun woff2ToSfnt(woff2: ByteArray): ByteArray? = runCatching {
    val r = Woff2Reader(woff2)
    if (r.u32() != 0x774F4632L) return null // 'wOF2'
    val flavor = r.u32()
    if (flavor == 0x74746366L) return null // 'ttcf'
    r.u32() // length
    val numTables = r.u16()
    r.p = 20
    val compressedSize = r.u32().toInt()
    r.p = 48
    val tables = (0 until numTables).map {
        val flags = r.u8()
        val tag = if (flags and 0x3F == 63) String(r.bytes(4), Charsets.ISO_8859_1) else KNOWN_TAGS[flags and 0x3F]
        val orig = r.base128()
        val probe = Woff2Table(tag, flags, orig)
        Woff2Table(tag, flags, if (probe.transformed) r.base128() else orig)
    }
    if (tables.any { it.transformed && it.tag != "glyf" && it.tag != "loca" }) return null
    val data = BrotliInputStream(woff2.inputStream(r.p, compressedSize)).use { it.readBytes() }
    if (data.size < tables.sumOf { it.length }) return null

    val out = sortedMapOf<String, ByteArray>()
    var off = 0
    for (t in tables) {
        out[t.tag] = data.copyOfRange(off, off + t.length)
        off += t.length
    }
    if (tables.firstOrNull { it.tag == "glyf" }?.transformed == true) {
        val (glyf, loca) = rebuildGlyf(out.getValue("glyf"))
        out["glyf"] = glyf
        out["loca"] = loca
    }
    assembleSfnt(flavor, out)
}.getOrNull()

private fun withSign(flag: Int, base: Int) = if (flag and 1 != 0) base else -base

private fun ByteArrayOutputStream.u16(v: Int) { write(v shr 8 and 0xFF); write(v and 0xFF) }

private fun rebuildGlyf(t: ByteArray): Pair<ByteArray, ByteArray> {
    val h = Woff2Reader(t)
    h.u16() // reserved
    val options = h.u16()
    val numGlyphs = h.u16()
    val indexFormat = h.u16()
    val sizes = IntArray(7) { h.u32().toInt() }
    var at = h.p
    fun stream(i: Int) = Woff2Reader(t, at).also { at += sizes[i] }
    val nContours = stream(0); val nPoints = stream(1); val flagS = stream(2); val glyphS = stream(3)
    val compS = stream(4); val bboxS = stream(5); val instrS = stream(6)
    val overlap = if (options and 1 != 0) t.copyOfRange(at, at + ((numGlyphs + 7) shr 3)) else null
    val bboxBitmap = bboxS.bytes(((numGlyphs + 31) shr 5) * 4)
    fun bit(bits: ByteArray, i: Int) = bits[i shr 3].toInt() and (0x80 shr (i and 7)) != 0

    val glyf = ByteArrayOutputStream()
    val offsets = IntArray(numGlyphs + 1)
    for (g in 0 until numGlyphs) {
        val w = ByteArrayOutputStream()
        val n = nContours.i16()
        if (n == -1) {
            // Composite: copy its components, sizing each from its flags.
            val start = compS.p
            var instructions = false
            while (true) {
                val f = compS.u16()
                compS.p += 2 + (if (f and 0x1 != 0) 4 else 2) +
                    (if (f and 0x8 != 0) 2 else if (f and 0x40 != 0) 4 else if (f and 0x80 != 0) 8 else 0)
                if (f and 0x100 != 0) instructions = true
                if (f and 0x20 == 0) break
            }
            w.u16(0xFFFF)
            repeat(4) { w.u16(bboxS.i16()) }
            w.write(t, start, compS.p - start)
            if (instructions) {
                val len = glyphS.u255()
                w.u16(len)
                w.write(instrS.bytes(len))
            }
        } else if (n > 0) {
            val ends = IntArray(n)
            var count = 0
            for (c in 0 until n) { count += nPoints.u255(); ends[c] = count - 1 }
            val xs = IntArray(count); val ys = IntArray(count); val on = BooleanArray(count)
            var x = 0; var y = 0
            for (i in 0 until count) {
                var f = flagS.u8()
                on[i] = f shr 7 == 0
                f = f and 0x7F
                val dx: Int; val dy: Int
                when {
                    f < 10 -> { dx = 0; dy = withSign(f, ((f and 14) shl 7) + glyphS.u8()) }
                    f < 20 -> { dx = withSign(f, (((f - 10) and 14) shl 7) + glyphS.u8()); dy = 0 }
                    f < 84 -> {
                        val b0 = f - 20; val b1 = glyphS.u8()
                        dx = withSign(f, 1 + (b0 and 0x30) + (b1 shr 4))
                        dy = withSign(f shr 1, 1 + ((b0 and 0x0C) shl 2) + (b1 and 0x0F))
                    }
                    f < 120 -> {
                        val b0 = f - 84
                        dx = withSign(f, 1 + ((b0 / 12) shl 8) + glyphS.u8())
                        dy = withSign(f shr 1, 1 + (((b0 % 12) shr 2) shl 8) + glyphS.u8())
                    }
                    f < 124 -> {
                        val a = glyphS.u8(); val b = glyphS.u8(); val c = glyphS.u8()
                        dx = withSign(f, (a shl 4) + (b shr 4))
                        dy = withSign(f shr 1, ((b and 0x0F) shl 8) + c)
                    }
                    else -> { val a = glyphS.u16(); val b = glyphS.u16(); dx = withSign(f, a); dy = withSign(f shr 1, b) }
                }
                x += dx; y += dy
                xs[i] = x; ys[i] = y
            }
            val instrLen = glyphS.u255()
            val instr = instrS.bytes(instrLen)
            w.u16(n)
            if (bit(bboxBitmap, g)) repeat(4) { w.u16(bboxS.i16()) }
            else { w.u16(xs.min()); w.u16(ys.min()); w.u16(xs.max()); w.u16(ys.max()) }
            ends.forEach { w.u16(it) }
            w.u16(instrLen)
            w.write(instr)
            // Flags, then x and y as short (up to 255) or word deltas; no repeat packing.
            val flags = ByteArrayOutputStream(); val xb = ByteArrayOutputStream(); val yb = ByteArrayOutputStream()
            var px = 0; var py = 0
            val firstOverlap = overlap != null && bit(overlap, g)
            for (i in 0 until count) {
                var fl = if (on[i]) 0x01 else 0
                if (i == 0 && firstOverlap) fl = fl or 0x40
                val dx = xs[i] - px; val dy = ys[i] - py
                px = xs[i]; py = ys[i]
                when {
                    dx == 0 -> fl = fl or 0x10
                    abs(dx) <= 255 -> { fl = fl or 0x02 or (if (dx > 0) 0x10 else 0); xb.write(abs(dx)) }
                    else -> xb.u16(dx)
                }
                when {
                    dy == 0 -> fl = fl or 0x20
                    abs(dy) <= 255 -> { fl = fl or 0x04 or (if (dy > 0) 0x20 else 0); yb.write(abs(dy)) }
                    else -> yb.u16(dy)
                }
                flags.write(fl)
            }
            flags.writeTo(w); xb.writeTo(w); yb.writeTo(w)
        }
        w.writeTo(glyf)
        repeat((4 - w.size() % 4) % 4) { glyf.write(0) }
        offsets[g + 1] = glyf.size()
    }
    val loca = ByteBuffer.allocate((numGlyphs + 1) * (if (indexFormat == 0) 2 else 4))
    for (o in offsets) if (indexFormat == 0) loca.putShort((o shr 1).toShort()) else loca.putInt(o)
    return glyf.toByteArray() to loca.array()
}

private fun checksum(b: ByteArray, from: Int = 0, len: Int = b.size): Long {
    var sum = 0L
    var i = 0
    while (i < len) {
        var word = 0L
        for (k in 0 until 4) word = (word shl 8) or (if (i + k < len) (b[from + i + k].toLong() and 0xFF) else 0L)
        sum = (sum + word) and 0xFFFFFFFFL
        i += 4
    }
    return sum
}

private fun assembleSfnt(flavor: Long, tables: Map<String, ByteArray>): ByteArray {
    val tags = tables.keys.sorted()
    val n = tags.size
    var pow2 = 1; var log2 = 0
    while (pow2 * 2 <= n) { pow2 *= 2; log2++ }
    var size = 12 + 16 * n
    val offsets = tags.associateWith { tag -> size.also { size += (tables.getValue(tag).size + 3) and 3.inv() } }
    val out = ByteBuffer.allocate(size).order(ByteOrder.BIG_ENDIAN)
    out.putInt(flavor.toInt()).putShort(n.toShort()).putShort((pow2 * 16).toShort())
        .putShort(log2.toShort()).putShort((n * 16 - pow2 * 16).toShort())
    tags.forEachIndexed { i, tag ->
        val body = tables.getValue(tag).let { if (tag == "head" && it.size >= 12) it.copyOf().also { h -> h.fill(0, 8, 12) } else it }
        val rec = 12 + i * 16
        tag.forEachIndexed { k, c -> out.put(rec + k, c.code.toByte()) }
        out.putInt(rec + 4, checksum(body).toInt())
        out.putInt(rec + 8, offsets.getValue(tag))
        out.putInt(rec + 12, body.size)
        out.position(offsets.getValue(tag)); out.put(body)
    }
    val bytes = out.array()
    offsets["head"]?.let { ByteBuffer.wrap(bytes).putInt(it + 8, (0xB1B0AFBAL - checksum(bytes)).toInt()) }
    return bytes
}
