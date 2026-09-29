package com.karotto.app.ui.form

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DragHandle
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.karotto.app.domain.DailyFrequency
import com.karotto.app.domain.HabitFrequency
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.common.Dates
import com.karotto.app.ui.common.singular
import com.karotto.app.ui.theme.KarottoTheme
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.TextStyle as JavaTextStyle
import java.time.temporal.WeekFields
import java.util.Locale

@Composable
fun TaskFormScreen(viewModel: TaskFormViewModel, onClose: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = KarottoTheme.colors
    val themePalette = KarottoTheme.palette
    val palette = remember(state.isEdit, state.value, themePalette) { FormPalette.of(themePalette, state.isEdit, state.value) }
    var discardPrompt by remember { mutableStateOf(false) }
    var deletePrompt by remember { mutableStateOf(false) }

    LaunchedEffect(state.done) { if (state.done) onClose() }

    fun back() {
        if (viewModel.hasChanges()) discardPrompt = true else onClose()
    }
    BackHandler(onBack = ::back)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.page)
            .imePadding(),
    ) {
        FormHeader(state, palette, onBack = ::back, onSave = viewModel::save, onDelete = { deletePrompt = true }, onChange = viewModel::update)
        if (!state.loaded) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = palette.uiSub) }
            return@Column
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .padding(bottom = 32.dp),
        ) {
            state.error?.let { error ->
                Text(
                    text = error,
                    color = colors.textRed,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            when (state.type) {
                TaskType.HABIT -> {
                    HabitScoringSection(state, palette, viewModel::update)
                    SectionTitle("Reset Counter", palette)
                    Selector(
                        options = HabitFrequency.entries.map { it to it.name.lowercase().replaceFirstChar(Char::uppercase) },
                        selected = state.habitFrequency,
                        palette = palette,
                    ) { value -> viewModel.update { it.copy(habitFrequency = value) } }
                    if (state.isEdit && (state.up || state.down)) {
                        SectionTitle("Adjust Counter", palette)
                        Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                            if (state.up) NumberField("Positive", state.counterUp, palette, Modifier.weight(1f)) { v -> viewModel.update { it.copy(counterUp = v) } }
                            if (state.down) NumberField("Negative", state.counterDown, palette, Modifier.weight(1f)) { v -> viewModel.update { it.copy(counterDown = v) } }
                        }
                    }
                }

                TaskType.DAILY -> {
                    SectionTitle("Checklist", palette)
                    ChecklistEditor(state, palette, viewModel)
                    SectionTitle("Scheduling", palette)
                    DailyScheduling(state, palette, viewModel)
                    if (state.isEdit) {
                        SectionTitle("Adjust Streak", palette)
                        NumberField("Streak", state.streak, palette, Modifier.fillMaxWidth(0.5f)) { v -> viewModel.update { it.copy(streak = v) } }
                    }
                    SectionTitle("Reminders", palette)
                    RemindersEditor(state, palette, viewModel)
                }

                TaskType.TODO -> {
                    SectionTitle("Checklist", palette)
                    ChecklistEditor(state, palette, viewModel)
                    SectionTitle("Scheduling", palette)
                    DueDateCard(state, palette, viewModel)
                    SectionTitle("Reminders", palette)
                    RemindersEditor(state, palette, viewModel)
                }
            }
            SectionTitle("Alias", palette)
            AliasField(state.alias, palette) { v -> viewModel.update { it.copy(alias = v) } }
            Text(
                "A short name that scripts, the CLI and automations can use instead of the id.",
                fontSize = 12.sp,
                color = palette.textSecondary,
                modifier = Modifier.padding(top = 8.dp),
            )
            SectionTitle("Tags", palette)
            TagsSection(state, palette, viewModel)
        }
    }

    if (discardPrompt) {
        ConfirmDialog(
            title = "Unsaved Changes",
            message = "Are you sure you want to discard changes to this task?",
            confirm = "Discard",
            onConfirm = {
                discardPrompt = false
                onClose()
            },
            onDismiss = { discardPrompt = false },
        )
    }
    if (deletePrompt) {
        ConfirmDialog(
            title = "Are you sure?",
            message = "This will permanently delete the task.",
            confirm = "Delete Task",
            onConfirm = {
                deletePrompt = false
                viewModel.delete()
            },
            onDismiss = { deletePrompt = false },
        )
    }
}

