/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.ui

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OimLottieTest {
    @Test
    fun reversedStarsAreDrawnForward_otherShapesUntouched() {
        val src = """{"layers":[{"shapes":[{"ty":"gr","it":[{"ty":"sr","d":3},{"ty":"sh","d":3}]}]}]}"""
        val it = JSONObject(forwardPolystars(src)).getJSONArray("layers").getJSONObject(0)
            .getJSONArray("shapes").getJSONObject(0).getJSONArray("it")
        assertEquals(1, it.getJSONObject(0).getInt("d"))
        assertEquals(3, it.getJSONObject(1).getInt("d"))
    }
}
