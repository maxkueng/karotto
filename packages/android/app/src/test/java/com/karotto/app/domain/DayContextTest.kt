package com.karotto.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class DayContextTest {
    @Test
    fun cdsDayRespectsDayStartAndZone() {
        val utc5 = DayContext(ZoneId.of("UTC"), 5)
        assertEquals(LocalDate.of(2020, 2, 1), utc5.cdsDay(Instant.parse("2020-02-02T04:30:00Z")))
        assertEquals(LocalDate.of(2020, 2, 2), utc5.cdsDay(Instant.parse("2020-02-02T05:00:00Z")))
        val zurich = DayContext(ZoneId.of("Europe/Zurich"), 0)
        assertEquals(LocalDate.of(2020, 2, 2), zurich.cdsDay(Instant.parse("2020-02-01T23:30:00Z")))
    }

    @Test
    fun daysBetweenCountsBoundaries() {
        val ctx = DayContext(ZoneId.of("UTC"), 6)
        assertEquals(6, ctx.daysBetween(Instant.parse("2020-02-01T13:00:00Z"), Instant.parse("2020-02-08T03:00:00Z")))
    }

    @Test
    fun nextBoundary() {
        val ctx = DayContext(ZoneId.of("UTC"), 5)
        assertEquals(Instant.parse("2020-02-03T05:00:00Z"), ctx.nextCdsBoundary(Instant.parse("2020-02-02T09:30:00Z")).toInstant())
    }
}
