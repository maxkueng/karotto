package com.karotto.app.ui.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.karotto.app.AppContainer
import com.karotto.app.data.api.ApiException
import com.karotto.app.data.api.NetworkException
import com.karotto.app.data.sync.SyncManager
import com.karotto.app.domain.ActiveFilter
import com.karotto.app.domain.Checklisted
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DayContext
import com.karotto.app.domain.Direction
import com.karotto.app.domain.Filters
import com.karotto.app.domain.Preferences
import com.karotto.app.domain.ScoreRequest
import com.karotto.app.domain.Tag
import com.karotto.app.domain.Task
import com.karotto.app.domain.TaskType
import com.karotto.app.domain.Todo
import com.karotto.app.domain.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WelcomeBack(
    val yesterday: String,
    val dailies: List<Daily>,
    val checked: Set<String> = emptySet(),
    val running: Boolean = false,
)

data class Notice(
    val text: String,
    val error: Boolean = false,
    val action: String? = null,
    val onAction: (() -> Unit)? = null,
    val id: Long = System.nanoTime(),
)

data class TasksState(
    val user: User? = null,
    val tasks: List<Task> = emptyList(),
    val tags: List<Tag> = emptyList(),
    val filter: ActiveFilter = ActiveFilter(),
    val selectedTagIds: Set<String> = emptySet(),
    val search: String = "",
    val searchOpen: Boolean = false,
    val expandedChecklistId: String? = null,
    val refreshing: Boolean = false,
    val offline: Boolean = false,
    val pendingCount: Int = 0,
    val loaded: Boolean = false,
    val welcomeBack: WelcomeBack? = null,
    val notice: Notice? = null,
    val haptics: Boolean = true,
) {
    val preferences: Preferences get() = user?.preferences ?: Preferences()
    val dayContext: DayContext get() = DayContext.of(preferences)

    fun filterFor(type: TaskType): String = when (type) {
        TaskType.HABIT -> filter.habit
        TaskType.DAILY -> filter.daily
        TaskType.TODO -> filter.todo
    }

    fun isDefaultFilter(type: TaskType): Boolean = filterFor(type) == defaultFilter(type)

    val activeFilterCount: Int
        get() = selectedTagIds.size + TaskType.entries.count { !isDefaultFilter(it) }

    /** Visible tasks for one tab, in list order. */
    fun visible(type: TaskType): List<Task> {
        val filterName = filterFor(type)
        val list = tasks.filter { task ->
            task.type == type &&
                Filters.matches(task, filterName) &&
                Filters.matchesSearch(task, search) &&
                Filters.hasAllTags(task, selectedTagIds)
        }
        return if (type == TaskType.TODO && filterName == "scheduled") {
            list.sortedWith(compareBy<Task> { (it as Todo).dueDate }.thenBy { it.position })
        } else {
            list.sortedWith(compareBy<Task> { it.position }.thenByDescending { it.createdAt })
        }
    }

    fun canReorder(type: TaskType): Boolean =
        search.isBlank() && !(type == TaskType.TODO && filter.todo == "scheduled")

    companion object {
        fun defaultFilter(type: TaskType): String = when (type) {
            TaskType.HABIT -> "all"
            TaskType.DAILY -> "due"
            TaskType.TODO -> "active"
        }
    }
}

class TasksViewModel(private val container: AppContainer) : ViewModel() {
    private val local = MutableStateFlow(TasksState())

    private val remote = combine(container.users.user, container.tasks.tasks, container.tags.tags) { user, tasks, tags ->
        Triple(user, tasks, tags)
    }

