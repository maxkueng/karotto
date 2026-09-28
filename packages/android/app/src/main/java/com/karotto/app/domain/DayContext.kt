package com.karotto.app.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/** The user's day: timezone plus the hour at which a new day starts (Custom Day Start). */
data class DayContext(
    val zone: ZoneId,
    val dayStart: Int,
) {
    /** Calendar date of the user's day containing [instant]. Before dayStart it belongs to the previous day. */
    fun cdsDay(instant: Instant): LocalDate {
        val local = instant.atZone(zone)
        val date = local.toLocalDate()
        return if (local.hour < dayStart) date.minusDays(1) else date
    }

    fun startOfCdsDay(instant: Instant): ZonedDateTime =
        cdsDay(instant).atStartOfDay(zone).plusHours(dayStart.toLong())

    fun nextCdsBoundary(instant: Instant): ZonedDateTime = startOfCdsDay(instant).plusDays(1)

    fun daysBetween(from: Instant, to: Instant): Long = ChronoUnit.DAYS.between(cdsDay(from), cdsDay(to))

    fun isSameCdsDay(a: Instant, b: Instant): Boolean = cdsDay(a) == cdsDay(b)

    companion object {
        fun of(preferences: Preferences): DayContext = DayContext(
            zone = runCatching { ZoneId.of(preferences.timezone) }.getOrDefault(ZoneId.systemDefault()),
            dayStart = preferences.dayStart,
        )
    }
}