@Composable
private fun ConfirmDialog(title: String, message: String, confirm: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    val colors = KarottoTheme.colors
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.dialogBackground,
        title = { Text(title, color = colors.textTitle) },
        text = { Text(message, color = colors.textSecondary) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirm, color = colors.textRed, fontWeight = FontWeight.Medium) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = colors.textBrand) } },
    )
}

@Composable
private fun FormHeader(
    state: FormState,
    palette: FormPalette,
    onBack: () -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    onChange: ((FormState) -> FormState) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.tint)
            .statusBarsPadding(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = palette.onTint)
            }
            Text(
                text = if (state.isEdit) "" else "Create ${state.type.singular}",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                color = palette.onTint,
                modifier = Modifier.weight(1f).padding(start = 8.dp),
            )
            if (state.isEdit) {
                HeaderAction("Delete", enabled = !state.saving, palette, onDelete)
            }
            HeaderAction(if (state.isEdit) "Save" else "Create", enabled = state.canSave, palette, onSave)
        }
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            HeaderField(
                label = "Task Title",
                value = state.text,
                palette = palette,
                singleLine = false,
                onChange = { v -> onChange { it.copy(text = v) } },
            )
            Spacer(Modifier.height(16.dp))
            HeaderField(
                label = "Notes",
                value = state.notes,
                palette = palette,
                singleLine = false,
                minLines = 3,
                onChange = { v -> onChange { it.copy(notes = v) } },
            )
        }
    }
}

@Composable
private fun HeaderAction(text: String, enabled: Boolean, palette: FormPalette, onClick: () -> Unit) {
    Text(
        text = text,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        color = palette.onTint.copy(alpha = if (enabled) 1f else 0.4f),
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    )
}

/** Habitica tints the box with `colorPrimaryText`; 90% alpha reads better than its 60/80 on OLED. */
@Composable
private fun HeaderField(
    label: String,
    value: String,
    palette: FormPalette,
    singleLine: Boolean,
    onChange: (String) -> Unit,
    minLines: Int = 1,
) {
    var focused by remember { mutableStateOf(false) }
    val box = palette.fieldBox.copy(alpha = if (focused) 1f else 0.9f)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
            .background(box)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(label, fontSize = 12.sp, color = Color.White.copy(alpha = 0.8f))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = singleLine,
            minLines = minLines,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            textStyle = TextStyle(fontSize = 16.sp, color = Color.White, lineHeight = 22.sp),
            cursorBrush = SolidColor(Color.White),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .onFocusChanged { focused = it.isFocused },
        )
    }
    Box(Modifier.fillMaxWidth().height(2.dp).background(box))
}

@Composable
private fun SectionTitle(text: String, palette: FormPalette) {
    Text(
        text = text,
        fontSize = 16.sp,
        fontWeight = FontWeight.Medium,
        color = palette.textPrimary,
        modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
    )
}

@Composable
private fun HabitScoringSection(state: FormState, palette: FormPalette, onChange: ((FormState) -> FormState) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(30.dp, Alignment.CenterHorizontally),
    ) {
        ScoringToggle("Positive", Icons.Rounded.Add, state.up, palette) { onChange { it.copy(up = !it.up) } }
        ScoringToggle("Negative", Icons.Rounded.Remove, state.down, palette) { onChange { it.copy(down = !it.down) } }
    }
}

@Composable
private fun ScoringToggle(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, selected: Boolean, palette: FormPalette, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(if (selected) palette.uiMain else Color.Transparent)
                .border(1.dp, if (selected) palette.uiMain else palette.textSecondary, CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = if (selected) palette.uiDetails else palette.textSecondary, modifier = Modifier.size(20.dp))
        }
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
            color = if (selected) palette.textPrimary else palette.textSecondary,
        )
    }
}

