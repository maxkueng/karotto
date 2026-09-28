package com.karotto.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class SchedulingTest {
    private fun daily(
        frequency: DailyFrequency = DailyFrequency.WEEKLY,
        everyX: Int = 1,
        startDate: LocalDate = LocalDate.of(2017, 5, 1),
        repeat: Repeat = Repeat.EVERY_DAY,
        daysOfMonth: List<Int> = emptyList(),
        weeksOfMonth: List<Int> = emptyList(),
    ) = Schedule(frequency, everyX, startDate, repeat, daysOfMonth, weeksOfMonth)

    private fun d(value: String): LocalDate = LocalDate.parse(value)

    @Test
    fun neverDueBeforeStart() {
        assertFalse(Scheduling.shouldDo(d("2017-04-30"), daily()))
        assertTrue(Scheduling.shouldDo(d("2017-05-01"), daily()))
    }

    @Test
    fun everyXDays() {
        val task = daily(frequency = DailyFrequency.DAILY, everyX = 2)
        assertTrue(Scheduling.shouldDo(d("2017-05-01"), task))
        assertFalse(Scheduling.shouldDo(d("2017-05-02"), task))
        assertTrue(Scheduling.shouldDo(d("2017-05-03"), task))
        assertEquals(
            listOf("2017-05-03", "2017-05-05", "2017-05-07", "2017-05-09", "2017-05-11", "2017-05-13").map(::d),
            Scheduling.nextDueDates(d("2017-05-01"), task),
        )
    }

    @Test
    fun weeklyBlocksFromStart() {
        val task = daily(startDate = d("2017-11-19"), everyX = 3, repeat = Repeat.NONE.copy(su = true))
        assertTrue(Scheduling.shouldDo(d("2017-11-19"), task))
        assertFalse(Scheduling.shouldDo(d("2017-11-26"), task))
        assertTrue(Scheduling.shouldDo(d("2017-12-10"), task))
        assertTrue(Scheduling.shouldDo(d("2018-01-21"), task))
        assertFalse(Scheduling.shouldDo(d("2018-01-22"), task))
    }

    @Test
    fun weeklyNextDue() {
        val sundayFriday = daily(everyX = 2, repeat = Repeat.NONE.copy(su = true, f = true))
        assertEquals(
            listOf("2017-05-05", "2017-05-07", "2017-05-19", "2017-05-21", "2017-06-02", "2017-06-04").map(::d),
            Scheduling.nextDueDates(d("2017-05-01"), sundayFriday),
        )
    }

    @Test
    fun monthlyDayOfMonthWithClamp() {
        val task = daily(frequency = DailyFrequency.MONTHLY, startDate = d("2017-01-31"), daysOfMonth = listOf(31))
        assertTrue(Scheduling.shouldDo(d("2017-02-28"), task))
        assertTrue(Scheduling.shouldDo(d("2017-04-30"), task))
        assertFalse(Scheduling.shouldDo(d("2017-04-29"), task))
        val quarterly = daily(frequency = DailyFrequency.MONTHLY, everyX = 3, daysOfMonth = listOf(1))
        assertEquals(
            listOf("2017-08-01", "2017-11-01", "2018-02-01", "2018-05-01", "2018-08-01", "2018-11-01").map(::d),
            Scheduling.nextDueDates(d("2017-05-01"), quarterly),
        )
    }

    @Test
    fun monthlyNthWeekday() {
        val fifthMonday = daily(
            frequency = DailyFrequency.MONTHLY,
            startDate = d("2017-05-29"),
            weeksOfMonth = listOf(4),
            repeat = Repeat.NONE.copy(m = true),
        )
        assertEquals(
            listOf("2017-07-31", "2017-10-30", "2018-01-29", "2018-04-30", "2018-07-30", "2018-10-29").map(::d),
            Scheduling.nextDueDates(d("2017-05-29"), fifthMonday),
        )
        assertFalse(Scheduling.shouldDo(d("2017-05-01"), daily(frequency = DailyFrequency.MONTHLY)))
    }

    @Test
    fun yearly() {
        val task = daily(frequency = DailyFrequency.YEARLY, everyX = 2)
        assertTrue(Scheduling.shouldDo(d("2019-05-01"), task))
        assertFalse(Scheduling.shouldDo(d("2018-05-01"), task))
        val leap = daily(frequency = DailyFrequency.YEARLY, startDate = d("2024-02-29"))
        assertEquals(listOf(d("2028-02-29"), d("2032-02-29")), Scheduling.nextDueDates(d("2024-02-29"), leap, 2))
    }
}
