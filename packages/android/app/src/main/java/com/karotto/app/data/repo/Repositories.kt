package com.karotto.app.data.repo

import com.karotto.app.data.api.ApiClient
import com.karotto.app.data.api.NetworkException
import com.karotto.app.data.api.TaskDto
import com.karotto.app.data.db.KarottoDatabase
import com.karotto.app.data.db.PendingScoreEntity
import com.karotto.app.data.db.TagEntity
import com.karotto.app.data.db.TaskEntity
import com.karotto.app.data.store.Settings
import com.karotto.app.domain.Checklisted
import com.karotto.app.domain.Daily
import com.karotto.app.domain.DayContext
import com.karotto.app.domain.Direction
import com.karotto.app.domain.Habit
import com.karotto.app.domain.Preferences
import com.karotto.app.domain.Scheduling
import com.karotto.app.domain.ScoreRequest
import com.karotto.app.domain.Scoring
import com.karotto.app.domain.Tag
import com.karotto.app.domain.Task
import com.karotto.app.domain.TaskType
import com.karotto.app.domain.Todo
import com.karotto.app.domain.User
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonObject
import java.time.Instant

/** Local-first task store: Room is what the UI observes; the API updates it. */
class TaskRepository(
    private val api: ApiClient,
    private val db: KarottoDatabase,
    private val settings: Settings,
    private val onLocalChange: () -> Unit,
) {
    private val json get() = api.json

    private fun entity(dto: TaskDto): TaskEntity = TaskEntity(
        id = dto.id,
        type = dto.type,
        position = dto.position,
        completed = dto.completed ?: false,
        createdAt = dto.createdAt,
        json = json.encodeToString(TaskDto.serializer(), dto),
    )

    private fun decode(entity: TaskEntity): TaskDto = json.decodeFromString(TaskDto.serializer(), entity.json)

    /** Tasks with `isDue` recomputed locally so the list is right even before the next sync. */
    val tasks: Flow<List<Task>> = combine(db.tasks().observeAll(), settings.user) { entities, user ->
        val ctx = DayContext.of(user?.preferences ?: Preferences())
        val now = Instant.now()
        entities.map { entity ->
            val task = decode(entity).toDomain()
            if (task is Daily) task.copy(isDue = Scheduling.isDueOn(now, task.schedule, ctx)) else task
        }
    }

    val pendingCount: Flow<Int> = db.pendingScores().observeCount()

    suspend fun find(id: String): Task? = db.tasks().byId(id)?.let { decode(it).toDomain() }

    suspend fun refresh() {
        val dtos = api.tasks()
        db.tasks().replaceActive(dtos.map(::entity))
    }

    suspend fun refreshCompleted() {
        val dtos = api.completedTodos()
        db.tasks().replaceCompletedTodos(dtos.map(::entity))
    }

    private suspend fun save(task: Task) {
        db.tasks().upsert(entity(TaskDto.fromDomain(task)))
    }

    private suspend fun save(dto: TaskDto) {
        db.tasks().upsert(entity(dto))
    }

    suspend fun create(bodies: List<JsonObject>): List<Task> {
        val created = api.createTasks(bodies)
        val type = created.firstOrNull()?.type
        if (type != null) {
            val shifted = db.tasks().all().filter { it.type == type && !it.completed }.map { existing ->
                val dto = decode(existing)
                entity(dto.copy(position = dto.position + created.size))
            }
            db.tasks().upsert(shifted)
        }
        db.tasks().upsert(created.map(::entity))
        onLocalChange()
        return created.map { it.toDomain() }
    }

    suspend fun update(id: String, patch: JsonObject): Task {
        val updated = api.updateTask(id, patch)
        save(updated)
        onLocalChange()
        return updated.toDomain()
    }

    suspend fun delete(id: String) {
        api.deleteTask(id)
        db.tasks().delete(id)
        onLocalChange()
    }

    /** Applies the score locally at once; the server call is queued and replayed in order. */
    suspend fun score(id: String, direction: Direction) {
        val task = find(id) ?: return
        val now = Instant.now()
        val scored: Task = when (task) {
            is Habit -> Scoring.scoreHabit(task, direction)
            is Daily -> Scoring.scoreDaily(task, direction)
            is Todo -> Scoring.scoreTodo(task, direction, now)
        }
        save(scored)
        db.pendingScores().insert(PendingScoreEntity(taskId = id, direction = direction.apiName, createdAt = now.toEpochMilli()))
        onLocalChange()
    }

    /** Replays queued scores. Returns false when the network is unavailable. */
    suspend fun flushPendingScores(): Boolean {
        val pending = db.pendingScores().all()
        for (op in pending) {
            try {
                val result = api.score(op.taskId, op.direction)
                save(result.task)
            } catch (error: NetworkException) {
                return false
            } catch (error: Exception) {
                // Conflicts (already completed etc.) mean the server already has this state; drop it.
            }
            db.pendingScores().delete(op)
        }
        return true
    }

    suspend fun toggleChecklistItem(id: String, itemId: String) {
        val task = find(id) as? Checklisted ?: return
        val toggled = task.checklist.map { if (it.id == itemId) it.copy(completed = !it.completed) else it }
        val optimistic: Task = when (task) {
            is Daily -> task.copy(checklist = toggled)
            is Todo -> task.copy(checklist = toggled)
        }
        save(optimistic)
        try {
            save(api.toggleChecklistItem(id, itemId))
        } catch (error: Exception) {
            save(task)
            throw error
        }
    }

    suspend fun setCollapsed(id: String, collapsed: Boolean) {
        val task = find(id) as? Checklisted ?: return
        val optimistic: Task = when (task) {
            is Daily -> task.copy(collapseChecklist = collapsed)
            is Todo -> task.copy(collapseChecklist = collapsed)
        }
        save(optimistic)
        runCatching { save(api.updateTask(id, JsonObject(mapOf("collapseChecklist" to kotlinx.serialization.json.JsonPrimitive(collapsed))))) }
    }

    suspend fun move(id: String, position: Int, type: TaskType) {
        val siblings = db.tasks().all().filter { it.type == type.apiName && !it.completed }
            .sortedWith(compareBy<TaskEntity> { it.position }.thenByDescending { it.createdAt })
            .map { it.id }
            .filter { it != id }
            .toMutableList()
        val target = if (position < 0 || position > siblings.size) siblings.size else position
        siblings.add(target, id)
        applyOrder(siblings)
        val result = api.move(id, position)
        applyOrder(result.ids)
    }

    private suspend fun applyOrder(ids: List<String>) {
        val rank = ids.withIndex().associate { it.value to it.index }
        val updated = db.tasks().all().mapNotNull { existing ->
            val index = rank[existing.id] ?: return@mapNotNull null
            val dto = decode(existing)
            entity(dto.copy(position = index))
        }
        db.tasks().upsert(updated)
    }

    suspend fun clearCompleted() {
        api.clearCompleted()
        db.tasks().deleteCompletedTodos()
    }

    suspend fun bulkScore(scores: List<ScoreRequest>) {
        val result = api.bulkScore(scores)
        result.results.forEach { save(it.task) }
    }

    suspend fun clearLocal() {
        db.tasks().deleteActive()
        db.tasks().deleteCompletedTodos()
        db.pendingScores().deleteAll()
    }
}