@Composable
private fun <T> Selector(options: List<Pair<T, String>>, selected: T, palette: FormPalette, onSelect: (T) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        options.forEach { (value, label) ->
            val active = value == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (active) palette.uiMain else palette.offset)
                    .clickable { onSelect(value) }
                    .padding(15.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    fontSize = 16.sp,
                    fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                    color = if (active) palette.uiDetails else palette.textSecondary,
                )
            }
        }
    }
}

@Composable
private fun AliasField(value: String, palette: FormPalette, onChange: (String) -> Unit) {
    FieldCard("Alias", palette, Modifier.fillMaxWidth()) {
        BasicTextField(
            value = value,
            onValueChange = { v -> if (v.length <= 64 && v.all { it.isLetterOrDigit() || it == '-' || it == '_' }) onChange(v) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false),
            textStyle = TextStyle(fontSize = 16.sp, color = KarottoTheme.colors.textPrimary),
            cursorBrush = SolidColor(palette.uiSub),
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                Box { if (value.isEmpty()) Text("e.g. shower", fontSize = 16.sp, color = palette.textSecondary); inner() }
            },
        )
    }
}

@Composable
private fun NumberField(label: String, value: String, palette: FormPalette, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    FieldCard(label, palette, modifier) {
        BasicTextField(
            value = value,
            onValueChange = { v -> if (v.length <= 6 && v.all(Char::isDigit)) onChange(v) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = TextStyle(fontSize = 16.sp, color = KarottoTheme.colors.textPrimary),
            cursorBrush = SolidColor(palette.uiSub),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Filled field with a 2dp coloured underline, Habitica's `task_form_control_bg`. */
@Composable
private fun FieldCard(label: String, palette: FormPalette, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
            .background(palette.textSecondary)
            .padding(bottom = 2.dp)
            .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
            .background(palette.page)
            .background(palette.offset)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(label, fontSize = 12.sp, color = palette.textSecondary)
        Spacer(Modifier.height(4.dp))
        content()
    }
}

@Composable
private fun ChecklistEditor(state: FormState, palette: FormPalette, viewModel: TaskFormViewModel) {
    val focusManager = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        state.checklist.forEachIndexed { index, item ->
            val isAddRow = index == state.checklist.lastIndex
            FormRow(palette, filled = !isAddRow, onRemove = if (isAddRow) null else ({ viewModel.removeChecklistItem(item.key) })) {
                BasicTextField(
                    value = item.text,
                    onValueChange = { viewModel.setChecklistText(item.key, it) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences,
                        imeAction = if (isAddRow) ImeAction.Done else ImeAction.Next,
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) },
                        onDone = { focusManager.clearFocus() },
                    ),
                    textStyle = TextStyle(fontSize = 14.sp, color = KarottoTheme.colors.textPrimary),
                    cursorBrush = SolidColor(palette.uiSub),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        Box {
                            if (item.text.isEmpty()) {
                                Text(if (isAddRow) "New checklist entry" else "Checklist Text", fontSize = 14.sp, color = palette.textSecondary)
                            }
                            inner()
                        }
                    },
                )
                if (!isAddRow) {
                    Icon(
                        Icons.Rounded.DragHandle,
                        contentDescription = "Move up",
                        tint = palette.textSecondary,
                        modifier = Modifier
                            .size(24.dp)
                            .clickable(enabled = index > 0) { viewModel.moveChecklistItem(index, index - 1) },
                    )
                }
            }
        }
    }
}

