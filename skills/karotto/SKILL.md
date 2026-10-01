---
name: karotto
description: Manage the user's karotto tasks (habits, dailies, to-dos) from the shell with karotto. Use for listing what is due, completing or scoring tasks, adding or editing tasks and tags, and running the day rollover.
---

# karotto

karotto is a personal habit, daily and to-do tracker; the `karotto` command is
its command-line client. It is already configured on this machine; if a command
fails with `no_server` or `unauthorized`, tell the user to run
`karotto login --url <url> -u <username>`.

Always pass `--json` when you will read the output. Errors then arrive on
stderr as `{"error":{"code","message"}}` with exit code 1 (server error),
2 (usage or unknown thing), 3 (cannot reach or not authorized).

## Task model

- **habit**: scored any number of times with `up` or `down`; no completion.
- **daily**: repeats on a schedule; `isDue` says whether it counts today;
  completing it with `up` advances the streak, `down` un-completes.
- **todo**: one-off; `up` completes, `down` un-completes; optional `dueDate`.
- Every task has a `value` (a colour from `worst` to `best` shows in lists),
  optional `notes` in markdown, `tags`, an optional `alias` and, for dailies
  and to-dos, a `checklist`.
- Refer to tasks by alias when they have one, otherwise by id. Both work in
  every command. Aliases are stable; ids are UUIDs.

## Daily routine

1. `karotto cron status --json`. If `needsCron` is true, the user's day
   has rolled over since the app was last opened. Ask which of
   `yesterdailies` were actually done, then
   `karotto cron run --done <alias-or-id> ...` (or plain `cron run`).
   Do this before scoring anything today; scoring first records it against
   the wrong day.
2. `karotto tasks list --due --json` gives today's unfinished dailies.
   `karotto tasks list --type todo --json` gives open to-dos.
3. Complete things with `karotto done <task>`. Undo mistakes with
   `karotto undo <task>`. Scoring is not idempotent: completing an already
   completed task fails, and each habit click counts.

## Commands

```sh
karotto tasks list [--type habit|daily|todo] [--due] [--completed] [--tag NAME ...] [--search TEXT]
karotto tasks show <task>
karotto tasks add <habit|daily|todo> "<text>" [flags]
karotto tasks edit <task> [--text ...] [flags] [--add-tag NAME] [--remove-tag NAME]
karotto tasks rm <task>
karotto tasks clear-completed
karotto done <task>            # daily or to-do complete
karotto undo <task>
karotto score <task> up|down   # habits
karotto check <task> <n|text>  # toggle checklist item by number or text
karotto tags list|add|rename|rm
karotto cron status|run [--done <task> ...]
karotto pause | resume                      # vacation mode: no penalties while paused
karotto events                 # JSON lines of live changes, runs until killed
karotto api GET /tasks?type=completedTodos   # anything else
```

Flags for `add` and `edit`:

| Flag | Applies to | Meaning |
|---|---|---|
| `--notes TEXT` | all | markdown notes |
| `--alias NAME` | all | short handle; `--alias ""` clears |
| `--tag NAME` | all | tag names, created if missing; on edit replaces all tags |
| `--checklist "item"` (repeatable) | daily, todo | checklist items; on edit replaces the list |
| `--due YYYY-MM-DD` | todo | due date; `--due ""` clears |
| `--start YYYY-MM-DD` | daily | schedule start |
| `--frequency daily\|weekly\|monthly\|yearly` | daily | schedule unit (default weekly) |
| `--every N` | daily | every N units |
| `--repeat mon,wed,fri` or `all` | daily | weekdays for weekly schedules |
| `--up` / `--no-up`, `--down` / `--no-down` | habit | which directions exist |
| `--reset daily\|weekly\|monthly` | habit | when counters reset |
| `--streak N` | daily | correct a streak |

## Examples

Add a weekday daily with a checklist:

```sh
karotto tasks add daily "Morning routine" --repeat mon,tue,wed,thu,fri \
  --checklist "Stretch" --checklist "Plan the day" --tag health --alias morning
```

Add a to-do due Friday: `karotto tasks add todo "Renew passport" --due 2026-10-03`.

Complete a checklist item, then the task:

```sh
karotto check morning "Stretch"
karotto done morning
```

What changed while you were away: `karotto tasks list --completed --json`
lists completed to-dos; `karotto tasks show <task> --json` shows streak,
schedule and `isDue`.

## MCP instead of the shell

The same operations are available as MCP tools: run `karotto mcp` as a stdio
server (it reads the same stored login or KAROTTO_URL/KAROTTO_TOKEN). Tools:
list_tasks, get_task, create_task, update_task, delete_task, score_task,
toggle_checklist_item, list_tags, create_tag, rename_tag, delete_tag,
cron_status, run_cron. Prefer the shell commands when both are available;
they cost fewer tokens.

## Cautions

- Ask before deleting tasks or tags, and before `clear-completed`.
- Do not run `cron run` more than needed; it is safe when nothing is pending
  (`ran: false`) but it decides which day a completion belongs to.
- Habit `down` clicks lower the task's value; only use them when the user
  reports the negative behaviour.
