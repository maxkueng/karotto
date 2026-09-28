package com.karotto.app.ui.common

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircleOutline
import androidx.compose.material.icons.rounded.EventRepeat
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.theme.KarottoTheme

val TaskType.icon: ImageVector
    get() = when (this) {
        TaskType.HABIT -> Icons.Rounded.Bolt
        TaskType.DAILY -> Icons.Rounded.EventRepeat
        TaskType.TODO -> Icons.Rounded.CheckCircleOutline
    }

val TaskType.label: String
    get() = when (this) {
        TaskType.HABIT -> "Habits"
        TaskType.DAILY -> "Dailies"
        TaskType.TODO -> "To Do's"
    }

val TaskType.singular: String
    get() = when (this) {
        TaskType.HABIT -> "Habit"
        TaskType.DAILY -> "Daily"
        TaskType.TODO -> "To Do"
    }

/** Habitica's 40dp-tall rounded pill radio, used in the filter sheet. */
@Composable
fun RowScope.FilterPill(text: String, selected: Boolean, onClick: () -> Unit) {
    val colors = KarottoTheme.colors
    Box(
        modifier = Modifier
            .weight(1f)
            .height(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) colors.accent else colors.offsetBackground)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = if (selected) Color.White else colors.textTernary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun PillRow(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
            FilterPill(text = label, selected = value == selected) { onSelect(value) }
        }
    }
}

@Composable
fun SectionCaption(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.56.sp,
        color = KarottoTheme.colors.textQuad,
        modifier = modifier,
    )
}

/** Habitica's 24dp checkbox: square (r4) for dailies, round for to-dos. */
@Composable
fun TaskCheckbox(round: Boolean, fill: Color, checked: Boolean, checkTint: Color, size: androidx.compose.ui.unit.Dp = 24.dp) {
    val shape = if (round) androidx.compose.foundation.shape.CircleShape else RoundedCornerShape(4.dp)
    Box(
        modifier = Modifier
            .size(size)
            .clip(shape)
            .background(fill),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            Icon(Icons.Rounded.Check, contentDescription = null, tint = checkTint, modifier = Modifier.size(size * 0.7f))
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, description: String) {
    val colors = KarottoTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 56.dp, start = 24.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = colors.textDimmed, modifier = Modifier.size(32.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textSecondary,
            modifier = Modifier.padding(top = 16.dp, bottom = 2.dp),
        )
        Text(
            text = description,
            fontSize = 14.sp,
            color = colors.textTernary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 300.dp),
        )
    }
}


@Composable
fun rememberHaptic(enabled: Boolean): () -> Unit {
    val view = LocalView.current
    return { if (enabled) view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) }
}
