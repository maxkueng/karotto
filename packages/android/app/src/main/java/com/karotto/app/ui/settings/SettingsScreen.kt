package com.karotto.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.karotto.app.AppContainer
import com.karotto.app.data.store.ThemeMode
import com.karotto.app.ui.common.SectionCaption
import com.karotto.app.ui.theme.KarottoTheme
import com.karotto.app.ui.theme.Themes
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private val dateFormats = listOf("MM/dd/yyyy", "dd/MM/yyyy", "yyyy/MM/dd", "yyyy-MM-dd", "dd.MM.yyyy")

@Composable
fun SettingsScreen(container: AppContainer, onBack: () -> Unit, onSignedOut: () -> Unit) {
    val colors = KarottoTheme.colors
    val user by container.users.user.collectAsStateWithLifecycle(initialValue = null)
    val session by container.session.collectAsStateWithLifecycle()
    val themeMode by container.settings.themeMode.collectAsStateWithLifecycle(initialValue = ThemeMode.SYSTEM)
    val themeId by container.settings.themeId.collectAsStateWithLifecycle(initialValue = Themes.DEFAULT_ID)
    val theme = Themes.find(themeId)
    val haptics by container.settings.haptics.collectAsStateWithLifecycle(initialValue = true)
    val scope = rememberCoroutineScope()
    var signOutPrompt by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun patch(key: String, value: Any) {
        scope.launch {
            runCatching {
                container.users.updatePreferences(
                    buildJsonObject {
                        when (value) {
                            is Int -> put(key, value)
                            is Boolean -> put(key, value)
                            else -> put(key, value.toString())
                        }
                    },
                )
            }.onFailure { error = it.message ?: "Could not save" }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.contentBackground),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = colors.textTitle) }
            Text("Settings", fontSize = 18.sp, fontWeight = FontWeight.Medium, color = colors.textTitle, modifier = Modifier.padding(start = 8.dp))
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .padding(bottom = 32.dp),
        ) {
            error?.let { Text(it, color = colors.textRed, fontSize = 14.sp, modifier = Modifier.padding(vertical = 8.dp)) }
            SectionCaption("Account", Modifier.padding(top = 8.dp, bottom = 4.dp))
            InfoRow("Username", user?.username ?: session?.username ?: "")
            InfoRow("Server", session?.serverUrl ?: "")
            InfoRow("Timezone", user?.preferences?.timezone ?: "")

            SectionCaption("Day", Modifier.padding(top = 24.dp, bottom = 4.dp))
            ChoiceRow(
                label = "Custom Day Start",
                value = "%02d:00".format(user?.preferences?.dayStart ?: 0),
                options = (0..23).map { it to "%02d:00".format(it) },
            ) { patch("dayStart", it) }
            ChoiceRow(
                label = "Date format",
                value = user?.preferences?.dateFormat ?: dateFormats.first(),
                options = dateFormats.map { it to it },
            ) { patch("dateFormat", it) }

            SectionCaption("Vacation", Modifier.padding(top = 24.dp, bottom = 4.dp))
            SwitchRow("Pause", user?.preferences?.paused == true) { on -> patch("paused", on) }
            Text(
                "Days still roll over, but missed dailies keep their streak and value and to-dos do not decay.",
                fontSize = 13.sp,
                color = colors.textSecondary,
                modifier = Modifier.padding(bottom = 4.dp),
            )

            SectionCaption("App", Modifier.padding(top = 24.dp, bottom = 4.dp))
            ChoiceRow(
                label = "Theme",
                value = theme.name,
                options = Themes.all.map { it.id to it.name },
            ) { id -> scope.launch { container.settings.setThemeId(id) } }
            ChoiceRow(
                label = "Colour mode",
                value = if (theme.hasBothModes) {
                    themeMode.name.lowercase().replaceFirstChar(Char::uppercase)
                } else if (theme.dark != null) {
                    "Dark only"
                } else {
                    "Light only"
                },
                options = ThemeMode.entries.map { it to it.name.lowercase().replaceFirstChar(Char::uppercase) },
                enabled = theme.hasBothModes,
            ) { mode -> scope.launch { container.settings.setThemeMode(mode) } }
            SwitchRow("Haptic feedback", haptics) { on -> scope.launch { container.settings.setHaptics(on) } }

            Spacer(Modifier.height(32.dp))
            Text(
                "Sign out",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = colors.textRed,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { signOutPrompt = true }
                    .padding(vertical = 14.dp),
            )
        }
    }

    if (signOutPrompt) {
        AlertDialog(
            onDismissRequest = { signOutPrompt = false },
            containerColor = colors.dialogBackground,
            title = { Text("Sign out?", color = colors.textTitle) },
            text = { Text("Unsynced changes on this device will be lost.", color = colors.textSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    signOutPrompt = false
                    scope.launch {
                        container.signOut()
                        onSignedOut()
                    }
                }) { Text("Sign out", color = colors.textRed) }
            },
            dismissButton = { TextButton(onClick = { signOutPrompt = false }) { Text("Cancel", color = colors.textBrand) } },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    val colors = KarottoTheme.colors
    Column(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
        Text(label, fontSize = 16.sp, color = colors.textPrimary)
        Text(value, fontSize = 14.sp, color = colors.textTernary)
    }
}

@Composable
private fun <T> ChoiceRow(
    label: String,
    value: String,
    options: List<Pair<T, String>>,
    enabled: Boolean = true,
    onSelect: (T) -> Unit,
) {
    val colors = KarottoTheme.colors
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled) { open = true }
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontSize = 16.sp, color = if (enabled) colors.textPrimary else colors.textQuad, modifier = Modifier.weight(1f))
            Text(value, fontSize = 14.sp, color = if (enabled) colors.textBrand else colors.textQuad)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (option, text) ->
                DropdownMenuItem(text = { Text(text) }, onClick = {
                    open = false
                    onSelect(option)
                })
            }
        }
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = KarottoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) }
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 16.sp, color = colors.textPrimary, modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = colors.accent),
        )
    }
}
