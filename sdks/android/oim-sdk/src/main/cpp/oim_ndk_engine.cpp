/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
#include <jni.h>
#include <android/bitmap.h>
#include <android/log.h>
#include <zlib.h>
#include <chrono>
#include <vector>
#include "oim_png_scanner.hpp"

#define OIM_LOG_TAG "OimNdkEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, OIM_LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, OIM_LOG_TAG, __VA_ARGS__)

extern "C" {

JNIEXPORT jintArray JNICALL
Java_media_oim_sdk_ndk_OimNativeBridge_nativeScanDirectBuffer(
    JNIEnv* env,
    jobject /* thiz */,
    jobject directBuffer,
    jint length
) {
    const auto t0 = std::chrono::steady_clock::now();
    auto* rawPtr = static_cast<const uint8_t*>(env->GetDirectBufferAddress(directBuffer));
    if (!rawPtr || length <= 0) {
        return nullptr;
    }

    std::vector<oim::ndk::PngChunkSpan> chunks;
    chunks.reserve(16);
    int lastOimIdx = -1;
    const int count = oim::ndk::scan_png_chunks_zero_copy(
        rawPtr, static_cast<size_t>(length), chunks, lastOimIdx
    );

    if (count < 0) {
        LOGE("Invalid or truncated PNG stream: code=%d", count);
        return nullptr;
    }

    int oimOffset = -1;
    int oimLength = 0;
    int crcValid = 1;

    if (lastOimIdx >= 0) {
        const auto& target = chunks[static_cast<size_t>(lastOimIdx)];
        oimOffset = static_cast<int>(target.data_offset);
        oimLength = static_cast<int>(target.data_length);

        const uint8_t* typeAndData = rawPtr + target.data_offset - 4;
        const uLong computed = crc32(0L, typeAndData, target.data_length + 4);
        crcValid = (static_cast<uint32_t>(computed) == target.stored_crc) ? 1 : 0;
    }

    const auto t1 = std::chrono::steady_clock::now();
    const auto elapsedUs = static_cast<jint>(
        std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count()
    );

    jint result[5] = {oimOffset, oimLength, count, crcValid, elapsedUs};
    jintArray out = env->NewIntArray(5);
    if (out != nullptr) {
        env->SetIntArrayRegion(out, 0, 5, result);
    }
    return out;
}

JNIEXPORT jboolean JNICALL
Java_media_oim_sdk_ndk_OimNativeBridge_nativeVerifyBitmapPixelSurface(
    JNIEnv* env,
    jobject /* thiz */,
    jobject bitmap
) {
    AndroidBitmapInfo info;
    if (AndroidBitmap_getInfo(env, bitmap, &info) != ANDROID_BITMAP_RESULT_SUCCESS) {
        return JNI_FALSE;
    }
    if (info.format != ANDROID_BITMAP_FORMAT_RGBA_8888) {
        return JNI_FALSE;
    }
    void* pixels = nullptr;
    if (AndroidBitmap_lockPixels(env, bitmap, &pixels) != ANDROID_BITMAP_RESULT_SUCCESS) {
        return JNI_FALSE;
    }
    AndroidBitmap_unlockPixels(env, bitmap);
    return JNI_TRUE;
}

} // extern "C"
