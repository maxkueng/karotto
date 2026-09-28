package com.karotto.app.domain

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate

enum class TaskType(val apiName: String) {
    HABIT("habit"),
    DAILY("daily"),
    TODO("todo");

    companion object {
        fun fromApi(value: String): TaskType = entries.first { it.apiName == value }
    }
}

enum class Direction(val apiName: String) {
    UP("up"),
    DOWN("down"),
}

enum class DailyFrequency(val apiName: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly"),
    YEARLY("yearly");

    companion object {
        fun fromApi(value: String): DailyFrequency = entries.first { it.apiName == value }
    }
}

enum class HabitFrequency(val apiName: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly");

    companion object {
        fun fromApi(value: String): HabitFrequency = entries.first { it.apiName == value }
    }
}

@Serializable
data class Repeat(
    val su: Boolean = true,
    val m: Boolean = true,
    val t: Boolean = true,
    val w: Boolean = true,
    val th: Boolean = true,
    val f: Boolean = true,
    val s: Boolean = true,
) {
    /** Enabled weekdays as java.time DayOfWeek values (Monday = 1 .. Sunday = 7). */
    fun enabledDays(): Set<Int> = buildSet {
        if (m) add(1)
        if (t) add(2)
        if (w) add(3)
        if (th) add(4)
        if (f) add(5)
        if (s) add(6)
        if (su) add(7)
    }

    fun with(dayOfWeek: Int, enabled: Boolean): Repeat = when (dayOfWeek) {
        1 -> copy(m = enabled)
        2 -> copy(t = enabled)
        3 -> copy(w = enabled)
        4 -> copy(th = enabled)
        5 -> copy(f = enabled)
        6 -> copy(s = enabled)
        else -> copy(su = enabled)
    }

    companion object {
        val EVERY_DAY = Repeat()
        val NONE = Repeat(false, false, false, false, false, false, false)
    }
}

@Serializable
data class ChecklistItem(
    val id: String,
    val text: String,
    val completed: Boolean = false,
)

@Serializable
data class Reminder(
    val id: String,
    /** ISO-8601 instant with offset, as stored by the server. */
    val time: String,
    val startDate: String? = null,
)

/** Fields every task carries. */
sealed interface Task {
    val id: String
    val type: TaskType
    val text: String
    val notes: String
    val alias: String?
    val value: Double
    val tags: List<String>
    val reminders: List<Reminder>
    val position: Int
    val createdAt: String
    val updatedAt: String
}

sealed interface Checklisted : Task {
    val completed: Boolean
    val collapseChecklist: Boolean
    val checklist: List<ChecklistItem>
}

data class Habit(
    override val id: String,
    override val text: String,
    override val notes: String,
    override val alias: String?,
    override val value: Double,
    override val tags: List<String>,
    override val reminders: List<Reminder>,
    override val position: Int,
    override val createdAt: String,
    override val updatedAt: String,
    val up: Boolean,
    val down: Boolean,
    val counterUp: Int,
    val counterDown: Int,
    val frequency: HabitFrequency,
) : Task {
    override val type: TaskType get() = TaskType.HABIT
}

data class Daily(
    override val id: String,
    override val text: String,
    override val notes: String,
    override val alias: String?,
    override val value: Double,
    override val tags: List<String>,
    override val reminders: List<Reminder>,
    override val position: Int,
    override val createdAt: String,
    override val updatedAt: String,
    override val completed: Boolean,
    override val collapseChecklist: Boolean,
    override val checklist: List<ChecklistItem>,
    val frequency: DailyFrequency,
    val everyX: Int,
    val startDate: LocalDate,
    val repeat: Repeat,
    val streak: Int,
    val daysOfMonth: List<Int>,
    val weeksOfMonth: List<Int>,
    val yesterdaily: Boolean,
    /** Due on the current day as last computed (server at fetch time, or locally). */
    val isDue: Boolean,
) : Checklisted {
    override val type: TaskType get() = TaskType.DAILY

    val schedule: Schedule
        get() = Schedule(frequency, everyX, startDate, repeat, daysOfMonth, weeksOfMonth)
}

data class Todo(
    override val id: String,
    override val text: String,
    override val notes: String,
    override val alias: String?,
    override val value: Double,
    override val tags: List<String>,
    override val reminders: List<Reminder>,
    override val position: Int,
    override val createdAt: String,
    override val updatedAt: String,
    override val completed: Boolean,
    override val collapseChecklist: Boolean,
    override val checklist: List<ChecklistItem>,
    val dueDate: LocalDate?,
    val dateCompleted: String?,
) : Checklisted {
    override val type: TaskType get() = TaskType.TODO
}

data class Schedule(
    val frequency: DailyFrequency,
    val everyX: Int,
    val startDate: LocalDate,
    val repeat: Repeat,
    val daysOfMonth: List<Int>,
    val weeksOfMonth: List<Int>,
)

@Serializable
data class Tag(
    val id: String,
    val name: String,
    val position: Int,
)

@Serializable
data class ActiveFilter(
    val habit: String = "all",
    val daily: String = "due",
    val todo: String = "active",
)

@Serializable
data class Preferences(
    val dayStart: Int = 0,
    val timezone: String = "UTC",
    val dateFormat: String = "MM/dd/yyyy",
    val activeFilter: ActiveFilter = ActiveFilter(),
    val completedTodoRetentionDays: Int? = 30,
)

@Serializable
data class User(
    val id: String,
    val username: String,
    val createdAt: String,
    val lastCron: String,
    val needsCron: Boolean,
    val preferences: Preferences,
)

@Serializable
data class HistoryEntry(
    val date: String,
    val value: Double,
    val scoredUp: Int? = null,
    val scoredDown: Int? = null,
    val isDue: Boolean? = null,
    val completed: Boolean? = null,
)

@Serializable
data class ScoreRequest(
    val id: String,
    val direction: String,
)

@Serializable
data class ApiErrorBody(
    val error: ApiErrorDetail,
)

@Serializable
data class ApiErrorDetail(
    val code: String,
    val message: String,
)

@Serializable
data class OkResponse(
    @SerialName("ok") val ok: Boolean,
)
