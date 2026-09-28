package com.karotto.app.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.domain.Checklisted
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DayContext
import com.karotto.app.domain.Direction
import com.karotto.app.domain.Habit
import com.karotto.app.domain.Scoring
import com.karotto.app.domain.Task
import com.karotto.app.domain.Todo
import com.karotto.app.ui.common.Dates
import com.karotto.app.ui.common.MarkdownText
import com.karotto.app.ui.common.TaskCheckbox
import com.karotto.app.ui.theme.KarottoTheme
import com.karotto.app.ui.theme.ValueRamp
import com.karotto.app.ui.theme.ramps
import java.time.Instant

private val cardShape = RoundedCornerShape(8.dp)

val Task.ramp: ValueRamp get() = ramps.getValue(Scoring.color(value))

data class CardCallbacks(
    val onOpen: (Task) -> Unit,
    val onScore: (Task, Direction) -> Unit,
    val onToggleChecklist: (Task) -> Unit,
    val onToggleChecklistItem: (Task, String) -> Unit,
)

@Composable
fun TaskCard(
    task: Task,
    expanded: Boolean,
    ctx: DayContext,
    dateFormat: String,
    callbacks: CardCallbacks,
    modifier: Modifier = Modifier,
) {
    val colors = KarottoTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp)
            .clip(cardShape)
            .background(colors.windowBackground)
            .defaultMinSize(minHeight = 60.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .defaultMinSize(minHeight = 60.dp),
        ) {
            when (task) {
                is Habit -> HabitStrip(task, Direction.UP) { callbacks.onScore(task, Direction.UP) }
                is Daily -> DailyStrip(task) { callbacks.onScore(task, if (task.completed) Direction.DOWN else Direction.UP) }
                is Todo -> TodoStrip(task) { callbacks.onScore(task, if (task.completed) Direction.DOWN else Direction.UP) }
            }
            CardBody(task, ctx, dateFormat, Modifier.weight(1f).clickable { callbacks.onOpen(task) })
            when (task) {
                is Habit -> HabitStrip(task, Direction.DOWN) { callbacks.onScore(task, Direction.DOWN) }
                is Checklisted -> if (task.checklist.isNotEmpty()) {
                    ChecklistIndicator(task) { callbacks.onToggleChecklist(task) }
                }
            }
        }
        if (task is Checklisted && expanded && task.checklist.isNotEmpty()) {
            ChecklistRows(task) { itemId -> callbacks.onToggleChecklistItem(task, itemId) }
        }
    }
}

