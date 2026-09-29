package com.karotto.app.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.karotto.app.domain.Tag
import com.karotto.app.domain.TaskType
import com.karotto.app.ui.common.PillRow
import com.karotto.app.ui.common.SectionCaption
import com.karotto.app.ui.common.label
import com.karotto.app.ui.theme.KarottoTheme

fun filterOptions(type: TaskType): List<Pair<String, String>> = when (type) {
    TaskType.HABIT -> listOf("all" to "All", "weak" to "Weak", "strong" to "Strong")
    TaskType.DAILY -> listOf("all" to "All", "due" to "Due", "notDue" to "Grey")
    TaskType.TODO -> listOf("active" to "Active", "scheduled" to "Scheduled", "complete" to "Completed")
}

@androidx.compose.material3.ExperimentalMaterial3Api
@Composable
fun FilterSheet(
    type: TaskType,
    state: TasksState,
    onDismiss: () -> Unit,
    onFilter: (String) -> Unit,
    onToggleTag: (String) -> Unit,
    onClear: () -> Unit,
    onCreateTag: (String) -> Unit,
    onRenameTag: (String, String) -> Unit,
    onDeleteTag: (String) -> Unit,
) {
    val colors = KarottoTheme.colors
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    var editing by remember { mutableStateOf(false) }
    val drafts = remember { mutableStateMapOf<String, String>() }
    var newTag by remember { mutableStateOf<String?>(null) }
    val canClear = state.selectedTagIds.isNotEmpty() || !state.isDefaultFilter(type)

    fun finishEditing() {
        drafts.forEach { (id, name) ->
            val original = state.tags.firstOrNull { it.id == id } ?: return@forEach
            if (name.isNotBlank() && name != original.name) onRenameTag(id, name.trim())
        }
        drafts.clear()
        newTag?.takeIf { it.isNotBlank() }?.let { onCreateTag(it.trim()) }
        newTag = null
        editing = false
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = colors.windowBackground,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = {
            Box(
                Modifier
                    .padding(top = 8.dp, bottom = 16.dp)
                    .size(width = 24.dp, height = 3.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(colors.offsetBackground),
            )
        },
    ) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding(),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Filters", fontSize = 16.sp, fontWeight = FontWeight.Medium, color = colors.textTernary)
                Spacer(Modifier.weight(1f))
                Text(
                    "Clear",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (canClear) colors.accent else colors.textDimmed,
                    modifier = Modifier.clickable(enabled = canClear, onClick = onClear).padding(4.dp),
                )
            }
            SectionCaption(type.label, Modifier.padding(top = 16.dp))
            PillRow(
                options = filterOptions(type),
                selected = state.filterFor(type),
                onSelect = onFilter,
                modifier = Modifier.padding(top = 12.dp, bottom = 24.dp),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionCaption("Tags")
                Spacer(Modifier.weight(1f))
                Text(
                    if (editing) "Done" else "Edit",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.textBrand,
                    modifier = Modifier.clickable { if (editing) finishEditing() else editing = true }.padding(4.dp),
                )
            }
            Spacer(Modifier.height(8.dp))
            state.tags.forEach { tag ->
                if (editing) {
                    EditableTagRow(
                        name = drafts[tag.id] ?: tag.name,
                        onChange = { drafts[tag.id] = it },
                        onDelete = { onDeleteTag(tag.id) },
                    )
                } else {
                    TagRow(tag = tag, checked = tag.id in state.selectedTagIds) { onToggleTag(tag.id) }
                }
            }
            if (editing && newTag != null) {
                EditableTagRow(name = newTag ?: "", onChange = { newTag = it }, onDelete = { newTag = null })
            }
            Row(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (colors.isDark) colors.offsetBackground else colors.windowBackground)
                    .clickable {
                        if (!editing) editing = true
                        if (newTag == null) newTag = "" else finishEditing()
                    }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Add, contentDescription = null, tint = colors.accent)
                Spacer(Modifier.width(8.dp))
                Text("Add new Tag", fontSize = 16.sp, color = colors.textSecondary)
            }
        }
    }
}

@Composable
private fun TagRow(tag: Tag, checked: Boolean, onToggle: () -> Unit) {
    val colors = KarottoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = colors.accent, uncheckedColor = colors.textDimmed),
        )
        Text(tag.name, fontSize = 16.sp, color = colors.textSecondary, modifier = Modifier.padding(start = 4.dp))
    }
}

@Composable
private fun EditableTagRow(name: String, onChange: (String) -> Unit, onDelete: () -> Unit) {
    val colors = KarottoTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Rounded.Close,
            contentDescription = "Delete tag",
            tint = colors.accent,
            modifier = Modifier.size(40.dp).clickable(onClick = onDelete).padding(8.dp),
        )
        BasicTextField(
            value = name,
            onValueChange = onChange,
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            textStyle = TextStyle(fontSize = 16.sp, color = colors.textPrimary),
            cursorBrush = SolidColor(colors.accent),
            modifier = Modifier
                .weight(1f)
                .padding(start = 8.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(colors.contentBackground)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            decorationBox = { inner ->
                Box {
                    if (name.isEmpty()) Text("Tag name", fontSize = 16.sp, color = colors.textDimmed)
                    inner()
                }
            },
        )
    }
}
