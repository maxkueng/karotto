package com.karotto.app.ui.form

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import com.karotto.app.domain.Scoring
import com.karotto.app.domain.TaskColor
import com.karotto.app.ui.theme.Brand
import com.karotto.app.ui.theme.KarottoColors
import com.karotto.app.ui.theme.purpleRamp
import com.karotto.app.ui.theme.ramps

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
        fun of(colors: KarottoColors, isEdit: Boolean, value: Double): FormPalette {
            if (!isEdit) {
                return FormPalette(
                    tint = Brand.b300,
                    onTint = Color.White,
                    fieldBox = Brand.b50,
                    page = if (colors.isDark) colors.contentBackground else Brand.b800,
                    offset = if (colors.isDark) purpleRamp.darkBackground else Brand.b500.copy(alpha = 0.12f),
                    textPrimary = if (colors.isDark) Brand.b800 else Brand.b100,
                    textSecondary = if (colors.isDark) Brand.b500 else Brand.b300,
                    uiMain = Brand.b500,
                    uiSub = Brand.b400,
                    uiDetails = Brand.b100,
                )
            }
            val color = Scoring.color(value)
            val ramp = ramps.getValue(color)
            val darkOnTint = color == TaskColor.WORST || color == TaskColor.WORSE
            return FormPalette(
                tint = ramp.light,
                onTint = if (darkOnTint) Color.White else ramp.extraDark,
                fieldBox = ramp.extraDark,
                page = if (colors.isDark) ramp.darkestBackground else ramp.lightest,
                offset = if (colors.isDark) ramp.darkBackground else ramp.extraLight.copy(alpha = 0.12f),
                textPrimary = if (colors.isDark) ramp.extraLight else ramp.extraDark,
                textSecondary = ramp.subText,
                uiMain = ramp.extraLight,
                uiSub = ramp.medium,
                uiDetails = ramp.extraDark,
            )
        }
    }
}
