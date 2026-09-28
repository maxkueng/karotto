package com.karotto.app.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DayContext
import com.karotto.app.domain.Habit
import com.karotto.app.domain.Preferences
import com.karotto.app.domain.Reminder
import com.karotto.app.domain.Scheduling
import com.karotto.app.domain.Task
import com.karotto.app.domain.Todo
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

/**
 * Turns stored reminders into exact alarms. Dailies get a rolling window of the next
 * [OCCURRENCES] due days at the reminder's wall-clock time; to-dos and habits fire once.
 */
class ReminderScheduler(private val context: Context) {
    private val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun scheduleAll(tasks: List<Task>, preferences: Preferences) {
        val ctx = DayContext.of(preferences)
        tasks.forEach { schedule(it, ctx) }
    }

    fun schedule(task: Task, ctx: DayContext) {
        cancel(task.id, task.reminders.size)
        val now = Instant.now()
        task.reminders.forEachIndexed { reminderIndex, reminder ->
            occurrences(task, reminder, ctx, now).forEachIndexed { occurrence, at ->
                arm(task, reminder, requestCode(task.id, reminderIndex, occurrence), at)
            }
        }
    }

    fun cancel(taskId: String, reminderCount: Int = MAX_REMINDERS) {
        for (reminderIndex in 0 until reminderCount.coerceAtLeast(MAX_REMINDERS)) {
            for (occurrence in 0 until OCCURRENCES) {
                val code = requestCode(taskId, reminderIndex, occurrence)
                val intent = PendingIntent.getBroadcast(
                    context, code, receiverIntent(taskId), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
                )
                if (intent != null) {
                    alarms.cancel(intent)
                    intent.cancel()
                }
            }
        }
    }

    fun cancelAll(taskIds: List<String>) = taskIds.forEach { cancel(it) }

    private fun occurrences(task: Task, reminder: Reminder, ctx: DayContext, now: Instant): List<Instant> {
        val time = runCatching { ZonedDateTime.parse(reminder.time) }.getOrNull() ?: return emptyList()
        val localTime: LocalTime = time.withZoneSameInstant(ctx.zone).toLocalTime()
        return when (task) {
            is Todo -> if (task.completed || time.toInstant().isBefore(now)) emptyList() else listOf(time.toInstant())
            is Habit -> listOf(nextAt(localTime, ctx, now))
            is Daily -> {
                val today = ctx.cdsDay(now)
                val candidates = mutableListOf<Instant>()
                if (Scheduling.shouldDo(today, task.schedule) && !task.completed) {
                    val at = today.atTime(localTime).atZone(ctx.zone).toInstant()
                    if (at.isAfter(now)) candidates += at
                }
                Scheduling.nextDueDates(today, task.schedule, OCCURRENCES).forEach { day ->
                    candidates += day.atTime(localTime).atZone(ctx.zone).toInstant()
                }
                candidates.take(OCCURRENCES)
            }
        }
    }

    private fun nextAt(localTime: LocalTime, ctx: DayContext, now: Instant): Instant {
        val today = LocalDate.now(ctx.zone)
        val at = today.atTime(localTime).atZone(ctx.zone).toInstant()
        return if (at.isAfter(now)) at else today.plusDays(1).atTime(localTime).atZone(ctx.zone).toInstant()
    }

    private fun arm(task: Task, reminder: Reminder, code: Int, at: Instant) {
        val intent = receiverIntent(task.id).putExtra(ReminderReceiver.EXTRA_REMINDER_ID, reminder.id)
        val pending = PendingIntent.getBroadcast(
            context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
        try {
            if (exact) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pending)
            } else {
                alarms.setWindow(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), WINDOW_MS, pending)
            }
        } catch (error: SecurityException) {
            alarms.setWindow(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), WINDOW_MS, pending)
        }
    }

    private fun receiverIntent(taskId: String): Intent =
        Intent(context, ReminderReceiver::class.java).setAction(ACTION).putExtra(ReminderReceiver.EXTRA_TASK_ID, taskId)

    private fun requestCode(taskId: String, reminderIndex: Int, occurrence: Int): Int =
        taskId.hashCode() * 31 + reminderIndex * OCCURRENCES + occurrence

    companion object {
        const val CHANNEL = "reminders"
        const val ACTION = "com.karotto.app.REMINDER"
        private const val OCCURRENCES = 3
        private const val MAX_REMINDERS = 10
        private const val WINDOW_MS = 10L * 60 * 1000

        fun ensureChannel(context: Context) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Task reminders"
                },
            )
        }
    }
}
