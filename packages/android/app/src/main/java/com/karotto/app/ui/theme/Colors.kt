package com.karotto.app.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.karotto.app.domain.TaskColor

/** One theme as generated from the shared spec: a token map per available mode. */
data class ThemeDefinition(
    val id: String,
    val name: String,
    val light: Map<String, Long>?,
    val dark: Map<String, Long>?,
) {
    val hasBothModes: Boolean get() = light != null && dark != null
}

/** One value-colour ramp resolved for the current mode. */
@Immutable
data class ValueRamp(
    val light: Color,
    val medium: Color,
    val dark: Color,
    val extraLight: Color,
    val extraDark: Color,
    val subText: Color,
    /** Tinted form page background. */
    val tint: Color,
    /** Cards and rows on the tinted form page. */
    val tintOffset: Color,
)

@Immutable
data class BrandRamp(
    val b50: Color,
    val b100: Color,
    val b200: Color,
    val b300: Color,
    val b400: Color,
    val b500: Color,
    val b600: Color,
    val b700: Color,
    val b800: Color,
    val tint: Color,
    val tintOffset: Color,
    val nav: Color,
    val navHover: Color,
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

@Immutable
class Palette(
    val id: String,
    val isDark: Boolean,
    val colors: KarottoColors,
    val brand: BrandRamp,
    val ramps: Map<TaskColor, ValueRamp>,
) {
    companion object {
        private val hueOf = mapOf(
            TaskColor.WORST to "maroon",
            TaskColor.WORSE to "red",
            TaskColor.BAD to "orange",
            TaskColor.NEUTRAL to "yellow",
            TaskColor.GOOD to "green",
            TaskColor.BETTER to "teal",
            TaskColor.BEST to "blue",
        )

        fun from(id: String, tokens: Map<String, Long>, isDark: Boolean): Palette {
            fun c(key: String): Color = Color(tokens[key] ?: error("theme $id lacks token $key"))
            val brand = BrandRamp(
                b50 = c("brand-50"), b100 = c("brand-100"), b200 = c("brand-200"), b300 = c("brand-300"),
                b400 = c("brand-400"), b500 = c("brand-500"), b600 = c("brand-600"), b700 = c("brand-700"),
                b800 = c("brand-800"), tint = c("brand-tint"), tintOffset = c("brand-tint-offset"),
                nav = c("nav"), navHover = c("nav-hover"),
            )
            val ramps = hueOf.mapValues { (_, hue) ->
                ValueRamp(
                    light = c("$hue-100"),
                    medium = c("$hue-50"),
                    dark = c("$hue-10"),
                    extraLight = c("$hue-500"),
                    extraDark = c("$hue-1"),
                    subText = c("$hue-sub"),
                    tint = c("$hue-tint"),
                    tintOffset = c("$hue-tint-offset"),
                )
            }
            val colors = KarottoColors(
                isDark = isDark,
                contentBackground = if (isDark) c("page") else c("surface"),
                windowBackground = if (isDark) c("neutral-600") else c("page"),
                offsetBackground = if (isDark) c("neutral-100") else c("neutral-600"),
                contentBackgroundOffset = if (isDark) c("neutral-200") else c("neutral-500"),
                textTitle = c("ink"),
                textPrimary = c("neutral-50"),
                textSecondary = c("neutral-100"),
                textTernary = c("neutral-200"),
                textQuad = c("neutral-300"),
                textDimmed = c("neutral-400"),
                textBrand = c("brand-300"),
                textRed = if (isDark) c("red-500") else c("maroon-100"),
                accent = if (isDark) c("brand-300") else c("brand-400"),
                barColor = if (isDark) c("nav") else c("brand-300"),
                barUnselected = c("brand-600"),
                barSelected = Color.White,
                checkboxFill = if (isDark) Color(0x40000000) else Color(0x50FFFFFF),
                checkboxFillInactive = if (isDark) Color(0x80000000) else Color(0x99FFFFFF),
                checkboxFillSelected = if (isDark) Color(0x40FFFFFF) else c("neutral-600"),
                habitInactive = if (isDark) c("neutral-500") else c("page"),
                dialogBackground = if (isDark) c("popover") else c("surface"),
                separator = if (isDark) c("neutral-300") else c("neutral-400"),
                errorBanner = c("maroon-5"),
                errorBannerText = c("maroon-500"),
                overdue = if (isDark) c("red-100") else c("maroon-100"),
            )
            return Palette(id, isDark, colors, brand, ramps)
        }
    }
}

object Themes {
    const val DEFAULT_ID = "carrot"

    val all: List<ThemeDefinition> get() = GeneratedThemes.all

    fun find(id: String?): ThemeDefinition = all.firstOrNull { it.id == id } ?: all.first { it.id == DEFAULT_ID }

    /** Resolves the palette for a theme, falling back to whichever mode the theme ships. */
    fun resolve(id: String?, preferDark: Boolean): Palette {
        val theme = find(id)
        val dark = if (preferDark) theme.dark ?: theme.light else theme.light ?: theme.dark
        val isDark = if (preferDark) theme.dark != null else theme.light == null
        return Palette.from(theme.id, dark ?: error("theme ${theme.id} has no variants"), isDark)
    }
}

val LocalPalette = staticCompositionLocalOf { Themes.resolve(Themes.DEFAULT_ID, preferDark = false) }
