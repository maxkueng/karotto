# Habitica Vue client — Tasks page visual/behavioral spec

Source root (abbreviated `C/`): `/tmp/claude-1000/-home-max-projects-karotto/056b76f6-667d-4225-beac-6be61ca77ec1/scratchpad/habitica/website/client/src`
Common (abbreviated `COMMON/`): `.../scratchpad/habitica/website/common`

Scope: Habits / Dailies / To Do's columns, task card, task modal, filters, feedback. Rewards, avatar header, stats, party, shops, drops, Bailey, notifications-of-drops are intentionally omitted unless they leak into shared CSS.

Stack facts that matter for the port: Vue 2.7 + bootstrap 4.6 + bootstrap-vue 2.23 (grid, `b-modal`, `b-dropdown`, `b-popover`, `b-tooltip`, `custom-control` checkboxes), `vuedraggable` 2.24 (SortableJS), `vuejs-datepicker` (habitrpg fork), `habitica-markdown` (markdown-it wrapper), `moment`, `lodash`. Bootstrap grid gutter overridden to 24px (`C/assets/scss/bootstrap.scss:2` `$grid-gutter-width: 24px`) so every `.col-*` has 12px horizontal padding and `.row` has -12px margins.

---

## 1. PAGE LAYOUT

### 1.1 Global shell
- `body`: `background: $gray-700 (#F9F9F9)` (`C/assets/scss/page.scss:5`), `font-family: 'Roboto', sans-serif; color: $gray-50 (#4E4A57); font-size: 14px; line-height: 1.43; -webkit-font-smoothing: antialiased` (`typography.scss:1-9`).
- Global `* { transition-duration: .15s; transition-property: border-color, box-shadow, color; timing ease-in }` (`index.scss:7-11`) but `misc.scss:22 * { transition: none }` then re-enables via `.transition` class (used on `.task`). Net effect: only elements with `.transition` animate border/shadow/color at 150ms ease-in.
- `#app` is `display:flex; flex-direction:column; overflow-x:hidden` (`pages/user-main.vue:58-62`). Order: `<app-menu>` (navbar) → `.container-fluid` (`flex: 1 0 auto`) containing `<app-header>` (avatar/party bar — DROP) then `<router-view>` → `<app-footer>`.
- Loading progress bar: axios-progress-bar/nprogress, z-index 1600.

### 1.2 Navbar (`C/components/header/menu.vue`)
Keep the bar, replace items.
- `.topbar`: `background: $purple-100 (#432874) url(bits.svg) right top no-repeat; min-height: 56px; box-shadow: 0 1px 2px 0 rgba(#1A181D,.24); z-index:1080; a { color: white !important }` (`menu.vue:469-478`). `$menuToolbarHeight: 56px` (`variables.scss:1`). Bootstrap `b-navbar toggleable="lg"` → hamburger below 992px.
- Logo: gryphon svg `32×32`, white, `pl-2 mr-3` (`menu.vue:480-485`).
- Nav items `.topbar-item`: `font-size:16px; font-weight:bold; color:#fff; >a { padding: .8em 1em }`. Desktop (≥992px): `height:56px; padding-top:5px; &:hover { background:$purple-200 (#4F2A93) }; &.active:not(:hover) { box-shadow: 0 -4px 0 $purple-300 (#6133B4) inset }` (`menu.vue:676-687`). Dropdown open state `.down { background:$purple-200 }`, dropdown panel `background:$purple-200; border-radius 0 0 5px 5px; items 16px, hover/active background $purple-300` (`menu.vue:516-555`).
- ≤1200px items `font-size:14px`. ≤992px collapsed menu: `background $purple-100`, items `background #4f2a93; border-bottom 1px #6133b4; active #6133b4`, text-center (`menu.vue:695-786`).
- Right side: `.item-with-icon` (24×24 icons colored `$header-color #D5C8FF`, white on hover, `margin 0 12px`), user avatar dropdown. `.message-count.top-count` red badge `$red-50`.

### 1.3 Tasks page (`C/components/tasks/user.vue`)
```
<div class="row user-tasks-page">          padding: 12px 12px 0; padding-top:16px   (user.vue:259-263)
  <div class="col-12">
    <div class="row tasks-navigation">      margin-bottom: 20px                     (265-267)
      <div class="col-12 col-md-4 offset-md-4">   ← search + Tags button centered, 1/3 width on md+
        <div class="d-flex">
          <input class="form-control input-search" placeholder="Search">
          <button class="btn btn-secondary dropdown-toggle ml-2 search-button" :class="{active: selectedTags.length}">
             <filter icon 16×16 mr-2> Tags
        <div class="filter-panel" v-if="isFilterPanelOpen">   (absolute dropdown, see §7)
      <div class="create-task-area">        ← absolutely positioned top-right "+ Add Task" btn + dropdown
    <div class="row tasks-columns">
      <task-column class="col-lg-3 col-md-6" v-for type in [habit,daily,todo,reward]>
```
- Search input: `.input-search { height: 2rem; border-radius: 2px; border: 1px solid $gray-400; background #fff; font-size 14px; line-height 1.71; color $gray-200; padding: .25rem 1rem .25rem .75rem }` (`form.scss:44-55`). Focus border `$purple-400` (`form.scss:33-37`).
- Tags button: `.btn.btn-secondary` (white, see §4 buttons) with bootstrap `dropdown-toggle` caret; `.active` state = white bg, `border 2px $purple-400`, text `$purple-300`.
- Create button: `.create-task-area { position:absolute; right:12px; top:1px; z-index:998 }` (`create-task.scss:1-6`, `user.vue:379-381`). `.create-btn { color:#fff; background:$purple-200; height:32px; .svg-icon { color:$purple-500; width:10px;height:10px } }` — content: `+` icon then "Add Task" (`create-task.scss:67-77`). Dropdown: `width:140px; border-radius:2px; box-shadow: 0 3px 6px 0 rgba(26,24,29,.16), 0 3px 6px 0 rgba(26,24,29,.24); background:#fff; margin-top:2px; position:absolute; right:0` items `.dropdown-item.d-flex.px-2.py-1` with type icon (`.task-icon` 30px wide box; habit icon 30×20, daily 24×20, todo 20×20, gray-200 → purple-300 on hover) + label "Habit / Daily / To Do" (`create-task.scss:8-54`). Click outside (`@click` on page root) closes it. Selecting a type opens the task modal in `create` mode with `taskDefaults()` and pre-fills currently selected filter tags (`user.vue:633-642`).

### 1.4 Responsive
- Columns: Bootstrap `col-lg-3 col-md-6` → 4 columns ≥992px, 2×2 grid 768–991px, single stacked column <768px. **There is no mobile tab bar for switching columns in the web client**; columns just stack. (Mobile tabs exist only in native apps.)
- Filter panel: `@media (max-width:768px) { .filter-panel { max-width:none; left:0 } }` (`user.vue:400-405`).
- Modal `@media (max-width:768px) .option-item { margin-right:12px }` (`taskModal.vue:1040`).
- `user.preferences.stickyHeader` toggles a `.sticky` class on the router-view wrapper but no CSS exists for it in the client — dead.

### 1.5 Column (`C/components/tasks/column.vue`)
```
<div class="tasks-column" :class="type">                min-height: 556px                  (168-170)
  <div class="d-flex align-items-center">                ← header row (56px tall incl. filters)
    <h2 class="column-title">Habits</h2>                  Roboto Condensed bold 20px/1.4, $gray-10, mb 0, ellipsis (256-261)
    <div class="badge badge-pill badge-purple column-badge mx-1">{{count}}</div>   (only if >0)
    <div class="filters d-flex justify-content-end">      margin-left:auto
      <div class="filter small-text" :class="{active}">All</div> ...
  <div class="tasks-list" ref="tasksWrapper">             border-radius:4px; background:$gray-600 (#EDECEE); padding:8px; padding-bottom:30px; position:relative; height: calc(100% - 56px)  (198-205)
    <textarea class="quick-add" :rows placeholder="Add a Habit">
    <transition name="quick-add-tip-slide"><div v-show="quickAddFocused" class="quick-add-tip small-text">Tip: …</div>
    <clear-completed-todos v-if="todo && filter==='complete2' && list.length">
    <div class="column-background" :class="{'initial-description': taskList.length===0}">   ← empty-state illustration
      <svg icon-{type}> <h3>These are your Habits</h3> <div class="small-text">Habits don't have a rigid schedule…</div>
    <draggable class="sortable-tasks" :disabled="filter==='scheduled'" scroll-sensitivity=64 :delay=100 delay-on-touch-only @update="taskSorted">
      <task v-for …/>
```
- Column badge: `.badge { font-size:12px; font-weight:bold; line-height:1.33; padding:.25rem .5rem; color:$gray-100; box-shadow: 0 1px 3px 0 rgba(#1A181D,.12), 0 1px 2px 0 rgba(#1A181D,.24) } .badge-pill { border-radius:12px } .badge-purple { color:#fff; background:$purple-400 (#925CF3); line-height:1.2; font-size:10px }` (`badge.scss`), column overrides `position: static` (`column.vue:263-265`). Count = number of tasks after filter+tags+search (`badgeCount`, 484-489).
- Filter tabs `.filter { font-weight:bold; color:$gray-100; font-style:normal; padding:8px; cursor:pointer; white-space:nowrap; &:hover { color:$purple-200 } &.active { color:$purple-200; border-bottom:2px solid $purple-200; padding-bottom:6px } }` and base `.small-text { font-size:12px; font-style:italic; line-height:1.33; color:$gray-200 }` (`column.vue:271-288`, `typography.scss:12-17`). Tabs are `tabindex=0`, Enter activates.
- Filter labels (`C/libs/store/helpers/filterTasks.js:5-38`):
  - habit: `all` "All" (default), `yellowred` "Weak" (`value < 1`), `greenblue` "Strong" (`value >= 1`)
  - daily: `all` "All", `due` "Due" (`!completed && isDue`), `notDue` "Not Due" (`completed || !isDue`)
  - todo: `remaining` "Active" (`!completed`, default), `scheduled` "Scheduled" (`!completed && date`, **sorted by date, drag disabled**), `complete2` "Complete" (`completed`; triggers `tasks:fetchCompletedTodos` GET `/api/v4/tasks/user?type=completedTodos`).
