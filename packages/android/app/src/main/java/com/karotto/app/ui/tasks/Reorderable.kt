package com.karotto.app.ui.tasks

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyListItemInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.zIndex
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Long-press drag reordering for a LazyColumn keyed by id. Items are swapped in the
 * caller's list while dragging; [onDrop] reports the final index once the finger lifts.
 */
class ReorderState(
    private val listState: LazyListState,
    private val scope: CoroutineScope,
    private val onStart: () -> Unit,
    private val onSwap: (from: Int, to: Int) -> Unit,
    private val onDrop: (id: String, index: Int) -> Unit,
) {
    var draggingId by mutableStateOf<String?>(null)
        private set
    var dragOffset by mutableStateOf(0f)
        private set
    private var startIndex = -1

    private fun itemOf(id: String): LazyListItemInfo? = listState.layoutInfo.visibleItemsInfo.firstOrNull { it.key == id }

    fun start(id: String) {
        val item = itemOf(id) ?: return
        onStart()
        draggingId = id
        startIndex = item.index
        dragOffset = 0f
    }

    fun drag(delta: Float) {
        val id = draggingId ?: return
        dragOffset += delta
        val item = itemOf(id) ?: return
        val center = item.offset + dragOffset + item.size / 2f
        val target = listState.layoutInfo.visibleItemsInfo.firstOrNull { other ->
            other.key != id && other.key is String && center > other.offset && center < other.offset + other.size
        } ?: return
        val from = item.index
        val to = target.index
        onSwap(from, to)
        dragOffset -= (target.offset - item.offset)
        scrollIfNeeded(center)
    }

    private fun scrollIfNeeded(center: Float) {
        val info = listState.layoutInfo
        val edge = 120f
        val delta = when {
            center < info.viewportStartOffset + edge -> -24f
            center > info.viewportEndOffset - edge -> 24f
            else -> return
        }
        scope.launch { listState.scrollBy(delta) }
    }

    fun end() {
        val id = draggingId ?: return
        val index = itemOf(id)?.index ?: startIndex
        draggingId = null
        dragOffset = 0f
        if (index != startIndex) onDrop(id, index)
    }
}

@Composable
fun rememberReorderState(
    listState: LazyListState,
    onStart: () -> Unit,
    onSwap: (from: Int, to: Int) -> Unit,
    onDrop: (id: String, index: Int) -> Unit,
): ReorderState {
    val scope = rememberCoroutineScope()
    val start = rememberUpdatedState(onStart)
    val swap = rememberUpdatedState(onSwap)
    val drop = rememberUpdatedState(onDrop)
    return remember(listState) {
        ReorderState(listState, scope, { start.value() }, { from, to -> swap.value(from, to) }, { id, index -> drop.value(id, index) })
    }
}

fun Modifier.reorderable(state: ReorderState, id: String, enabled: Boolean): Modifier {
    val dragging = state.draggingId == id
    return this
        .zIndex(if (dragging) 1f else 0f)
        .graphicsLayer {
            if (dragging) {
                translationY = state.dragOffset
                scaleX = 1.02f
                scaleY = 1.02f
                shadowElevation = 8.dp.toPx()
            }
        }
        .pointerInput(id, enabled) {
            if (!enabled) return@pointerInput
            detectDragGesturesAfterLongPress(
                onDragStart = { state.start(id) },
                onDrag = { change, offset ->
                    change.consume()
                    state.drag(offset.y)
                },
                onDragEnd = { state.end() },
                onDragCancel = { state.end() },
            )
        }
}


