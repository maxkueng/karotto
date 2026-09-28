package com.karotto.app

import android.content.Context
import com.karotto.app.data.api.ApiClient
import com.karotto.app.data.db.KarottoDatabase
import com.karotto.app.data.repo.TagRepository
import com.karotto.app.data.repo.TaskRepository
import com.karotto.app.data.repo.UserRepository
import com.karotto.app.data.store.SecureStore
import com.karotto.app.data.store.Settings
import com.karotto.app.data.store.Session
import com.karotto.app.data.sync.SyncManager
import com.karotto.app.reminders.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Hand-wired dependency graph; small enough not to need a DI framework. */
class AppContainer(context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val secure = SecureStore(context)
    val settings = Settings(context, secure)
    val session: StateFlow<Session?> = settings.session.stateIn(scope, SharingStarted.Eagerly, null)
    val api = ApiClient { session.value?.let { ApiClient.Credentials(it.serverUrl, it.token) } }
    val db = KarottoDatabase.create(context)
    val reminders = ReminderScheduler(context)
    val users = UserRepository(api, settings)
    val tasks = TaskRepository(api, db, settings) { scope.launch { rescheduleReminders() } }
    val tags = TagRepository(api, db)
    val sync = SyncManager(context, settings, users, tasks, tags)

    suspend fun rescheduleReminders() {
        val user = settings.currentUser() ?: return
        val entities = db.tasks().all()
        val all = entities.map { api.json.decodeFromString(com.karotto.app.data.api.TaskDto.serializer(), it.json).toDomain() }
        reminders.scheduleAll(all, user.preferences)
    }

    suspend fun signOut() {
        reminders.cancelAll(db.tasks().all().map { it.id })
        tasks.clearLocal()
        tags.clearLocal()
        settings.clearSession()
    }
}
