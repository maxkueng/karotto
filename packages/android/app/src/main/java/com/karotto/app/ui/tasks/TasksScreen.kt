package com.karotto.app.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import com.karotto.app.ui.theme.Brand
import com.karotto.app.ui.theme.KarottoTheme
import kotlinx.coroutines.launch

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
    var filterOpen by remember { mutableStateOf(false) }
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.contentBackground),
    ) {
        Column(Modifier.fillMaxSize()) {
            TasksTopBar(
                state = state,
                type = currentType,
                onSearchChange = viewModel::setSearch,
                onSearchOpen = viewModel::setSearchOpen,
                onFilter = { filterOpen = true },
                onSettings = onOpenSettings,
                onClearCompleted = viewModel::clearCompleted,
            )
            if (state.offline) ConnectionBanner(state.pendingCount)
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
        TasksBottomBar(
            selected = currentType,
            speedDialOpen = speedDial,
            onSelect = { type -> scope.launch { pager.animateScrollToPage(type.ordinal) } },
            onCreate = { onCreate(currentType, state.selectedTagIds) },
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
                actionColor = if (colors.isDark) Brand.b300 else Brand.b500,
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
    if (filterOpen) {
        FilterSheet(
            type = currentType,
            state = state,
            onDismiss = { filterOpen = false },
            onFilter = { viewModel.setFilter(currentType, it) },
            onToggleTag = viewModel::toggleTag,
            onClear = { viewModel.clearFilters(currentType) },
            onCreateTag = { viewModel.createTag(it) },
            onRenameTag = viewModel::renameTag,
            onDeleteTag = viewModel::deleteTag,
        )
    }
}

@Composable
private fun TasksTopBar(
    state: TasksState,
    type: TaskType,
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
            val active = state.activeFilterCount > 0
            IconButton(onClick = onFilter) {
                Icon(
                    Icons.Rounded.FilterList,
                    contentDescription = "Filter",
                    tint = if (active) colors.accent else colors.textTitle,
                )
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
    val reorder = rememberReorderState(
        listState = listState,
        onStart = { dragOrder = visible },
        onSwap = { from, to ->
            dragOrder = dragOrder.toMutableList().apply { add(to, removeAt(from)) }
        },
        onDrop = { id, index ->
            haptic()
            viewModel.move(type, id, index)
        },
    )
    val order = if (reorder.draggingId != null) dragOrder else visible
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
                    modifier = Modifier.reorderable(reorder, task.id, enabled = state.canReorder(type)),
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
