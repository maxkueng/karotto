package com.karotto.app.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.karotto.app.domain.Direction
import com.karotto.app.domain.Task
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.common.EmptyState
import com.karotto.app.ui.common.icon
import com.karotto.app.ui.common.label
import com.karotto.app.ui.common.rememberHaptic
import com.karotto.app.ui.theme.KarottoTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Keeps the dropped order on screen until the store confirms it, so the card never snaps back. */
private const val PENDING_ORDER_TIMEOUT_MS = 3_000L

private val WIDE_LAYOUT_MIN_WIDTH = 840.dp
private val STACKED_HEADER_MAX_COLUMN_WIDTH = 400.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    state: TasksState,
    viewModel: TasksViewModel,
    onOpenTask: (Task) -> Unit,
    onCreate: (TaskType, Set<String>) -> Unit,
    onOpenSettings: () -> Unit,
) {
    val colors = KarottoTheme.colors
    val pager = rememberPagerState(initialPage = 1) { TaskType.entries.size }
    val scope = rememberCoroutineScope()
    var speedDial by remember { mutableStateOf(false) }
    var filterFor by remember { mutableStateOf<TaskType?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val currentType = TaskType.entries[pager.currentPage]

    LaunchedEffect(state.notice) {
        val notice = state.notice ?: return@LaunchedEffect
        val result = snackbar.showSnackbar(
            message = notice.text,
            actionLabel = notice.action,
            duration = SnackbarDuration.Short,
        )
        if (result == SnackbarResult.ActionPerformed) notice.onAction?.invoke()
        viewModel.dismissNotice()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    LaunchedEffect(pager) {
        snapshotFlow { pager.currentPage }.collect { if (state.searchOpen) viewModel.setSearchOpen(false) }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.contentBackground),
    ) {
        val wide = maxWidth >= WIDE_LAYOUT_MIN_WIDTH
        Column(Modifier.fillMaxSize()) {
            TasksTopBar(
                state = state,
                type = if (wide) null else currentType,
                onSearchChange = viewModel::setSearch,
                onSearchOpen = viewModel::setSearchOpen,
                onFilter = { filterFor = currentType },
                onSettings = onOpenSettings,
                onClearCompleted = viewModel::clearCompleted,
            )
            if (state.offline) ConnectionBanner(state.pendingCount)
            if (state.user?.preferences?.paused == true) PausedBanner()
            if (wide) {
                Row(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    TaskType.entries.forEach { type ->
                        Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                            ColumnHeader(
                                type = type,
                                state = state,
                                onSelectFilter = { viewModel.setFilter(type, it) },
                                onOpenFilters = { filterFor = type },
                                onClearCompleted = viewModel::clearCompleted,
                            )
                            TaskListPage(
                                type = type,
                                state = state,
                                viewModel = viewModel,
                                onOpenTask = onOpenTask,
                            )
                        }
                    }
                }
            } else {
                HorizontalPager(state = pager, modifier = Modifier.weight(1f), beyondViewportPageCount = 2) { page ->
                    val type = TaskType.entries[page]
                    TaskListPage(
                        type = type,
                        state = state,
                        viewModel = viewModel,
                        onOpenTask = onOpenTask,
                    )
                }
            }
        }
        TasksBottomBar(
            selected = currentType,
            showTabs = !wide,
            speedDialOpen = speedDial,
            onSelect = { type -> scope.launch { pager.animateScrollToPage(type.ordinal) } },
            onCreate = { if (wide) speedDial = true else onCreate(currentType, state.selectedTagIds) },
            onToggleSpeedDial = { speedDial = !speedDial },
            onCreateOfType = { type ->
                speedDial = false
                onCreate(type, state.selectedTagIds)
            },
        )
        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 108.dp),
        ) { data ->
            Snackbar(
                snackbarData = data,
                shape = RoundedCornerShape(100.dp),
                containerColor = if (state.notice?.error == true) colors.textRed else colors.textPrimary,
                contentColor = if (colors.isDark) colors.contentBackground else Color.White,
                actionColor = if (colors.isDark) KarottoTheme.palette.brand.b300 else KarottoTheme.palette.brand.b500,
            )
        }
    }

    state.welcomeBack?.let { wb ->
        WelcomeBackDialog(
            state = wb,
            onToggle = viewModel::toggleYesterdaily,
            onToggleChecklistItem = viewModel::toggleYesterdailyChecklistItem,
            onStart = viewModel::startDay,
        )
    }
    filterFor?.let { type ->
        FilterSheet(
            type = type,
            state = state,
            onDismiss = { filterFor = null },
            onFilter = { viewModel.setFilter(type, it) },
            onToggleTag = viewModel::toggleTag,
            onClear = { viewModel.clearFilters(type) },
            onCreateTag = { viewModel.createTag(it) },
            onRenameTag = viewModel::renameTag,
            onDeleteTag = viewModel::deleteTag,
        )
    }
}

