# 03 — Server API surface: tasks, tags, user preferences, auth, validation, webhooks

Source root: `website/server/` (paths below are relative to the Habitica repo root). Line numbers are from the checked-out tree.

Routing: every controller exports `{ method, url, middlewares, handler }` objects; `libs/routes.js:15-60` mounts them. `/api/v3` mounts `controllers/api-v3/*` (`middlewares/appRoutes.js:31-36`). `/api/v4` mounts the same v3 controllers minus an override list, plus `controllers/api-v4/*` (`appRoutes.js:42-67`). The web client only talks to `/api/v4` (`website/client/src/store/actions/tasks.js`). Everything below applies identically to both prefixes unless stated.

---

## 1. Task endpoints (`controllers/api-v3/tasks.js`, `libs/tasks/index.js`, `libs/tasks/utils.js`, `models/task.js`)

### Shared plumbing

- **Lookup by id or alias** — `Task.findByIdOrAlias(identifier, userId, additionalQueries)` `models/task.js:190-210`. If `identifier` is a UUID → `{ _id }` (no userId filter; ownership checked afterwards by the handler). Otherwise → `{ userId, alias: identifier }`. Aliases are therefore scoped per user. Bulk variant `findMultipleByIdOrAlias` `:212-250`.
- **Ownership check** — `verifyTaskModification(task, user, group, challenge, res)` `libs/tasks/index.js:348-364`: for a plain user task, `task.userId !== user._id` → 404 `NotFound` (deliberately not 403, to avoid leaking existence).
- **Sanitize** — `Task.sanitize(obj)` comes from `libs/baseModel.js:53-60`: `_.unset`s every path in `noSet` (`['createdAt','updatedAt'] + ['challenge','userId','completed','history','dateCompleted','_legacyId','group','isDue','nextDue']`, `models/task.js:160`) then runs `sanitizeTransform` (`:161-185`):
  - `value` is deleted unless `type === 'reward'`; reward value is `Math.floor`ed if non-integer.
  - `priority` is parsed with `parseFloat(...).toFixed(1)` (becomes a *string* like `"1.5"`; mongoose casts it back to Number).
  - `attribute === null` → `'str'`.
  - Note: `text`, `type`, `_id` are NOT stripped by sanitize; `updateTask` op strips `_id`/`id`/`type` separately (below).
- **Post-response side effects**: webhooks are fired after `res.respond` (`tasks.js:217-222`, `685-688`, `962-966`, `1438-1441`).

### `GET /tasks/user` — list user tasks (`tasks.js:376-398`, `getTasks` `libs/tasks/index.js:142-319`)

- Auth: `authWithHeaders({ leanUser: true, userFieldsToInclude: ['tasksOrder'] })`.
- Query params, validated with express-validator (`:384-390`):
  - `type` optional, one of `habits|dailys|todos|rewards|completedTodos|_allCompletedTodos` (`_allCompletedTodos` marked BETA and identical to `completedTodos` server-side: `index.js:205`). Invalid → 400.
  - `history` optional boolean; anything other than the literal string `'false'` includes history (`:395`); `false` drops the `history` field via projection (`index.js:241-244`).
  - `dueDate` optional; passed to `setNextDue(task, user, dueDate)` for every returned task (`index.js:258-262`). No format validation (`utils.js:83` "@TODO Add required ISO format").
- Query construction (`index.js:199-239`):
  - `todos` → `{type:'todo', completed:false}`.
  - `completedTodos` → `{type:'todo', completed:true}`, `sort {dateCompleted:-1}`, `limit=0` (unlimited; the "30 most recent" in the apidoc is stale — retention is enforced by cron which deletes completed todos older than 30 days / 90 for subscribers, `libs/cron.js:444-453`).
  - other types → `{type: type.slice(0,-1)}`.
  - no type → all habits/dailys/rewards + uncompleted todos.
- Ordering (`index.js:264-318`): result is sorted by `user.tasksOrder[<type>s]`. Ids in `tasksOrder` that no longer match a task are pruned; tasks missing from `tasksOrder` are appended to the end and pushed into `tasksOrder`; if anything changed the owner document is persisted via `updateOne({tasksOrder})` (`:304-314`). `completedTodos` is returned unordered (`:284-286`). Self-healing side effect on a GET.
- Response: `data` = array of lean task objects with `id` copied from `_id` and `__v` removed (`:252-255`).

### `POST /tasks/user` — create (`tasks.js:207-224`, `createTasks` `index.js:43-128`)

