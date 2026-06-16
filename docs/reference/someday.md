# Someday

Ideas and known limitations deferred but not lost. Format: `- <idea> — <why it might matter> (added YYYY-MM-DD)`.

- `getModules` uses `Promise.all`, so one module's items endpoint returning 403 (restricted/locked module) rejects the whole call — user gets an error instead of the accessible modules. Not a regression (the old serial loop also threw). Fix if it ever bites: absorb per-module 403 and return that module with empty items. Owner-accepted limitation. (added 2026-06-16)
- `download_file` falls back to filename `'file'` when a Canvas display_name sanitizes to empty (all-CJK/symbol names). Two such files in one dir would overwrite. Real-world rare. Better fix: suffix with the fileId. Owner-accepted limitation. (added 2026-06-16)
- `list_courses` filters `enrollment_state: active`, so between semesters (e.g. summer) concluded courses don't appear. If past-course access is ever wanted, broaden `enrollment_state` to include `completed`. (added 2026-06-16)