@Composable
private fun TasksTopBar(
    state: TasksState,
    type: TaskType?,
    onSearchChange: (String) -> Unit,
    onSearchOpen: (Boolean) -> Unit,
    onFilter: () -> Unit,
    onSettings: () -> Unit,
    onClearCompleted: () -> Unit,
) {
    val colors = KarottoTheme.colors
    var menuOpen by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.contentBackground)
            .statusBarsPadding()
            .padding(start = 4.dp, end = 4.dp)
            .size(width = 0.dp, height = 56.dp)
            .fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (state.searchOpen) {
            IconButton(onClick = { onSearchOpen(false) }) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Close search", tint = colors.textTitle)
            }
            LaunchedEffect(Unit) { focus.requestFocus() }
            BasicTextField(
                value = state.search,
                onValueChange = onSearchChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 18.sp, color = colors.textTitle),
                cursorBrush = SolidColor(colors.accent),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {}),
                modifier = Modifier.weight(1f).focusRequester(focus),
                decorationBox = { inner ->
                    Box {
                        if (state.search.isEmpty()) Text("Search", fontSize = 18.sp, color = colors.textDimmed)
                        inner()
                    }
                },
            )
            if (state.search.isNotEmpty()) {
                IconButton(onClick = { onSearchChange("") }) {
                    Icon(Icons.Rounded.Close, contentDescription = "Clear", tint = colors.textTitle)
                }
            }
        } else {
            Text(
                text = state.user?.username ?: "karotto",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                color = colors.textTitle,
                maxLines = 1,
                modifier = Modifier.weight(1f).padding(start = 12.dp),
            )
            IconButton(onClick = { onSearchOpen(true) }) {
                Icon(Icons.Rounded.Search, contentDescription = "Search", tint = colors.textTitle)
            }
            if (type != null) {
                val active = state.activeFilterCount > 0
                IconButton(onClick = onFilter) {
                    Icon(
                        Icons.Rounded.FilterList,
                        contentDescription = "Filter",
                        tint = if (active) colors.accent else colors.textTitle,
                    )
                }
            }
            Box {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Rounded.MoreVert, contentDescription = "More", tint = colors.textTitle)
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    if (type == TaskType.TODO && state.filter.todo == "complete") {
                        DropdownMenuItem(text = { Text("Clear completed To Do's") }, onClick = {
                            menuOpen = false
                            onClearCompleted()
                        })
                    }
                    DropdownMenuItem(text = { Text("Settings") }, onClick = {
                        menuOpen = false
                        onSettings()
                    })
                }
            }
        }
    }
}

@Composable
private fun PausedBanner() {
    val colors = KarottoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.contentBackgroundOffset)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Pause, contentDescription = null, tint = colors.textTitle, modifier = Modifier.size(18.dp))
        Text(
            text = "Paused. Missed dailies and to-dos are not penalised until you resume in Settings.",
            fontSize = 14.sp,
            color = colors.textTitle,
            modifier = Modifier.padding(start = 10.dp),
        )
    }
}