class TagRepository(private val api: ApiClient, private val db: KarottoDatabase) {
    val tags: Flow<List<Tag>> = db.tags().observeAll().map { list -> list.map { Tag(it.id, it.name, it.position) } }

    suspend fun refresh() {
        db.tags().replaceAll(api.tags().map { TagEntity(it.id, it.name, it.position) })
    }

    suspend fun create(name: String): Tag {
        val tag = api.createTag(name)
        db.tags().insertAll(listOf(TagEntity(tag.id, tag.name, tag.position)))
        return tag
    }

    suspend fun rename(id: String, name: String) {
        val tag = api.renameTag(id, name)
        db.tags().insertAll(listOf(TagEntity(tag.id, tag.name, tag.position)))
    }

    suspend fun delete(id: String) {
        api.deleteTag(id)
        refresh()
    }

    suspend fun reorder(ids: List<String>) {
        db.tags().replaceAll(api.reorderTags(ids).map { TagEntity(it.id, it.name, it.position) })
    }

    suspend fun clearLocal() = db.tags().deleteAll()
}

class UserRepository(private val api: ApiClient, private val settings: Settings) {
    val user: Flow<User?> = settings.user

    suspend fun refresh(): User {
        val user = api.user()
        settings.saveUser(user)
        return user
    }

    suspend fun updatePreferences(patch: JsonObject): User {
        val user = api.updatePreferences(patch)
        settings.saveUser(user)
        return user
    }
}
