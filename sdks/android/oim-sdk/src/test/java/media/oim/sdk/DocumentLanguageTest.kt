/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk

import media.oim.sdk.ui.documentLanguage
import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentLanguageTest {
    @Test fun exactTagWins() = assertEquals("en-GB", documentLanguage(listOf("en", "en-GB"), "en-gb"))

    @Test fun mainSubtagMatches() = assertEquals("es", documentLanguage(listOf("en", "es"), "es-MX"))

    @Test fun aLanguageTheFileLacksFallsToItsFirst() = assertEquals("es", documentLanguage(listOf("es"), "en"))

    @Test fun aFileWithoutLanguagesKeepsTheReaders() = assertEquals("en", documentLanguage(emptyList(), "en"))
}
