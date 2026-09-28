package com.karotto.app.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Tasks are cached as their wire JSON; the domain object is rebuilt on read. */
@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val type: String,
    val position: Int,
    val completed: Boolean,
    val createdAt: String,
    val json: String,
)

@Entity(tableName = "tags")
data class TagEntity(
    @PrimaryKey val id: String,
    val name: String,
    val position: Int,
)

/** A score that was applied locally and still has to reach the server. */
@Entity(tableName = "pending_scores")
data class PendingScoreEntity(
    @PrimaryKey(autoGenerate = true) val seq: Long = 0,
    val taskId: String,
    val direction: String,
    val createdAt: Long,
)
