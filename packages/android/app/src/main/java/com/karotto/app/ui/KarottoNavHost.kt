package com.karotto.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.karotto.app.AppContainer
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.form.TaskFormScreen
import com.karotto.app.ui.form.TaskFormViewModel
import com.karotto.app.ui.login.LoginScreen
import com.karotto.app.ui.settings.SettingsScreen
import com.karotto.app.ui.tasks.TasksScreen
import com.karotto.app.ui.tasks.TasksViewModel
import kotlinx.serialization.Serializable

@Serializable
object LoginRoute

@Serializable
object TasksRoute

@Serializable
object SettingsRoute

@Serializable
data class TaskFormRoute(val type: String, val taskId: String? = null, val tags: List<String> = emptyList())

@Composable
fun KarottoNavHost(container: AppContainer, navController: NavHostController, signedIn: Boolean, modifier: Modifier = Modifier) {
    NavHost(
        navController = navController,
        startDestination = if (signedIn) TasksRoute else LoginRoute,
        modifier = modifier,
    ) {
        composable<LoginRoute> {
            LoginScreen(container) {
                navController.navigate(TasksRoute) { popUpTo(LoginRoute) { inclusive = true } }
            }
        }
        composable<TasksRoute> {
            val viewModel: TasksViewModel = viewModel(factory = TasksViewModel.Factory(container))
            val state by viewModel.state.collectAsStateWithLifecycle()
            TasksScreen(
                state = state,
                viewModel = viewModel,
                onOpenTask = { task -> navController.navigate(TaskFormRoute(task.type.apiName, task.id)) },
                onCreate = { type, tags -> navController.navigate(TaskFormRoute(type.apiName, null, tags.toList())) },
                onOpenSettings = { navController.navigate(SettingsRoute) },
            )
        }
        composable<TaskFormRoute> { entry ->
            val route = entry.toRoute<TaskFormRoute>()
            val viewModel: TaskFormViewModel = viewModel(
                factory = TaskFormViewModel.Factory(container, TaskType.fromApi(route.type), route.taskId, route.tags.toSet()),
            )
            TaskFormScreen(viewModel) { navController.popBackStack() }
        }
        composable<SettingsRoute> {
            SettingsScreen(
                container = container,
                onBack = { navController.popBackStack() },
                onSignedOut = { navController.navigate(LoginRoute) { popUpTo(0) { inclusive = true } } },
            )
        }
    }
}
