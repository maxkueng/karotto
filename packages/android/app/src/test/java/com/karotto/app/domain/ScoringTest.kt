package com.karotto.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class ScoringTest {
    @Test
    fun matchesHabiticaReferenceVectors() {
        val vectors = listOf(
            Triple(-60.0, 3.357913, -3.691022),
            Triple(-20.0, 1.669478, -1.745857),
            Triple(-1.0, 1.025957, -1.054045),
            Triple(0.0, 1.0, -1.026657),
            Triple(1.0, 0.9747, -1.0),
            Triple(10.0, 0.773944, -0.789761),
            Triple(30.0, 0.57981, -0.58862),
        )
        for ((value, up, reverse) in vectors) {
            assertEquals(up, Scoring.forwardDelta(value, Direction.UP), 1e-5)
            assertEquals(-up, Scoring.forwardDelta(value, Direction.DOWN), 1e-5)
            assertEquals(reverse, Scoring.reverseDelta(value), 1e-5)
        }
    }

    @Test
    fun habitTenUps() {
        var task = Habit("h", "t", "", null, 0.0, emptyList(), emptyList(), 0, "", "", true, true, 0, 0, HabitFrequency.DAILY)
        val values = mutableListOf<Double>()
        repeat(10) {
            task = Scoring.scoreHabit(task, Direction.UP)
            values += Math.round(task.value * 10000) / 10000.0
        }
        assertEquals(listOf(1.0, 1.9747, 2.9254, 3.8531, 4.7591, 5.6443, 6.5096, 7.356, 8.1842, 8.995), values)
        assertEquals(10, task.counterUp)
    }

    @Test
    fun dailyRoundTrip() {
        val daily = Daily(
            "d", "t", "", null, 2.0, emptyList(), emptyList(), 0, "", "",
            completed = false, collapseChecklist = false, checklist = emptyList(),
            frequency = DailyFrequency.WEEKLY, everyX = 1, startDate = java.time.LocalDate.of(2026, 1, 1),
            repeat = Repeat.EVERY_DAY, streak = 3, daysOfMonth = emptyList(), weeksOfMonth = emptyList(),
            yesterdaily = true, isDue = true,
        )
        val checked = Scoring.scoreDaily(daily, Direction.UP)
        assertEquals(4, checked.streak)
        val unchecked = Scoring.scoreDaily(checked, Direction.DOWN)
        assertEquals(3, unchecked.streak)
        assertEquals(2.0, unchecked.value, 1e-5)
    }

    @Test
    fun todoChecklistMultiplier() {
        val todo = Todo(
            "t", "t", "", null, 0.0, emptyList(), emptyList(), 0, "", "",
            completed = false, collapseChecklist = false,
            checklist = listOf(ChecklistItem("a", "a", true), ChecklistItem("b", "b", true), ChecklistItem("c", "c", false)),
            dueDate = null, dateCompleted = null,
        )
        val done = Scoring.scoreTodo(todo, Direction.UP, Instant.parse("2026-09-28T10:00:00Z"))
        assertEquals(3.0, done.value, 1e-5)
        assertEquals("2026-09-28T10:00:00Z", done.dateCompleted)
    }
}
