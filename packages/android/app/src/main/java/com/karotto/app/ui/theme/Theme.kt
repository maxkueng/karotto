package com.karotto.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.data.store.ThemeMode

object KarottoTheme {
    val colors: KarottoColors
        @Composable @ReadOnlyComposable get() = LocalKarottoColors.current
}

val karottoTypography = Typography(
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 18.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 16.sp),
    titleSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 14.sp, letterSpacing = 0.04.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 16.sp, letterSpacing = 0.02.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 15.sp, letterSpacing = 0.025.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 16.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.03.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 11.sp),
)

val karottoShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

private fun scheme(colors: KarottoColors): ColorScheme = if (colors.isDark) {
    darkColorScheme(
        primary = Brand.b400,
        onPrimary = androidx.compose.ui.graphics.Color.White,
        secondary = Brand.b500,
        background = colors.contentBackground,
        onBackground = colors.textPrimary,
        surface = colors.contentBackground,
        onSurface = colors.textPrimary,
        surfaceVariant = colors.windowBackground,
        onSurfaceVariant = colors.textSecondary,
        outline = colors.separator,
        error = colors.textRed,
    )
} else {
    lightColorScheme(
        primary = Brand.b400,
        onPrimary = androidx.compose.ui.graphics.Color.White,
        secondary = Brand.b300,
        background = colors.contentBackground,
        onBackground = colors.textPrimary,
        surface = colors.contentBackground,
        onSurface = colors.textPrimary,
        surfaceVariant = colors.windowBackground,
        onSurfaceVariant = colors.textSecondary,
        outline = colors.separator,
        error = colors.textRed,
    )
}

@Composable
fun KarottoTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = if (dark) darkColors else lightColors
    CompositionLocalProvider(LocalKarottoColors provides colors) {
        MaterialTheme(colorScheme = scheme(colors), typography = karottoTypography, shapes = karottoShapes, content = content)
    }
}
