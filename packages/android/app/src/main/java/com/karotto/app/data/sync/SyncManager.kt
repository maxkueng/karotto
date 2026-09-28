package com.karotto.app.data.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.karotto.app.KarottoApp
import com.karotto.app.data.api.ApiException
import com.karotto.app.data.api.NetworkException
import com.karotto.app.data.repo.TagRepository
import com.karotto.app.data.repo.TaskRepository
import com.karotto.app.data.repo.UserRepository
import com.karotto.app.data.store.Settings
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.TimeUnit

/** Coordinates pull syncs and the replay of queued scores. */
class SyncManager(
    private val context: Context,
    private val settings: Settings,
    private val users: UserRepository,
    private val tasks: TaskRepository,
    private val tags: TagRepository,
) {
    private val mutex = Mutex()

    sealed interface Result {
        data object Synced : Result
        data object Offline : Result
        data class Failed(val message: String, val unauthorized: Boolean) : Result
    }

    /** Full pull: user, tags, tasks. Queued scores are pushed first so the pull does not overwrite them. */
    suspend fun sync(force: Boolean = true): Result = mutex.withLock {
        if (settings.currentSession() == null) return Result.Failed("Not signed in", unauthorized = true)
        try {
            if (!tasks.flushPendingScores()) return Result.Offline
            users.refresh()
            tags.refresh()
            tasks.refresh()
            settings.markSynced(System.currentTimeMillis())
            Result.Synced
        } catch (error: NetworkException) {
            Result.Offline
        } catch (error: ApiException) {
            Result.Failed(error.message ?: "Sync failed", unauthorized = error.status == 401)
        }
    }

    /** Schedules a background replay of queued scores once the network is back. */
    fun schedulePush() {
        val request = OneTimeWorkRequestBuilder<PushWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(PUSH_WORK, ExistingWorkPolicy.REPLACE, request)
    }

    suspend fun push(): Boolean = mutex.withLock {
        try {
            tasks.flushPendingScores()
        } catch (error: Exception) {
            false
        }
    }

    companion object {
        const val PUSH_WORK = "push-scores"
    }
}

class PushWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val container = (applicationContext as KarottoApp).container
        return if (container.sync.push()) Result.success() else Result.retry()
    }
}
