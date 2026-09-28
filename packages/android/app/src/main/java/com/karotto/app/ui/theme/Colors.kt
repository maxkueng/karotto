package com.karotto.app.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.karotto.app.domain.TaskColor

object Brand {
    val b50 = Color(0xFF36205D)
    val b100 = Color(0xFF432874)
    val b200 = Color(0xFF4F2A93)
    val b300 = Color(0xFF6133B4)
    val b400 = Color(0xFF925CF3)
    val b500 = Color(0xFFBDA8FF)
    val b600 = Color(0xFFD5C8FF)
    val b700 = Color(0xFFEEEBF8)
    val b800 = Color(0xFFF6F4FC)
}

object Gray {
    val g1 = Color(0xFF1A181D)
    val g5 = Color(0xFF23202A)
    val g10 = Color(0xFF34313A)
    val g50 = Color(0xFF4E4A57)
    val g100 = Color(0xFF686274)
    val g200 = Color(0xFF878190)
    val g300 = Color(0xFFA5A1AC)
    val g400 = Color(0xFFC3C0C7)
    val g500 = Color(0xFFE1E0E3)
    val g600 = Color(0xFFEDECEE)
    val g700 = Color(0xFFF9F9F9)
}

/** One value-colour ramp: strip (100), habit disc (medium), checklist strip (500), dark glyph (1), tinted backgrounds. */
@Immutable
data class ValueRamp(
    val light: Color,
    val medium: Color,
    val dark: Color,
    val extraLight: Color,
    val extraDark: Color,
    val lightest: Color,
    val xxlight: Color,
    val subText: Color,
    val darkBackground: Color,
    val darkestBackground: Color,
)

val ramps: Map<TaskColor, ValueRamp> = mapOf(
    TaskColor.WORST to ValueRamp(Color(0xFFDE3F3F), Color(0xFFC92B2B), Color(0xFFB01515), Color(0xFFF19595), Color(0xFF4C0001), Color(0xFFFFF7F7), Color(0xFFF7E9E9), Color(0xFFAB6565), Color(0xFF3D2828), Color(0xFF261C1C)),
    TaskColor.WORSE to ValueRamp(Color(0xFFFF6165), Color(0xFFF74E52), Color(0xFFF23035), Color(0xFFFFB6B8), Color(0xFF6C0406), Color(0xFFFFF7F7), Color(0xFFF7E9E9), Color(0xFFAB6570), Color(0xFF3D2828), Color(0xFF261C1C)),
    TaskColor.BAD to ValueRamp(Color(0xFFFF944C), Color(0xFFFA8537), Color(0xFFF47825), Color(0xFFFFC8A7), Color(0xFF7F3300), Color(0xFFFFF9F5), Color(0xFFF7EDED), Color(0xFFAB8165), Color(0xFF3D3028), Color(0xFF26201C)),
    TaskColor.NEUTRAL to ValueRamp(Color(0xFFFFBE5D), Color(0xFFFFA624), Color(0xFFEE9109), Color(0xFFFEDEAD), Color(0xFF794B00), Color(0xFFFFFCF7), Color(0xFFFCF3E5), Color(0xFFAB9065), Color(0xFF3D3528), Color(0xFF26221C)),
    TaskColor.GOOD to ValueRamp(Color(0xFF24CC8F), Color(0xFF20B780), Color(0xFF1CA372), Color(0xFF77F4C7), Color(0xFF005737), Color(0xFFF3FBF8), Color(0xFFEBF5F5), Color(0xFF65AB94), Color(0xFF283D36), Color(0xFF1C2622)),
    TaskColor.BETTER to ValueRamp(Color(0xFF3BCAD7), Color(0xFF34B5C1), Color(0xFF26A0AB), Color(0xFF8EEDF6), Color(0xFF005158), Color(0xFFF5FFFE), Color(0xFFE5F5F5), Color(0xFF65A7AB), Color(0xFF283C3D), Color(0xFF1C2526)),
    TaskColor.BEST to ValueRamp(Color(0xFF50B5E9), Color(0xFF46A7D9), Color(0xFF2995CD), Color(0xFFA9DCF6), Color(0xFF033F5E), Color(0xFFFAFDFF), Color(0xFFEEF5F9), Color(0xFF6594AB), Color(0xFF28373D), Color(0xFF191D21)),
)