@Composable
private fun FormRow(palette: FormPalette, filled: Boolean, onRemove: (() -> Unit)?, content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(palette.offset)
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .height(38.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Rounded.Add,
            contentDescription = if (filled) "Remove" else "Add",
            tint = palette.uiSub,
            modifier = Modifier
                .size(30.dp)
                .rotate(if (filled) 135f else 0f)
                .then(if (onRemove != null) Modifier.clickable(onClick = onRemove) else Modifier),
        )
        Spacer(Modifier.width(16.dp))
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DailyScheduling(state: FormState, palette: FormPalette, viewModel: TaskFormViewModel) {
    var datePicker by remember { mutableStateOf(false) }
    var frequencyMenu by remember { mutableStateOf(false) }
    FieldCard("Start Date", palette, Modifier.fillMaxWidth().clickable { datePicker = true }) {
        ValueWithCaret(Dates.formatMedium(state.startDate), palette)
    }
    Spacer(Modifier.height(16.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(Modifier.weight(1f)) {
            FieldCard("Repeats", palette, Modifier.fillMaxWidth().clickable { frequencyMenu = true }) {
                ValueWithCaret(state.frequency.name.lowercase().replaceFirstChar(Char::uppercase), palette)
            }
            DropdownMenu(expanded = frequencyMenu, onDismissRequest = { frequencyMenu = false }) {
                DailyFrequency.entries.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.name.lowercase().replaceFirstChar(Char::uppercase)) },
                        onClick = {
                            frequencyMenu = false
                            viewModel.update { it.copy(frequency = option) }
                            if (option == DailyFrequency.MONTHLY) viewModel.setMonthlyMode(state.monthlyMode)
                        },
                    )
                }
            }
        }
        FieldCard("Every", palette, Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BasicTextField(
                    value = state.everyX,
                    onValueChange = { v -> if (v.length <= 4 && v.all(Char::isDigit)) viewModel.update { it.copy(everyX = v) } },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    textStyle = TextStyle(fontSize = 16.sp, color = KarottoTheme.colors.textPrimary),
                    cursorBrush = SolidColor(palette.uiSub),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    when (state.frequency) {
                        DailyFrequency.DAILY -> "Days"
                        DailyFrequency.WEEKLY -> "Weeks"
                        DailyFrequency.MONTHLY -> "Months"
                        DailyFrequency.YEARLY -> "Years"
                    },
                    fontSize = 16.sp,
                    color = KarottoTheme.colors.textQuad,
                )
            }
        }
    }
    if (state.frequency == DailyFrequency.WEEKLY) {
        Spacer(Modifier.height(16.dp))
        WeekdayRow(state, palette) { day, enabled -> viewModel.update { it.copy(repeat = it.repeat.with(day, enabled)) } }
    }
    if (state.frequency == DailyFrequency.MONTHLY) {
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            MonthlyToggle("Day of Month", state.monthlyMode == MonthlyMode.DAY_OF_MONTH, palette, Modifier.weight(1f)) { viewModel.setMonthlyMode(MonthlyMode.DAY_OF_MONTH) }
            MonthlyToggle("Day of Week", state.monthlyMode == MonthlyMode.DAY_OF_WEEK, palette, Modifier.weight(1f)) { viewModel.setMonthlyMode(MonthlyMode.DAY_OF_WEEK) }
        }
    }
    Text(
        text = scheduleSummary(state),
        fontSize = 12.sp,
        color = palette.textSecondary,
        modifier = Modifier.padding(top = 8.dp),
    )
    if (datePicker) {
        DatePickerPrompt(
            initial = state.startDate,
            neutral = "Today" to { viewModel.setStartDate(LocalDate.now()) },
            onPick = viewModel::setStartDate,
            onDismiss = { datePicker = false },
        )
    }
}

@Composable
private fun ValueWithCaret(text: String, palette: FormPalette) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontSize = 16.sp, color = KarottoTheme.colors.textPrimary, modifier = Modifier.weight(1f))
        Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = palette.textSecondary)
    }
}

