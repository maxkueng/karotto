package com.karotto.app.ui.tasks

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.common.icon
import com.karotto.app.ui.common.label
import com.karotto.app.ui.common.singular
import com.karotto.app.ui.theme.Brand
import com.karotto.app.ui.theme.KarottoTheme

private const val FAB_SIZE = 80
private const val FAB_OVERLAP = 39
private const val NOTCH_RADIUS = 46

/** The bar rectangle with a round scallop at the top centre where the FAB sits. */
private class NotchedBarShape : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val radius = with(density) { NOTCH_RADIUS.dp.toPx() }
        val centreY = with(density) { (FAB_SIZE / 2 - FAB_OVERLAP).dp.toPx() }
        val bar = Path().apply { addRect(Rect(Offset.Zero, size)) }
        val notch = Path().apply { addOval(Rect(center = Offset(size.width / 2, centreY), radius = radius)) }
        return Outline.Generic(Path.combine(PathOperation.Difference, bar, notch))
    }
}

@Composable
fun BoxScope.TasksBottomBar(
    selected: TaskType,
    speedDialOpen: Boolean,
    onSelect: (TaskType) -> Unit,
    onCreate: () -> Unit,
    onToggleSpeedDial: () -> Unit,
    onCreateOfType: (TaskType) -> Unit,
) {
    val colors = KarottoTheme.colors
    if (speedDialOpen) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.25f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onToggleSpeedDial),
        )
    }
    Column(
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SpeedDial(open = speedDialOpen, onCreateOfType = onCreateOfType)
        Box(Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = (FAB_SIZE - FAB_OVERLAP).dp)
                    .clip(NotchedBarShape())
                    .background(colors.barColor)
                    .navigationBarsPadding()
                    .height(56.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(Modifier.weight(1f)) {
                    BarItem(TaskType.HABIT, selected == TaskType.HABIT, onSelect)
                    BarItem(TaskType.DAILY, selected == TaskType.DAILY, onSelect)
                }
                Spacer(Modifier.width(96.dp))
                Row(Modifier.weight(1f)) {
                    Spacer(Modifier.weight(0.5f))
                    BarItem(TaskType.TODO, selected == TaskType.TODO, onSelect)
                    Spacer(Modifier.weight(0.5f))
                }
            }
            Box(Modifier.align(Alignment.TopCenter)) {
                Fab(open = speedDialOpen, onClick = { if (speedDialOpen) onToggleSpeedDial() else onCreate() }, onLongClick = onToggleSpeedDial)
            }
        }
    }
}

@Composable
private fun RowScope.BarItem(type: TaskType, selected: Boolean, onSelect: (TaskType) -> Unit) {
    val colors = KarottoTheme.colors
    val tint = if (selected) colors.barSelected else colors.barUnselected
    Column(
        modifier = Modifier
            .weight(1f)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onSelect(type) }
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(type.icon, contentDescription = type.label, tint = tint, modifier = Modifier.size(26.dp))
        Text(
            text = type.label,
            fontSize = 12.sp,
            letterSpacing = 0.6.sp,
            fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
            color = tint,
        )
    }
}

@Composable
private fun Fab(open: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {
    val rotation by animateFloatAsState(if (open) 135f else 0f, tween(250), label = "fab")
    Box(
        modifier = Modifier
            .size(FAB_SIZE.dp)
            .clip(CircleShape)
            .background(KarottoTheme.colors.accent)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Rounded.Add,
            contentDescription = "New task",
            tint = Color.White,
            modifier = Modifier.size(28.dp).rotate(rotation),
        )
    }
}

@Composable
private fun SpeedDial(open: Boolean, onCreateOfType: (TaskType) -> Unit) {
    val colors = KarottoTheme.colors
    Column(
        modifier = Modifier.padding(bottom = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TaskType.entries.forEachIndexed { index, type ->
            AnimatedVisibility(
                visible = open,
                enter = fadeIn(tween(250, delayMillis = 100 * (TaskType.entries.size - index))) +
                    scaleIn(tween(250, delayMillis = 100 * (TaskType.entries.size - index)), initialScale = 0.7f),
                exit = fadeOut(tween(150, delayMillis = 150 * index)),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = type.singular.uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.5.sp,
                        color = if (colors.isDark) Brand.b200 else Brand.b300,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Brand.b600)
                            .clickable { onCreateOfType(type) }
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .clickable { onCreateOfType(type) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(type.icon, contentDescription = type.singular, tint = Brand.b300, modifier = Modifier.size(28.dp))
                    }
                }
            }
        }
    }
}
