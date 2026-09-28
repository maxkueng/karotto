package com.karotto.app.ui.common

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

object Dates {
    fun formatDate(date: LocalDate, pattern: String): String =
        runCatching { date.format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault())) }
            .getOrElse { date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)) }

    fun formatMedium(date: LocalDate): String = date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))

    fun formatTime(time: LocalTime): String = time.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))

    fun formatDateTime(at: ZonedDateTime): String =
        at.format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))

    fun parseReminder(time: String, zone: ZoneId): ZonedDateTime? =
        runCatching { ZonedDateTime.parse(time).withZoneSameInstant(zone) }
            .recoverCatching { Instant.parse(time).atZone(zone) }
            .getOrNull()
}
