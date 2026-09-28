package com.karotto.app.domain

import java.time.Instant
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.pow

enum class TaskColor { WORST, WORSE, BAD, NEUTRAL, GOOD, BETTER, BEST }

/** Port of the core scoring math: the 0.9747^value curve and its reverse solver. */
object Scoring {
    const val MAX_TASK_VALUE = 21.27
    const val MIN_TASK_VALUE = -47.27
    private const val CLOSE_ENOUGH = 0.00001
    private const val BASE = 0.9747

    private fun clamp(value: Double): Double = value.coerceIn(MIN_TASK_VALUE, MAX_TASK_VALUE)

    fun forwardDelta(value: Double, direction: Direction): Double =
        BASE.pow(clamp(value)) * if (direction == Direction.DOWN) -1 else 1

    fun reverseDelta(value: Double): Double {
        val current = clamp(value)
        var test = current - BASE.pow(current)
        repeat(1000) {
            val calc = test + BASE.pow(test)
            val diff = current - calc
            if (abs(diff) < CLOSE_ENOUGH) return test - current
            test += if (diff > 0) -diff else diff
        }
        return test - current
    }

    fun color(value: Double): TaskColor = when {
        value < -20 -> TaskColor.WORST
        value < -10 -> TaskColor.WORSE
        value < -1 -> TaskColor.BAD
        value < 1 -> TaskColor.NEUTRAL
        value < 5 -> TaskColor.GOOD
        value < 10 -> TaskColor.BETTER
        else -> TaskColor.BEST
    }

    fun scoreHabit(task: Habit, direction: Direction, times: Int = 1): Habit {
        var value = task.value
        repeat(times) {
            value += if (direction == Direction.DOWN) reverseDelta(value) else forwardDelta(value, direction)
        }
        return task.copy(
            value = value,
            counterUp = task.counterUp + if (direction == Direction.UP) times else 0,
            counterDown = task.counterDown + if (direction == Direction.DOWN) times else 0,
        )
    }

    fun scoreDaily(task: Daily, direction: Direction): Daily = if (direction == Direction.UP) {
        task.copy(value = task.value + forwardDelta(task.value, Direction.UP), streak = task.streak + 1, completed = true)
    } else {
        task.copy(value = task.value + reverseDelta(task.value), streak = max(0, task.streak - 1), completed = false)
    }

    fun scoreTodo(task: Todo, direction: Direction, now: Instant): Todo {
        val multiplier = 1 + task.checklist.count { it.completed }
        return if (direction == Direction.UP) {
            task.copy(
                value = task.value + forwardDelta(task.value, Direction.UP) * multiplier,
                completed = true,
                dateCompleted = now.toString(),
            )
        } else {
            task.copy(
                value = task.value + reverseDelta(task.value) * multiplier,
                completed = false,
                dateCompleted = null,
            )
        }
    }
}
