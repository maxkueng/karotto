package com.karotto.app.ui.form

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.karotto.app.AppContainer
import com.karotto.app.data.api.NetworkException
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DailyFrequency
import com.karotto.app.domain.DayContext
import com.karotto.app.domain.Habit
import com.karotto.app.domain.HabitFrequency
import com.karotto.app.domain.Repeat
import com.karotto.app.domain.Scheduling
import com.karotto.app.domain.Tag
import com.karotto.app.domain.Task
import com.karotto.app.domain.TaskType
import com.karotto.app.domain.Todo
import com.karotto.app.ui.common.Dates
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

enum class MonthlyMode { DAY_OF_MONTH, DAY_OF_WEEK }

data class ReminderDraft(val id: String?, val at: ZonedDateTime)

data class ChecklistDraft(val id: String?, val key: String, val text: String, val completed: Boolean)

data class FormState(
    val type: TaskType,
    val taskId: String? = null,
    val value: Double = 0.0,
    val text: String = "",
    val notes: String = "",
    val up: Boolean = true,
    val down: Boolean = false,
    val habitFrequency: HabitFrequency = HabitFrequency.DAILY,
    val counterUp: String = "0",
    val counterDown: String = "0",
    val checklist: List<ChecklistDraft> = emptyList(),
    val frequency: DailyFrequency = DailyFrequency.WEEKLY,
    val everyX: String = "1",
    val startDate: LocalDate = LocalDate.now(),
    val repeat: Repeat = Repeat.EVERY_DAY,
    val monthlyMode: MonthlyMode = MonthlyMode.DAY_OF_MONTH,
    val streak: String = "0",
    val dueDate: LocalDate? = null,
    val reminders: List<ReminderDraft> = emptyList(),
    val tagIds: Set<String> = emptySet(),
    val tags: List<Tag> = emptyList(),
    val loaded: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
) {
    val isEdit: Boolean get() = taskId != null
    val canSave: Boolean get() = text.isNotBlank() && !saving

    /** Equality excluding transient UI fields, for the unsaved-changes prompt. */
    fun snapshot(): FormState = copy(
        tags = emptyList(),
        loaded = false,
        saving = false,
        error = null,
        done = false,
        checklist = checklist.filter { it.text.isNotBlank() }.map { it.copy(key = "") },
    )
}

