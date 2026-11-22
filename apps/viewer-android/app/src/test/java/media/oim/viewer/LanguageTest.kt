/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer

import media.oim.viewer.ui.deviceLanguage
import media.oim.viewer.ui.pickLanguage
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class LanguageTest {
    @Test fun theDeviceLanguageIsSpanishOrElseEnglish() {
        assertEquals("es", deviceLanguage(Locale.forLanguageTag("es-MX")))
        assertEquals("en", deviceLanguage(Locale.forLanguageTag("en-US")))
        assertEquals("en", deviceLanguage(Locale.forLanguageTag("fr-FR")))
    }

    @Test fun aFileOpensInThePreferredLanguageWhenItHasIt() {
        assertEquals("es", pickLanguage(listOf("en", "es"), "en", "es"))
        assertEquals("en", pickLanguage(listOf("en", "es"), "es", "en"))
    }

    @Test fun otherwiseInItsDefaultThenItsFirst() {
        assertEquals("ko", pickLanguage(listOf("ko", "ja"), "ko", "es"))
        assertEquals("ja", pickLanguage(listOf("ja"), null, "es"))
        assertEquals("es", pickLanguage(emptyList(), null, "es"))
    }
}
