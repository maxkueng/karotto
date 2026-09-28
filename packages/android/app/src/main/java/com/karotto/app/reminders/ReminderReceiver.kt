package com.karotto.app.reminders

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.karotto.app.KarottoApp
import com.karotto.app.MainActivity
import com.karotto.app.R
import com.karotto.app.domain.Checklisted
import com.karotto.app.domain.DayContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val container = (context.applicationContext as KarottoApp).container
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val task = container.tasks.find(taskId) ?: return@launch
                val user = container.settings.currentUser()
                val done = (task as? Checklisted)?.completed == true
                if (!done && hasPermission(context)) {
                    notify(context, task.id, task.text, task.notes)
                }
                if (user != null) container.reminders.schedule(task, DayContext.of(user.preferences))
            } finally {
                pending.finish()
            }
        }
    }

    private fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun notify(context: Context, id: String, title: String, notes: String) {
        val open = PendingIntent.getActivity(
            context,
            id.hashCode(),
            Intent(context, MainActivity::class.java).putExtra(EXTRA_TASK_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF6133B4.toInt())
            .setContentTitle(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notes))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(id.hashCode(), notification)
    }

    companion object {
        const val EXTRA_TASK_ID = "taskId"
        const val EXTRA_REMINDER_ID = "reminderId"
        fun now(): Instant = Instant.now()
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val container = (context.applicationContext as KarottoApp).container
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                container.rescheduleReminders()
            } finally {
                pending.finish()
            }
        }
    }
}