    val state: StateFlow<TasksState> = combine(
        local,
        remote,
        container.tasks.pendingCount,
        container.settings.haptics,
        container.settings.activeFilter,
    ) { state, (user, tasks, tags), pending, haptics, filter ->
        state.copy(
            user = user,
            tasks = tasks,
            tags = tags,
            pendingCount = pending,
            haptics = haptics,
            filter = filter,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TasksState())

    init {
        viewModelScope.launch {
            container.settings.lastSync.collect { at -> local.update { it.copy(loaded = it.loaded || at > 0) } }
        }
    }

    fun refresh(force: Boolean = true) {
        viewModelScope.launch {
            local.update { it.copy(refreshing = true) }
            when (val result = container.sync.sync(force)) {
                SyncManager.Result.Synced -> {
                    local.update { it.copy(offline = false, loaded = true) }
                    if (state.value.filter.todo == "complete") runCatching { container.tasks.refreshCompleted() }
                    checkCron()
                }

                SyncManager.Result.Offline -> {
                    local.update { it.copy(offline = true) }
                    container.sync.schedulePush()
                }

                is SyncManager.Result.Failed -> if (result.unauthorized) {
                    container.signOut()
                } else {
                    notify(result.message, error = true)
                }
            }
            local.update { it.copy(refreshing = false) }
            container.rescheduleReminders()
        }
    }

    private suspend fun checkCron() {
        val status = runCatching { container.api.cronStatus() }.getOrNull() ?: return
        if (!status.needsCron) return
        val dailies = status.yesterdailies.map { it.toDomain() }.filterIsInstance<Daily>()
        if (dailies.isEmpty()) {
            runCron(emptyList())
        } else {
            local.update { it.copy(welcomeBack = WelcomeBack(status.yesterday, dailies)) }
        }
    }

    private suspend fun runCron(scores: List<ScoreRequest>) {
        try {
            container.tasks.flushPendingScores()
            container.api.runCron(scores)
            container.sync.sync(force = true)
        } catch (error: NetworkException) {
            local.update { it.copy(offline = true) }
        } catch (error: ApiException) {
            if (error.code != "cron_running") notify(error.message ?: "Day rollover failed", error = true)
        }
    }

    fun toggleYesterdaily(id: String) {
        local.update { state ->
            val wb = state.welcomeBack ?: return@update state
            val checked = if (id in wb.checked) wb.checked - id else wb.checked + id
            state.copy(welcomeBack = wb.copy(checked = checked))
        }
    }

    fun toggleYesterdailyChecklistItem(taskId: String, itemId: String) {
        viewModelScope.launch {
            runCatching { container.tasks.toggleChecklistItem(taskId, itemId) }
            local.update { state ->
                val wb = state.welcomeBack ?: return@update state
                val dailies = wb.dailies.map { daily ->
                    if (daily.id != taskId) daily
                    else daily.copy(checklist = daily.checklist.map { if (it.id == itemId) it.copy(completed = !it.completed) else it })
                }
                state.copy(welcomeBack = wb.copy(dailies = dailies))
            }
        }
    }

    fun startDay() {
        val wb = state.value.welcomeBack ?: return
        viewModelScope.launch {
            local.update { it.copy(welcomeBack = wb.copy(running = true)) }
            runCron(wb.checked.map { ScoreRequest(it, Direction.UP.apiName) })
            local.update { it.copy(welcomeBack = null) }
            container.rescheduleReminders()
        }
    }

    fun score(task: Task, direction: Direction) {
        viewModelScope.launch {
            container.tasks.score(task.id, direction)
            if (task is Checklisted && direction == Direction.UP) {
                local.update {
                    it.copy(notice = Notice("Completed \u201c${task.text}\u201d", action = "Undo", onAction = { score(task, Direction.DOWN) }))
                }
            }
            if (!container.sync.push()) {
                local.update { it.copy(offline = true) }
                container.sync.schedulePush()
            } else {
                local.update { it.copy(offline = false) }
            }
        }
    }

    fun toggleChecklistItem(task: Task, itemId: String) {
        viewModelScope.launch {
            try {
                container.tasks.toggleChecklistItem(task.id, itemId)
            } catch (error: Exception) {
                notify(if (error is NetworkException) "No connection" else error.message ?: "Failed", error = true)
            }
        }
    }

    fun toggleExpanded(id: String) {
        local.update { it.copy(expandedChecklistId = if (it.expandedChecklistId == id) null else id) }
    }

    fun move(type: TaskType, id: String, visibleTarget: Int) {
        val current = state.value
        val visible = current.visible(type).map { it.id }.filter { it != id }
        val all = current.tasks.filter { it.type == type && (it as? Checklisted)?.completed != true }
            .sortedWith(compareBy<Task> { it.position }.thenByDescending { it.createdAt })
            .map { it.id }
            .filter { it != id }
        val position = if (visibleTarget >= visible.size) {
            all.size
        } else {
            all.indexOf(visible[visibleTarget]).takeIf { it >= 0 } ?: all.size
        }
        viewModelScope.launch {
            try {
                container.tasks.move(id, position, type)
            } catch (error: Exception) {
                notify(if (error is NetworkException) "No connection" else error.message ?: "Reorder failed", error = true)
                runCatching { container.tasks.refresh() }
            }
        }
    }

    fun setFilter(type: TaskType, value: String) {
        viewModelScope.launch {
            container.settings.setFilter(type, value)
            if (type == TaskType.TODO && value == "complete") runCatching { container.tasks.refreshCompleted() }
        }
    }

    fun toggleTag(id: String) {
        local.update { it.copy(selectedTagIds = if (id in it.selectedTagIds) it.selectedTagIds - id else it.selectedTagIds + id) }
    }

    fun clearFilters(type: TaskType) {
        local.update { it.copy(selectedTagIds = emptySet()) }
        if (!state.value.isDefaultFilter(type)) setFilter(type, TasksState.defaultFilter(type))
    }

    fun setSearch(query: String) = local.update { it.copy(search = query) }

    fun setSearchOpen(open: Boolean) = local.update { it.copy(searchOpen = open, search = if (open) it.search else "") }

    fun createTag(name: String, onDone: (Tag?) -> Unit = {}) {
        viewModelScope.launch {
            val tag = runCatching { container.tags.create(name) }.onFailure { notify(it.message ?: "Failed", error = true) }.getOrNull()
            onDone(tag)
        }
    }

    fun renameTag(id: String, name: String) {
        viewModelScope.launch { runCatching { container.tags.rename(id, name) }.onFailure { notify(it.message ?: "Failed", error = true) } }
    }

    fun deleteTag(id: String) {
        viewModelScope.launch {
            runCatching { container.tags.delete(id) }.onFailure { notify(it.message ?: "Failed", error = true) }
            local.update { it.copy(selectedTagIds = it.selectedTagIds - id) }
        }
    }

    fun clearCompleted() {
        viewModelScope.launch {
            runCatching { container.tasks.clearCompleted() }
                .onSuccess { notify("Completed To Do's cleared") }
                .onFailure { notify(it.message ?: "Failed", error = true) }
        }
    }

    fun notify(text: String, error: Boolean = false) = local.update { it.copy(notice = Notice(text, error)) }

    fun dismissNotice() = local.update { it.copy(notice = null) }

    class Factory(private val container: AppContainer) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = TasksViewModel(container) as T
    }
}