@Composable
private fun WeekdayRow(state: FormState, palette: FormPalette, onToggle: (Int, Boolean) -> Unit) {
    val first = WeekFields.of(Locale.getDefault()).firstDayOfWeek
    val days = (0 until 7).map { first.plus(it.toLong()) }
    val enabled = state.repeat.enabledDays()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        days.forEach { day ->
            val on = day.value in enabled
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (on) palette.uiMain else Color.Transparent)
                    .border(2.dp, if (on) palette.uiMain else palette.textSecondary, CircleShape)
                    .clickable { onToggle(day.value, !on) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    day.getDisplayName(JavaTextStyle.NARROW, Locale.getDefault()).uppercase(),
                    fontSize = 16.sp,
                    color = if (on) palette.uiDetails else palette.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun MonthlyToggle(text: String, active: Boolean, palette: FormPalette, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (active) palette.uiMain else palette.offset)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = 16.sp, color = if (active) palette.uiDetails else palette.textSecondary)
    }
}

private fun ordinal(n: Int): String {
    val suffix = when {
        n % 100 in 11..13 -> "th"
        n % 10 == 1 -> "st"
        n % 10 == 2 -> "nd"
        n % 10 == 3 -> "rd"
        else -> "th"
    }
    return "$n$suffix"
}

