/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import org.json.JSONArray
import org.json.JSONObject

/**
 * Lottie stars drawn reversed (`sr` with `d: 3`) render with broken tips in lottie-android,
 * while lottie-web draws them like forward ones. Same fix as the Flutter SDK's `forwardPolystars`.
 */
internal fun forwardPolystars(json: String): String {
    if (!json.contains("\"sr\"")) return json
    val root = runCatching { JSONObject(json) }.getOrNull() ?: return json
    fun walk(v: Any?) {
        when (v) {
            is JSONObject -> {
                if (v.optString("ty") == "sr" && v.optInt("d") == 3) v.put("d", 1)
                v.keys().forEach { walk(v.opt(it)) }
            }
            is JSONArray -> for (i in 0 until v.length()) walk(v.opt(i))
        }
    }
    walk(root)
    return root.toString()
}
