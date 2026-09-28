package com.karotto.app.data.store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.karotto.app.domain.ActiveFilter
import com.karotto.app.domain.TaskType
import com.karotto.app.domain.User
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("karotto")

data class Session(val serverUrl: String, val username: String, val token: String)

enum class ThemeMode { SYSTEM, LIGHT, DARK }

class Settings(private val context: Context, private val secure: SecureStore) {
    private val json = Json { ignoreUnknownKeys = true }

    private object Keys {
        val serverUrl = stringPreferencesKey("server_url")
        val username = stringPreferencesKey("username")
        val userJson = stringPreferencesKey("user_json")
        val lastSync = longPreferencesKey("last_sync")
        val themeMode = stringPreferencesKey("theme_mode")
        val haptics = booleanPreferencesKey("haptics")
        val lastCronCheck = longPreferencesKey("last_cron_check")
        val filterHabit = stringPreferencesKey("filter_habit")
        val filterDaily = stringPreferencesKey("filter_daily")
        val filterTodo = stringPreferencesKey("filter_todo")
    }

    val session: Flow<Session?> = context.dataStore.data.map { prefs ->
        val url = prefs[Keys.serverUrl] ?: return@map null
        val user = prefs[Keys.username] ?: return@map null
        val token = secure.get(TOKEN) ?: return@map null
        Session(url, user, token)
    }

    suspend fun currentSession(): Session? = session.first()

    suspend fun saveSession(serverUrl: String, username: String, token: String) {
        secure.put(TOKEN, token)
        context.dataStore.edit { prefs ->
            prefs[Keys.serverUrl] = serverUrl
            prefs[Keys.username] = username
        }
    }

    suspend fun clearSession() {
        secure.remove(TOKEN)
        context.dataStore.edit { prefs ->
            prefs.remove(Keys.serverUrl)
            prefs.remove(Keys.username)
            prefs.remove(Keys.userJson)
            prefs.remove(Keys.lastSync)
        }
    }

    val user: Flow<User?> = context.dataStore.data.map { prefs ->
        prefs[Keys.userJson]?.let { runCatching { json.decodeFromString(User.serializer(), it) }.getOrNull() }
    }

    suspend fun currentUser(): User? = user.first()

    suspend fun saveUser(user: User) {
        context.dataStore.edit { it[Keys.userJson] = json.encodeToString(User.serializer(), user) }
    }

    val lastSync: Flow<Long> = context.dataStore.data.map { it[Keys.lastSync] ?: 0L }

    suspend fun markSynced(at: Long) {
        context.dataStore.edit { it[Keys.lastSync] = at }
    }

    val themeMode: Flow<ThemeMode> = context.dataStore.data.map { prefs ->
        prefs[Keys.themeMode]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: ThemeMode.SYSTEM
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[Keys.themeMode] = mode.name }
    }

    /** Per-device list views, as in Habitica; deliberately not synced through the server. */
    val activeFilter: Flow<ActiveFilter> = context.dataStore.data.map { prefs ->
        val defaults = ActiveFilter()
        ActiveFilter(
            habit = prefs[Keys.filterHabit] ?: defaults.habit,
            daily = prefs[Keys.filterDaily] ?: defaults.daily,
            todo = prefs[Keys.filterTodo] ?: defaults.todo,
        )
    }

    suspend fun setFilter(type: TaskType, value: String) {
        val key = when (type) {
            TaskType.HABIT -> Keys.filterHabit
            TaskType.DAILY -> Keys.filterDaily
            TaskType.TODO -> Keys.filterTodo
        }
        context.dataStore.edit { it[key] = value }
    }

    val haptics: Flow<Boolean> = context.dataStore.data.map { it[Keys.haptics] ?: true }

    suspend fun setHaptics(enabled: Boolean) {
        context.dataStore.edit { it[Keys.haptics] = enabled }
    }

    private companion object {
        const val TOKEN = "token"
    }
}
