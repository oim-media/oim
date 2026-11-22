/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.viewer.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val OimDarkColorScheme = darkColorScheme(
    primary = WhitePrimaryFill,
    onPrimary = ObsidianVoid,
    primaryContainer = WhiteContainer,
    onPrimaryContainer = OnWhiteContainer,
    secondary = InkSecondaryDark,
    onSecondary = ObsidianVoid,
    secondaryContainer = StudioSurfaceHighest,
    onSecondaryContainer = InkPrimaryDark,
    tertiary = EmeraldSeal,
    onTertiary = ObsidianVoid,
    tertiaryContainer = EmeraldContainer,
    onTertiaryContainer = OnEmeraldContainer,
    error = CrimsonTamper,
    onError = Color.White,
    errorContainer = CrimsonContainer,
    onErrorContainer = OnCrimsonContainer,
    background = ObsidianVoid,
    onBackground = InkPrimaryDark,
    surface = StudioSurface,
    onSurface = InkPrimaryDark,
    surfaceVariant = StudioSurfaceElevated,
    onSurfaceVariant = InkSecondaryDark,
    surfaceContainerLowest = ObsidianVoid,
    surfaceContainerLow = StudioSurface,
    surfaceContainer = StudioSurfaceElevated,
    surfaceContainerHigh = StudioSurfaceHighest,
    outline = StudioOutline,
    outlineVariant = StudioOutlineSubtle
)

private val OimLightColorScheme = lightColorScheme(
    primary = DarkPrimaryFill,
    onPrimary = Color.White,
    primaryContainer = DarkLightContainer,
    onPrimaryContainer = DarkPrimaryFill,
    secondary = InkSecondaryLight,
    onSecondary = Color.White,
    secondaryContainer = PaperSurfaceVariant,
    onSecondaryContainer = InkPrimaryLight,
    tertiary = Color(0xFF047857),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD1FAE5),
    onTertiaryContainer = Color(0xFF064E3B),
    error = Color(0xFFE11D48),
    onError = Color.White,
    errorContainer = Color(0xFFFFE4E6),
    onErrorContainer = Color(0xFF881337),
    background = PaperCanvas,
    onBackground = InkPrimaryLight,
    surface = PaperSurface,
    onSurface = InkPrimaryLight,
    surfaceVariant = PaperSurfaceVariant,
    onSurfaceVariant = InkSecondaryLight,
    outline = PaperOutline,
    outlineVariant = Color(0xFFF0F1F3)
)

val OimStudioShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(20.dp)
)

@Composable
fun OimStudioTheme(
    darkTheme: Boolean = true,
    forceDarkSystemBars: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) OimDarkColorScheme else OimLightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        val useLightSystemBarIcons = !darkTheme && !forceDarkSystemBars
        SideEffect {
            val window = view.context.findActivity()?.window ?: return@SideEffect
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = useLightSystemBarIcons
            controller.isAppearanceLightNavigationBars = useLightSystemBarIcons
        }
    }
    MaterialTheme(
        colorScheme = colorScheme,
        typography = OimStudioTypography,
        shapes = OimStudioShapes,
        content = content
    )
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
