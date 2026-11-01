package com.karotto.app.ui.common

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class DatesTest {
    private val now = Instant.parse("2026-10-31T12:00:00Z")

    private fun ago(at: String) = Dates.timeAgo(Instant.parse(at), now)

    @Test
    fun timeAgo() {
        assertEquals("just now", ago("2026-10-31T11:59:30Z"))
        assertEquals("just now", ago("2026-10-31T12:00:30Z"))
        assertEquals("5m ago", ago("2026-10-31T11:55:00Z"))
        assertEquals("3h ago", ago("2026-10-31T09:00:00Z"))
        assertEquals("1d ago", ago("2026-10-30T12:00:00Z"))
    }
}
