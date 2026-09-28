package com.karotto.app.domain

object Filters {
    fun matches(task: Task, filter: String): Boolean = when (task) {
        is Habit -> when (filter) {
            "weak" -> task.value < 1
            "strong" -> task.value >= 1
            else -> true
        }

        is Daily -> when (filter) {
            "due" -> !task.completed && task.isDue
            "notDue" -> task.completed || !task.isDue
            else -> true
        }

        is Todo -> when (filter) {
            "active" -> !task.completed
            "scheduled" -> !task.completed && task.dueDate != null
            "complete" -> task.completed
            else -> true
        }
    }

    fun matchesSearch(task: Task, query: String): Boolean {
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return true
        if (task.text.lowercase().contains(needle) || task.notes.lowercase().contains(needle)) return true
        return (task as? Checklisted)?.checklist?.any { it.text.lowercase().contains(needle)} == true
    }

    fun hasAllTags(task: Task, tagIds: Collection<String>): Boolean = tagIds.all { it in task.tags }
}
