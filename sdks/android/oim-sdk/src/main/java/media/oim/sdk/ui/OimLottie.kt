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
                if (v.optString("ty") == "sr") {
                    if (v.optInt("d") == 3) v.put("d", 1)
                    // lottie-web sizes a rounded point's handles 2*PI*r / (4*points); lottie-android uses
                    // 0.47829*r whatever the count, so with 8 points the curve overshoots into notches.
                    val pts = maxPoints(v.optJSONObject("pt"))
                    if (pts > 0 && v.optInt("sy", 1) == 1) {
                        val f = Math.PI / (2 * pts) / 0.47829
                        scaleProp(v.optJSONObject("is"), f)
                        scaleProp(v.optJSONObject("os"), f)
                    }
                }
                v.keys().forEach { walk(v.opt(it)) }
            }
            is JSONArray -> for (i in 0 until v.length()) walk(v.opt(i))
        }
    }
    walk(root)
    return root.toString()
}

/** The largest point count a star reaches (static or over its keyframes). */
private fun maxPoints(prop: JSONObject?): Double {
    val k = prop?.opt("k") ?: return 0.0
    if (k is Number) return k.toDouble()
    if (k !is JSONArray) return 0.0
    var max = 0.0
    for (i in 0 until k.length()) {
        val s = k.optJSONObject(i)?.opt("s")
        val n = if (s is JSONArray) s.optDouble(0, 0.0) else (s as? Number)?.toDouble() ?: 0.0
        if (n > max) max = n
    }
    return max
}

private fun scaleProp(prop: JSONObject?, f: Double) {
    val k = prop?.opt("k") ?: return
    when (k) {
        is Number -> prop.put("k", k.toDouble() * f)
        is JSONArray -> for (i in 0 until k.length()) {
            val kf = k.optJSONObject(i) ?: continue
            when (val s = kf.opt("s")) {
                is Number -> kf.put("s", s.toDouble() * f)
                is JSONArray -> for (j in 0 until s.length()) s.put(j, s.optDouble(j) * f)
            }
        }
    }
}