/** The brand-purple form palette, used for the create form. */
val purpleRamp = ValueRamp(
    light = Brand.b300,
    medium = Brand.b400,
    dark = Brand.b200,
    extraLight = Brand.b500,
    extraDark = Brand.b100,
    lightest = Brand.b800,
    xxlight = Brand.b700,
    subText = Brand.b300,
    darkBackground = Color(0xFF2F283F),
    darkestBackground = Gray.g1,
)

/** Semantic colours that swap between light and dark. */
@Immutable
data class KarottoColors(
    val isDark: Boolean,
    val contentBackground: Color,
    val windowBackground: Color,
    val offsetBackground: Color,
    val contentBackgroundOffset: Color,
    val textTitle: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textTernary: Color,
    val textQuad: Color,
    val textDimmed: Color,
    val textBrand: Color,
    val textRed: Color,
    val accent: Color,
    val barColor: Color,
    val barUnselected: Color,
    val barSelected: Color,
    val systemBars: Color,
    val checkboxFill: Color,
    val checkboxFillInactive: Color,
    val checkboxFillSelected: Color,
    val habitInactive: Color,
    val dialogBackground: Color,
    val separator: Color,
    val errorBanner: Color,
    val errorBannerText: Color,
    val overdue: Color,
)

val lightColors = KarottoColors(
    isDark = false,
    contentBackground = Color.White,
    windowBackground = Gray.g700,
    offsetBackground = Gray.g600,
    contentBackgroundOffset = Gray.g500,
    textTitle = Gray.g1,
    textPrimary = Gray.g50,
    textSecondary = Gray.g100,
    textTernary = Gray.g200,
    textQuad = Gray.g300,
    textDimmed = Gray.g400,
    textBrand = Brand.b300,
    textRed = Color(0xFFDE3F3F),
    accent = Brand.b400,
    barColor = Brand.b300,
    barUnselected = Brand.b600,
    barSelected = Color.White,
    systemBars = Brand.b200,
    checkboxFill = Color(0x50FFFFFF),
    checkboxFillInactive = Color(0x99FFFFFF),
    checkboxFillSelected = Gray.g600,
    habitInactive = Gray.g700,
    dialogBackground = Color.White,
    separator = Gray.g400,
    errorBanner = Color(0xFF7D0C0C),
    errorBannerText = Color(0xFFF19595),
    overdue = Color(0xFFDE3F3F),
)

val darkColors = KarottoColors(
    isDark = true,
    contentBackground = Gray.g1,
    windowBackground = Gray.g5,
    offsetBackground = Gray.g50,
    contentBackgroundOffset = Gray.g100,
    textTitle = Color.White,
    textPrimary = Gray.g700,
    textSecondary = Gray.g500,
    textTernary = Gray.g400,
    textQuad = Gray.g300,
    textDimmed = Gray.g200,
    textBrand = Brand.b600,
    textRed = Color(0xFFFFB6B8),
    accent = Brand.b400,
    barColor = Gray.g1,
    barUnselected = Gray.g200,
    barSelected = Brand.b500,
    systemBars = Gray.g1,
    checkboxFill = Color(0x40000000),
    checkboxFillInactive = Color(0x80000000),
    checkboxFillSelected = Color(0x40FFFFFF),
    habitInactive = Gray.g10,
    dialogBackground = Gray.g10,
    separator = Gray.g200,
    errorBanner = Color(0xFF7D0C0C),
    errorBannerText = Color(0xFFF19595),
    overdue = Color(0xFFFF6165),
)

val LocalKarottoColors = staticCompositionLocalOf { lightColors }
