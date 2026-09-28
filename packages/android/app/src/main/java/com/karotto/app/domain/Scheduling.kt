package com.karotto.app.domain

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/** Port of the core `shouldDo` / `nextDueDates` math on civil dates. */
object Scheduling {
    private const val MAX_EVERY_X = 9999

    fun weekOfMonthByDay(day: LocalDate): Int = (day.dayOfMonth - 1) / 7

    fun shouldDo(day: LocalDate, schedule: Schedule): Boolean {
        if (schedule.everyX < 1 || schedule.everyX > MAX_EVERY_X) return false
        if (day.isBefore(schedule.startDate)) return false
        return when (schedule.frequency) {
            DailyFrequency.DAILY ->
                ChronoUnit.DAYS.between(schedule.startDate, day) % schedule.everyX == 0L

            DailyFrequency.WEEKLY -> {
                val days = schedule.repeat.enabledDays()
                if (days.isEmpty() || day.dayOfWeek.value !in days) return false
                val weeks = ChronoUnit.DAYS.between(schedule.startDate, day) / 7
                weeks % schedule.everyX == 0L
            }

            DailyFrequency.MONTHLY -> {
                val months = ChronoUnit.MONTHS.between(
                    YearMonth.from(schedule.startDate).atDay(1),
                    YearMonth.from(day).atDay(1),
                )
                if (months % schedule.everyX != 0L) return false
                when {
                    schedule.weeksOfMonth.isNotEmpty() ->
                        day.dayOfWeek.value in schedule.repeat.enabledDays() &&
                            weekOfMonthByDay(day) in schedule.weeksOfMonth

                    schedule.daysOfMonth.isNotEmpty() -> matchesDayOfMonth(day, schedule.daysOfMonth)
                    else -> false
                }
            }

            DailyFrequency.YEARLY -> {
                val start = schedule.startDate
                start.monthValue == day.monthValue &&
                    start.dayOfMonth == day.dayOfMonth &&
                    (day.year - start.year) % schedule.everyX == 0
            }
        }
    }

    private fun matchesDayOfMonth(day: LocalDate, daysOfMonth: List<Int>): Boolean {
        val date = day.dayOfMonth
        if (date in daysOfMonth) return true
        if (day.dayOfMonth != day.lengthOfMonth()) return false
        return daysOfMonth.any { it > date }
    }

    fun isDueOn(instant: Instant, schedule: Schedule, ctx: DayContext): Boolean =
        shouldDo(ctx.cdsDay(instant), schedule)

    /** Next [count] due dates strictly after [after], generated per frequency and verified with [shouldDo]. */
    fun nextDueDates(after: LocalDate, schedule: Schedule, count: Int = 6): List<LocalDate> {
        if (schedule.everyX < 1 || schedule.everyX > MAX_EVERY_X) return emptyList()
        val result = mutableListOf<LocalDate>()
        var inspected = 0
        for (day in candidates(after, schedule)) {
            inspected += 1
            if (inspected > CANDIDATE_LIMIT) break
            if (shouldDo(day, schedule)) {
                result += day
                if (result.size >= count) break
            }
        }
        return result
    }

    private const val CANDIDATE_LIMIT = 200_000

    private fun candidates(after: LocalDate, schedule: Schedule): Sequence<LocalDate> {
        val start = if (schedule.startDate.isAfter(after)) schedule.startDate else after.plusDays(1)
        return when (schedule.frequency) {
            DailyFrequency.DAILY -> {
                val offset = ChronoUnit.DAYS.between(schedule.startDate, start)
                val remainder = ((offset % schedule.everyX) + schedule.everyX) % schedule.everyX
                val first = start.plusDays(if (remainder == 0L) 0 else schedule.everyX - remainder)
                generateSequence(first) { it.plusDays(schedule.everyX.toLong()) }
            }

            DailyFrequency.WEEKLY -> generateSequence(start) { it.plusDays(1) }
            DailyFrequency.MONTHLY -> generateSequence(YearMonth.from(start)) { it.plusMonths(1) }
                .flatMap { month ->
                    (1..month.lengthOfMonth()).asSequence().map { month.atDay(it) }.filter { !it.isBefore(start) }
                }

            DailyFrequency.YEARLY -> generateSequence(start.year) { it + 1 }.mapNotNull { year ->
                val month = schedule.startDate.monthValue
                val day = schedule.startDate.dayOfMonth
                if (day > YearMonth.of(year, month).lengthOfMonth()) {
                    null
                } else {
                    LocalDate.of(year, month, day).takeIf { !it.isBefore(start) }
                }
            }
        }
    }
}