- Quick-add textarea: `.quick-add { border-radius:2px; background: rgba(#1A181D,.06); width:100%; margin-bottom:3px; padding:12px 16px; border-color:transparent; transition: background .15s ease-in; resize:none; overflow:hidden; &:hover { background: rgba(#1A181D,.1) } &:focus { background:#fff; border-color:$purple-500; color:$gray-50; margin-bottom:0 } &::placeholder { font-weight:bold } }` (`column.vue:207-233`). Placeholder "Add a Habit / Add a Daily / Add a To Do". Rows = number of lines while focused, 1 when blurred (498-501).
- Quick-add tip: `.quick-add-tip { font-style:normal; padding:16px; text-align:center; overflow-y:hidden }`; enter/leave transition `all .5s cubic-bezier(0,1,.5,1)` from `max-height:0; padding:0 16px` (235-254). Text: **"Tip: To add multiple Habits, separate each one using a line break (Shift + Enter) and then press "Enter.""**
- Quick-add semantics (`column.vue:623-651`): Enter → `preventDefault`, split text on `\n`, `.reverse()`, drop blanks, each → `taskDefaults({type, text})`, tags = currently selected filter tags, `tasks:create(array)` (client `unshift`s onto list + tasksOrder, then POST `/api/v4/tasks/user` with array), clear, blur. Shift+Enter → adds a row (newline). Reverse means the first typed line ends up at the top.
- Empty-state `.column-background { position:absolute; width:100%; bottom:32px; margin-left:-8px; &.initial-description { top:30% } .svg-icon { margin:0 auto 12px } h3,.small-text { color:$gray-300; text-align:center } h3 { font-weight:normal; margin-bottom:4px } .small-text { font-style:normal; padding:0 24px } }` icons gray-300: habit 30×20, daily 30×20, todo 20×20 (`column.vue:290-344`). Shown only if free space in the list wrapper ≥150px (`setColumnBackgroundVisibility`, 687-712). Texts: "These are your Habits" / "Habits don't have a rigid schedule. You can check them off multiple times per day." — "These are your Dailies" / "Dailies repeat on a regular basis. Choose the schedule that works best for you!" — "These are your To Do's" / "To Do's need to be completed once. Add checklists to your To Do's to increase their value."
- Clear completed (`clearCompletedTodos.vue`): `.delete-completed { padding:1em; text-align:center } .help-text { color:#878190; font-size:12px }` "Completed To Do's are deleted after 30 days for non-subscribers and 90 days for subscribers." + `.btn.btn-danger { font-size:12px; padding:.4em .6em; margin-top:.5em }` "Delete Completed" → `window.confirm("Are you sure you want to delete your completed To Do's?")` → POST `/api/v4/tasks/clearCompletedTodos`.
- Drag & drop: `vuedraggable` (SortableJS) with `delay=100`, `delay-on-touch-only`, `scroll-sensitivity=64`; `@start/@end` toggles `draggable-cursor` class on `<html>` (`cursor: grabbing`). `[draggable] { cursor: grab } [draggable]:active { cursor: grabbing }` (`dragdrop.scss`). No custom animation configured → SortableJS default (`animation: 0`, i.e. none; ghost element is the browser-native drag image since `forceFallback` not set). On drop: `taskSorted` computes index in the unfiltered list (`getUnfilteredTaskList`) and POSTs `/api/v4/tasks/:id/move/to/:position`, then splices locally and forces re-render via `rerendering` flag (544-576). Task dropdown "To top / To bottom" uses the same move endpoint with position 0 / length.

---

## 2. TASK CARD (`C/components/tasks/task.vue`)

### 2.1 Structure
```
<div class="task-wrapper" draggable>
  <div class="task transition" :class="[type_habit|type_daily|type_todo, ...]" tabindex=0 @keypress.enter=edit>
    <div class="d-flex">
      [habit]  <div class="left-control d-flex justify-content-center pt-3" :class="controlClass.up.bg">
                  <div class="task-control habit-control habit-control-positive-(enabled|disabled)" :class="controlClass.up.inner" role=button tabindex=0 @click=score('up')>
                     <div class="svg-icon positive">+</div>
      [daily/todo] <div class="left-control d-flex justify-content-center" :class="controlClass.bg">
                  <div class="task-control daily-todo-control" :class="controlClass.inner" role=checkbox tabindex=0 @click=score(completed?'down':'up')>
                     <div class="svg-icon check" :class="{'display-check-icon': completed, [controlClass.checkbox]:true}">✓</div>
      <div class="task-content" :class="contentClass">
        <div class="task-clickable-area pt-1 pl-75 pb-0" @click=edit>
          <div class="d-flex justify-content-between">
            <h3 class="task-title markdown" :class="{has-notes}" v-markdown="task.text">
            <menu-dropdown class="task-dropdown mr-1" v-b-tooltip.hover.top="Options">   ← 3-dot vertical "menu" icon, opacity 0 until hover
               items: Edit (edit icon) | To top (top arrow) | To bottom (bottom arrow) | Delete (trash, red)
          <div class="task-notes small-text" :class="{has-checklist}" v-markdown="task.notes">
        <div class="checklist" :class="{isOpen: !collapseChecklist}" v-if="hasChecklist">
          <div class="d-inline-flex"><div class="collapse-checklist expand-toggle mb-2" :class="{open}"> <checklist icon> <span>2/5</span> </div></div>
          <div class="custom-control custom-checkbox checklist-item" :class="{checklist-item-done}" v-for item>  <input checkbox> <label v-markdown=item.text>
        <div class="icons small-text d-flex align-items-center">
          [todo w/ date] <div class="d-flex align-items-center" :class="{due-overdue}"> <calendar icon> <span>Today | 09/28/2026</span>
          <div class="icons-right d-flex justify-content-end">
             [streak] <streak icon> <span>{{streak}}</span>                       (daily)
                      <span>+3 | -1</span> / <span>3</span> / <span>0</span>    (habit counters, see below)
             [challenge icon — drop]
             [tags]   <tags icon>  + b-popover on hover: "Tags:" + pill per tag name
      [habit]  <div class="right-control d-flex justify-content-center pt-3" :class="controlClass.down.bg">
                  <div class="task-control habit-control habit-control-negative-(enabled|disabled)" …> <svg negative>−</svg>
```
No "edit pencil appears on hover": what appears on hover is the **vertical 3-dot menu** (`menu.svg`, 4×16) at the top-right of the card; the edit pencil is inside that dropdown. Clicking anywhere on `.task-clickable-area` (title/notes region) opens the edit modal, except clicks on `<a>` links inside markdown and clicks on the dropdown (`edit()`, 981-1008). Enter key on a focused card also opens edit.