private fun scheduleSummary(state: FormState): String {
    val every = state.everyX.toIntOrNull()?.coerceAtLeast(1) ?: 1
    val unit = when (state.frequency) {
        DailyFrequency.DAILY -> "day"
        DailyFrequency.WEEKLY -> "week"
        DailyFrequency.MONTHLY -> "month"
        DailyFrequency.YEARLY -> "year"
    }
    val period = if (every == 1) unit else "$every ${unit}s"
    val tail = when (state.frequency) {
        DailyFrequency.WEEKLY -> {
            val names = state.repeat.enabledDays().sorted().map { DayOfWeek.of(it).getDisplayName(JavaTextStyle.FULL, Locale.getDefault()) }
            when {
                names.isEmpty() -> " (never, no weekday selected)"
                names.size == 7 -> ""
                else -> " on ${names.joinToString(", ")}"
            }
        }
        DailyFrequency.MONTHLY -> if (state.monthlyMode == MonthlyMode.DAY_OF_MONTH) {
            " on the ${ordinal(state.startDate.dayOfMonth)}"
        } else {
            val week = ordinal(com.karotto.app.domain.Scheduling.weekOfMonthByDay(state.startDate) + 1)
            " on the $week ${state.startDate.dayOfWeek.getDisplayName(JavaTextStyle.FULL, Locale.getDefault())} of the month"
        }
        else -> ""
    }
    return "Repeats every $period$tail."
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DueDateCard(state: FormState, palette: FormPalette, viewModel: TaskFormViewModel) {
    var datePicker by remember { mutableStateOf(false) }
    FieldCard("Due Date", palette, Modifier.fillMaxWidth().clickable { datePicker = true }) {
        ValueWithCaret(state.dueDate?.let(Dates::formatMedium) ?: "", palette)
    }
    if (datePicker) {
        DatePickerPrompt(
            initial = state.dueDate ?: LocalDate.now(),
            neutral = "Clear" to { viewModel.update { it.copy(dueDate = null) } },
            onPick = { date -> viewModel.update { it.copy(dueDate = date) } },
            onDismiss = { datePicker = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DatePickerPrompt(initial: LocalDate, neutral: Pair<String, () -> Unit>?, onPick: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val pickerState = rememberDatePickerState(initialSelectedDateMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                pickerState.selectedDateMillis?.let { onPick(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                onDismiss()
            }) { Text("OK") }
        },
        dismissButton = {
            Row {
                if (neutral != null) {
                    TextButton(onClick = {
                        neutral.second()
                        onDismiss()
                    }) { Text(neutral.first) }
                }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        },
    ) {
        DatePicker(state = pickerState)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimePickerPrompt(initial: LocalTime, onPick: (LocalTime) -> Unit, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val pickerState = rememberTimePickerState(
        initialHour = initial.hour,
        initialMinute = initial.minute,
        is24Hour = android.text.format.DateFormat.is24HourFormat(context),
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onPick(LocalTime.of(pickerState.hour, pickerState.minute))
                onDismiss()
            }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        text = { TimePicker(state = pickerState) },
    )
}

@Composable
private fun RemindersEditor(state: FormState, palette: FormPalette, viewModel: TaskFormViewModel) {
    val context = LocalContext.current
    var editing by remember { mutableStateOf<Int?>(null) }
    var pickingDate by remember { mutableStateOf<Int?>(null) }
    var pendingDate by remember { mutableStateOf<LocalDate?>(null) }
    var pickingTime by remember { mutableStateOf(false) }
    var notificationsEnabled by remember { mutableStateOf(NotificationManagerCompat.from(context).areNotificationsEnabled()) }
    var exactAllowed by remember { mutableStateOf(canScheduleExact(context)) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        notificationsEnabled = granted
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        exactAllowed = canScheduleExact(context)
    }
    fun requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsEnabled) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    fun open(index: Int?) {
        editing = index
        if (state.type == TaskType.TODO) {
            pickingDate = index ?: -1
        } else {
            pickingTime = true
        }
    }
    val zone = viewModel.ctx.zone

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (!notificationsEnabled) {
            Text(
                "Allow karotto notifications in the Settings app to receive reminders",
                fontSize = 12.sp,
                color = KarottoTheme.colors.textQuad,
                modifier = Modifier.clickable { requestNotifications() },
            )
        }
        state.reminders.forEachIndexed { index, reminder ->
            FormRow(palette, filled = true, onRemove = { viewModel.removeReminder(index) }) {
                val label = if (state.type == TaskType.TODO) Dates.formatDateTime(reminder.at) else Dates.formatTime(reminder.at.toLocalTime())
                Text(
                    label,
                    fontSize = 14.sp,
                    color = KarottoTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f).clickable { open(index) },
                )
            }
        }
        FormRow(palette, filled = false, onRemove = null) {
            Text(
                "New reminder",
                fontSize = 14.sp,
                color = palette.textSecondary,
                modifier = Modifier.weight(1f).clickable {
                    requestNotifications()
                    open(null)
                },
            )
        }
        if (!exactAllowed) {
            Text(
                "Reminders may be delayed because permissions aren't enabled. Tap to view and update permissions.",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = palette.uiDetails,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(palette.uiMain)
                    .clickable {
                        if (Build.VERSION.SDK_INT >= 31) {
                            context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(android.net.Uri.parse("package:${context.packageName}")))
                        }
                        exactAllowed = canScheduleExact(context)
                    }
                    .padding(12.dp),
            )
        }
    }

    val current = editing?.let { state.reminders.getOrNull(it)?.at }
    pickingDate?.let {
        DatePickerPrompt(
            initial = current?.toLocalDate() ?: state.dueDate ?: LocalDate.now(zone),
            neutral = null,
            onPick = { date ->
                pendingDate = date
                pickingTime = true
            },
            onDismiss = { pickingDate = null },
        )
    }
    if (pickingTime && pickingDate == null) {
        TimePickerPrompt(
            initial = current?.toLocalTime() ?: LocalTime.now(zone).withSecond(0).withNano(0),
            onPick = { time ->
                val date = pendingDate ?: current?.toLocalDate() ?: if (state.type == TaskType.DAILY) state.startDate else LocalDate.now(zone)
                viewModel.setReminder(editing, ZonedDateTime.of(date, time, zone))
                pendingDate = null
                editing = null
            },
            onDismiss = {
                pickingTime = false
                pendingDate = null
            },
        )
    }
}

private fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < 31 || (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

@Composable
private fun TagsSection(state: FormState, palette: FormPalette, viewModel: TaskFormViewModel) {
    if (state.tags.isEmpty()) {
        Text("No tags yet. Create tags from the filter sheet.", fontSize = 14.sp, color = palette.textSecondary)
        return
    }
    Column {
        state.tags.forEach { tag ->
            val checked = tag.id in state.tagIds
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.update { it.copy(tagIds = if (checked) it.tagIds - tag.id else it.tagIds + tag.id) } }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = null,
                    colors = CheckboxDefaults.colors(checkedColor = palette.tint, uncheckedColor = palette.textSecondary, checkmarkColor = palette.onTint),
                )
                Text(tag.name, fontSize = 16.sp, color = palette.textPrimary, modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}
