package com.karotto.app.ui.form

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import com.karotto.app.domain.Scoring
import com.karotto.app.domain.TaskColor
import com.karotto.app.ui.theme.BrandRamp
import com.karotto.app.ui.theme.Palette

/** Tinted form colours: purple when creating, the task's value colour when editing. */
@Immutable
data class FormPalette(
    val tint: Color,
    val onTint: Color,
    val fieldBox: Color,
    val page: Color,
    val offset: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val uiMain: Color,
    val uiSub: Color,
    val uiDetails: Color,
) {
    companion object {
        fun of(palette: Palette, isEdit: Boolean, value: Double): FormPalette {
            val colors = palette.colors
            val brand: BrandRamp = palette.brand
            if (!isEdit) {
                return FormPalette(
                    tint = brand.b300,
                    onTint = Color.White,
                    fieldBox = brand.b50,
                    page = brand.tint,
                    offset = if (colors.isDark) brand.tintOffset else brand.b500.copy(alpha = 0.12f),
                    textPrimary = if (colors.isDark) brand.b800 else brand.b100,
                    textSecondary = if (colors.isDark) brand.b500 else brand.b300,
                    uiMain = brand.b500,
                    uiSub = brand.b400,
                    uiDetails = brand.b100,
                )
            }
            val color = Scoring.color(value)
            val ramp = palette.ramps.getValue(color)
            val darkOnTint = color == TaskColor.WORST || color == TaskColor.WORSE
            return FormPalette(
                tint = ramp.light,
                onTint = if (darkOnTint) Color.White else ramp.extraDark,
                fieldBox = ramp.extraDark,
                page = ramp.tint,
                offset = if (colors.isDark) ramp.tintOffset else ramp.extraLight.copy(alpha = 0.12f),
                textPrimary = if (colors.isDark) ramp.extraLight else ramp.extraDark,
                textSecondary = ramp.subText,
                uiMain = ramp.extraLight,
                uiSub = ramp.medium,
                uiDetails = ramp.extraDark,
            )
        }
    }
}
