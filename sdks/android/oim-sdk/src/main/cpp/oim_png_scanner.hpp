/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
#pragma once

#include <cstdint>
#include <cstddef>
#include <cstring>
#include <vector>

namespace oim::ndk {

static constexpr uint8_t kPngMagic[8] = {0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

struct PngChunkSpan {
    uint32_t type_fourcc;
    uint32_t data_offset;
    uint32_t data_length;
    uint32_t stored_crc;
    bool crc_valid;
    bool is_oim_payload;
};

inline uint32_t read_be32(const uint8_t* ptr) noexcept {
    return (static_cast<uint32_t>(ptr[0]) << 24) |
           (static_cast<uint32_t>(ptr[1]) << 16) |
           (static_cast<uint32_t>(ptr[2]) << 8)  |
           static_cast<uint32_t>(ptr[3]);
}

constexpr uint32_t make_fourcc(char a, char b, char c, char d) noexcept {
    return (static_cast<uint32_t>(static_cast<uint8_t>(a)) << 24) |
           (static_cast<uint32_t>(static_cast<uint8_t>(b)) << 16) |
           (static_cast<uint32_t>(static_cast<uint8_t>(c)) << 8)  |
           static_cast<uint32_t>(static_cast<uint8_t>(d));
}

static constexpr uint32_t kChunkTEXT = make_fourcc('t', 'E', 'X', 't');
static constexpr uint32_t kChunkZTXT = make_fourcc('z', 'T', 'X', 't');
static constexpr uint32_t kChunkITXT = make_fourcc('i', 'T', 'X', 't');
static constexpr uint32_t kChunkOIMD = make_fourcc('o', 'I', 'M', 'd');
static constexpr uint32_t kChunkIEND = make_fourcc('I', 'E', 'N', 'D');

inline bool has_oim_keyword(const uint8_t* data, uint32_t length) noexcept {
    if (length >= 9 && std::memcmp(data, "OIM_Data\0", 9) == 0) return true;
    if (length >= 14 && std::memcmp(data, "OIM_JSON_DATA\0", 14) == 0) return true;
    if (length >= 4 && (std::memcmp(data, "OIM\0", 4) == 0 || std::memcmp(data, "oim\0", 4) == 0)) return true;
    return false;
}

inline int scan_png_chunks_zero_copy(
    const uint8_t* buffer,
    size_t size,
    std::vector<PngChunkSpan>& out_chunks,
    int& last_oim_chunk_index
) noexcept {
    out_chunks.clear();
    last_oim_chunk_index = -1;

    if (!buffer || size < 33 || std::memcmp(buffer, kPngMagic, 8) != 0) {
        return -1;
    }

    size_t cursor = 8;
    while (cursor + 12 <= size) {
        const uint32_t length = read_be32(buffer + cursor);
        const uint32_t fourcc = read_be32(buffer + cursor + 4);
        const size_t data_offset = cursor + 8;
        const size_t crc_offset = data_offset + length;

        if (crc_offset + 4 > size) {
            return -2;
        }

        const uint32_t stored_crc = read_be32(buffer + crc_offset);
        bool is_oim = (fourcc == kChunkOIMD) ||
                      ((fourcc == kChunkTEXT || fourcc == kChunkZTXT || fourcc == kChunkITXT) &&
                       has_oim_keyword(buffer + data_offset, length));

        PngChunkSpan span{
            fourcc,
            static_cast<uint32_t>(data_offset),
            length,
            stored_crc,
            true,
            is_oim
        };

        out_chunks.push_back(span);
        if (is_oim) {
            last_oim_chunk_index = static_cast<int>(out_chunks.size()) - 1;
        }

        cursor = crc_offset + 4;
        if (fourcc == kChunkIEND) break;
    }

    return static_cast<int>(out_chunks.size());
}

} // namespace oim::ndk
