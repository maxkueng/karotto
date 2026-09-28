package com.karotto.app

import android.app.Application
import com.karotto.app.reminders.ReminderScheduler

class KarottoApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        ReminderScheduler.ensureChannel(this)
    }
}
