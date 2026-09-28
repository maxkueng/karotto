package com.karotto.app.data.sync

import com.karotto.app.data.api.ApiClient
import com.karotto.app.data.api.ServerEventDto
import com.karotto.app.data.repo.TagRepository
import com.karotto.app.data.repo.TaskRepository
import com.karotto.app.data.store.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

/**
 * Foreground-only SSE subscription. Events from other clients are applied to the local
 * cache; after a dropped connection a full sync fills the gap.
 */
class LiveUpdates(
    private val api: ApiClient,
    private val settings: Settings,
    private val tasks: TaskRepository,
    private val tags: TagRepository,
    private val scope: CoroutineScope,
    private val resync: suspend () -> Unit,
) {
    private var source: EventSource? = null
    private var retry: Job? = null
    private var attempts = 0
    private var wanted = false

    fun start() {
        wanted = true
        if (source == null) connect()
    }

    fun stop() {
        wanted = false
        retry?.cancel()
        retry = null
        source?.cancel()
        source = null
    }

    private fun connect() {
        val request = runCatching { api.eventsRequest() }.getOrNull() ?: return
        source = EventSources.createFactory(api.streamingHttp).newEventSource(request, listener)
    }

    private fun scheduleReconnect() {
        source = null
        if (!wanted) return
        val wait = (2_000L shl attempts.coerceAtMost(4)).coerceAtMost(30_000L)
        attempts += 1
        retry = scope.launch {
            delay(wait)
            if (wanted && source == null) connect()
        }
    }

    private val listener = object : EventSourceListener() {
        override fun onOpen(eventSource: EventSource, response: Response) {
            val reconnected = attempts > 0
            attempts = 0
            if (reconnected) scope.launch { resync() }
        }

        override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
            val event = runCatching { api.json.decodeFromString(ServerEventDto.serializer(), data) }.getOrNull() ?: return
            if (event.origin == api.clientId) return
            scope.launch { apply(event) }
        }

        override fun onClosed(eventSource: EventSource) = scheduleReconnect()

        override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) = scheduleReconnect()
    }

    private suspend fun apply(event: ServerEventDto) {
        when (event.type) {
            "task.upserted" -> event.task?.let { tasks.applyRemote(it) }
            "task.deleted" -> event.id?.let { tasks.removeLocal(it) }
            "tasks.reordered" -> event.ids?.let { tasks.applyRemoteOrder(it) }
            "tasks.invalidated" -> resync()
            "tags.changed" -> event.tags?.let { tags.replaceLocal(it) }
            "user.updated" -> event.user?.let { settings.saveUser(it) }
        }
    }
}