### 2.2 Card box
- `.task { margin-bottom:2px; box-shadow: 0 2px 2px 0 rgba(#1A181D,.16), 0 1px 4px 0 rgba(#1A181D,.12); background:#fff; border-radius:4px; position:relative }` hover/focus-within: `box-shadow: 0 1px 8px 0 rgba(#1A181D,.12), 0 4px 4px 0 rgba(#1A181D,.16)` and `outline: 1px solid $purple-400` (`task.vue:449-467`). `*:focus { outline:none; border: $purple-400 solid 1px }` inside card (431-435).
- `.left-control, .right-control { width:40px; flex-shrink:0; border:1px solid transparent }` `.left-control { border-radius 4px 0 0 4px; min-height:60px; border-right:none }` `.right-control { border-radius 0 4px 4px 0; min-height:56px; border-left:none }`. For non-habits `.left-control + .task-content` gets right radius 4px (`task.vue:790-829`).
- `.task-content { padding:0 0 7px; flex-grow:1; background:#fff; border:1px solid transparent; min-width:0 }`; `.no-right-border` for habits (`task.vue:661-675`). `.task-clickable-area { border: transparent solid 1px; cursor:pointer; padding: .25rem 0 0 .75rem }`.
- `.task-control { width:28px; height:28px }` (`task.scss:415-418`).
- Habit buttons `.habit-control { border-radius:100px; color:#fff; .svg-icon { width:10px; height:10px; margin:0 auto } }`; `-positive-*` `padding-top:8px`, `-negative-*` `padding-top:12px` (icon is 10×2 line) (`task.scss:420-457`). Container `pt-3` (16px) so the 28px circle sits 16px from top.
- Daily/todo checkbox `.daily-todo-control { margin-top:16px; border-radius:2px; margin-left:-1px }` 28×28 square; `.check.svg-icon { width:16px; height:16px; margin:5px }`; check icon hidden unless `.display-check-icon` (completed) or control hovered (`task.scss:459-479`, `task.vue:770-775, 842-846`).
- Title `h3.task-title.markdown`: `font-family 'Roboto Condensed'; font-size:16px; line-height:1.25; margin-top:6px; margin-bottom:4px; color:$gray-10; font-weight:normal` (`markdown.scss:1-15`), plus `padding-bottom:8px; margin-right:15px; overflow-wrap:break-word; p { margin-bottom:0 } &.has-notes { margin-bottom:0; padding-bottom:4px }` (`task.vue:481-505`).
- Notes `.task-notes.small-text { color:$gray-100; font-style:normal; padding-right:20px; min-width:0; overflow-wrap:break-word; &.has-checklist { padding-bottom:2px } }` → 12px/1.33 (`task.vue:648-659`).
- Bottom icons row `.icons { padding:0 8px; margin-top:4px; color:$gray-100; font-style:normal; font-size:12px } .icons-right { flex-grow:1 } .icons-right .svg-icon { margin-left:8px } .icons span { margin-left:4px }` (`task.vue:740-756`). Icon sizes: streak 11.6×7.1, tags 14×14 (hover `$purple-500`), calendar 14×14 `margin-right:2px; margin-top:-2px`, overdue text `.due-overdue { color:$maroon-10 (#B01515) }` (`task.vue:757-800`).
- Due date text: "Today" if same day else `moment(date).format(preferences.dateFormat.toUpperCase())` e.g. `MM/DD/YYYY`. Overdue = end of due day < end of today (with dayStart offset) (`task.vue:963-978`).
- Streak/counters (`task.vue:275-315`): shown when `task.userId` and (`streak !== undefined` or habit with up/down). Daily shows `{{streak}}`. Habit: if both up&down → `+{{counterUp}} | -{{counterDown}}` (0 shown as `0`, sign only when non-zero) — e.g. `+3 | -1`, `0 | 0`; one-directional shows just the number. Tooltip "Streak Counter" / "Counter".
- Tags: **not chips on the card**. Only a tag icon; hovering it shows a dark popover "Tags:" followed by pills `.tag-label { border-radius:100px; background:$gray-50; padding:4px 10px; color:$gray-300; margin-left:4px; white-space:nowrap }` (`task.vue:890-922`). Popover base: `border-radius:8px; background: rgba($gray-10,.96); box-shadow: 0 2px 2px 0 rgba(#1A181D,.16), 0 1px 4px 0 rgba(#1A181D,.12); max-width:300px; no arrow; body padding 12px 16px; color $gray-500; 12px/1.33` (`popover.scss`).
- Dropdown (`customMenuDropdown.vue` + `task.vue:520-647`): toggle `.dropdown-icon { width:4px; height:16px; color:$gray-100 }`, `opacity:0; padding:0 8px; transition: opacity .15s ease-in` → `opacity:1` on `.task:hover`/`:focus-within`; open/hover icon color `$purple-400`, open state icon `#fff` (customMenuDropdown global style). Menu: `.dropdown-menu { border:transparent; border-radius:2px; box-shadow: 0 3px 6px 0 rgba(#1A181D,.16), 0 3px 6px 0 rgba(#1A181D,.24); padding:0; right:0; margin-top:8px }`; items `.dropdown-item { padding: 8px 0 8px 24px; font-size:14px; line-height:1.71; color:$gray-50; hover background rgba($purple-600,.25), color $purple-300 }` + `.dropdown-icon-item .svg-icon { margin-right:16px }`. Icons: edit 16×16, top/bottom 10×11 (stroke $purple-300), delete 14×16; "Delete" item text `$red-10 (#F23035)`.

### 2.3 Color classes (`C/assets/scss/task.scss` + `C/store/getters/tasks.js:23-42`)
Value → color: `value < -20 worst`, `< -10 worse`, `< -1 bad`, `< 1 neutral`, `< 5 good`, `< 10 better`, else `best`. Rewards / `byHabitica` → `purple`.

| color | control bg (`task-X-control-bg`) | habit inner circle (`-inner-habit`) | daily/todo inner box (`-inner-daily-todo`) | checkbox/icon color (`-checkbox`, `-icon`) | habit hover (`.habit-control:hover` bg) | daily hover (`.daily-todo-control:hover`) |
|---|---|---|---|---|---|---|
| worst | `$maroon-100 #DE3F3F` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$red-1 #6C0406` | `rgba(#1A181D,.5)` | `rgba(#fff,.75)` |
| worse | `$red-100 #FF6165` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$red-1 #6C0406` | `rgba(#1A181D,.5)` | `rgba(#fff,.75)` |
| bad | `$orange-100 #FF944C` | `rgba(#7F3300,.25)` | `rgba(#fff,.5)` | `$orange-1 #7F3300` | `rgba(#7F3300,.5)` | `rgba(#fff,.75)` |
| neutral | `$yellow-100 #FFBE5D` | `rgba(#794B00,.25)` | `rgba(#fff,.5)` | `$yellow-1 #794B00` | `rgba(#794B00,.5)` | `rgba(#fff,.75)` |
| good | `$green-100 #24CC8F` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$green-1 #005737` | `rgba(#1A181D,.5)` | `rgba(#fff,.75)` |
| better | `$teal-100 #3BCAD7` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$teal-1 #005158` | `rgba(#1A181D,.5)` | `rgba(#fff,.75)` |
| best | `$blue-100 #50B5E9` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$blue-1 #033F5E` | `rgba(#1A181D,.5)` | `rgba(#fff,.75)` |
| purple (modal/create only) | `$purple-task #925CF3` | `rgba(#1A181D,.25)` | `rgba(#fff,.5)` | `$purple-task` | same | same |

Non-interactive variants (challenge/group tasks; `-bg-noninteractive`, `-inner-habit-noninteractive { border:1px solid rgba(X-1,.5) }`) can be dropped.

Habit "+" icon color: `.habit-control { color: #fff }` — the +/− glyph is white on the translucent dark circle. Checkbox check glyph color = `-checkbox` class = the dark `X-1` tone (e.g. `$green-1`) on the 50% white square.

Disabled states (`task.scss:374-412`):
- Habit direction not enabled (`task.up === false` → left side; `task.down === false` → right side): `task-disabled-habit-control-bg { background:$gray-600 #EDECEE }`, inner `task-disabled-habit-control-inner { border:1px solid $gray-300; opacity:.75; .positive,.negative { color:$gray-200 } }` — i.e. the other side renders as a light grey column with a hollow grey-outlined circle and grey glyph, `cursor: initial`; `score()` early-returns when `!task[direction]` (`task.vue:1181`). Both sides are always rendered for habits; nothing is hidden.
- Daily not due / completed daily / completed todo (`getTaskClasses` 'control', `getters/tasks.js:172-193`): bg `task-disabled-daily-todo-control-bg { background:$gray-200 #878190 }`, inner `{ background: rgba(#fff,.5) }`, checkbox `{ color:$gray-10 }`, content `task-disabled-daily-todo-control-content { background:$gray-600 #EDECEE; .task-title,.task-notes { opacity:.75 } }`. So a completed/undue daily = grey control strip + light-grey body with faded text; the ✓ is drawn (dark grey) when completed. "Not due" is `!shouldDo(today, task, prefs)`.