@Composable
private fun ConnectionBanner(pending: Int) {
    val colors = KarottoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.errorBanner)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Warning, contentDescription = null, tint = colors.errorBannerText, modifier = Modifier.size(18.dp))
        Text(
            text = if (pending > 0) "Offline. $pending change(s) will sync when you're back online." else "No connection to the server.",
            fontSize = 14.sp,
            color = colors.errorBannerText,
            modifier = Modifier.padding(start = 10.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ColumnHeader(
    type: TaskType,
    state: TasksState,
    onSelectFilter: (String) -> Unit,
    onOpenFilters: () -> Unit,
    onClearCompleted: () -> Unit,
) {
    val colors = KarottoTheme.colors
    val count = state.visible(type).size
    val title: @Composable RowScope.() -> Unit = {
        Text(type.label, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = colors.textTitle, maxLines = 1)
        Box(
            modifier = Modifier
                .padding(start = 8.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(colors.accent)
                .padding(horizontal = 7.dp, vertical = 1.dp),
        ) {
            Text("$count", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
    val controls: @Composable RowScope.() -> Unit = {
        if (type == TaskType.TODO && state.filter.todo == "complete" && count > 0) {
            Text(
                "Clear",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = colors.textRed,
                maxLines = 1,
                modifier = Modifier.clickable(onClick = onClearCompleted).padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        FilterTabs(options = filterOptions(type), selected = state.filterFor(type), onSelect = onSelectFilter)
        val tagged = state.selectedTagIds.isNotEmpty()
        IconButton(onClick = onOpenFilters) {
            Icon(
                Icons.Rounded.FilterList,
                contentDescription = "Filter ${type.label}",
                tint = if (tagged) colors.accent else colors.textTitle,
            )
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp)) {
        if (maxWidth < STACKED_HEADER_MAX_COLUMN_WIDTH) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, content = title)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(Modifier.weight(1f))
                    controls()
                }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                title()
                Spacer(Modifier.weight(1f))
                controls()
            }
        }
    }
}

@Composable
private fun FilterTabs(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val colors = KarottoTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        options.forEach { (value, label) ->
            val active = value == selected
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable { onSelect(value) }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                    color = if (active) colors.accent else colors.textSecondary,
                    maxLines = 1,
                    softWrap = false,
                )
                Box(
                    modifier = Modifier
                        .padding(top = 3.dp)
                        .width(20.dp)
                        .height(2.dp)
                        .background(if (active) colors.accent else Color.Transparent),
                )
            }
        }
    }
}

@Composable
private fun TaskListPage(
    type: TaskType,
    state: TasksState,
    viewModel: TasksViewModel,
    onOpenTask: (Task) -> Unit,
) {
    val haptic = rememberHaptic(state.haptics)
    val visible = state.visible(type)
    val listState = rememberLazyListState()
    var dragOrder by remember { mutableStateOf(visible) }
    var pendingOrder by remember { mutableStateOf<List<String>?>(null) }
    val reorder = rememberReorderState(
        listState = listState,
        onStart = { dragOrder = visible },
        onSwap = { from, to ->
            dragOrder = dragOrder.toMutableList().apply { add(to, removeAt(from)) }
        },
        onDrop = { id, index ->
            haptic()
            pendingOrder = dragOrder.map { it.id }
            viewModel.move(type, id, index)
        },
    )
    val visibleIds = visible.map { it.id }
    LaunchedEffect(visibleIds) { if (pendingOrder == visibleIds) pendingOrder = null }
    LaunchedEffect(pendingOrder) {
        if (pendingOrder != null) {
            delay(PENDING_ORDER_TIMEOUT_MS)
            pendingOrder = null
        }
    }
    val order = when {
        reorder.draggingId != null -> dragOrder
        pendingOrder != null -> visible.sortedBy { pendingOrder?.indexOf(it.id)?.takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }
        else -> visible
    }
    val callbacks = remember(viewModel, haptic) {
        CardCallbacks(
            onOpen = onOpenTask,
            onScore = { task, direction ->
                haptic()
                viewModel.score(task, direction)
            },
            onToggleChecklist = { viewModel.toggleExpanded(it.id) },
            onToggleChecklistItem = { task, itemId -> viewModel.toggleChecklistItem(task, itemId) },
        )
    }
    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize(),
    ) {
        if (order.isEmpty()) {
            EmptyPage(type, filtered = state.activeFilterCount > 0 || state.search.isNotBlank(), loaded = state.loaded)
        }
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 4.dp, bottom = 108.dp),
        ) {
            items(order, key = { it.id }) { task ->
                TaskCard(
                    task = task,
                    expanded = state.expandedChecklistId == task.id,
                    ctx = state.dayContext,
                    dateFormat = state.preferences.dateFormat,
                    callbacks = callbacks,
                    modifier = Modifier
                        .then(if (reorder.draggingId == task.id) Modifier else Modifier.animateItem(fadeInSpec = null, fadeOutSpec = null))
                        .reorderable(reorder, task.id, enabled = state.canReorder(type)),
                )
            }
        }
    }
}

@Composable
private fun EmptyPage(type: TaskType, filtered: Boolean, loaded: Boolean) {
    if (!loaded) return
    val (title, description) = when {
        filtered -> "No ${type.label}" to "There aren't any ${type.label} visible with your current filters."
        type == TaskType.HABIT -> "You don't have any Habits" to
            "Habits are tasks that don't have a rigid schedule. You can check them off many times a day, or not at all."
        type == TaskType.DAILY -> "You don't have any Dailies" to
            "Dailies are tasks that repeat on a regular basis. Choose the schedule that works for you!"
        else -> "You don't have any To Do's" to
            "To Do's are tasks that only need to be completed once. Add checklists to your To Do's to increase their value."
    }
    EmptyState(icon = type.icon, title = title, description = description)
}
