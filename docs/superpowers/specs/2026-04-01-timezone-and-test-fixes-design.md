# Timezone-Aware Date Formatting & Test Infrastructure Fixes

**Date:** 2026-04-01
**Status:** Approved

## Overview

Two related fixes:

1. **Test runner correction** — `bun test` invokes Bun's native runner, which does not support Vitest APIs (`vi.stubGlobal`, `vi.doMock`, native Node modules). The correct command is `bun run test` (→ `vitest run`). All 90 tests pass under `vitest run`. CLAUDE.md must be corrected.

2. **Timezone-aware date formatting** — The existing `localDateFromISO` uses the system timezone with no override, making date assertions non-deterministic across machines. The user also wants full date+time+timezone output (e.g. `2026-03-31 11:59 PM EST`) instead of date-only. Timezone is now a user-configured value stored in `config.json` and injected at startup.

---

## Goals

- All tests pass deterministically on any machine regardless of system timezone
- All Canvas timestamps surfaced to Claude include date, time, and timezone abbreviation
- Timezone is configured once during setup and stored in config
- Existing users who don't re-run setup get a sensible fallback (system timezone)
- Setup wizard detects system timezone and asks for confirmation

---

## New Files

None.

## Modified Files

- `CLAUDE.md` — fix `bun test` → `bun run test`
- `src/types.ts` — add `timezone: string` to `Config`
- `src/lib/config.ts` — read `timezone`, fall back to system timezone
- `src/lib/dateUtils.ts` — rename + rewrite `localDateFromISO` → `formatDateTime(isoString, timezone)`
- `src/tools/getUpcomingAssignments.ts` — accept and pass `timezone`
- `src/tools/getAssignmentGrades.ts` — accept and pass `timezone`
- `src/tools/getAssignmentDetails.ts` — accept and pass `timezone`
- `src/index.ts` — pass `config.timezone` to the three affected tool calls
- `scripts/setup.ts` — add timezone confirmation stage
- `tests/tools/getUpcomingAssignments.test.ts` — pass timezone explicitly, fix assertions
- `tests/tools/getAssignmentGrades.test.ts` — pass timezone explicitly, fix assertions

---

## Design

### 1. Config

Add `timezone` to the `Config` interface:

```typescript
export interface Config {
  token: string;
  baseUrl: string;
  downloadDir: string;
  timezone: string;
}
```

`loadConfig` reads `timezone` from `config.json`. If absent (existing users), falls back to the system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. This means existing users are not broken — they get their system timezone automatically.

`config.json` after setup:

```json
{
  "token": "...",
  "baseUrl": "https://babson.instructure.com",
  "downloadDir": "/Users/yourname/Academics",
  "timezone": "America/New_York"
}
```

### 2. `dateUtils.ts` — `formatDateTime`

Rename `localDateFromISO` to `formatDateTime`. New signature:

```typescript
export function formatDateTime(isoString: string | null, timezone: string): string | null
```

Returns `null` for null inputs (assignments with no due date). For non-null inputs, returns a string in the format:

```
2026-03-31 11:59 PM EST
```

Implementation uses two `Intl.DateTimeFormat` calls:
- One for the date portion (`year`, `month`, `day`)
- One for the time + timezone name portion (`hour`, `minute`, `hour12: true`, `timeZoneName: 'short'`)

Both pass the `timeZone` option explicitly. This ensures output is deterministic regardless of where the process runs.

### 3. Tool Functions

Three tools currently call `localDateFromISO` and must be updated.

**`getUpcomingAssignments(client, opts, allCourses, timezone)`**
Passes `timezone` to every `formatDateTime` call on `due_at` fields.

**`getAssignmentGrades(client, courseId, timezone)`**
Passes `timezone` to every `formatDateTime` call on `due_at` and `submitted_at` fields.

**`getAssignmentDetails(client, courseId, assignmentId, timezone)`**
Passes `timezone` to every `formatDateTime` call on `due_at`, `unlock_at`, `lock_at` fields.

### 4. `index.ts` Wiring

At each of the three tool call sites, append `config.timezone`:

```typescript
// getUpcomingAssignments
const assignments = await getUpcomingAssignments(client, { courseId }, allCourses, config.timezone);

// getAssignmentGrades
const grades = await getAssignmentGrades(client, courseId, config.timezone);

// getAssignmentDetails
const details = await getAssignmentDetails(client, courseId, assignmentId, config.timezone);
```

### 5. Setup Wizard — Timezone Stage

Inserted between token validation (Stage 3) and download folder (Stage 4). Becomes new Stage 4; download folder shifts to Stage 5.

Flow:

```
Detected timezone: America/New_York
Is this correct? (Y/n) ❯ Y
```

If confirmed (default yes): stores detected timezone as-is.

If declined: shows a free-text input pre-filled with the detected timezone so the user can edit it:

```
Enter your timezone (IANA format):
❯ America/New_York
```

Common examples printed above the prompt:
```
Common timezones: America/New_York, America/Chicago, America/Denver, America/Los_Angeles
```

No runtime validation of the IANA name — if it's invalid, `Intl.DateTimeFormat` will throw at format time, which is a recoverable problem (re-run setup).

### 6. Test Fixes

**`tests/tools/getAssignmentGrades.test.ts`**

Pass `'America/New_York'` to `getAssignmentGrades`. Update date assertion to expect full datetime format:
```typescript
const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');
expect(result[0].dueAt).toBe('2026-03-31 11:59 PM EDT');
```

Note: `2026-04-01T03:59:00Z` in `America/New_York` is `2026-03-31 11:59 PM EDT` (daylight saving is active in April).

**`tests/tools/getUpcomingAssignments.test.ts`**

Pass `'America/New_York'` to `getUpcomingAssignments`. The fixture `2026-04-04T23:59:59-04:00` is already in EDT offset, so:
```typescript
const result = await getUpcomingAssignments(mockClient as any, { courseId: '7779627' }, undefined, 'America/New_York');
expect(result[0].dueAt).toBe('2026-04-04 11:59 PM EDT');
```

### 7. CLAUDE.md Correction

Change:

```bash
bun test             # Run Vitest once
bun run test:watch   # Run Vitest in watch mode
```

To:

```bash
bun run test         # Run Vitest once
bun run test:watch   # Run Vitest in watch mode
```

---

## Backward Compatibility

- Existing `config.json` without `timezone` → falls back to system timezone. No error, no breaking change.
- `formatDateTime` returns `null` for null inputs — tools that previously returned `null` for missing dates continue to do so.
- The rename from `localDateFromISO` to `formatDateTime` is an internal change; the function is not exported from `index.ts` or used outside `src/`.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| `due_at` is null | `formatDateTime` returns `null`; tool passes it through |
| Invalid IANA timezone in config | `Intl.DateTimeFormat` throws at format time; MCP server logs error |
| User on Windows with `APPDATA` timezone | System timezone detection works identically via `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| DST boundary (e.g., March/November) | `Intl.DateTimeFormat` handles DST automatically; abbreviation reflects actual offset (EST vs EDT) |