@Composable
private fun HabitStrip(task: Habit, direction: Direction, onClick: () -> Unit) {
    val colors = KarottoTheme.colors
    val enabled = if (direction == Direction.UP) task.up else task.down
    val ramp = task.ramp
    Box(
        modifier = Modifier
            .width(40.dp)
            .fillMaxHeight()
            .background(if (enabled) ramp.light else colors.habitInactive)
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        val glyph = if (direction == Direction.UP) Icons.Rounded.Add else Icons.Rounded.Remove
        if (enabled) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(ramp.medium),
                contentAlignment = Alignment.Center,
            ) {
                Icon(glyph, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
            }
        } else {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .border(2.dp, colors.contentBackgroundOffset, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(glyph, contentDescription = null, tint = colors.contentBackgroundOffset, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun DailyStrip(task: Daily, onClick: () -> Unit) {
    val colors = KarottoTheme.colors
    val (background, fill) = when {
        task.completed -> colors.windowBackground to colors.checkboxFillSelected
        task.isDue -> task.ramp.light to colors.checkboxFill
        else -> colors.offsetBackground to colors.checkboxFillInactive
    }
    CheckStrip(background, fill, round = false, checked = task.completed, onClick = onClick)
}

@Composable
private fun TodoStrip(task: Todo, onClick: () -> Unit) {
    val colors = KarottoTheme.colors
    val (background, fill) = if (task.completed) {
        colors.windowBackground to colors.checkboxFillSelected
    } else {
        task.ramp.light to colors.checkboxFill
    }
    CheckStrip(background, fill, round = true, checked = task.completed, onClick = onClick)
}

@Composable
private fun CheckStrip(background: Color, fill: Color, round: Boolean, checked: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .width(40.dp)
            .fillMaxHeight()
            .background(background)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        TaskCheckbox(round = round, fill = fill, checked = checked, checkTint = KarottoTheme.colors.textDimmed)
    }
}

@Composable
private fun CardBody(task: Task, ctx: DayContext, dateFormat: String, modifier: Modifier) {
    val colors = KarottoTheme.colors
    val done = (task as? Checklisted)?.completed == true
    val muted = done || (task is Habit && !task.up && !task.down)
    val notDue = task is Daily && !task.isDue && !task.completed
    Column(
        modifier = modifier
            .fillMaxHeight()
            .padding(horizontal = 15.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        MarkdownText(
            source = task.text,
            style = androidx.compose.ui.text.TextStyle(fontSize = 15.sp, letterSpacing = 0.375.sp, lineHeight = 20.sp),
            color = if (muted) colors.textQuad else colors.textPrimary,
        )
        if (task.notes.isNotBlank()) {
            MarkdownText(
                source = task.notes,
                style = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, lineHeight = 17.sp),
                color = if (muted) colors.textQuad else if (notDue) colors.textTernary else colors.textTernary,
                modifier = Modifier.padding(top = 1.dp, bottom = 3.dp),
            )
        }
        IconRow(task, ctx, dateFormat)
    }
}

@Composable
private fun IconRow(task: Task, ctx: DayContext, dateFormat: String) {
    val colors = KarottoTheme.colors
    val streak: String? = when (task) {
        is Daily -> task.streak.takeIf { it > 0 }?.toString()
        is Habit -> listOfNotNull(
            "+${task.counterUp}".takeIf { task.up },
            "-${task.counterDown}".takeIf { task.down },
        ).takeIf { task.counterUp > 0 || task.counterDown > 0 }?.joinToString(" | ")
        else -> null
    }
    val due: Pair<String, Color>? = (task as? Todo)?.dueDate?.let { date ->
        val today = ctx.cdsDay(Instant.now())
        when {
            date == today -> "Today" to colors.textQuad
            date.isBefore(today) -> Dates.formatDate(date, dateFormat) to colors.overdue
            else -> Dates.formatDate(date, dateFormat) to colors.textQuad
        }
    }
    val reminder: String? = (task as? Daily)?.reminders?.takeIf { it.isNotEmpty() }?.let { reminders ->
        val times = reminders.mapNotNull { Dates.parseReminder(it.time, ctx.zone) }.sortedBy { it.toLocalTime() }
        val first = times.firstOrNull() ?: return@let null
        Dates.formatTime(first.toLocalTime()) + if (times.size > 1) " (+${times.size - 1})" else ""
    }
    if (streak == null && due == null && task.reminders.isEmpty()) return
    Row(
        modifier = Modifier.padding(top = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (due != null) {
            SmallIcon(Icons.Rounded.CalendarToday)
            Caption(due.first, due.second, Modifier.padding(start = 2.dp, end = 12.dp))
        }
        if (streak != null) {
            SmallIcon(Icons.Rounded.LocalFireDepartment)
            Caption(streak, colors.textQuad, Modifier.padding(start = 2.dp, end = 12.dp))
        }
        if (task.reminders.isNotEmpty()) {
            SmallIcon(Icons.Rounded.Alarm)
            if (reminder != null) Caption(reminder, colors.textQuad, Modifier.padding(start = 2.dp))
        }
    }
}

@Composable
private fun SmallIcon(icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Icon(
        icon,
        contentDescription = null,
        tint = KarottoTheme.colors.textTernary,
        modifier = Modifier.size(18.dp).padding(2.dp).alpha(0.5f),
    )
}

@Composable
private fun Caption(text: String, color: Color, modifier: Modifier = Modifier) {
    Text(text, fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.36.sp, color = color, modifier = modifier)
}

@Composable
private fun ChecklistIndicator(task: Checklisted, onClick: () -> Unit) {
    val colors = KarottoTheme.colors
    val done = task.checklist.count { it.completed }
    val allDone = done == task.checklist.size
    val background = if (allDone) colors.offsetBackground else colors.textTernary
    val foreground = if (allDone) colors.textQuad else if (colors.isDark) colors.offsetBackground else colors.contentBackgroundOffset
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .clickable(onClick = onClick)
            .padding(start = 4.dp, end = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .size(width = 24.dp, height = 43.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(background),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("$done", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = foreground, lineHeight = 13.sp)
            Spacer(Modifier.height(2.dp))
            Box(Modifier.size(width = 14.dp, height = 1.5.dp).background(foreground))
            Spacer(Modifier.height(2.dp))
            Text("${task.checklist.size}", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = foreground, lineHeight = 13.sp)
        }
    }
}

@Composable
private fun ChecklistRows(task: Checklisted, onToggle: (String) -> Unit) {
    val colors = KarottoTheme.colors
    val inactive = task.completed || (task is Daily && !task.isDue)
    val ramp = task.ramp
    val holder = if (inactive) colors.offsetBackground else ramp.extraLight
    val checkTint = if (inactive) colors.textDimmed else if (colors.isDark) ramp.extraDark else ramp.dark
    val boxFill = if (colors.isDark && !inactive) ramp.light else colors.checkboxFill
    Column {
        task.checklist.forEach { item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min)
                    .defaultMinSize(minHeight = 50.dp),
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .fillMaxHeight()
                        .background(holder)
                        .clickable { onToggle(item.id) },
                    contentAlignment = Alignment.Center,
                ) {
                    TaskCheckbox(
                        round = task is Todo,
                        fill = boxFill,
                        checked = item.completed,
                        checkTint = checkTint,
                        size = 20.dp,
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .padding(horizontal = 15.dp, vertical = 5.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    MarkdownText(
                        source = item.text,
                        style = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, letterSpacing = 0.28.sp, lineHeight = 20.sp),
                        color = if (item.completed) colors.textDimmed else colors.textSecondary,
                    )
                }
            }
        }
    }
}
