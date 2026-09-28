package com.karotto.app.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY type, position, createdAt DESC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks")
    suspend fun all(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun byId(id: String): TaskEntity?

    @Upsert
    suspend fun upsert(entities: List<TaskEntity>)

    @Upsert
    suspend fun upsert(entity: TaskEntity)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM tasks WHERE NOT (type = 'todo' AND completed = 1)")
    suspend fun deleteActive()

    @Query("DELETE FROM tasks WHERE type = 'todo' AND completed = 1")
    suspend fun deleteCompletedTodos()

    @Transaction
    suspend fun replaceActive(entities: List<TaskEntity>) {
        deleteActive()
        upsert(entities)
    }

    @Transaction
    suspend fun replaceCompletedTodos(entities: List<TaskEntity>) {
        deleteCompletedTodos()
        upsert(entities)
    }
}

@Dao
interface TagDao {
    @Query("SELECT * FROM tags ORDER BY position")
    fun observeAll(): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags ORDER BY position")
    suspend fun all(): List<TagEntity>

    @Query("DELETE FROM tags")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<TagEntity>)

    @Transaction
    suspend fun replaceAll(entities: List<TagEntity>) {
        deleteAll()
        insertAll(entities)
    }
}

@Dao
interface PendingScoreDao {
    @Query("SELECT * FROM pending_scores ORDER BY seq")
    suspend fun all(): List<PendingScoreEntity>

    @Query("SELECT COUNT(*) FROM pending_scores")
    fun observeCount(): Flow<Int>

    @Insert
    suspend fun insert(entity: PendingScoreEntity): Long

    @Delete
    suspend fun delete(entity: PendingScoreEntity)

    @Query("DELETE FROM pending_scores")
    suspend fun deleteAll()
}