### 2.4 Checklist in card
- `.checklist { padding:0 8px } .checklist.isOpen { margin-bottom:2px }`.
- Toggle pill `.collapse-checklist { padding:2px 6px; border-radius:1px; background:$gray-600; font-size:10px; line-height:1.2; color:$gray-200; border:transparent 1px; cursor:pointer; span { margin:0 4px } .svg-icon { width:12px; height:8px } }` + `.expand-toggle:after` CSS triangle (4px, pointing right when collapsed, down when `.open`) (`task.vue:686-711`, `popover.scss:32-48`). Text `completed/total` e.g. `2/5`. Tooltip "Expand Checklist"/"Collapse Checklist". Toggle PUTs `collapseChecklist` to `/api/v4/tasks/:id` (`actions/tasks.js:153-158`).
- Items `.checklist-item { color:$gray-50; font-size:14px; line-height:1.43; margin-bottom:-3px; padding-right:20px; width:100% } &-done { color:$gray-300; text-decoration:line-through } .custom-control-label { cursor:pointer; margin-left:6px; padding-top:0 }` with the custom checkbox (§4). Toggling POSTs `/api/v4/tasks/:taskId/checklist/:itemId/score` and flips `item.completed` locally (`task.vue:955-959`).

### 2.5 Markdown
- Directive `C/directives/markdown.js`: `el.innerHTML = habiticaMarkdown.render(String(value))` and adds class `markdown`. `habitica-markdown` = markdown-it with linkify, emoji (`:smile:` → `<span class="emoji-native">`/img), mentions; it is used for title, notes, checklist item labels, tag names.
- `.markdown` CSS (`markdown.scss`): `p { margin-bottom:8px }`, headings Roboto Condensed normal weight (h1 24/1.67, h2 20/1.4, h3 16/1.25, h4 14/1.43, color $gray-10), `img { max-width:100% }`, `.emoji-native { font-size:.85em; vertical-align:middle }`, `blockquote { padding:0 16px; border-left:4px solid #e1e0e3 }`, links `$purple-300` underline on hover (`typography.scss:28-37`). External links open via an "external link" confirm modal (`externalLinks` mixin) — drop.

### 2.6 Scoring flow (`C/mixins/scoreTask.js`, `task.vue:1178-1210`)
1. Click control → `score(dir)`; for daily/todo dir = `completed ? 'down' : 'up'`.
2. Runs `COMMON/script/ops/scoreTask` locally (optimistic): flips `task.completed`, bumps `streak`/`counterUp/Down`, changes `task.value` (which may change the color band immediately), plays sound (`playSound` event; sounds off unless `preferences.sound` set).
3. POST `/api/v4/tasks/:id/score/:direction`; response `_tmp` handled for drops/crit (drop all).
4. No animation on the card itself besides the 150ms color/border transition; a completed daily immediately leaves the "Due" list (no delay/timeout — `taskList` is a computed filter; the throttle at `column.vue:492-496` only re-checks the empty-state background). A completed todo immediately leaves "Active".

---

## 3. TASK MODAL (`C/components/tasks/taskModal.vue`)

`b-modal#task-modal size="sm" hide-footer no-close-on-esc no-close-on-backdrop`. `.modal-dialog.modal-sm { max-width:448px }`, `.modal-content { border-radius:8px; border:none; box-shadow: 0 14px 28px 0 rgba(#1A181D,.24), 0 10px 10px 0 rgba(#1A181D,.28) }`, header/body/footer `padding:0; border:none`; `.modal-dialog { margin: 3rem auto }`; backdrop `opacity:.9; background:$purple-100 (#432874)` (`user-main.vue:103-106`) — the whole page goes deep purple behind the modal. `.modal { z-index:1350 }`.

Color classes via `getTaskClasses(task, 'edit-modal-*' | 'create-modal-*')`: create → always `task-purple-modal-*` (`bg $purple-300 #6133B4`, headings white, text `$black`, icon `$purple-300`, `--svg-color: $purple-300`); edit → `task-{color}-modal-*` from value (bg = `X-100` tone; headings white for worst/purple else `X-1` dark tone; icon = `X-100` (good uses `$green-10`); `--svg-color` = `X-100`; inputs: `border:0; focus box-shadow 0 0 0 1px X-1; placeholder color X-1`) (`task.scss:97-357`).

### 3.1 Header (`.task-modal-header.p-4` = 24px padding, colored bg, top radius 8px)
```
[h2 "Create Habit" | "Edit Habit"]                         [Cancel]  [Create|Save (btn-secondary)]
Title*                                       ⚠ Avoid SPI (popover)
[ input.input-title  placeholder "Add a title" ]           height 2rem, bg rgba(#fff,.5) → .75 on hover/focus
Notes                                        Markdown formatting help
[ textarea.input-notes placeholder "Add notes" ]           height 3.5rem
```
- h2 = Roboto Condensed bold 20px/1.4, white/colored per class. Cancel = `.cancel-task-btn { border:0; background:none; color:inherit; hover underline }`. Save/Create = `.btn.btn-secondary` (white pill-ish, see §4) with `.btn-disabled` when title empty (`bg #fff; border 2px transparent; color $gray-200; opacity .6; cursor not-allowed`).
- Labels: `font-size:14px; font-weight:bold; line-height:1.71` (`lockableLabel.vue:24-30`). Small links 12px/1.33.
- Inputs inside modal: `padding:.25rem .75rem; line-height:1.71; background rgba(#fff,.5); hover/focus rgba(#fff,.75); transition border-color, box-shadow, color, background` (`taskModal.vue:1225-1236, 870-877`).
- Emoji autocomplete on title/notes (`:sm…`) — optional.
- Enter in title does not submit (only autocomplete); form `@submit` → `submit()`.

### 3.2 Body (`.task-modal-content.px-4`, white, `--svg-color` set) — field order per type
Each block `.option.mt-3` (16px top margin); `.form-group { margin-bottom:0 }`.

**Habit**
1. Positive / Negative toggles (centered, `d-flex justify-content-center mt-3`): two `button.habit-option-container` (min-width 3rem, first has `margin-right:2rem`), each a `.habit-option-button` circle `2.5rem` diameter (`border-radius:50%`) with `+` (10×10 white) or `−` (10×2, `margin-top:.5rem`) and label below `.habit-option-label { font-size:12px; font-weight:bold }`. Enabled: circle bg = modal color class (`cssClass('bg')`), label color = `cssClass('icon')`. Disabled: circle `border:2px solid $gray-300`, icon `$gray-200`, label `$gray-100` normal weight; hover → border + label in modal color (`task.scss:82-95`, `taskModal.vue:1183-1222`). Both can be off (allowed).
2. Difficulty (label + info icon tooltip "Difficulty describes how challenging…") → `select-difficulty`.
3. Tags → `select-multi`.
4. Reset Counter → `select-translated-array` items `['daily','weekly','monthly']` bound to `task.frequency` (labels "Daily/Weekly/Monthly").
5. Advanced Settings (edit only): "Adjust Counter" — `.row.streak-inputs` with `+` input-group (`positive-addon`) and/or `−` input-group (`negative-addon`), `col-6` each when both.

