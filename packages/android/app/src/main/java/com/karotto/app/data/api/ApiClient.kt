package com.karotto.app.data.api

import com.karotto.app.domain.ApiErrorBody
import com.karotto.app.domain.ScoreRequest
import com.karotto.app.domain.Tag
import com.karotto.app.domain.User
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

private const val CLIENT_ID_HEADER = "X-Client-Id"

class ApiException(val status: Int, val code: String, message: String) : IOException(message)

class NetworkException(cause: Throwable) : IOException(cause.message ?: "Network error", cause)

/** Thin OkHttp + kotlinx.serialization client for the karotto API. */
class ApiClient(
    private val credentials: () -> Credentials?,
    val clientId: String,
) {
    data class Credentials(val baseUrl: String, val token: String?)

    val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = true
        encodeDefaults = true
    }

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /** No read timeout: the event stream stays open until the server sends something. */
    val streamingHttp: OkHttpClient = http.newBuilder().readTimeout(0, TimeUnit.SECONDS).build()

    fun eventsRequest(): Request {
        val creds = requireCredentials()
        return Request.Builder()
            .url(url("/events", creds.baseUrl))
            .header("Authorization", "Bearer ${creds.token}")
            .header("Accept", "text/event-stream")
            .header(CLIENT_ID_HEADER, clientId)
            .build()
    }

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    private fun url(path: String, base: String = requireCredentials().baseUrl): HttpUrl {
        val root = base.trimEnd('/').toHttpUrlOrNull() ?: throw ApiException(0, "bad_url", "Invalid server URL")
        return root.newBuilder().encodedPath(root.encodedPath.trimEnd('/') + "/api/v1" + path).build()
    }

    private fun requireCredentials(): Credentials = credentials() ?: throw ApiException(401, "unauthorized", "Not signed in")

    private suspend fun <T> call(
        method: String,
        path: String,
        body: JsonElement? = null,
        deserializer: KSerializer<T>?,
        baseUrl: String? = null,
        token: String? = null,
    ): T? = withContext(Dispatchers.IO) {
        val creds = if (baseUrl != null) Credentials(baseUrl, token) else requireCredentials()
        val builder = Request.Builder().url(url(path, creds.baseUrl))
        creds.token?.let { builder.header("Authorization", "Bearer $it") }
        builder.header("Accept", "application/json")
        builder.header(CLIENT_ID_HEADER, clientId)
        val requestBody = body?.let { json.encodeToString(JsonElement.serializer(), it).toRequestBody(jsonMedia) }
        builder.method(method, requestBody ?: if (method == "POST" || method == "PUT" || method == "PATCH") "".toRequestBody(null) else null)
        val response = try {
            http.newCall(builder.build()).execute()
        } catch (error: IOException) {
            throw NetworkException(error)
        }
        response.use { res ->
            val text = res.body.string()
            if (!res.isSuccessful) {
                val parsed = runCatching { json.decodeFromString(ApiErrorBody.serializer(), text) }.getOrNull()
                throw ApiException(res.code, parsed?.error?.code ?: "error", parsed?.error?.message ?: "Request failed (${res.code})")
            }
            if (deserializer == null || text.isBlank()) null else json.decodeFromString(deserializer, text)
        }
    }

    private suspend fun <T> get(path: String, deserializer: KSerializer<T>): T = call("GET", path, null, deserializer)!!
    private suspend fun <T> post(path: String, body: JsonElement?, deserializer: KSerializer<T>): T = call("POST", path, body, deserializer)!!
    private suspend fun <T> patch(path: String, body: JsonElement, deserializer: KSerializer<T>): T = call("PATCH", path, body, deserializer)!!
    private suspend fun <T> put(path: String, body: JsonElement, deserializer: KSerializer<T>): T = call("PUT", path, body, deserializer)!!
    private suspend fun delete(path: String) { call<Unit>("DELETE", path, null, null) }

    suspend fun login(baseUrl: String, username: String, password: String, deviceName: String, timezone: String): TokenCreatedDto =
        call(
            "POST",
            "/auth/token",
            buildJsonObject {
                put("username", username)
                put("password", password)
                put("name", deviceName)
                put("timezone", timezone)
            },
            TokenCreatedDto.serializer(),
            baseUrl = baseUrl,
        )!!

    suspend fun user(): User = get("/user", User.serializer())
    suspend fun updatePreferences(patch: JsonObject): User = patch("/user/preferences", patch, User.serializer())

    suspend fun tasks(): List<TaskDto> = get("/tasks", ListSerializer(TaskDto.serializer()))
    suspend fun completedTodos(): List<TaskDto> = get("/tasks?type=completedTodos", ListSerializer(TaskDto.serializer()))
    suspend fun createTasks(bodies: List<JsonObject>): List<TaskDto> =
        post("/tasks", kotlinx.serialization.json.JsonArray(bodies), ListSerializer(TaskDto.serializer()))
    suspend fun updateTask(id: String, patch: JsonObject): TaskDto = patch("/tasks/$id", patch, TaskDto.serializer())
    suspend fun deleteTask(id: String) = delete("/tasks/$id")
    suspend fun score(id: String, direction: String): ScoreResultDto = post("/tasks/$id/score/$direction", null, ScoreResultDto.serializer())
    suspend fun bulkScore(scores: List<ScoreRequest>): BulkScoreResultDto = post(
        "/tasks/score",
        buildJsonObject { put("scores", json.encodeToJsonElement(ListSerializer(ScoreRequest.serializer()), scores)) },
        BulkScoreResultDto.serializer(),
    )
    suspend fun move(id: String, position: Int): OrderResultDto = post("/tasks/$id/move/$position", null, OrderResultDto.serializer())
    suspend fun toggleChecklistItem(id: String, itemId: String): TaskDto = post("/tasks/$id/checklist/$itemId/score", null, TaskDto.serializer())
    suspend fun clearCompleted(): DeletedCountDto = post("/tasks/clear-completed", null, DeletedCountDto.serializer())

    suspend fun tags(): List<Tag> = get("/tags", ListSerializer(Tag.serializer()))
    suspend fun createTag(name: String): Tag = post("/tags", buildJsonObject { put("name", name) }, Tag.serializer())
    suspend fun renameTag(id: String, name: String): Tag = patch("/tags/$id", buildJsonObject { put("name", name) }, Tag.serializer())
    suspend fun deleteTag(id: String) = delete("/tags/$id")
    suspend fun reorderTags(ids: List<String>): List<Tag> = put(
        "/tags/order",
        buildJsonObject { put("ids", json.encodeToJsonElement(ListSerializer(String.serializer()), ids)) },
        ListSerializer(Tag.serializer()),
    )

    suspend fun cronStatus(): CronStatusDto = get("/cron/status", CronStatusDto.serializer())
    suspend fun runCron(scores: List<ScoreRequest>): CronResultDto = post(
        "/cron",
        buildJsonObject { put("scores", json.encodeToJsonElement(ListSerializer(ScoreRequest.serializer()), scores)) },
        CronResultDto.serializer(),
    )
}
