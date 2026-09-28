package com.karotto.app.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [TaskEntity::class, TagEntity::class, PendingScoreEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class KarottoDatabase : RoomDatabase() {
    abstract fun tasks(): TaskDao
    abstract fun tags(): TagDao
    abstract fun pendingScores(): PendingScoreDao

    companion object {
        fun create(context: Context): KarottoDatabase = Room
            .databaseBuilder(context, KarottoDatabase::class.java, "karotto.db")
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()
    }
}