**Daily**
1. Checklist (`checklist.vue`).
2. Difficulty.
3. Start Date → `datepicker` (no clear button; today highlighted).
4. Repeats → select `['daily','weekly','monthly','yearly']` ("Daily/Weekly/Monthly/Yearly").
5. Repeat Every → `.input-group-outer` = `[number input everyX min 0 max 9999]` + `.input-group-spaced.input-group-text` suffix "day(s)/week(s)/month(s)/year(s)" (`margin-left:12px; height:2rem; border-radius:2px; background:$gray-600; font 14px bold; color $gray-50`).
6. If weekly: Repeat On → `.toggle-group` of 7 `toggle-checkbox` buttons (Su M T W Th F S; labels come from `$t('weekdaysMin0..6')`, not in en JSON — i18n falls back to moment's `weekdaysMin`, i.e. "Su Mo Tu We Th Fr Sa"). Style: `height:2rem; border:1px solid $gray-400; bg #fff; flex:1; joined (no left border except first); radius 2px on outer ends; checked { border-color:$purple-100; background:$purple-300; color:#fff }; hover unchecked { border $gray-300; color $purple-300 }; focus outline 1px $purple-400` (`toggleCheckbox.vue`).
7. If monthly: Repeat On → two inline custom radios "Day of the Month" / "Day of the Week" (`repeatsOn` computed; sets `daysOfMonth=[date]` or `weeksOfMonth=[week]` + `repeat[day]` from `startDate`, `taskModal.vue:1608-1631`).
8. `p.scheduling-summary` (12px/16px `$gray-50`) e.g. "Repeats every week on Monday, Wednesday" / "Repeats every month on the 15th" / "Repeats every year on September 28th" (`schedulingSummary`, 1391-1462). `.scheduling-warning` with alert icon when 5th-week monthly: "This task **will not** appear due during months with fewer Mondays".
9. Tags.
10. Advanced Settings (edit only): "Adjust Streak" input-group with streak icon prepend.

**To Do**
1. Checklist.
2. Difficulty.
3. Due Date → `datepicker` with clear (×) button.
4. Tags.
5. (No advanced settings unless developer-mode alias.)

**All (edit, non-challenge)**: centered `.delete-task-btn` "Delete this Habit/Daily/To Do" — trash icon 1rem + text `14px/1.71 color $maroon-50 (#C92B2B)`, `margin: 24px 0`, hover underline. Opens `delete-task-confirm-modal` (§8). Create mode: footer `.btn.btn-primary.btn-footer` "Create" centered `mt-4 mb-4`.

**Dropped**: "Assigned Stat" (attribute str/int/con/per; only when `automaticAllocation && allocationMode==='taskbased'`), Task Alias (developer mode), group assign, reward cost, Avoid SPI (keep or drop).

**Reminders: the web client has no reminders UI at all** (only `reminders: []` in `taskDefaults`; grep hits only in `main.js` comment). Skip them.

Advanced Settings block: `.advanced-settings { min-height:3rem; background:$gray-700; margin:0 -1.5rem; padding:.75rem 1.5rem } h3 { Roboto 14px bold 1.71 $gray-10 } .toggle-up .svg-icon { width:1rem } .toggle-open { rotate 180deg }` chevron icon; `b-collapse`.

### 3.3 Sub-controls
- **Checklist** (`modal-controls/checklist.vue`): label "Checklist" + chevron (16px, `.chevron-flip` when open, `translateY(-5px) rotate(180deg)`), `b-collapse`. Rows `.checklist-group.input-group { height:2rem; border-bottom:1px solid $gray-500; first has border-top }`: absolute `span.grippy` (grip icon 10×16, `left:-15px; top:4px; color $gray-200; opacity 0 → 1 on row hover; cursor pointer`) as the vuedraggable `handle=".grippy"`, custom checkbox (`margin-left .375rem; 18×18`), `input.inline-edit-input.checklist-item { border:none; padding:0; margin-left .75rem; height 1.5rem; 14px/1.71 $gray-50 }`, trailing `.input-group-append .destroy-icon` (trash 14×16, hidden until row hover, `$gray-200` → `$maroon-50` on hover). New row `.new-checklist`: `+` icon 10×10 `$gray-200` prepend (`margin-left .688rem`), input placeholder "New checklist item"; Enter or blur adds (`addChecklistItem`), IME-safe. `.top-border` when list empty. Items array is `.sync`ed; empty-text items are stripped on save (`actions/tasks.js:82-86`).
- **Difficulty** (`selectDifficulty.vue`): a `select-list` (b-dropdown full width, `.inline-dropdown`) with items `{0.1 Trivial ★}, {1 Easy ★★}, {1.5 Medium ★★★}, {2 Hard ★★★★}` — each row: label (flex 1) + right-aligned star group (`div.svg-icon { width:80px; justify-content:flex-end } svg { 10×10; margin-left .125rem; fill $gray-200 }`; hovered row / selected button → `fill: var(--svg-color)` (the modal color)). Star icon = `difficulty-trivial.svg` (4-point sparkle star, viewBox 16). `difficulty-normal/medium/hard.svg` exist (2/3/4 stars composed) but the component repeats the single star `n` times. Dropdown toggle: `.dropdown > .btn { Roboto 14px normal 1.714; padding 2px 12px }` white btn-secondary with caret at `right:12px; top:14px`; `.dropdown-menu.show { min-width:100%; max-height:400px; overflow:scroll }`; `.selectListItem .dropdown-item { padding:.25rem 1rem .25rem .75rem; height:32px; hover bg rgba($purple-600,.25) color $purple-300 }`; selected item shows check icon `$purple-300` (`.77rem × .615rem`) unless `hide-icon` (difficulty hides it, frequency selects show it) (`dropdown.scss`, `selectList.vue`).
- **Tags multi-select** (`selectMulti.vue` + `multiList.vue`): a `b-dropdown.inline-dropdown.select-multi` whose toggle shows the selected tags as pills (or "Add tags..." empty message). Pill `.multi-item { height:1.5rem; border-radius:100px; background:$gray-600; label 12px/16px $gray-100 with ml .75rem mr .5rem; × remove icon 8×8 stroke $gray-200 → $maroon-50 on hover; click removes }`. Open panel: `.dropdown-header { background:$gray-700; min-height:3rem; padding 0 .75rem }` with search input placeholder "Enter a tag" + the pills again; below, list of unselected tags filtered by search, rows `height 2rem`, label 14px/1.71 (+ "Challenge" addl-text 12px right for challenge tags); `max-height 5×2rem` scroll when >5; hint `.hint` 12px $gray-100 "Press Enter to add tag: 'foo'" when no exact match; Enter creates a tag via `tags:createTag` and selects it. Esc closes. Selection does not close the dropdown.
- **Datepicker** (`ui/datepicker.vue`, vuejs-datepicker bootstrap styling): input-group with calendar icon append (12×12); calendar opens **above** (`bottom: 2.125rem`), `width:100%; padding:.5rem`; header + `.datetime-buttons` band (`background $gray-700; min-height 40px`) with two flat buttons "Today" / "Tomorrow" (`height 1.5rem; radius 2px; bg $gray-600; color $gray-100 → $purple-300 hover`); day cells `width 1/7; radius 2px; 14px; padding .65rem .35rem`; hover `border 1px solid $purple-400`; selected `bg $purple-300 color #fff bold`; highlighted (today) `bg rgba($purple-600,.25) color $purple-300 bold`; day headers 12px bold $gray-100; month/year btn 14px bold $gray-50. Clear button (todo only) = close × icon `.563rem` wide. Dates are normalized to local midnight before emit.
- **Info icon** (`informationIcon.vue`): `information.svg` 16×16 `$gray-200` + b-tooltip.
- **Lockable label**: lock icon 10px `$gray-200` + label when the field is read-only (challenge tasks) — drop lock.

### 3.4 Save semantics
`submit()` (`taskModal.vue:1633-1683`): requires non-empty `text`; pending new checklist text is added; create → `tasks:create` (optimistic unshift + POST array); edit → `tasks:save` (Object.assign local, PUT `/api/v4/tasks/:id` without `history`, then assign response). Then hides modal; `@hidden` emits `cancel` → parent nulls `editingTask/creatingTask` (task passed to the modal is a `cloneDeep`, so cancel discards edits).

---

## 4. COLORS, BUTTONS, FORMS, DROPDOWNS, BADGES, MODALS, TOOLTIPS

### 4.1 `C/assets/scss/colors.scss` verbatim
```scss
$white: #FFFFFF;
$black: #1A181D;

$gray-10: #34313A;
$gray-50: #4E4A57;
$gray-100: #686274;
$gray-200: #878190;
$gray-300: #A5A1AC;
$gray-400: #C3C0C7;
$gray-500: #E1E0E3;
$gray-600: #EDECEE;
$gray-700: #F9F9F9;

$red-1: #6C0406;
$red-10: #F23035;
$red-50: #F74E52;
$red-100: #FF6165;
$red-500: #FFB6B8;

$maroon-10: #B01515;
$maroon-50: #C92B2B;
$maroon-100: #DE3F3F;
$maroon-500: #F19595;

$orange-1: #7F3300;
$orange-10: #F47825;
$orange-50: #FA8537;
$orange-100: #FF944C;
$orange-500: #FFC8A7;

$yellow-1: #794B00;
$yellow-5: #EE9109;
$yellow-10: #FFA624;
$yellow-50: #FFB445;
$yellow-100: #FFBE5D;
$yellow-500: #FEDEAD;

$green-1: #005737;
$green-10: #1CA372;
$green-50: #20B780;
$green-100: #24CC8F;
$green-500: #77F4C7;

$teal-1: #005158;
$teal-10: #26A0AB;
$teal-50: #34B5C1;
$teal-100: #3BCAD7;
$teal-500: #8EEDF6;

$blue-1: #033F5E;
$blue-10: #2995CD;
$blue-50: #46A7D9;
$blue-100: #50B5E9;
$blue-500: #A9DCF6;

$purple-50: #36205D;
$purple-100: #432874;
$purple-200: #4F2A93;
$purple-300: #6133B4;
$purple-400: #925CF3;
$purple-500: #BDA8FF;
$purple-600: #D5C8FF;

$header-color: #D5C8FF;
$header-dark-background: #271B3D;

$healer-color: #FFA624;
$rogue-color: #4F2A93;
$warrior-color: #C92B2B;
$wizard-color: #2995CD;

$gems-color: #24CC8F;
$gold-color: #FFA624;
$hourglass-color: #2995CD;

$purple-task: #925cf3;
```
Task value→color mapping: see §2.3 table. Utility color classes exist for most tokens (`.gray-50`, `.purple-300`, `.bg-gray-600` …, `typography.scss:129-227`).

Shadows used (all rgba of `#1A181D`):
- card / filter panel / tooltip / popover: `0 2px 2px 0 .16, 0 1px 4px 0 .12`
- card hover: `0 1px 8px 0 .12, 0 4px 4px 0 .16`
- button rest / badge: `0 1px 3px 0 .12, 0 1px 2px 0 .24`
- button hover / dropdown menu / create dropdown: `0 3px 6px 0 .16, 0 3px 6px 0 .24`
- modal: `0 14px 28px 0 .24, 0 10px 10px 0 .28`
- navbar: `0 1px 2px 0 .24`

### 4.2 Buttons (`C/assets/scss/button.scss`)
- `.btn { cursor:pointer; font-family Roboto; font-size:14px; font-weight:bold; line-height:1.714; border:2px solid transparent; padding:2px 12px; border-radius:4px; box-shadow: 0 1px 3px 0 rgba(#1A181D,.12), 0 1px 2px 0 rgba(#1A181D,.24); color:#fff; gap:8px }` → 32px tall. Hover/focus shadow `0 3px 6px 0 .16, 0 3px 6px 0 .24`; active `box-shadow:none`. Disabled: `color $gray-200; background transparent; border 2px transparent; padding 4px 12px; min/max-height 32px`.
- `.btn-primary { background:$purple-200 (#4F2A93) }` focus `border 2px $purple-400`; hover same bg (only shadow grows); icon color var `$purple-500` → white on hover/focus.
- `.btn-secondary { background:#fff; border 2px transparent; color:$gray-50 }` hover `color $purple-300`; focus/active `border 2px $purple-400; color $purple-300`; icon `$gray-200` → `$purple-300`.
- `.btn-danger { background:$maroon-100 (#DE3F3F) }` focus/active border `$purple-400`.
- `.btn-success { background:$green-50 (#20B780) }`, `.btn-warning { background:$orange-10 }`, `.btn-info { background:$blue-100; color:$black }`.
- `.btn-flat { border:0; box-shadow:none }`, `.btn-cancel { color:$blue-10 }`, `.btn-small { font-size:12px; line-height:2; padding:2px }`, `.btn-lg { 1.25rem/1.5; padding .5rem 1rem }`, `.btn-show-more { width 100%; padding 8px; background $gray-500; color $gray-200 }`.
- Text-link buttons: `a { color:$purple-300; hover underline }`, `a.small-link { 12px/1.33 }`; `a[disabled] { color:$gray-300 }`.

### 4.3 Form controls (`C/assets/scss/form.scss` — the one actually imported globally; `forms.scss` is only used on auth/home pages)
- `input, textarea, .form-control { padding:10px 12px; border-radius:2px; font-size:14px; line-height:1.43; color:$gray-50; border:1px solid $gray-400 }` hover `border $gray-300`; focus/active `border $purple-400; outline 0; box-shadow none`; disabled `opacity .64; background $gray-700`; `.input-invalid { border-color $red-100; alert bg-image }`, `.input-valid { check bg-image }`. Placeholder color (from forms.scss, applies where imported) `$gray-200`.
- `.input-group:not(.checklist-group) { border-radius:2px; border:1px solid $gray-400; hover $gray-300; focus-within 1px $purple-400; prepend/append background $gray-600 }`; `.input-group { height:2rem } .input-group-prepend/append { color $gray-200; border 0; height 30px; width 2rem } input { height 30px; border 0 }`. `.input-group-text { 14px/1.43; color rgba($gray-100,.64); padding 10px 24px }`. Addon icon sizes: streak 11.6×7.1, positive 10×10, negative 10×2.
- `.input-error { 12px/1.33 $maroon-100 }`.
- Custom checkbox (`form.scss:203-278`): `.custom-control { margin-bottom:.5rem } .custom-control-label { padding-top:2px; padding-left:3px; 14px/1.71 $gray-50; &::before { width:18px; height:18px; background transparent; border 2px solid $gray-200; border-radius 2px } }` checked: `::before { background $purple-400; border $purple-400 } ::after { 18×18 checkbox-white.svg 13×10 }`; focus unchecked `border 2px $gray-300; box-shadow 0 0 0 2px rgba(146,92,243,.5)`; disabled checked `$gray-400` fill.
- Custom radio (`form.scss:305-411`): 18×18 circle, `border 2px $gray-200`; checked `border $purple-400; bg $gray-700; inner 12×12 purple dot (svg circle r=3 fill $purple-400)`; hover unchecked shows dot preview + purple border; focus `box-shadow 0 0 0 2px rgba(146,92,243,.5)`.
- `.inline-edit-input { margin-bottom 0; border-radius 0; border none; padding-left 36px }` + `.inline-edit-input-group .input-group-append/prepend { cursor pointer; padding 0 10px } .destroy-icon svg { 14×16 }`.
- Toggle switch (`ui/toggleSwitch.vue`) exists for settings — not used on the tasks page.

### 4.4 Dropdown (`C/assets/scss/dropdown.scss`) — see §3.3 for dimensions. Summary: menu `radius 2px; shadow 0 3px 6px .16/.24; padding 0; border transparent`; item `padding 8px 0 8px 24px; 14px/1.71; color $gray-50; hover bg rgba($purple-600,.25) + color $purple-300`; open toggle `color $purple-200; border-color $purple-400`; caret `border-top-color var(--caret-color)` (purple-300 on hover), 5px sides; `.dropdown + .dropdown { margin-left 12px }`; `.dropdown-label { 14px bold 1.71; margins 20px }`.

### 4.5 Badge (`badge.scss`): see §1.5. `.badge-round { 1.5rem circle }`, `.badge-default { bg $gray-600; no shadow }`.

### 4.6 Modal (`modal.scss`, `taskModal.vue`, `deleteTaskConfirmModal.vue`)
- `.modal { z-index:1350 } .modal-content { border-radius:8px } .modal-dialog { margin:3rem auto } .modal-dialog .title { Roboto Condensed 20px bold 1.2 center $gray-50; margin-top 24px } .text { Roboto 14px/1.43 center $gray-100 }`.
- Backdrop `rgba-ish: opacity .9 of $purple-100`.
- Delete-confirm: `max-width:330px; centered; radius 8px; overflow hidden`; `.top-bar { height:8px; background:$maroon-100 }`; body `padding 0 24px 24px; align center`; alert icon 48×48 `#DE3F3F` at `margin-top 40px`; `h2 "Delete Habit" { margin-top 16px; $maroon-100; Roboto Condensed 700 20px }`; subtitle "Are you sure you want to delete this task?" `Roboto 700 14px/24px $gray-50; margin-top 12px`; buttons column gap 8px: `.btn.btn-danger` "Delete Habit" + text `.btn-cancel { $purple-300; 14px/24px; padding 8px 16px; hover underline }`.

### 4.7 Tooltip (`tooltip.scss`): no arrow; `.tooltip-inner { 12px/1.33; color #fff; padding 8px 12px; margin-top 8px; border-radius 4px; background rgba($gray-10,.96); shadow 0 2px 2px .16, 0 1px 4px .12 }`. Used via `v-b-tooltip.hover.top/bottom/right`.

---

## 5. ICONS (`C/assets/svg/`) used by tasks page + modal

| file | depicts | where | rendered size | Lucide suggestion |
|---|---|---|---|---|
| `positive.svg` (10×10) | plus, filled | habit +, create btn, checklist new row, tag new row | 10×10 | `plus` |
| `negative.svg` (10×2) | minus bar | habit − | 10×2 (10×10 box) | `minus` |
| `check.svg` (16×16) | bold checkmark | daily/todo control, selectList selected | 16×16 / .77rem | `check` |
| `checklist.svg` (12×8) | 3 bullet lines | checklist collapse pill | 12×8 | `list-checks` / `list` |
| `streak.svg` (12×8) | double right-pointing triangles ("fast-forward") | streak/counter | 11.6×7.1 | `fast-forward` |
| `calendar.svg` (14×14) | calendar | due date, datepicker button | 14×14 / 12×12 | `calendar` |
| `tags.svg` (14×14) | tag with hole | tags indicator | 14×14 | `tag` |
| `menu.svg` (4×16) | 3 vertical dots | task options toggle | 4×16 | `ellipsis-vertical` / `more-vertical` |
| `edit.svg` (16×16) | pencil | options → Edit | 16×16 | `pencil` |
| `top.svg` / `bottom.svg` (10×11) | arrow up/down with bar, stroke #686274 w2 | options → To top/bottom | 10×11 | `arrow-up-to-line` / `arrow-down-to-line` |
| `delete.svg` (14×16) | trash can | options → Delete, modal delete, checklist remove | 14×16 / 1rem | `trash-2` |
| `grip.svg` (10×16) | 6-dot grip (2 cols × 3) | checklist drag handle | 10×16 | `grip-vertical` |
| `drag_indicator.svg` (24×24) | 6-dot grip (Material) | tag editing drag handle | 20×20 | `grip-vertical` |
| `chevron.svg` (14×9) | chevron down, stroke #878190 w2.5 | checklist/advanced toggles | 16px | `chevron-down` |
| `filter.svg` (16×16) | 3 sliders (horizontal lines with knobs) | Tags filter button | 16×16 | `sliders-horizontal` |
| `habit.svg` (30×20) | two joined cards with + and − | column empty state, create dropdown | 30×20 | custom / `plus-minus`-ish (`diff`) |
| `daily.svg` (24×20) | calendar with dots grid | column empty state, create dropdown | 30×20 / 24×20 | `calendar-days` |
| `todo.svg` (20×20) | square with check | column empty state, create dropdown | 20×20 | `square-check` / `check-square` |
| `difficulty-trivial.svg` (16×16) | 4-point sparkle star | difficulty stars (repeated 1–4×) | 10×10 | `sparkle` / `star` |
| `information.svg` (16×16) | circle-i | difficulty info tooltip | 16×16 | `info` |
| `remove.svg` (7×7) | thin × stroke | tag pill remove | 8×8 | `x` |
| `close.svg` (16×16) | × polygon | datepicker clear, error snackbar | ~9px | `x` |
| `lock.svg` (10×12) | padlock | locked (challenge) fields — drop | 10×12 | `lock` |
| `for-css/alert.svg`, `alert-white.svg` | triangle/circle alert | delete-confirm icon, SPI warning, scheduling warning | 48 / 16 | `triangle-alert` |
| `for-css/checkbox-white.svg`, `checkbox-gray.svg` | check glyph 13×10 for custom checkbox | CSS `::after` | 13×10 | `check` |
| `for-css/bits.svg` | decorative pixel bits on navbar right | navbar bg | – | none |
| `for-css/search.svg`, `search_gray.svg` | magnifier (unused on tasks page; search box has no icon) | – | – | `search` |
| `for-css/positive.svg` | plus as CSS bg for new-tag input | filter panel edit mode | 10×10 | `plus` |
| `challenge.svg`, `broken-megaphone.svg`, `gold.svg`, `reward.svg` | challenge megaphone, coin, reward | drop | – | – |

All are single-path `fill-rule=evenodd` glyphs rendered with `.svg-icon { display:block; fill:currentColor }`; some carry hardcoded `fill="#878190"` (checklist, grip, information) or `stroke="#686274"` (top/bottom) — the `.color` modifier forces `currentColor`.

---

## 6. FONTS
- Loaded in `website/client/index.html:10`: `<link href="https://fonts.googleapis.com/css?family=Roboto+Condensed:400,400i,700,700i|Roboto:400,400i,700,700i" rel="stylesheet">`.
- Body: Roboto 14px/1.43 `$gray-50`.
- `h1,h2,h5,h6`: Roboto Condensed bold `$gray-10`; h1 24px/1.67 mb 24px; h2 20px/1.4 mb 16px. `h3,h4`: Roboto bold .875rem/1.71 (h3 `$gray-10`, h4 `$gray-100`).
- Task title: Roboto Condensed **normal** 16px/1.25 `$gray-10`.
- Task notes / small-text: Roboto 12px/1.33 (italic by default in `.small-text`, tasks force `font-style:normal`) `$gray-200` (notes `$gray-100`).
- Column title: h2 → Roboto Condensed bold 20px/1.4.
- Filter tabs: Roboto bold 12px/1.33.
- Buttons: Roboto bold 14px/1.714. Dropdown toggles: Roboto normal 14px/1.714.
- Modal labels: Roboto bold 14px/1.71; modal h2: Roboto Condensed bold 20px; modal small links 12px/1.33; delete link 14px/1.71.
- Checklist pill: 10px/1.2. Badge: 12px bold (purple column badge 10px/1.2).
- `.page-header { $purple-300; 24px bold 1.33 }`, `.sub-header { 20px bold 1.4 $gray-10 }` (settings pages).

---

## 7. FILTERS & SEARCH

- Search (`user.vue:22-27, 520-523`, `column.vue:728-749`): text input, throttled 250ms, lowercased; matches `task.text`, `task.notes`, or any `checklist[].text` (substring, case-insensitive). Applied after type filter and tag filter. Not persisted.
- Tag filter panel (`user.vue:41-193, 274-377`): toggled by the "Tags" button (button gets `.active` while any tag selected). Panel: `position:absolute; top:44px; left:20vw; width:100%; min-width:300px; max-width:50vw; z-index:9999; background #fff; border-radius:2px; box-shadow 0 2px 2px .16 / 0 1px 4px .12; padding 0 24px; font 14px/1.43`. Closes on `mouseleave` (throttled 250ms) unless editing. Sections `.tags-category` (`border-bottom 1px $gray-600; padding 24px 0`) for "Challenges" (if any), "Groups" (if any), "Tags": header `<strong>` + "Edit Tags" link (12px). Body: bootstrap row of `.col-6` custom checkboxes, label rendered as markdown, `margin-left:10px; word-break`. Toggling a checkbox applies immediately (`toggleTag → applyFilters`). Footer (`padding 16px 0`): left "Clear all filters" (`.btn-filters-danger { color:$red-50 }`), right "Cancel" (`$gray-300`). Edit mode: draggable list of inputs (`.tag-edit-input` bottom border `$gray-500`, focus `$purple-500`), drag handle `drag_indicator` 20×20 `#C3C0C7` → `#878190`, trash on hover, "New Tag" input with `+` bg-image, footer "Save Edits" (`$blue-10`) / "Cancel"; save → `user:set { tags }`.
- Tag filter semantics: AND — a task must contain **every** selected tag (`filterByTagList`, `column.vue:718-727`). Selected tags also seed new tasks (quick-add and modal create).
- Type filter persistence: `activateFilter(type, filter)` dispatches `user:set { 'preferences.tasks.activeFilter.<type>': filter }` (`column.vue:658-686`); on mount reads `user.preferences.tasks.activeFilter[type]` with `skipSave`. If the stored daily filter is empty string it defaults to `'due'` (this is the "dailyDueDefaultView" behavior — the identifier `dailyDueDefaultView` does not exist in the client; the default is hardcoded at `column.vue:674-678`). Habits default `all`, todos default `remaining`.
- `isDue` comes from the server (`server/libs/tasks/utils.js:102` `task.isDue = shouldDo(...)`), and the client also calls `COMMON/script/cron.shouldDo(today, task, prefs)` for the disabled-look decision.

---

## 8. INTERACTIONS & FEEDBACK
- Scoring: see §2.6. Color of the control strip changes immediately with `task.value` (150ms transition on `.task.transition` for border/shadow/color only — background changes are instant). Completed daily/todo leaves the "Due"/"Active" list on the next render; no exit animation, no delay. Sounds via `<audio>` if `preferences.sound` theme set (`Plus_Habit`, `Minus_Habit`, `Todo`, `Daily`).
- Optimistic UI: create (unshift), edit (assign), delete (splice), move (splice), checklist toggle, collapse — all update the store before the request.
- Errors: axios interceptor (`app.vue:205-280`) pushes `snackbars:add { title:'Habitica', text, type:'error', timeout:false }` (502 → auto-timeout). Snackbar container `position:fixed; right:10px; width:350px; z-index:999; top = navbar(56px)+banners − scroll`; max 4 visible; non-error ones auto-removed every 2500ms; item `max-width:330px; border-radius:4px; color #fff; padding 0 1rem; shadow 0 2px 2px .16 / 0 1px 4px .12; margin-bottom .5rem`; types: default/success `$green-50`, `info $blue-50`, `error $maroon-100` (click to dismiss, × icon 9px top-right at .5 opacity), enter/leave `opacity .25s ease-in` (`snackbars/notification.vue`, `snackbars/notifications.vue`). Keep only `error` (and maybe success).
- Keyboard: no global shortcuts. Cards/controls are `tabindex=0`; Enter on card → edit, Enter on control → score, Enter on filter tab → activate, Enter/Space on dropdown toggle. Esc closes select dropdowns (document `keyup` 27). Modal ignores Esc/backdrop (`no-close-on-esc`, `no-close-on-backdrop`).
- Delete: confirmation modal (§4.6) via `$root.$emit('habitica:delete-task-confirm', {message, taskType, resolve})` → promise; then `tasks:destroy` (splice + DELETE).
- No undo.
- Empty states: §1.5.
- Yesterdailies / "Welcome back!" modal (`yesterdailyModal.vue`, `components/notifications.vue:582-650`): on load and whenever `Date.now() > nextCron` (checked on `keydown`, throttled 1s), if `user.needsCron`, collect dailies that were due yesterday (`shouldDo(yesterday@dayStart)`), not completed, `yesterDaily === true`; if any, show `b-modal#yesterdaily` (`.modal-dialog { width: 22.625rem (362px) } content radius 8px`, header/footer hidden): `h1.header-welcome "Welcome back!" { color:$purple-200; margin-top:1rem; center }`, `p.call-to-action "Check off any Dailies you did yesterday:" { 14px bold center }`, `.tasks-list { radius 4px; bg $gray-600; padding 8px; overflow auto }` containing regular `<task>` cards with `is-yesterdaily` (clicking just toggles `completed` locally, no request), then `.start-day { margin: 1.5rem auto 1rem }` `.btn.btn-primary` "Start My New Day!" → `tasks:bulkScore([{id,direction:'up'}...])` then POST `/api/v4/cron` then refetch user+tasks. `isRunningYesterdailies` state hides task dropdowns and blocks edit while open. If none are due, cron runs silently. Next cron time = today/tomorrow at `preferences.dayStart` hour.

---

## 9. OTHER PAGES WORTH KEEPING (brief)
- **Settings → General** (`C/pages/settings/generalSettings.vue` + `settingRows/`): table rows `settings-label | settings-value | edit link` that expand inline (`inlineSettingMixin`) into a `.dialog-title` + disclaimer + input + Save/Cancel. Relevant rows:
  - `dayStartAdjustmentSetting.vue`: "Day Start Adjustment" select of 0–12 → labels `Default (12:00 AM)`, `+1 hours (1:00 AM)` … `+12 hours (12:00 PM)`; disclaimer "Habitica checks and resets your Dailies at midnight in your own time zone each day. You can adjust when that happens past the default time here."; shows next cron time and `UTC±hh:mm` computed from `getUtcOffset(user)`.
  - `dateFormatSetting.vue`: "Date Format" select `['MM/dd/yyyy','dd/MM/yyyy','yyyy/MM/dd']` → `preferences.dateFormat` (task cards use `.toUpperCase()` for moment).
  - `languageSetting`, `audioThemeSetting` (sound theme; off by default), `displayNameSetting`, `userNameSetting`, `userEmailSetting`, `passwordSetting`, `headerSettings` (sticky header toggle), `sleepMode`, `fixValuesSetting` (manually set task values/stats), `resetAccount`, `deleteAccount`.
  - Timezone: not user-editable; `preferences.timezoneOffset` is auto-synced from the browser on load (`user-main.vue:272-278`).
- **Settings → Site Data** (`siteData.vue` + `siteDataRows/`): `userIdRow` (User ID + copy), `apiRow` (API token), `userDataRow` "Data export": links `/export/history.csv` (task history CSV), `/export/userdata.xml`, `/export/userdata.json`; `webhooksRow` (webhook CRUD), `developerModeRow` (enables task alias field), `privacyPreferencesRow`.
- **Task summary modal** (`taskSummary.vue`): read-only view for non-editable tasks — drop.
- `notificationSettings.vue` (email/push prefs) — drop.

---

## 10. WIREFRAMES

### Tasks page (≥992px)
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ▓▓ NAVBAR  #432874  h56  [logo] Tasks  Inventory▾  Social▾ …                 (icons) [avatar▾] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ (app-header: avatar + stats + party — DROPPED)                                            │
├──────────────────────────────────────────────────────────────────────────────────────────┤ bg #F9F9F9
│ pad 16px top, 12px sides                                                                  │
│                    [ Search........................ ] [⩸ Tags ▾]        [+ Add Task] ←abs │
│                                                        ↓ (panel)              ↓ 140px     │
│                                                   ┌────────────┐          ┌──────────┐    │
│                                                   │ Tags  Edit │          │ ⊞ Habit  │    │
│                                                   │ ☐ work ☐ x │          │ ▦ Daily  │    │
│                                                   │ Clear│Canc │          │ ☑ To Do  │    │
│ mb 20px                                           └────────────┘          └──────────┘    │
│ ┌ col-lg-3 ───────────┐ ┌ col-lg-3 ───────────┐ ┌ col-lg-3 ───────────┐ ┌ col-lg-3 (Rewards, drop) ┐
│ │ Habits (3)  All Weak Strong │ Dailies (2) All Due NotDue │ To Do's (4) Active Sched Complete │
│ │ ┌ .tasks-list #EDECEE r4 p8 ─┐│ ┌────────────────────┐ │ ┌────────────────────┐ │
│ │ │[Add a Habit          ]     ││ │[Add a Daily      ] │ │ │[Add a To Do      ] │ │
│ │ │┌─┬──────────────────┬─┐    ││ │┌─┬───────────────┐ │ │ │┌─┬───────────────┐ │ │
│ │ ││+│ Title        ⋮   │−│    ││ ││☐│ Title      ⋮  │ │ │ ││☐│ Title     ⋮   │ │ │
│ │ ││ │ notes            │ │    ││ ││ │ notes         │ │ │ ││ │ ▸2/5          │ │ │
│ │ ││ │        ⏩+2 | -1 🏷│ │    ││ ││ │       ⏩ 12  🏷│ │ │ ││ │ 📅 Today   🏷 │ │ │
│ │ │└─┴──────────────────┴─┘    ││ │└─┴───────────────┘ │ │ │└─┴───────────────┘ │ │
│ │ │   (2px gap)                ││ │                    │ │ │                    │ │
│ │ │                            ││ │      ▦             │ │ │                    │ │
│ │ │                            ││ │ These are your     │ │ │                    │ │
│ │ │                            ││ │ Dailies            │ │ │                    │ │
│ │ │                            ││ │ small grey desc    │ │ │                    │ │
│ │ └────────────────────────────┘│ └────────────────────┘ │ └────────────────────┘ │
│ └ min-height 556px ─────────────┘                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```
768–991px: 2 columns per row; <768px: single column, columns stacked, filter panel full width.

### Task card (habit, width = column inner)
```
 ◄40px►◄──────────── flex 1 ────────────────────►◄40px►
┌──────┬────────────────────────────────────────┬──────┐  radius 4px, shadow, mb 2px
│ #24CC8F (value color)                          │      │
│ pt16 │ pt4 pl12                        mr4 pt? │ pt16 │
│  ╭──╮│ Title (Roboto Cond 16px, #34313A)   ⋮  │ ╭──╮ │  ⋮ = 4×16 dots, visible on hover only
│  │+ ││ pb4 (8 if no notes)                     │ │− │ │  circles 28px, radius 100px,
│  ╰──╯│ notes (12px #686274, pr20)              │ ╰──╯ │  bg rgba(0,0,0,.25), glyph white 10px
│      │ [▸ 2/5]  checklist pill (10px) (d/t only)│      │  disabled side: bg #EDECEE,
│      │ ☐ item  ☑ ~~done~~ (14px)               │      │  circle border 1px #A5A1AC, glyph #878190
│      │ px8 mt4: 📅 09/28  ……  ⏩ +2 | -1   🏷   │      │
│ min-h 60 │ pb7                                 │min-h56│
└──────┴────────────────────────────────────────┴──────┘
Daily/todo: left strip only; control is a 28px square (radius 2px, bg rgba(255,255,255,.5)),
check glyph 16px in the dark tone shows on hover or when completed; right edge of body rounded.
Completed/not-due: strip #878190, body #EDECEE, title/notes opacity .75.
```

### Task modal (448px)
```
┌────────────────────────────────────────────────┐ radius 8px, backdrop #432874 @ .9
│ HEADER bg = purple-300 (create) / value tone (edit), p24            │
│ Create Daily                              Cancel  [ Create ]        │  h2 white; Create = white btn-secondary
│ Title*                                  ⚠ Avoid SPI                 │  labels bold 14px
│ [ Add a title                                   ]  h32 bg #fff@.5   │
│ Notes                          Markdown formatting help             │
│ [ Add notes                                     ]  h56              │
├────────────────────────────────────────────────┤
│ BODY white, px24                                                    │
│ Checklist                                    ⌄                      │
│  ⠿ ☐ [item text                        ]   🗑                       │  rows 32px, hairline #E1E0E3
│    + [New checklist item              ]                             │
│ Difficulty ⓘ                                                       │
│ [ Easy                                ✦✦    ▾ ]                    │  select-list, stars right, 10px
│ Start Date                                                          │
│ [ 09/28/2026                             📅 ]                       │
│ Repeats                                                             │
│ [ Weekly                                   ▾ ]                     │
│ Repeat Every                                                        │
│ [ 1            ]  [ week ]                                          │
│ Repeat On                                                           │
│ [Su][Mo][Tu][We][Th][Fr][Sa]   ← joined toggle buttons, checked = #6133B4/white │
│ Repeats every week on Monday, Wednesday   (12px)                    │
│ Tags                                                                │
│ [ (work ×) (home ×)   or "Add tags..."        ▾ ]                   │
│ ┌ Advanced Settings (bg #F9F9F9, full-bleed)             ⌄ ┐        │  edit only
│ │ Adjust Streak   [⏩ | 12          ]                       │        │
│ └───────────────────────────────────────────────────────────┘        │
│                    🗑 Delete this Daily   (#C92B2B)                  │  edit only
│                    [   Create   ]  (btn-primary)                     │  create only
└────────────────────────────────────────────────┘
Habit body: (+) Positive  (−) Negative circles 40px | Difficulty | Tags | Reset Counter [Daily▾] | Adv: Adjust Counter [+|n] [−|n]
To Do body: Checklist | Difficulty | Due Date [ 📅 ] (× clear) | Tags
```
