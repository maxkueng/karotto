package com.karotto.app.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.karotto.app.domain.Daily
import com.karotto.app.ui.common.MarkdownText
import com.karotto.app.ui.common.TaskCheckbox
import com.karotto.app.ui.theme.KarottoTheme

@Composable
fun WelcomeBackDialog(
    state: WelcomeBack,
    onToggle: (String) -> Unit,
    onToggleChecklistItem: (String, String) -> Unit,
    onStart: () -> Unit,
) {
    val colors = KarottoTheme.colors
    Dialog(onDismissRequest = {}, properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false, usePlatformDefaultWidth = false)) {
        Column(
            modifier = Modifier
                .width(360.dp)
                .heightIn(max = 640.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(colors.dialogBackground)
                .padding(top = 32.dp, bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Welcome Back", fontSize = 20.sp, fontWeight = FontWeight.Medium, color = colors.textTitle)
            Text(
                "Check off any Dailies you did yesterday:",
                fontSize = 16.sp,
                lineHeight = 22.sp,
                color = colors.textSecondary,
                modifier = Modifier.padding(top = 8.dp, start = 26.dp, end = 26.dp),
            )
            Column(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 17.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.dailies.forEach { daily ->
                    YesterdailyRow(daily, checked = daily.id in state.checked, onToggle = { onToggle(daily.id) }) { itemId ->
                        onToggleChecklistItem(daily.id, itemId)
                    }
                }
            }
            Button(
                onClick = onStart,
                enabled = !state.running,
                colors = ButtonDefaults.buttonColors(containerColor = colors.accent, contentColor = Color.White),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.padding(horizontal = 26.dp).fillMaxWidth().height(48.dp),
            ) {
                if (state.running) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(20.dp).width(20.dp))
                } else {
                    Text("Start My Day", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun YesterdailyRow(daily: Daily, checked: Boolean, onToggle: () -> Unit, onToggleItem: (String) -> Unit) {
    val colors = KarottoTheme.colors
    val ramp = daily.ramp
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(colors.windowBackground),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .defaultMinSize(minHeight = 60.dp)
                .clickable(onClick = onToggle),
        ) {
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .fillMaxHeight()
                    .background(if (checked) colors.windowBackground else ramp.light),
                contentAlignment = Alignment.Center,
            ) {
                TaskCheckbox(
                    round = false,
                    fill = if (checked) colors.checkboxFillSelected else colors.checkboxFill,
                    checked = checked,
                    checkTint = colors.textDimmed,
                )
            }
            Box(Modifier.weight(1f).padding(12.dp), contentAlignment = Alignment.CenterStart) {
                MarkdownText(
                    source = daily.text,
                    style = androidx.compose.ui.text.TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
                    color = if (checked) colors.textQuad else colors.textPrimary,
                )
            }
        }
        daily.checklist.forEach { item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min)
                    .defaultMinSize(minHeight = 50.dp),
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .fillMaxHeight()
                        .background(ramp.extraLight)
                        .clickable { onToggleItem(item.id) },
                    contentAlignment = Alignment.Center,
                ) {
                    TaskCheckbox(round = false, fill = colors.checkboxFill, checked = item.completed, checkTint = ramp.dark, size = 20.dp)
                }
                Box(Modifier.weight(1f).padding(horizontal = 15.dp, vertical = 5.dp).fillMaxHeight(), contentAlignment = Alignment.CenterStart) {
                    Text(item.text, fontSize = 14.sp, color = if (item.completed) colors.textDimmed else colors.textSecondary)
                }
            }
        }
    }
}
