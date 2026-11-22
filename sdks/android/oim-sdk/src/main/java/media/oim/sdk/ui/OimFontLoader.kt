/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import android.content.Context
import android.graphics.Typeface
import androidx.compose.ui.text.font.FontFamily
import media.oim.sdk.crypto.Base64Codec
import media.oim.sdk.model.OimEmbeddedFont
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.Inflater
import kotlin.math.abs

/**
 * Decodes embedded OIM WOFF1 (`wOFF`) fonts into SFNT (TTF/OTF) Typefaces and caches
 * them per font family and weight so Android renders condensed and display OIM typography accurately.
 * Unsupported formats (e.g. `woff2`) safely return null so system fallbacks apply cleanly.
 */
internal object OimFontLoader {

    private const val WOFF1_MAGIC = 0x774F4646 // 'wOFF'
    private const val WOFF_HEADER_SIZE = 44
    private const val WOFF_DIR_ENTRY_SIZE = 20
    private const val SFNT_HEADER_SIZE = 12
    private const val SFNT_DIR_ENTRY_SIZE = 16

    private val loadedTypefaces = ConcurrentHashMap<String, FontFamily>()

    fun resolveEmbeddedFonts(
        context: Context,
        fonts: List<OimEmbeddedFont>
    ): Map<String, List<Pair<Int, FontFamily>>> {
        if (fonts.isEmpty()) return emptyMap()
        val result = linkedMapOf<String, MutableList<Pair<Int, FontFamily>>>()
        fonts.forEach { font ->
            val familyKey = font.family.trim().lowercase()
            if (familyKey.isEmpty()) return@forEach
            val resolved = loadSingleFont(context, font)
            if (resolved != null) {
                result.getOrPut(familyKey) { mutableListOf() }.add(font.weight to resolved)
            }
        }
        return result
    }

    fun findBestFont(
        fonts: Map<String, List<Pair<Int, FontFamily>>>,
        family: String?,
        requestedWeight: Int
    ): FontFamily? {
        val key = family?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        val candidates = fonts[key] ?: return null
        return candidates.minByOrNull { (w, _) -> abs(w - requestedWeight) }?.second
    }

    private fun loadSingleFont(context: Context, font: OimEmbeddedFont): FontFamily? {
        val rawB64 = font.dataBase64?.takeIf { it.isNotBlank() } ?: return null
        val format = font.format.trim().lowercase()
        if (format != "woff" && format != "woff2" && format != "ttf" && format != "otf") return null

        val key = sha256Hex("sfnt2|${font.family}|${font.weight}|${font.style}|$rawB64").take(24)
        loadedTypefaces[key]?.let { return it }

        return runCatching {
            val rawBytes = Base64Codec.decode(rawB64)
            val sfntBytes = when (format) {
                "woff" -> decodeWoff1ToSfnt(rawBytes)
                "woff2" -> woff2ToSfnt(rawBytes)
                else -> rawBytes
            } ?: return null

            val fontDir = File(context.cacheDir, "oim_fonts").apply { mkdirs() }
            val outFile = File(fontDir, "$key.ttf")
            if (!outFile.exists() || outFile.length() == 0L) {
                outFile.writeBytes(sfntBytes)
            }
            val typeface = Typeface.createFromFile(outFile)
            val fontFamily = FontFamily(typeface)
            loadedTypefaces[key] = fontFamily
            fontFamily
        }.getOrNull()
    }

    internal fun decodeWoff1ToSfnt(woff: ByteArray): ByteArray? {
        if (woff.size < WOFF_HEADER_SIZE) return null
        val buf = ByteBuffer.wrap(woff).order(ByteOrder.BIG_ENDIAN)
        val signature = buf.getInt(0)
        if (signature != WOFF1_MAGIC) return null

        val flavor = buf.getInt(4)
        val numTables = buf.getShort(12).toInt() and 0xFFFF
        if (numTables <= 0 || numTables > 128) return null
        val dirEnd = WOFF_HEADER_SIZE + numTables * WOFF_DIR_ENTRY_SIZE
        if (woff.size < dirEnd) return null

        var maxPow2 = 1
        var entrySelector = 0
        while (maxPow2 * 2 <= numTables) {
            maxPow2 *= 2
            entrySelector++
        }
        val searchRange = maxPow2 * 16
        val rangeShift = numTables * 16 - searchRange

        val sfntDirOut = ByteBuffer.allocate(SFNT_HEADER_SIZE + numTables * SFNT_DIR_ENTRY_SIZE)
            .order(ByteOrder.BIG_ENDIAN)
        sfntDirOut.putInt(flavor)
        sfntDirOut.putShort(numTables.toShort())
        sfntDirOut.putShort(searchRange.toShort())
        sfntDirOut.putShort(entrySelector.toShort())
        sfntDirOut.putShort(rangeShift.toShort())

        val tableDataStream = ByteArrayOutputStream()
        var currentDataOffset = SFNT_HEADER_SIZE + numTables * SFNT_DIR_ENTRY_SIZE

        for (i in 0 until numTables) {
            val entryOffset = WOFF_HEADER_SIZE + i * WOFF_DIR_ENTRY_SIZE
            val tag = buf.getInt(entryOffset)
            val offset = buf.getInt(entryOffset + 4)
            val compLength = buf.getInt(entryOffset + 8)
            val origLength = buf.getInt(entryOffset + 12)
            val origChecksum = buf.getInt(entryOffset + 16)

            if (offset < dirEnd || compLength < 0 || origLength < 0 || offset + compLength > woff.size) {
                return null
            }

            val tableBytes = if (compLength < origLength) {
                val inflater = Inflater()
                try {
                    inflater.setInput(woff, offset, compLength)
                    val out = ByteArray(origLength)
                    var total = 0
                    while (total < origLength && !inflater.finished()) {
                        val read = inflater.inflate(out, total, origLength - total)
                        if (read == 0) {
                            if (inflater.needsInput() || inflater.needsDictionary()) break
                        } else {
                            total += read
                        }
                    }
                    if (total != origLength) return null
                    out
                } finally {
                    inflater.end()
                }
            } else {
                woff.copyOfRange(offset, offset + origLength)
            }

            sfntDirOut.putInt(tag)
            sfntDirOut.putInt(origChecksum)
            sfntDirOut.putInt(currentDataOffset)
            sfntDirOut.putInt(origLength)

            tableDataStream.write(tableBytes)
            val paddedLen = (origLength + 3) and 3.inv()
            val pad = paddedLen - origLength
            repeat(pad) { tableDataStream.write(0) }
            currentDataOffset += paddedLen
        }

        val headerAndDir = sfntDirOut.array()
        val dataBytes = tableDataStream.toByteArray()
        return ByteArray(headerAndDir.size + dataBytes.size).apply {
            System.arraycopy(headerAndDir, 0, this, 0, headerAndDir.size)
            System.arraycopy(dataBytes, 0, this, headerAndDir.size, dataBytes.size)
        }
    }

    private fun sha256Hex(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
