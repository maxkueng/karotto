package com.karotto.app.data.api

import com.karotto.app.domain.ChecklistItem
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DailyFrequency
import com.karotto.app.domain.Habit
import com.karotto.app.domain.HabitFrequency
import com.karotto.app.domain.Reminder
import com.karotto.app.domain.Repeat
import com.karotto.app.domain.Tag
import com.karotto.app.domain.Task
import com.karotto.app.domain.TaskType
import com.karotto.app.domain.Todo
import com.karotto.app.domain.User
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import java.time.LocalDate

/** Wire shape of a task: one class with nullable per-type fields, discriminated by [type]. */
@Serializable
data class TaskDto(
    val id: String,
    val type: String,
    val text: String,
    val notes: String = "",
    val alias: String? = null,
    val value: Double = 0.0,
    val tags: List<String> = emptyList(),
    val reminders: List<Reminder> = emptyList(),
    val position: Int = 0,
    val createdAt: String = "",
    val updatedAt: String = "",
    val up: Boolean? = null,
    val down: Boolean? = null,
    val counterUp: Int? = null,
    val counterDown: Int? = null,
    val frequency: String? = null,
    val completed: Boolean? = null,
    val collapseChecklist: Boolean? = null,
    val checklist: List<ChecklistItem>? = null,
    val everyX: Int? = null,
    val startDate: String? = null,
    val repeat: Repeat? = null,
    val streak: Int? = null,
    val daysOfMonth: List<Int>? = null,
    val weeksOfMonth: List<Int>? = null,
    val yesterdaily: Boolean? = null,
    val isDue: Boolean? = null,
    val dueDate: String? = null,
    val dateCompleted: String? = null,
) {
    fun toDomain(): Task = when (TaskType.fromApi(type)) {
        TaskType.HABIT -> Habit(
            id, text, notes, alias, value, tags, reminders, position, createdAt, updatedAt,
            up = up ?: true,
            down = down ?: true,
            counterUp = counterUp ?: 0,
            counterDown = counterDown ?: 0,
            frequency = HabitFrequency.fromApi(frequency ?: "daily"),
        )

        TaskType.DAILY -> Daily(
            id, text, notes, alias, value, tags, reminders, position, createdAt, updatedAt,
            completed = completed ?: false,
            collapseChecklist = collapseChecklist ?: false,
            checklist = checklist ?: emptyList(),
            frequency = DailyFrequency.fromApi(frequency ?: "weekly"),
            everyX = everyX ?: 1,
            startDate = startDate?.let(LocalDate::parse) ?: LocalDate.of(1970, 1, 1),
            repeat = repeat ?: Repeat.EVERY_DAY,
            streak = streak ?: 0,
            daysOfMonth = daysOfMonth ?: emptyList(),
            weeksOfMonth = weeksOfMonth ?: emptyList(),
            yesterdaily = yesterdaily ?: true,
            isDue = isDue ?: false,
        )

        TaskType.TODO -> Todo(
            id, text, notes, alias, value, tags, reminders, position, createdAt, updatedAt,
            completed = completed ?: false,
            collapseChecklist = collapseChecklist ?: false,
            checklist = checklist ?: emptyList(),
            dueDate = dueDate?.let(LocalDate::parse),
            dateCompleted = dateCompleted,
        )
    }

    companion object {
        fun fromDomain(task: Task): TaskDto = when (task) {
            is Habit -> TaskDto(
                task.id, "habit", task.text, task.notes, task.alias, task.value, task.tags, task.reminders,
                task.position, task.createdAt, task.updatedAt,
                up = task.up, down = task.down, counterUp = task.counterUp, counterDown = task.counterDown,
                frequency = task.frequency.apiName,
            )

            is Daily -> TaskDto(
                task.id, "daily", task.text, task.notes, task.alias, task.value, task.tags, task.reminders,
                task.position, task.createdAt, task.updatedAt,
                frequency = task.frequency.apiName, completed = task.completed,
                collapseChecklist = task.collapseChecklist, checklist = task.checklist, everyX = task.everyX,
                startDate = task.startDate.toString(), repeat = task.repeat, streak = task.streak,
                daysOfMonth = task.daysOfMonth, weeksOfMonth = task.weeksOfMonth, yesterdaily = task.yesterdaily,
                isDue = task.isDue,
            )

            is Todo -> TaskDto(
                task.id, "todo", task.text, task.notes, task.alias, task.value, task.tags, task.reminders,
                task.position, task.createdAt, task.updatedAt,
                completed = task.completed, collapseChecklist = task.collapseChecklist, checklist = task.checklist,
                dueDate = task.dueDate?.toString(), dateCompleted = task.dateCompleted,
            )
        }
    }
}

@Serializable
data class ScoreResultDto(val task: TaskDto, val delta: Double)

@Serializable
data class BulkScoreResultDto(val results: List<ScoreResultDto>)

@Serializable
data class OrderResultDto(val ids: List<String>)

@Serializable
data class CronStatusDto(
    val needsCron: Boolean,
    val daysMissed: Int,
    val yesterday: String,
    val yesterdailies: List<TaskDto>,
)

@Serializable
data class CronResultDto(val ran: Boolean, val daysMissed: Int, val user: User)

@Serializable
data class TokenCreatedDto(
    val id: String,
    val name: String,
    val prefix: String,
    val token: String,
)

@Serializable
data class DeletedCountDto(val deleted: Int)

/** One SSE `data:` payload; which fields are set depends on [type]. */
@Serializable
data class ServerEventDto(
    val type: String,
    val origin: String? = null,
    val task: TaskDto? = null,
    val id: String? = null,
    val taskType: String? = null,
    val ids: List<String>? = null,
    val tags: List<Tag>? = null,
    val user: User? = null,
)

/** Free-form patch bodies are sent as JSON objects built by the caller. */
typealias JsonBody = Map<String, JsonElement>
