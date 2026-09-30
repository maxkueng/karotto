# Third-party notices

karotto is licensed under the GNU General Public License v3.0 (see `LICENSE`).
This file credits the work it is derived from or borrows from, and states the
licence each piece is under. Where karotto reimplements behaviour rather than
copying code, that is said explicitly.

## Habitica

**Habitica** by HabitRPG, Inc. — <https://github.com/HabitRPG/habitica> and
<https://github.com/HabitRPG/habitica-android>. Code licensed under the
GNU General Public License v3.0. Artwork and content licensed under
CC BY-NC-SA 3.0. "Habitica" is a trademark of HabitRPG, Inc.; karotto is not
affiliated with or endorsed by HabitRPG.

karotto exists because Habitica's task mechanics are good and deserve a life
outside the game. It is a reimplementation, not a fork: no file was copied,
and the code is written in TypeScript, Kotlin and Python against a different
data model and API. It was written from a close reading of Habitica's source,
which is documented in `docs/habitica-analysis/` with file and line
references; `docs/DESIGN.md` records where karotto follows Habitica exactly
and where it deviates. karotto carries the same GPL-3.0 licence forward.

What was taken from Habitica, by area:

- **Task model.** The three task types (habit, daily, to-do), their fields,
  checklists, reminders, tags, aliases, per-type ordering, and the semantics
  of each field. From `website/server/models/task.js` and
  `website/common/script/libs/taskDefaults.js`.
- **Scoring.** The value formula with base 0.9747, the 21.27 value cap, the
  delta computation, streak and counter handling, and habit frequency
  resets. From `website/common/script/ops/scoreTask.js`. karotto's tests
  check its implementation against reference vectors computed from
  Habitica's formulas.
- **Day rollover ("cron").** The custom day start, missed-day detection,
  decay of missed dailies, "yesterdailies", to-do handling, history
  recording and compression. From `website/server/libs/cron.js`,
  `website/common/script/cron.js` and `website/server/libs/preening.js`.
- **Schedules.** Daily, weekly, monthly and yearly repeat rules, `everyX`,
  days and weeks of the month, and the due-today computation. From
  `website/common/script/cron.js` (`shouldDo`).
- **Value colours.** The mapping from task value to the worst-to-best colour
  bands and the thresholds between them. From
  `website/client/src/store/getters/tasks.js` and `task.scss`.
- **The "Classic" theme.** Habitica's colour palette from
  `website/client/src/assets/scss/colors.scss`, offered as an optional theme.
  It is not the default and is not called "Habitica" in the UI.
- **API shape.** The task, tag, cron and user endpoints follow the semantics
  of Habitica's API v3 (`website/server/controllers/api-v3/`) where the
  behaviour matters to clients, with different routes and payloads.
- **User interface.** The web client's task columns, task cards, filters and
  task editor follow the layout and interaction design of Habitica's web
  client. The Android app is modelled on the look and feel of Habitica's
  Android client, including details read from its source.

What was deliberately not taken: HP, XP, gold, levels, items, pets, quests,
avatars, parties, guilds, challenges and every other game mechanic; all
artwork, sprites, icons and copy; the name.

## Colour themes

The optional colour themes are built from published palettes. Only the colour
values were used; karotto's theme engine derives its own ramps from them.

- **Tokyo Night** by enkia — <https://github.com/enkia/tokyo-night-vscode-theme>. Licence: MIT.
- **Synthwave '84** by Robb Owen — <https://github.com/robb0wen/synthwave-vscode>. MIT. karotto's variant was tuned to match **synthwave-hass** by bbbenji — <https://github.com/bbbenji/synthwave-hass>, MIT.
- **Catppuccin** — <https://github.com/catppuccin/catppuccin>. MIT.
- **Nord** by Sven Greb / Arctic Ice Studio — <https://github.com/nordtheme/nord>. MIT.
- **Gruvbox** by Pavel Pertsev — <https://github.com/morhetz/gruvbox>. The repository carries no licence file; only the colour values were used.
- **Solarized** by Ethan Schoonover — <https://github.com/altercation/solarized>. MIT.

## Dependencies

Runtime and build dependencies are declared in each package's manifest
(`package.json`, `build.gradle.kts`) and carry their own licences, all of
them GPL-compatible.