- Body: single task object **or array** of task objects (`index.js:52`). Empty array → `[]` (`:55`).
- Per task: `type` must be in `['habit','daily','todo','reward']` else 400 `invalidTaskType` (`:61`). `new Tasks[type](Task.sanitize(taskData))` (`:64`), `userId = user._id` (`:73`). For dailies `startDate = normalizeDailyStartDate(startDate, user)` (`:83-85`, `utils.js:62-75`: unless it "looks like local midnight" (sec=0, ms=0, minute ∈ {0,15,30,45}) it is snapped to start-of-day in the user's tz). `setNextDue(newTask, user)` (`:87`). `validateSync()` errors thrown immediately (`:93-94`) so nothing is half-saved.
- Order: new ids are `unshift`ed to the top of `tasksOrder.<type>s` via `$push { $each, $position: 0 }` (`:97-112`).
- Aliases validated async after order update: duplicates within the batch → 400 `taskAliasAlreadyUsed`; each aliased task runs full `validate()` (async uniqueness check) (`utils.js:10-22`).
- All tasks then saved with `validateBeforeSave: false` in parallel with `owner.save()` (`:119-125`).
- Response: **201**, `data` = single object if exactly one task was created, otherwise array (`tasks.js:215`). Webhook `taskActivity/created` per task.
- Errors: 400 `BadRequest` with mongoose `errors[]` (see §5), 400 `invalidTaskType`.

### `GET /tasks/:taskId` (`tasks.js:497-532`)

- `taskId` = `_id` or alias. Plain user task: `task.userId !== user._id` → 404. Response 200, `data` = task document JSON (`toJSON` transform adds `id`, drops `__v`).

### `PUT /tasks/:taskId` — update (`tasks.js:588-691`)

- `taskId` required, not-empty (`:595`). 404 if not found.
- Merge logic: `common.ops.updateTask(task.toObject(), req)` `website/common/script/ops/updateTask.js:5-35`:
  - `reminders`, `checklist`, `tags` in body **replace** the arrays wholesale (`:9-21`).
  - Everything else is `lodash.merge`d after `omit(body, ['_id','id','type','reminders','checklist','tags'])` (`:23`). Consequence: `type` can never change; nested objects (`repeat`) are deep-merged, so `{"repeat":{"m":false}}` only flips Monday.
  - Empty `daysOfMonth` / `weeksOfMonth` arrays are explicitly honoured (`:26-32`) because `merge` would otherwise keep old entries.
- Then `Task.sanitize(updatedObj)` (`tasks.js:639`) — so `completed`, `history`, `dateCompleted`, `userId`, `challenge`, `group`, `isDue`, `nextDue`, `createdAt`, `updatedAt` from the body are dropped, `value` dropped unless reward, `priority` normalized. (Challenge-linked / group-linked user tasks are restricted to a whitelist via `sanitizeUserChallengeTask` / `sanitizeUserGroupTask` `models/task.js:254-272`: `streak, checklist, attribute, reminders, tags, notes, collapseChecklist, alias, yesterDaily, counterDown, counterUp` — irrelevant for a clone but shows what the authors consider "user-local" fields.)
- `assign(task, sanitizedObj)` (`:642`). For dailies with `startDate`: normalized again; if `frequency==='monthly' && daysOfMonth.length` then `daysOfMonth = [dayOfMonth(startDate in user tz)]` (`:663-672`); `streak` defaulted to 0 and truncated (`:673-674`).
- `setNextDue(task, user)`, `task.save()` (full mongoose validation incl. async alias uniqueness), response 200 `data` = saved task. Webhook `taskActivity/updated`.
- Effectively editable fields for a user task: `text, notes, alias, tags, priority, attribute, reminders, value (reward only), collapseChecklist, checklist, date (todo), frequency, everyX, startDate, repeat, streak, daysOfMonth, weeksOfMonth, yesterDaily, up, down, counterUp, counterDown, byHabitica`. Protected: `_id, id, type, userId, completed, dateCompleted, history, challenge, group, isDue, nextDue, createdAt, updatedAt`.
- Note: `completed` cannot be set by PUT; it only changes through scoring. Web client sends the whole edited task minus `history` (`client/src/store/actions/tasks.js:132-133`).

### `DELETE /tasks/:taskId` (`tasks.js:1387-1444`)

- 404 if not found/not owned. If task is not a completed todo: `$pull` from `tasksOrder.<type>s` and `user._v += 1` manually (`:1416-1428`, comment: version can't be bumped in an update hook). Response 200 `data: {}`. Webhook `taskActivity/deleted` (payload includes the deleted task).

### `POST /tasks/:taskId/score/:direction` (`tasks.js:732-756`; `scoreTasks` `index.js:529-613`; `scoreTask` `:416-527`)

- `direction` ∈ `up|down` else 400 `directionUpDown`; id must be string (`index.js:537-540`). Multiple ids resolved in one query (`:546`). Nothing found → 404.
- Guard (`:417-431`): for daily/todo, `completed && up` or `!completed && down` → **401 NotAuthorized `sessionOutdated`** (i.e., double-click / stale client).
- Scoring math is `common.ops.scoreTask` (other agent). Structural side effects we care about (`:482-508`): todo becoming completed → `$pull` from `tasksOrder.todos`; todo un-completed → `$push` back (`:588-602`). `setNextDue(task, user)` after scoring.
- Saves `user` and every modified task in parallel (`:576-604`).
- Response 200 `data` = `{ delta, _tmp, ...user.stats }` (`tasks.js:747-754`). **The task itself is not returned.** Client re-derives state locally. For a clone: return the task (and, if kept, `delta`).
- Webhook `taskActivity/scored` with `{ type:'scored', direction, delta, task, user:{_id,_tmp,stats} }` (`libs/webhook.js:121-151`).
- **Bulk**: `POST /api/v4/tasks/bulk-score` (`controllers/api-v4/tasks.js:53-67`), body `[{ id, direction }, ...]`, response `{ tasks:[{id, delta, _tmp}], ...stats }`. Fails atomically-ish: any error aborts before any save (`index.js:564-573`).

### `POST /tasks/:taskId/move/to/:position` (`tasks.js:779-849`, `moveTask` `utils.js:42-60`)

- `position` numeric; `0` = top, `-1` = bottom; a position beyond the end pushes to end. Completed todos → 400 `cantMoveCompletedTodo` (`:814`) — completed todos are not in `tasksOrder` at all.
- Two Mongo ops because `$pull` and `$push` on the same field can't share one update (`:823-837`). `user._v += 1` manually (`:843-845`).
- Response 200 `data` = the new ordered id array for that type.

### Checklist

- `POST /tasks/:taskId/checklist` (`:880-914`) body `{ text, completed? }`; `Task.sanitizeChecklist` only deletes `id` (`models/task.js:275-278`), so the server assigns the UUID. Only daily/todo else 400 `checklistOnlyDailyTodo`. Response = full task.
- `PUT /tasks/:taskId/checklist/:itemId` (`:990-1024`) `itemId` must be UUID; `merge(item, sanitizeChecklist(body))`. 404 `checklistItemNotFound`. Response = full task.
- `DELETE /tasks/:taskId/checklist/:itemId` (`:1051-1083`). Response = full task.
- `POST /tasks/:taskId/checklist/:itemId/score` (`:929-968`) toggles `item.completed`. Uses lean user; ownership check is 400 "Cannot score task belonging to another user." (`:946-947`). Response = full task. Webhook `taskActivity/checklistScored` with `{ type, task, item }`.
- Checklist item schema (`models/task.js:358-366`): `{ id: uuid (default generated, required), text: String default '' (may be empty), completed: Boolean default false, linkId: String }`. No `_id`.

### Tags on tasks

- `POST /tasks/:taskId/tags/:tagId` (`:1113-1141`): `tagId` must be a UUID **and** `isIn(user.tags.map(t=>t.id))` (`:1121-1122`) → 400 otherwise. Duplicate → 400 `alreadyTagged`. Lookup uses `{ userId: user._id }` extra filter. Response = full task.
- `DELETE /tasks/:taskId/tags/:tagId` (`:1170-1194`): missing tag on task → 404 `tagNotFound`. Response = full task.
- Note: `tags` set via `PUT /tasks/:id` is only validated as "array of UUIDs" (`models/task.js:92-95`); existence on the user is **not** checked on PUT/POST create — only on the dedicated add-tag route.

### `POST /tasks/clearCompletedTodos` (`:1335-1366`)

- `deleteMany({ userId, type:'todo', completed:true, <not linked to live challenge/group> })`. Response `data: {}`. Does not touch `tasksOrder` (completed todos aren't in it). No webhook.

### Unlink routes (`/tasks/unlink-all/:challengeId`, `/tasks/unlink-one/:taskId`, `:1217-1318`) — challenge-only, skip.

---

## 2. Tag endpoints (`controllers/api-v3/tags.js`, `models/tag.js`)

Tags are an **embedded array on the user document** (`models/user/schema.js:712 tags: [TagSchema]`), not a collection.

Tag schema (`models/tag.js:8-23`): `{ id: String uuid (default generated, required, validated), name: String required, challenge: Boolean, group: String }`, `_id:false`. `sanitize` strips `_id, challenge, group, createdAt, updatedAt` (`:25-28`); `id` is settable on create, stripped on update via `sanitizeUpdate` (`:31-34`, though the controller actually calls plain `sanitize` at `tags.js:150` — so `id` could in theory be overwritten on PUT; a bug).

| Route | File:line | Behaviour |
|---|---|---|
| `POST /tags` | `tags.js:40-54` | body `{ name, id? }`; `user.tags.push(Tag.sanitize(body))`, `user.save()`; **201** `data` = new tag `{id,name}`. Missing name → 400 mongoose ValidationError. |
| `GET /tags` | `:69-77` | 200, `data` = `user.tags` array in stored order. |
| `GET /tags/:tagId` | `:95-111` | `tagId` UUID; 404 `tagNotFound`. |
| `PUT /tags/:tagId` | `:133-155` | `_.merge(tag, Tag.sanitize(body))`; 200 data = updated tag. |
| `POST /reorder-tags` | `:175-198` | body `{ tagId, to }` (both required, not-empty); splice out, splice in at `to`; 200 `data: {}`. (The task prompt said `tags/reorder`; actual path is `/reorder-tags`.) |
| `DELETE /tags/:tagId` | `:215-250` | `user.updateOne({$pull:{tags:{id}}})`, `user._v += 1`, then **`Task.updateMany({userId}, {$pull:{tags: id}})`** — cascades removal from every task of that user (`:240-246`). 200 `data: {}`. |

Also: `PUT /user` with body key `tags` replaces the whole tag list and cascades `$pull` for removed ids (`libs/user/index.js:196-232`).

Default tags on registration come from `common.content.userDefaults.tags` (`models/user/hooks.js:66-75`).

---

## 3. User endpoints that matter (`controllers/api-v3/user.js`, `libs/user/index.js`, `models/user/schema.js`)

### `GET /user` (`user.js:84-91`, `libs/user/index.js:15-36`)

- Optional `?userFields=a,b.c,-d` comma list applied as a Mongo projection by the auth middleware (`middlewares/auth.js:22-54`); `_id,_v,notifications,preferences,auth,flags,permissions` are always loaded.
- Response `data` = `user.toJSON()` (v3 adds inbox messages) with `apiToken` deleted (`index.js:26`), and if no `userFields`: `needsCron: Boolean` (`daysUserHasMissed(...) > 0`, `:28-32`) plus computed stats.
- Private fields never serialized (`models/user/hooks.js:30`): `auth.local.hashed_password, auth.local.passwordHashMethod, auth.local.salt, _cronSignature, _ABtests, secret, profile.flags`. `toJSON` also adds `auth.local.has_password` (`:44-48`).

### `PUT /user` (`user.js:209-216`, `libs/user/index.js:38-260`)

- Body is a **flat map of dotted paths → values** (`_.each(req.body, (val,key)=>…)`, `:187`). Nested objects are not walked.
- Allowed roots (`updatablePaths` `:38-62`): `_ABtests.counter`, `flags.{customizationsNotification,showTour,tour,tutorial,communityGuidelinesAccepted,welcomed,cardReceived,warnedLowHealth}`, `achievements`, `party.{order,orderAscending,quest.completed,quest.RSVPNeeded,seeking}`, **`preferences`**, `profile`, `stats`, `inbox.optOut`. Expanded to every *leaf* schema path under those roots (`:66-72`), minus `restrictedPUTSubPaths` = `stats.class, preferences.disableClasses, preferences.sleep, preferences.webhooks` (`:74-84`).
- Special keys: `tags` (array replace + cascade), `flags.newStuff`, `preferences.tasks.mirrorGroupTasks` (must be array of groups the user belongs to), `party.seeking`, `profile.name` (≤30 chars, no newline, slur filter), `profile.blurb`.
- Anything else → **401 NotAuthorized** `messageUserOperationProtected` ("path `x` was not saved, as it's a protected path."). **`tasksOrder` is NOT updatable via `PUT /user`** — it's only mutated by task create/delete/move/score.
- Response 200 `data` = full user JSON (same as GET).
- Preference fields relevant to a clone, with schema types/defaults (`models/user/schema.js:546-659`):
  - `dayStart: Number, default 0, min 0, max 23` (`:547-549`)
  - `timezoneOffset: Number, default 0` (`:562`) — **sign convention: minutes *behind* UTC, i.e. `-moment().utcOffset()`** (`common/script/fns/getUtcOffset.js:10-12`, client `libs/auth.js:26-27`). Also `timezoneOffsetAtLastCron: Number` (`:565`).
  - `language: String` (`:566`)
  - `dateFormat: enum ['MM/dd/yyyy','dd/MM/yyyy','yyyy/MM/dd'], default 'MM/dd/yyyy'` (`:571`)
  - `sleep: Boolean default false` (`:572`) — not settable via PUT; toggled by `POST /user/sleep` (`user.js:409`).
  - `hideHeader: Boolean false` (`:559`), `stickyHeader: Boolean true` (`:573`)
  - `newTaskEdit: Boolean false` (`:575`)
  - `dailyDueDefaultView: Boolean false` (`:577`, comment: "not used anymore, now the current filter is saved in preferences.activeFilter" — but the actual field is `preferences.tasks.activeFilter`)
  - `advancedCollapsed: Boolean false` (`:579`, "deprecated, unused"), `toolbarCollapsed: Boolean false` (`:580`)
  - `reverseChatOrder: Boolean false` (`:581`)
  - `developerMode: Boolean false` (`:582`)
  - `tasks.groupByChallenge: Boolean false` (`:637`, "@TODO remove? not used"), `tasks.confirmScoreNotes: Boolean false` (`:638`, same), `tasks.mirrorGroupTasks: [uuid]` (`:639-641`), `tasks.activeFilter: { habit:'all', daily:'all', todo:'remaining', reward:'all' }` (`:642-647`) — persisted per-type list filter.
  - `analyticsConsent: Boolean` (`:658`)
  - `emailNotifications.*`, `pushNotifications.*` booleans (`:593-629`), `suppressModals.*` (`:630-635`).

### `POST /user/custom-day-start` (`user.js:1618-1635`)

- Body `{ dayStart }` (0-23, enforced by schema `min/max` → 400 "User validation failed"). Sets `preferences.dayStart` **and `user.lastCron = new Date()`** (`:1627`) so changing CDS never triggers a retroactive cron. Response `data: { message }`.

### `POST /user/reset` (`user.js:1585-1592`, `libs/user/index.js:262-281`) — note only: deletes all user tasks not linked to challenge/group and resets stats via `common.ops.reset`. Skip.

### Auth-related user routes (`controllers/api-v3/auth.js`, `libs/auth/index.js`)

- `POST /user/auth/local/register` (`auth.js:48-57` → `registerLocal` `libs/auth/index.js:82-222`), `authWithHeaders({optional:true})` (so a social user can attach local creds). Body `{ username, email, password, confirmPassword }`. Validation (`:85-111`): username 1-20 chars matching `/^[-_a-zA-Z0-9]+$/`; email `isEmail`; password 8-64 (`common/script/constants.js:33-34`) and `equals confirmPassword`. `verifyUsername` (`libs/user/validation.js:50-61`) adds slur/forbidden-name checks. Email lowercased; `lowerCaseUsername` stored for uniqueness (`:125-135`); duplicate → 401 `usernameTaken`/`emailTaken`. Creates `auth.local = { username, lowerCaseUsername, email, hashed_password (bcrypt), passwordHashMethod:'bcrypt' }`, `preferences.language = req.language`. Response **201** full user JSON + `newUser: true` — **includes `apiToken`** (only place besides login/password change). `x-client` header decides which default tasks are seeded (`:182`).
- `POST /user/auth/local/login` (`auth.js:74-131`), no auth middleware. Body `{ username, password }` (trimmed). `username` may be an email (`isEmail` → lookup lowercase email) or username (case-sensitive exact match on `auth.local.username`, `:99-103`). Any failure → 401 `invalidLoginCredentialsLong`. sha1→bcrypt upgrade on success (`:122-124`). Sets `auth.timestamps.updated`. Response (`libs/auth/utils.js:33-39`): `data = { id, apiToken, newUser:false, username }`.
- `PUT /user/auth/update-username` (`auth.js:198-260`): body `{ username, password? }`; verifies password only if supplied (!). Response `{ username }`.
- `PUT /user/auth/update-password` (`:274-327`): body `{ password, newPassword, confirmPassword }`; newPassword 8-64; **rotates `apiToken = uuid()`** (`:318`) and clears reset code. Response `{ apiToken }`.
- `PUT /user/auth/update-email` (`:406-445`): body `{ newEmail, password }`; email uniqueness checked case-insensitively; response `{ email }`.
- `POST /user/reset-password` / `POST /user/auth/reset-password-set-new-one` (`:339`, `:459`): email code flow, encrypted `{userId, expiresAt}` stored in `auth.local.passwordResetCode` (`libs/password.js:70-100`); setting a new password also rotates `apiToken` (`auth.js:495`).
- There is **no `reset-api-token` route** anywhere in `controllers/` (grep). Token rotation happens only via password change/reset. (Admin route `hall.js:500` can rotate another user's token.)

### User model fields of interest (`models/user/schema.js`)

- `apiToken: String, default: shared.uuid` (`:41-44`) — plaintext UUID v4, compared with `!==` (`middlewares/auth.js:103`).
- `auth.timestamps: { created, loggedin, updated }` all `Date default Date.now` (`:91-95`). `updated` is bumped on **every authenticated request** in the auth middleware (`auth.js:125`, `161`) — but only persisted if something else saves the user. `loggedin` is set only by cron (`libs/cron.js:482`); i.e. it means "last day rollover", not "last login". (`methods.js:398` reads `timestamps.loggedIn` with capital I — always `undefined`; latent bug.)
- `_v: Number default 0` (`:100`) — see §5.
- `lastCron: Date default now` (`:471`), `_cronSignature: String default 'NOT_RUNNING'` (`:472`) — lock; set to epoch-ms while cron runs, retry allowed after 5 min (`libs/cron.js:389-418`). Private in JSON.
- `needsCron` is **not stored**; computed on `GET /user` (`libs/user/index.js:28-31`). Cron itself is client-triggered: web client `POST /api/v4/cron` when `user.needsCron` (`client/src/components/notifications.vue:645`; server `controllers/api-v3/cron.js:16-24`). Timezone drift is read from request header `x-user-timezoneOffset` (`methods.js:384`, client `libs/auth.js:27`).
- `tasksOrder: { habits:[String], dailys:[String], todos:[String], rewards:[String] }` (`:720-725`). Note the plural key `dailys`.
- `tags: [TagSchema]` (`:712`), `webhooks: [WebhookSchema]` (`:735`), `pushDevices` (`:730`).
- `flags.lastNewStuffRead` — skip per instructions.

---

## 4. AUTH

### API auth (`middlewares/auth.js:67-135`, `authWithHeaders(options)`)

- Headers: `x-api-user` (user `_id`, UUID), `x-api-key` (`user.apiToken`), `x-client` (free-form; if `ENFORCE_CLIENT_HEADER=true` missing → 400 `missingClientHeader`, `:75-77`). Official values: `habitica-web`, `habitica-ios`, `habitica-android` (`:18`); other values stamp `flags.thirdPartyTools` at most daily (`:126-130`).
- Missing either header → 401 `missingAuthHeaders` unless `options.optional` (`:79-82`).
- `User.findOne({_id})` with projection from `getUserFields` (`:22-54`, apiToken force-included `:88-90`), optional `.lean()`. Mismatch → `InvalidCredentialsError` (401, `error: 'invalid_credentials'`, `libs/errors.js:137-143`; the apidoc says clients should treat this code as "log out now").
- `auth.blocked` → 401 `accountSuspended` (`:110-120`).
- Sets `res.locals.user`, **`req.session.userId = user._id`** (`:123`) — every header-auth request also refreshes the cookie session.
- Users without `preferences.analyticsConsent` get `req.headers['x-api-user']` rewritten to `'Private'` for logging (`:106-108`).

### Session auth (`authWithSession`, `auth.js:138-165`)

- Reads `req.session.userId` from `cookie-session` (`middlewares/index.js:115-121`: cookie name `connect:sess`, secret `SESSION_SECRET`, `httpOnly`, `maxAge` 10 years, **not `secure`**, TODO in source). Falls back to header auth if headers are present. Used only by a few top-level/OAuth routes; **all `/api/v3` and `/api/v4` routes use `authWithHeaders`** (grep: every `middlewares:` in `controllers/api-v3/*.js` is `authWithHeaders`). The web client stores `{auth:{apiId, apiToken}}` in `localStorage['habit-mobile-settings']` and sets the two headers globally on axios (`client/src/libs/auth.js:4-33`).

### Passwords (`libs/password.js`)

- `bcrypt` (npm `bcrypt ^5.1.1`), `BCRYPT_SALT_ROUNDS = 10` (`:8`). Legacy `sha1` HMAC with 10-char hex salt still supported and upgraded lazily on login/update (`:22-67`). `passwordHashMethod ∈ ['bcrypt','sha1']` (`schema.js:83-86`).

### Rate limiting (`middlewares/rateLimiter.js`, `middlewares/appRoutes.js:14-16,33-36,61-67`)

- `rate-limiter-flexible` with Redis (memory in tests). Key = `x-api-user` header value **unauthenticated/unverified** (`:96`) else `req.ip`. v3: 30 points/60 s; v4: 200 points/60 s. Costs: register 10 (v4 15), login 10, unauthenticated request 5, otherwise 1. Headers `X-RateLimit-Limit/Remaining/Reset`, `Retry-After`; 429 `TooManyRequests`. Redis failure → limiter bypassed (`:121-126`). Disabled unless `RATE_LIMITER_ENABLED=true`.

### What a clean design should do differently

- Habitica's `apiToken` is a single plaintext UUID per user, stored and compared in plaintext, returned in login/register, rotated only on password change, and doubles as the web session credential. Replace with: multiple named, long-lived tokens per user (`{ id, name, prefix, hash, createdAt, lastUsedAt, expiresAt? }`), random ≥32 bytes, **stored hashed** (SHA-256 is fine for high-entropy tokens; constant-time compare), shown once at creation, revocable individually; separate short-lived session (httpOnly + Secure + SameSite cookie) for the web client. Keep the `x-api-user` + `x-api-key` header pair (or `Authorization: Bearer`) for tool compatibility if desired.
- Rate limit keyed on the *verified* user id after auth, not on an unverified header.
- Don't mutate `req.session` on header auth.
- Don't do write side effects (tasksOrder self-heal, `thirdPartyTools` stamp, `timestamps.updated`) on read paths.
- `x-client` is useful telemetry; make it optional.

---

## 5. Response envelope, errors, `userV`

### Success (`middlewares/response.js:3-26`)

```json
{ "success": true, "data": <any>, "message"?: "...", "notifications"?: [...], "userV"?: <int>, "appVersion": "<package.json version>" }
```
`notifications` and `userV` are present whenever `res.locals.user` exists (i.e., any authenticated route). `success = status < 400`. `res.respond(status=200, data={}, message)`.

### Error (`middlewares/errorHandler.js:15-98`)

```json
{ "success": false, "error": "<code or class name>", "message": "<text>", "errors"?: [ ... ] }
```
- `error` is `responseErr.code || responseErr.name`: `BadRequest` (400), `NotAuthorized` (401), `invalid_credentials` (401, InvalidCredentialsError), `Forbidden` (403), `NotFound` (404), `RequestTimeout` (408), `TooManyRequests` (429), `InternalServerError` (500, message always generic).
- express-validator failures → 400, `message: "Invalid request parameters."`, `errors: [{ message, param, value }]` (`:29-37`).
- mongoose `ValidationError` → 400, `message: "<Model> validation failed"` (model name = first word of mongoose message, e.g. `"todo validation failed"`), `errors: [{ message, path, value }]` (`:39-48`).
- Any error with `httpCode >= 500` is masked as generic InternalServerError (`:60-67`).
- Error bodies do **not** carry `notifications`/`userV`/`appVersion`.

### `userV` optimistic-concurrency / cross-client sync

- Server: `user._v` (`schema.js:100`) is incremented on every `user.save()` (pre-save hook — see comment `:97-99`; routes that use `updateOne` bump it by hand, `tasks.js:843-845, 1426`, `tags.js:237`). It's returned as `userV` on every authenticated response.
- Client (`website/client/src/app.vue:153-185`): axios interceptor stores `userV` into `user._v`; if `newV - oldV > 1` (i.e., some *other* request/client changed the user in between) and the call wasn't itself a user/tasks GET, cron, chat-seen or spell cast, it re-fetches `GET /user` and `GET /tasks/user` (`forceLoad`). It is **not** a precondition check; the server never rejects a stale write. Purely a "something changed elsewhere, resync" heuristic. Also stores `appVersion` and replaces `user.notifications` from every response (`:187-202`).
- Clean design: a proper `ETag`/`If-Match` or per-resource `version` with 409 on conflict, plus a lightweight change feed (SSE/WebSocket) instead of polling by side-channel.

---

## 6. Validation

Stack: `express-validator ^5.2.0` in **legacy API mode** (`req.checkBody/checkParams/checkQuery`, `req.validationErrors()`, `req.sanitizeBody`; mounted `appRoutes.js:23`), `validator ^13` for isUUID/isEmail/isURL, and mongoose schema validation (`mongoose ^8`). Body JSON limit 10 MB (`middlewares/index.js:109`); `req.body` defaulted to `{}` (`setupBody.js`).

Task schema constraints (`models/task.js`):

- `type`: enum `['habit','daily','todo','reward']`, required, default `'habit'` (`:61-63`). Discriminator key, immutable after creation.
- `text`: String, **required**, no length limit (`:64`). Empty string → `"Path `text` is required."`.
- `notes`: String default `''`, **no length limit** (`:65`). (Neither client nor server enforces `maxlength`; grep confirms.)
- `alias`: `match /^[a-zA-Z0-9-_]+$/` (`:68`), must belong to a user task (`:70-73`), must not be a UUID (`:75-78`), async unique per `userId` (`:80-89`). No length limit. Optional.
- `tags`: `[String]` each `isUUID` (`:92-95`); existence on the user **not** verified except on `POST /tasks/:id/tags/:tagId`.
- `value`: Number required default 0; for rewards must be `>= 0` (`:97-107`); ignored from input for non-rewards (sanitize).
- `priority`: Number required default 1, `∈ {0.1, 1, 1.5, 2}` (`:108-116`).
- `attribute`: enum `['str','con','int','per']` default `'str'` (`:117`). Gamification — drop.
- `userId`: uuid (`:118`). `challenge.*`, `group.*` (`:120-148`) — drop.
- `reminders: [reminderSchema]` (`:38-55,150`): `{ id: String uuid (default generated, required), startDate: Date (optional), time: Date (required) }`, `_id:false`. baseModel `noSet` for reminders is `['_id','id']` but `sanitizeReminder` (`:281-284`) is never called from the controllers; `updateTask` replaces the array wholesale, so client-supplied ids are kept (mongoose regenerates missing ones). The web client has **no reminder UI** (grep `website/client/src` for "reminders": none); reminders are set by mobile apps only.
- `byHabitica: Boolean default false` (`:152`).
- `createdAt`/`updatedAt` (baseModel `timestamps:true`, `libs/baseModel.js:20-46`; `updatedAt` bumped in pre-save and pre-updateOne/updateMany).
- Habit (`:369-376`): `up: Boolean true`, `down: Boolean true`, `counterUp/counterDown: Number 0`, `frequency: enum ['daily','weekly','monthly'] default 'daily'` (counter reset cadence), `history: Array`.
- Daily (`:378-413`): `frequency: enum ['daily','weekly','monthly','yearly'] default 'weekly'`; `everyX: Number default 1, integer, 0 ≤ x ≤ 9999` (`:380-387` — **0 is allowed**, message "Valid everyX values are integers from 0 to 9999"); `startDate: Date required default utc now`; `repeat: { m,t,w,th,f,s,su: Boolean default true }` (`:395-403`); `streak: Number 0`; `daysOfMonth: [Number] default []`; `weeksOfMonth: [Number] default []` (no range validation on either); `isDue: Boolean`, `nextDue: [String]` (ISO strings, server-computed by `setNextDue`, `utils.js:77-109`; stripped from input); `yesterDaily: Boolean default true required`; plus `completed`, `collapseChecklist`, `checklist`, `history`.
- Todo (`:415-419`): `dateCompleted: Date`, `date: Date` (due date), plus `completed`, `collapseChecklist`, `checklist`.
- Reward (`:421-422`): no extra fields.
- Shared daily/todo (`:354-367`): `completed: Boolean false`, `collapseChecklist: Boolean false`, `checklist: [{ completed, text (default ''), id uuid, linkId }]`.
- Client-side defaults mirror this in `common/script/libs/taskDefaults.js:14-102` (reward default value 10; daily `startDate` = start of today in user tz, or yesterday if CDS hasn't passed yet, `:69-92`).

Tag: `name` required; `id` uuid (`models/tag.js`).

User prefs: `dayStart` 0-23; `dateFormat` enum; `mirrorGroupTasks` uuids; `improvementCategories` enum list (`schema.js:649-657`).

Username: 1-20 chars `[-_a-zA-Z0-9]`, no slurs/forbidden words (`libs/user/validation.js:50-61`). Display name ≤30, no newline (`:41-48`). Password 8-64.

Param-level checks in controllers: `taskId` not-empty (not required to be UUID — alias allowed); `itemId`/`tagId`/`challengeId` `isUUID`; `position` `isNumeric`; `type` query `isIn(...)`.

---

## 7. Webhooks (`models/webhook.js`, `libs/webhook.js`, `controllers/api-v3/webhook.js`)

Embedded on user: `user.webhooks: [WebhookSchema]`, max `MAX_WEBHOOKS` (`common/script/constants.js`).

Schema (`models/webhook.js:34-88`):
```
id: String uuid (default generated, required)
type: enum ['globalActivity','taskActivity','groupChatReceived','userActivity','questActivity'] default 'taskActivity'
label: String default ''
url: String required, isURL({ require_tld: IS_PROD, require_protocol: true, protocols: ['http','https'] })
enabled: Boolean required default true
failures: Number default 0        (noSet)
lastFailureAt: Date               (noSet)
options: Mixed required default {}
createdAt/updatedAt
```
`formatOptions(res)` (`:90-131`): for `taskActivity` → defaults `{ created:false, updated:false, deleted:false, checklistScored:false, scored:true }`, picks only those keys, every value must be boolean else 400 `webhookBooleanOption`. `globalActivity` receives every event regardless of options (`libs/webhook.js:103`).

Routes (`controllers/api-v3/webhook.js`): `POST /user/webhook` (201, body `{ id?, url, label?, enabled?, type?, options? }`, duplicate id → 400), `GET /user/webhook` (array), `PUT /user/webhook/:id` (partial: url/label/type/enabled/options merged), `DELETE /user/webhook/:id` (returns remaining array).

Delivery (`libs/webhook.js:12-69`): `got.post(url, { json: body, timeout: 30000, retry: 3 })`, fire-and-forget after the response. On failure: `failures += 1`, `lastFailureAt = now`; failures reset if last failure > 1 month ago; **`failures >= 10` → `enabled = false`**. No signature/HMAC, no delivery log.

Payload (`WebhookSender.send` `:98-118`, `attachDefaultData` `:92-96`): every body gets `webhookType: <hook type>` and `user: { _id }`. Task events:
- `taskActivity` created/updated/deleted: `{ webhookType:'taskActivity', type:'created'|'updated'|'deleted', task: <task JSON>, user:{_id} }` (`tasks.js:218-221, 685-688, 1438-1441`; default transform).
- `checklistScored`: `{ type:'checklistScored', task, item, user:{_id} }` (`tasks.js:962-966`).
- `scored`: `{ type:'scored', direction, delta, task, user:{ _id, _tmp, stats } }` (`libs/webhook.js:128-150`). Note `created` fires only from `POST /tasks/user`, and `updated` does not fire for checklist add/update/delete or tag add/remove routes.

For a clone: keep `{ id, type, url, label, enabled, options{created,updated,deleted,scored,checklistScored} }`, add HMAC signature header, a delivery queue with backoff, and a delivery log.

---

## 8. Reminder / push delivery

- **There is no server-side scheduler that reads `task.reminders`.** grep across `website/server` for `reminders` hits only the schema, sanitizers and apidoc (`models/task.js:38-55,150,258,268`). No bullmq/agenda/cron job touches them. `libs/pushNotifications.js` exists (`sendNotification(user, details)` over APNs `@parse/node-apn` + Firebase `firebase-admin`, `MAX_MESSAGE_LENGTH = 300`, unregistered tokens auto-pruned `:21-27`) but is used only for social events (PMs, invites, quests, gifts — `libs/chat.js`, `libs/inbox`, `libs/invites`, `models/group.js`, etc.).
- Reminder firing is done **locally by the mobile apps** from the synced `reminders[]` (`{ id, startDate, time }` — `time` is a full Date whose date part is ignored for repeating dailies; `startDate` gates when a reminder becomes active). Web has no reminder UI.
- `user.pushDevices: [{ regId, type ('ios'|'android'), createdAt, updatedAt }]` (`models/pushDevice.js`) registered through `controllers/api-v3/pushNotifications.js`.
- For schema parity: keep `reminders: [{ id: uuid, startDate?: datetime, time: datetime }]` on tasks. If we later deliver server-side, a scheduler that materializes next-fire times per (task, reminder, user tz, dayStart) is required — Habitica has nothing to copy.

---

## 9. Markdown rendering of task text/notes (client)

- Directive `v-markdown` (`website/client/src/directives/markdown.js:1-13`): `el.innerHTML = habiticaMarkdown.render(String(value))`; adds class `markdown`. Applied to `task.text`, `task.notes`, checklist `item.text` and tag names in `client/src/components/tasks/task.vue:107,188,236,344`. Chat uses `habitica-markdown/withMentions` via `libs/renderWithMentions.js` (adds `@user` spans, `at-highlight` for self) — not used for tasks.
- Library `habitica-markdown ^4.x` (`website/client/package.json:30`; repo HabitRPG/habitica-markdown). Deps: `markdown-it ^14`, `markdown-it-emoji ^2.0.2`, `markdown-it-link-attributes ^4.0.1`, `markdown-it-linkify-images ^3.0.0`. `lib/util/createMdInstance.js`:
  ```js
  mdOptions.linkify = true;                 // html:false, breaks:false, typographer:false (markdown-it defaults)
  markdownit(mdOptions)
    .use(linkAttributesPlugin, { attrs: { target: '_blank', rel: 'noopener' } })
    .use(linkifyImagesPlugin, { target: '_blank', linkClass: 'markdown-img-link', imgClass: 'markdown-img' })
    .use(emoji, { defs: {...full.json, melior: 'melior'}, shortcuts: {} });
  // emoji renderer: <span class="emoji-native">{unicode}</span>; 'melior' → <img class="habitica-emoji" src=...melior.png>
  // core rule patch: emoji tokens inside links are turned back into literal ':name:' text
  ```
  So: `:shortcode:` emoji from the full emoji set (no ASCII shortcuts like `:)`), autolinked URLs opening in new tab, bare image URLs rendered as `<img>` wrapped in a link, **raw HTML disabled** (`html` default false → escaped), no hard `breaks`. An `unsafe.js` variant (`md.unsafeHTMLRender`) exists for trusted content only. Equivalent in a clone: `markdown-it({ linkify:true })` + `markdown-it-emoji` (full) + link-attributes + linkify-images, and sanitize output anyway.

---

## Surprises / notes for the clone

1. `GET /tasks/user` mutates the user (`tasksOrder` self-heal, `libs/tasks/index.js:264-314`). Reads should not write.
2. Score response returns user stats + `delta`, not the task; the client mutates its local copy optimistically. We'll return the task.
3. `PUT /user` body is flat dotted paths; unknown paths return 401 (not 400). `tasksOrder` is not settable through it; ordering only via `/move/to/:position` (one task at a time, two Mongo ops, manual `_v++`). A clone should offer a bulk "set order for type" endpoint.
4. `everyX` lower bound is 0, not 1 (`models/task.js:384`); `daysOfMonth`/`weeksOfMonth` have no range validation; `text`/`notes` have no length cap.
5. `priority` is coerced to a 1-decimal *string* by sanitize and cast back by mongoose. Enum {0.1,1,1.5,2}.
6. Tags on tasks are only validated for existence on the dedicated add-tag route; `PUT /tasks/:id` with `tags` accepts any UUID. Deleting a tag cascades with `updateMany $pull`.
7. `apiToken` is plaintext UUID compared with `!==`; rotated only by password change; no dedicated reset route; embedded in an Apple-login redirect URL (`libs/auth/utils.js:30`). Rate limiter keys on the unverified `x-api-user` header.
8. Header auth writes `req.session.userId` and bumps `auth.timestamps.updated` on every request; `timestamps.loggedin` actually means "last cron", and `methods.js:398` reads a misspelled `loggedIn`.
9. `userV` is a resync hint, not real optimistic concurrency; the server never rejects stale writes.
10. `POST /tasks/user` accepts an array; response shape depends on count (object vs array) — annoying for clients; a clone should always return an array for the bulk route.
11. Reminders have zero server-side delivery; they're mobile-local. Web UI cannot edit them.
12. Completed todos are excluded from `tasksOrder`, cannot be moved, and are auto-deleted by cron after 30/90 days.
13. Error `error` field is a class name (`BadRequest`) except `invalid_credentials`, which clients use as the "force logout" signal.
14. Express-validator is v5 legacy API (`req.checkBody`), mongoose 8. Routes are declared as plain objects walked by `libs/routes.js`, with `getUserLanguage` auto-inserted after the auth middleware.