class TaskFormViewModel(
    private val container: AppContainer,
    type: TaskType,
    private val taskId: String?,
    preselectedTags: Set<String>,
) : ViewModel() {
    private val local = MutableStateFlow(FormState(type = type, taskId = taskId, tagIds = preselectedTags))
    val state: StateFlow<FormState> = local
    private var initial: FormState? = null
    lateinit var ctx: DayContext
        private set

    init {
        viewModelScope.launch {
            val user = container.settings.currentUser()
            ctx = DayContext.of(user?.preferences ?: com.karotto.app.domain.Preferences())
            val tags = container.tags.tags.first()
            val task = taskId?.let { container.tasks.find(it) }
            local.update { base ->
                val filled = if (task != null) fromTask(base, task) else base.copy(startDate = ctx.cdsDay(java.time.Instant.now()), checklist = base.checklist.withTrailingBlank())
                filled.copy(tags = tags, loaded = true)
            }
            initial = local.value.snapshot()
        }
    }

    private fun fromTask(base: FormState, task: Task): FormState {
        val common = base.copy(
            value = task.value,
            text = task.text,
            notes = task.notes,
            tagIds = task.tags.toSet(),
            reminders = task.reminders.mapNotNull { reminder ->
                Dates.parseReminder(reminder.time, ctx.zone)?.let { ReminderDraft(reminder.id, it) }
            },
        )
        return when (task) {
            is Habit -> common.copy(
                up = task.up,
                down = task.down,
                habitFrequency = task.frequency,
                counterUp = task.counterUp.toString(),
                counterDown = task.counterDown.toString(),
            )

            is Daily -> common.copy(
                checklist = task.checklist.map { ChecklistDraft(it.id, it.id, it.text, it.completed) }.withTrailingBlank(),
                frequency = task.frequency,
                everyX = task.everyX.toString(),
                startDate = task.startDate,
                repeat = task.repeat,
                monthlyMode = if (task.weeksOfMonth.isNotEmpty()) MonthlyMode.DAY_OF_WEEK else MonthlyMode.DAY_OF_MONTH,
                streak = task.streak.toString(),
            )

            is Todo -> common.copy(
                checklist = task.checklist.map { ChecklistDraft(it.id, it.id, it.text, it.completed) }.withTrailingBlank(),
                dueDate = task.dueDate,
            )
        }
    }

    fun hasChanges(): Boolean = initial != null && initial != local.value.snapshot()

    fun update(transform: (FormState) -> FormState) = local.update(transform)

    fun setChecklistText(key: String, text: String) = local.update { state ->
        state.copy(checklist = state.checklist.map { if (it.key == key) it.copy(text = text) else it }.withTrailingBlank())
    }

    fun removeChecklistItem(key: String) = local.update { state ->
        state.copy(checklist = state.checklist.filterNot { it.key == key }.withTrailingBlank())
    }

    fun moveChecklistItem(from: Int, to: Int) = local.update { state ->
        val real = state.checklist.size - 1
        if (from !in 0 until real || to !in 0 until real) return@update state
        state.copy(checklist = state.checklist.toMutableList().apply { add(to, removeAt(from)) })
    }

    /** The editor always ends with one empty "add" row, as in Habitica. */
    private fun List<ChecklistDraft>.withTrailingBlank(): List<ChecklistDraft> {
        val trimmed = filterIndexed { index, item -> item.text.isNotEmpty() || index == lastIndex }
        return if (trimmed.lastOrNull()?.text?.isEmpty() == true) trimmed else trimmed + ChecklistDraft(null, UUID.randomUUID().toString(), "", false)
    }

    fun setReminder(index: Int?, at: ZonedDateTime) = local.update { state ->
        if (index == null) {
            state.copy(reminders = state.reminders + ReminderDraft(null, at))
        } else {
            state.copy(reminders = state.reminders.mapIndexed { i, r -> if (i == index) r.copy(at = at) else r })
        }
    }

    fun removeReminder(index: Int) = local.update { state ->
        state.copy(reminders = state.reminders.filterIndexed { i, _ -> i != index })
    }

    fun setStartDate(date: LocalDate) = local.update { state ->
        val next = state.copy(startDate = date)
        if (next.frequency == DailyFrequency.MONTHLY && next.monthlyMode == MonthlyMode.DAY_OF_WEEK) {
            next.copy(repeat = Repeat.NONE.with(date.dayOfWeek.value, true))
        } else {
            next
        }
    }

    fun setMonthlyMode(mode: MonthlyMode) = local.update { state ->
        val next = state.copy(monthlyMode = mode)
        if (mode == MonthlyMode.DAY_OF_WEEK) next.copy(repeat = Repeat.NONE.with(state.startDate.dayOfWeek.value, true)) else next
    }

    fun body(): JsonObject {
        val s = local.value
        return buildJsonObject {
            if (!s.isEdit) put("type", s.type.apiName)
            put("text", s.text.trim())
            put("notes", s.notes.trim())
            putJsonArray("tags") { s.tagIds.forEach { add(it) } }
            putJsonArray("reminders") {
                s.reminders.forEach { reminder ->
                    add(
                        buildJsonObject {
                            reminder.id?.let { put("id", it) }
                            put("time", reminder.at.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                            put("startDate", null as String?)
                        },
                    )
                }
            }
            when (s.type) {
                TaskType.HABIT -> {
                    put("up", s.up)
                    put("down", s.down)
                    put("frequency", s.habitFrequency.apiName)
                    put("counterUp", s.counterUp.toIntOrNull()?.coerceAtLeast(0) ?: 0)
                    put("counterDown", s.counterDown.toIntOrNull()?.coerceAtLeast(0) ?: 0)
                }

                TaskType.DAILY -> {
                    putChecklist(s)
                    put("frequency", s.frequency.apiName)
                    put("everyX", s.everyX.toIntOrNull()?.coerceIn(1, 9999) ?: 1)
                    put("startDate", s.startDate.toString())
                    putJsonObject("repeat") {
                        put("su", s.repeat.su); put("m", s.repeat.m); put("t", s.repeat.t); put("w", s.repeat.w)
                        put("th", s.repeat.th); put("f", s.repeat.f); put("s", s.repeat.s)
                    }
                    put("streak", s.streak.toIntOrNull()?.coerceAtLeast(0) ?: 0)
                    val monthly = s.frequency == DailyFrequency.MONTHLY
                    putJsonArray("daysOfMonth") { if (monthly && s.monthlyMode == MonthlyMode.DAY_OF_MONTH) add(s.startDate.dayOfMonth) }
                    putJsonArray("weeksOfMonth") { if (monthly && s.monthlyMode == MonthlyMode.DAY_OF_WEEK) add(Scheduling.weekOfMonthByDay(s.startDate)) }
                }

                TaskType.TODO -> {
                    putChecklist(s)
                    put("dueDate", s.dueDate?.toString())
                }
            }
        }
    }

    private fun kotlinx.serialization.json.JsonObjectBuilder.putChecklist(s: FormState) {
        putJsonArray("checklist") {
            s.checklist.filter { it.text.isNotBlank() }.forEach { item ->
                add(
                    buildJsonObject {
                        item.id?.let { put("id", it) }
                        put("text", item.text.trim())
                        put("completed", item.completed)
                    },
                )
            }
        }
    }

    fun save() {
        if (!local.value.canSave) return
        viewModelScope.launch {
            local.update { it.copy(saving = true, error = null) }
            try {
                val id = taskId
                if (id == null) container.tasks.create(listOf(body())) else container.tasks.update(id, body())
                local.update { it.copy(done = true) }
            } catch (error: Exception) {
                local.update { it.copy(saving = false, error = if (error is NetworkException) "No connection to the server" else error.message ?: "Save failed") }
            }
        }
    }

    fun delete() {
        val id = taskId ?: return
        viewModelScope.launch {
            local.update { it.copy(saving = true, error = null) }
            try {
                container.tasks.delete(id)
                local.update { it.copy(done = true) }
            } catch (error: Exception) {
                local.update { it.copy(saving = false, error = if (error is NetworkException) "No connection to the server" else error.message ?: "Delete failed") }
            }
        }
    }

    class Factory(
        private val container: AppContainer,
        private val type: TaskType,
        private val taskId: String?,
        private val tags: Set<String>,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = TaskFormViewModel(container, type, taskId, tags) as T
    }
}
