# Setup Wizard + Timezone-Aware Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Supersedes:** `docs/superpowers/plans/2026-04-01-setup-wizard.md`

**Goal:** Add an interactive CLI setup wizard with timezone configuration, make all Canvas timestamps deterministic across machines, and fix the test runner confusion that caused pre-existing failures.

**Architecture:** `timezone` and `downloadDir` are added to `Config`, read by `loadConfig`, and passed as explicit parameters down to tools and fileManager — no global state. `dateUtils.formatDateTime(isoString, timezone)` replaces the system-timezone-dependent `localDateFromISO`. The wizard auto-detects timezone from the system and asks for confirmation. All three date-using tools gain a `timezone` param; `downloadFiles` gains `downloadDir`.

**Tech Stack:** `@inquirer/prompts`, `tsx` (dev), `Intl.DateTimeFormat` (built-in), `vitest run` (not `bun test`).

---

## File Map

| File | Change |
|---|---|
| `CLAUDE.md` | Fix `bun test` → `bun run test`; update architecture description |
| `src/types.ts` | Add `downloadDir: string` and `timezone: string` to `Config` |
| `src/lib/config.ts` | Read both new fields; fall back to sensible defaults |
| `src/lib/dateUtils.ts` | Rename + rewrite: `formatDateTime(isoString, timezone)` |
| `src/tools/getAssignmentGrades.ts` | Add `timezone` param; format `submittedAt` too |
| `src/tools/getUpcomingAssignments.ts` | Add `timezone` param |
| `src/tools/getAssignmentDetails.ts` | Add `timezone` param |
| `src/lib/fileManager.ts` | Remove hardcoded `CANVAS_ROOT`; accept `downloadDir` param |
| `src/tools/downloadFiles.ts` | Add `downloadDir` param |
| `src/index.ts` | Pass `config.timezone` and `config.downloadDir` at all call sites |
| `scripts/setup.ts` | New: full interactive wizard |
| `package.json` | Add `setup` script; add `@inquirer/prompts` devDependency |
| `README.md` | Replace manual setup steps with wizard instructions |
| `tests/lib/config.test.ts` | Add tests for downloadDir and timezone fallbacks |
| `tests/lib/dateUtils.test.ts` | New: test formatDateTime |
| `tests/lib/fileManager.test.ts` | Pass downloadDir to getLocalPath |
| `tests/tools/getAssignmentGrades.test.ts` | Pass timezone; update date assertions |
| `tests/tools/getUpcomingAssignments.test.ts` | Pass timezone; update date assertions |
| `tests/tools/getAssignmentDetails.test.ts` | Pass timezone; update date assertions |
| `tests/tools/downloadFiles.test.ts` | Pass downloadDir |
| `tests/scripts/setup.test.ts` | New: test wizard helpers |

---

### Task 1: Fix CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix the test commands and architecture notes**

Replace the entire `CLAUDE.md` with:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run build        # Compile TypeScript → dist/index.js
bun run dev          # Run with tsx (development mode)
bun run test         # Run Vitest once
bun run test:watch   # Run Vitest in watch mode
```

To run a single test file:
```bash
bun run test -- tests/tools/downloadFiles.test.ts
```

## What This Is

An MCP (Model Context Protocol) server that connects Claude to Babson College's Canvas LMS. It gives Claude read-only access to courses, assignments, grades, announcements, and files via 9 registered tools.

Config lives at `~/.accesscanvas/config.json` (requires `token`, `baseUrl`, `downloadDir`, `timezone`). Run `npm run setup` to configure. SQLite cache at `~/.accesscanvas/cache.db`. Downloaded files land in the configured `downloadDir` (default: `~/Academics/`).

## Architecture

```
src/
├── index.ts          — MCP server entry point; registers all 9 tools
├── types.ts          — Shared TypeScript interfaces
├── lib/
│   ├── canvasClient.ts   — Canvas REST API client (get, getPaginated, getFileBuffer)
│   ├── cache.ts          — SQLite cache (module_structure, cached_pages, downloaded_files)
│   ├── config.ts         — Loads ~/.accesscanvas/config.json
│   ├── fileManager.ts    — Downloads files to configured downloadDir
│   ├── htmlParser.ts     — Parses Canvas HTML; extracts file links, external URLs, plain text
│   └── dateUtils.ts      — Formats Canvas UTC timestamps → 'YYYY-MM-DD H:MM AM/PM TZ'
└── tools/            — One file per MCP tool
```

**Two categories of tools:**

- **Live tools** — always call Canvas API directly, return `_fetchedAt` timestamp. Used for time-sensitive data: courses, grades, assignments, announcements.
- **Cached tools** — check SQLite first, fall back to Canvas API, accept `forceRefresh: boolean`. Used for stable/expensive data: module structure, module page content.

All tool responses are wrapped in `index.ts` with metadata (`_fetchedAt`, `_fromCache`, `_hint`) before returning to Claude.

## Key Patterns

- New tools go in `src/tools/`, get registered in `src/index.ts`
- Use `CanvasClient.getPaginated<T>()` for any Canvas endpoint that paginates (most list endpoints do)
- Canvas file links are embedded in HTML as `data-api-endpoint` attributes — `htmlParser.ts` knows how to extract them
- File paths are sanitized before writing to disk (spaces and special chars removed)
- `_hint` field in cached responses reminds Claude not to surface cache details to users
```

- [ ] **Step 2: Verify tests still pass**

```bash
bun run test
```

Expected: all tests pass (90 tests).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix bun run test command and update architecture description"
```

---

### Task 2: Add `downloadDir` and `timezone` to Config interface

**Files:**
- Modify: `src/types.ts:119-123`

- [ ] **Step 1: Update the Config interface**

In `src/types.ts`, replace:
```typescript
// Config
export interface Config {
  token: string;
  baseUrl: string;
}
```
With:
```typescript
// Config
export interface Config {
  token: string;
  baseUrl: string;
  downloadDir: string;
  timezone: string;
}
```

- [ ] **Step 2: Verify TypeScript catches all call sites that need updating**

```bash
bun run build 2>&1 | head -30
```

Expected: TypeScript errors pointing at `config.ts`, `fileManager.ts`, tool files — confirms where work is needed.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add downloadDir and timezone to Config interface"
```

---

### Task 3: Update `config.ts` to read `downloadDir` and `timezone`

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `tests/lib/config.test.ts`

- [ ] **Step 1: Add failing tests to `tests/lib/config.test.ts`**

Replace `tests/lib/config.test.ts` with:
```typescript
// tests/lib/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'accesscanvas-test-' + Date.now());
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads token and baseUrl from config file', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'test-token-123',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.token).toBe('test-token-123');
    expect(config.baseUrl).toBe('https://babson.instructure.com');
  });

  it('throws if config file is missing', async () => {
    const { loadConfig } = await import('../../src/lib/config.js');
    expect(() => loadConfig(join(tmpDir, 'missing.json'))).toThrow(/config file not found/i);
  });

  it('throws if token is missing', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ baseUrl: 'https://babson.instructure.com' }));
    const { loadConfig } = await import('../../src/lib/config.js');
    expect(() => loadConfig(configPath)).toThrow(/token/i);
  });

  it('reads downloadDir from config when present', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
      downloadDir: '/custom/path',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.downloadDir).toBe('/custom/path');
  });

  it('falls back to ~/Academics when downloadDir is absent', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.downloadDir).toBe(join(homedir(), 'Academics'));
  });

  it('reads timezone from config when present', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
      timezone: 'America/Chicago',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.timezone).toBe('America/Chicago');
  });

  it('falls back to system timezone when timezone is absent', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
```

- [ ] **Step 2: Run tests to confirm the 4 new tests fail**

```bash
bun run test -- tests/lib/config.test.ts
```

Expected: 3 existing tests PASS, 4 new tests FAIL (config returns no `downloadDir`/`timezone`).

- [ ] **Step 3: Update `src/lib/config.ts`**

Replace `src/lib/config.ts` with:
```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config } from '../types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.accesscanvas', 'config.json');

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config {
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Run: npm run setup`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  if (!raw.token) {
    throw new Error('Config missing required field: token');
  }
  if (!raw.baseUrl) {
    throw new Error('Config missing required field: baseUrl');
  }

  const downloadDir = raw.downloadDir ?? join(homedir(), 'Academics');
  const timezone = raw.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return { token: raw.token, baseUrl: raw.baseUrl, downloadDir, timezone };
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
bun run test -- tests/lib/config.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts tests/lib/config.test.ts
git commit -m "feat: read downloadDir and timezone from config with sensible fallbacks"
```

---

### Task 4: Rewrite `dateUtils.ts` — `formatDateTime`

**Files:**
- Modify: `src/lib/dateUtils.ts`
- Create: `tests/lib/dateUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/dateUtils.test.ts`:
```typescript
// tests/lib/dateUtils.test.ts
import { describe, it, expect } from 'vitest';

describe('formatDateTime', () => {
  it('formats UTC timestamp as date+time+timezone abbreviation', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // 2026-04-01T03:59:00Z in EDT (America/New_York, UTC-4) = 2026-03-31 11:59 PM EDT
    expect(formatDateTime('2026-04-01T03:59:00Z', 'America/New_York')).toBe('2026-03-31 11:59 PM EDT');
  });

  it('returns null for null input', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    expect(formatDateTime(null, 'America/New_York')).toBeNull();
  });

  it('uses the specified timezone, not system timezone', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // Same UTC instant in two different timezones should differ
    const ny = formatDateTime('2026-04-01T03:59:00Z', 'America/New_York');
    const la = formatDateTime('2026-04-01T03:59:00Z', 'America/Los_Angeles');
    // NY: 11:59 PM EDT (UTC-4); LA: 8:59 PM PDT (UTC-7)
    expect(ny).toContain('EDT');
    expect(la).toContain('PDT');
    expect(ny).toContain('2026-03-31');
    expect(la).toContain('2026-03-31');
  });

  it('formats a midday time correctly', async () => {
    const { formatDateTime } = await import('../../src/lib/dateUtils.js');
    // 2026-03-25T07:59:59-04:00 = 2026-03-25 7:59 AM EDT in America/New_York
    expect(formatDateTime('2026-03-25T07:59:59-04:00', 'America/New_York')).toBe('2026-03-25 7:59 AM EDT');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/lib/dateUtils.test.ts
```

Expected: FAIL — `formatDateTime` not exported from `dateUtils.js`.

- [ ] **Step 3: Rewrite `src/lib/dateUtils.ts`**

```typescript
/**
 * Formats a Canvas ISO timestamp as 'YYYY-MM-DD H:MM AM/PM TZ'
 * in the specified IANA timezone (e.g. 'America/New_York').
 * Returns null for null inputs (assignments without due dates).
 */
export function formatDateTime(isoString: string | null, timezone: string): string | null {
  if (isoString === null) return null;

  const d = new Date(isoString);

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(d);

  return `${date} ${time}`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/lib/dateUtils.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dateUtils.ts tests/lib/dateUtils.test.ts
git commit -m "feat: rewrite dateUtils with explicit timezone — formatDateTime replaces localDateFromISO"
```

---

### Task 5: Update `getAssignmentGrades.ts` and its tests

**Files:**
- Modify: `src/tools/getAssignmentGrades.ts`
- Modify: `tests/tools/getAssignmentGrades.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace `tests/tools/getAssignmentGrades.test.ts` with:
```typescript
// tests/tools/getAssignmentGrades.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockAssignments = [
  {
    id: 54079881,
    name: 'Assignment 2: Data Management',
    due_at: '2026-04-01T03:59:00Z',
    points_possible: 100,
    submission_types: ['online_upload'],
    course_id: 7779627,
    description: null,
    unlock_at: null,
    lock_at: null,
    submission: {
      score: 88,
      grade: 'B+',
      submitted_at: '2026-03-30T20:00:00Z',
      missing: false,
      late: false,
      workflow_state: 'graded',
    },
  },
  {
    id: 54079882,
    name: 'Quiz 1',
    due_at: '2026-03-15T03:59:00Z',
    points_possible: 50,
    submission_types: ['online_quiz'],
    course_id: 7779627,
    description: null,
    unlock_at: null,
    lock_at: null,
    submission: {
      score: null,
      grade: null,
      submitted_at: null,
      missing: true,
      late: false,
      workflow_state: 'unsubmitted',
    },
  },
];

describe('getAssignmentGrades', () => {
  it('returns graded assignments with scores', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('54079881');
    expect(result[0].title).toBe('Assignment 2: Data Management');
    expect(result[0].pointsPossible).toBe(100);
    expect(result[0].score).toBe(88);
    expect(result[0].grade).toBe('B+');
    expect(result[0].missing).toBe(false);
    expect(result[0].late).toBe(false);
  });

  it('returns null score for unsubmitted assignments', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');

    expect(result[1].score).toBeNull();
    expect(result[1].missing).toBe(true);
    expect(result[1].submittedAt).toBeNull();
  });

  it('calls correct Canvas endpoint with submission include', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7779627/assignments',
      expect.objectContaining({ 'include[]': 'submission' })
    );
  });

  it('formats dueAt as date+time+timezone in specified timezone', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');
    // 2026-04-01T03:59:00Z in EDT (UTC-4) = 2026-03-31 11:59 PM EDT
    expect(result[0].dueAt).toBe('2026-03-31 11:59 PM EDT');
    // 2026-03-30T20:00:00Z in EDT (UTC-4) = 2026-03-30 4:00 PM EDT
    expect(result[0].submittedAt).toBe('2026-03-30 4:00 PM EDT');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/tools/getAssignmentGrades.test.ts
```

Expected: FAIL — `getAssignmentGrades` doesn't accept a `timezone` param yet.

- [ ] **Step 3: Update `src/tools/getAssignmentGrades.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import { formatDateTime } from '../lib/dateUtils.js';

export interface AssignmentGrade {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
}

export async function getAssignmentGrades(
  client: CanvasClient,
  courseId: string,
  timezone: string
): Promise<AssignmentGrade[]> {
  const assignments = await client.getPaginated<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments`,
    { 'include[]': 'submission', order_by: 'due_at' }
  );

  return assignments.map((a) => ({
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: formatDateTime(a.due_at, timezone),
    pointsPossible: a.points_possible,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    submittedAt: formatDateTime(a.submission?.submitted_at ?? null, timezone),
    missing: a.submission?.missing ?? false,
    late: a.submission?.late ?? false,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/tools/getAssignmentGrades.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/getAssignmentGrades.ts tests/tools/getAssignmentGrades.test.ts
git commit -m "feat: add timezone param to getAssignmentGrades; format all timestamps"
```

---

### Task 6: Update `getUpcomingAssignments.ts` and its tests

**Files:**
- Modify: `src/tools/getUpcomingAssignments.ts`
- Modify: `tests/tools/getUpcomingAssignments.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace `tests/tools/getUpcomingAssignments.test.ts` with:
```typescript
// tests/tools/getUpcomingAssignments.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockAssignments = [
  {
    id: 54079881,
    name: 'Assignment 2: Data Management in R',
    due_at: '2026-04-04T23:59:59-04:00',
    points_possible: 100,
    submission_types: ['online_upload'],
    course_id: 7779627,
    description: '<p>Complete the R exercises.</p>',
    unlock_at: null,
    lock_at: null,
  },
];

describe('getUpcomingAssignments', () => {
  it('returns trimmed upcoming assignments for a specific course', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    const result = await getUpcomingAssignments(mockClient as any, { courseId: '7779627' }, undefined, 'America/New_York');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('54079881');
    expect(result[0].title).toBe('Assignment 2: Data Management in R');
    expect(result[0].courseId).toBe('7779627');
    // 2026-04-04T23:59:59-04:00 = 2026-04-04 11:59 PM EDT in America/New_York
    expect(result[0].dueAt).toBe('2026-04-04 11:59 PM EDT');
    expect(result[0].submissionType).toBe('online_upload');
    expect(result[0].pointsPossible).toBe(100);
  });

  it('fetches across all provided courses when no courseId given', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const mockCourses = [
      { id: '7779656', name: 'Risk Management', code: 'FIN4507' },
      { id: '7779627', name: 'PBA', code: 'QTM3310' },
    ];
    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    await getUpcomingAssignments(mockClient as any, {}, mockCourses, 'America/New_York');

    expect(mockClient.getPaginated).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/tools/getUpcomingAssignments.test.ts
```

Expected: FAIL — `getUpcomingAssignments` doesn't accept a `timezone` param yet.

- [ ] **Step 3: Update `src/tools/getUpcomingAssignments.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import type { CourseInfo } from './getCourses.js';
import { formatDateTime } from '../lib/dateUtils.js';

export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  submissionType: string;
  pointsPossible: number;
}

export async function getUpcomingAssignments(
  client: CanvasClient,
  options: { courseId?: string },
  allCourses: CourseInfo[] | undefined,
  timezone: string
): Promise<AssignmentSummary[]> {
  const courseIds = options.courseId
    ? [options.courseId]
    : (allCourses ?? []).map((c) => c.id);

  const results: AssignmentSummary[] = [];

  for (const courseId of courseIds) {
    const assignments = await client.getPaginated<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments`,
      { bucket: 'upcoming', order_by: 'due_at', per_page: '50' }
    );

    for (const a of assignments) {
      results.push({
        id: String(a.id),
        courseId: String(a.course_id ?? courseId),
        title: a.name,
        dueAt: formatDateTime(a.due_at, timezone),
        submissionType: a.submission_types[0] ?? 'none',
        pointsPossible: a.points_possible,
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/tools/getUpcomingAssignments.test.ts
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/getUpcomingAssignments.ts tests/tools/getUpcomingAssignments.test.ts
git commit -m "feat: add timezone param to getUpcomingAssignments; format dueAt as datetime"
```

---

### Task 7: Update `getAssignmentDetails.ts` and its tests

**Files:**
- Modify: `src/tools/getAssignmentDetails.ts`
- Modify: `tests/tools/getAssignmentDetails.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace `tests/tools/getAssignmentDetails.test.ts` with:
```typescript
// tests/tools/getAssignmentDetails.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getAssignmentDetails', () => {
  it('returns assignment details with files parsed from HTML', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 54079881,
        name: 'Group Assignment 2',
        description: `<p><a
          title="Assignment 2.pdf"
          href="viewer/files/Assignment2.pdf"
          data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828267"
          data-api-returntype="File">Assignment 2.pdf</a></p>
          <p><a title="MS.xlsx" href="viewer/files/MS.xlsx"
          data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828268"
          data-api-returntype="File">MS.xlsx</a></p>`,
        due_at: '2026-03-25T07:59:59-04:00',
        points_possible: 100,
        submission_types: ['online_upload'],
        course_id: 7779656,
        unlock_at: null,
        lock_at: null,
      }),
    };

    const { getAssignmentDetails } = await import('../../src/tools/getAssignmentDetails.js');
    const result = await getAssignmentDetails(mockClient as any, '7779656', '54079881', 'America/New_York');

    expect(result.id).toBe('54079881');
    expect(result.title).toBe('Group Assignment 2');
    // 2026-03-25T07:59:59-04:00 = 2026-03-25 7:59 AM EDT in America/New_York
    expect(result.dueAt).toBe('2026-03-25 7:59 AM EDT');
    expect(result.files).toHaveLength(2);
    expect(result.files[0].name).toBe('Assignment 2.pdf');
    expect(result.files[0].fileId).toBe('344828267');
    expect(result.files[1].name).toBe('MS.xlsx');
    expect(result.files[1].fileId).toBe('344828268');
  });

  it('handles assignment with no files gracefully', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 99,
        name: 'Reading Quiz',
        description: '<p>Complete the quiz on Canvas.</p>',
        due_at: null,
        points_possible: 10,
        submission_types: ['external_tool'],
        course_id: 7779627,
        unlock_at: null,
        lock_at: null,
      }),
    };

    const { getAssignmentDetails } = await import('../../src/tools/getAssignmentDetails.js');
    const result = await getAssignmentDetails(mockClient as any, '7779627', '99', 'America/New_York');

    expect(result.files).toHaveLength(0);
    expect(result.description).toContain('Complete the quiz');
    expect(result.dueAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/tools/getAssignmentDetails.test.ts
```

Expected: FAIL — `getAssignmentDetails` doesn't accept a `timezone` param yet.

- [ ] **Step 3: Update `src/tools/getAssignmentDetails.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';
import { formatDateTime } from '../lib/dateUtils.js';

export interface AssignmentDetails {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionType: string;
  description: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export async function getAssignmentDetails(
  client: CanvasClient,
  courseId: string,
  assignmentId: string,
  timezone: string
): Promise<AssignmentDetails> {
  const a = await client.get<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  );

  const parsed = parseContent(a.description ?? '');

  return {
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: formatDateTime(a.due_at, timezone),
    pointsPossible: a.points_possible,
    submissionType: a.submission_types[0] ?? 'none',
    description: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/tools/getAssignmentDetails.test.ts
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/getAssignmentDetails.ts tests/tools/getAssignmentDetails.test.ts
git commit -m "feat: add timezone param to getAssignmentDetails; format dueAt as datetime"
```

---

### Task 8: Update `fileManager.ts` to accept `downloadDir`

**Files:**
- Modify: `src/lib/fileManager.ts`
- Modify: `tests/lib/fileManager.test.ts`

- [ ] **Step 1: Update the failing test**

Replace `tests/lib/fileManager.test.ts` with:
```typescript
// tests/lib/fileManager.test.ts
import { describe, it, expect } from 'vitest';

describe('sanitizeName', () => {
  it('removes spaces', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Risk Management')).toBe('RiskManagement');
  });

  it('removes special characters', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Course: 101 & More!')).toBe('Course101More');
  });

  it('preserves dots, hyphens, and underscores', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('assignment_2.qmd')).toBe('assignment_2.qmd');
  });
});

describe('getLocalPath', () => {
  it('builds path under the provided downloadDir', async () => {
    const { getLocalPath } = await import('../../src/lib/fileManager.js');
    const path = getLocalPath('FIN4507', 'Risk Management', 'Assignment 2', 'Assignment 2.pdf', '/tmp/TestAcademics');
    expect(path).toContain('TestAcademics');
    expect(path).toContain('FIN4507-RiskManagement');
    expect(path).toContain('Assignment2');
    expect(path).toContain('Assignment2.pdf');
  });
});
```

- [ ] **Step 2: Run tests to confirm `getLocalPath` test fails**

```bash
bun run test -- tests/lib/fileManager.test.ts
```

Expected: `sanitizeName` tests PASS, `getLocalPath` FAIL (wrong number of args).

- [ ] **Step 3: Update `src/lib/fileManager.ts`**

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export function getLocalPath(
  courseCode: string,
  courseName: string,
  context: string,
  filename: string,
  downloadDir: string
): string {
  const folderName = `${courseCode}-${sanitizeName(courseName)}`;
  return join(downloadDir, folderName, sanitizeName(context), sanitizeName(filename));
}

export async function downloadCanvasFile(
  client: CanvasClient,
  courseId: string,
  fileId: string,
  courseCode: string,
  courseName: string,
  context: string,
  downloadDir: string
): Promise<{ localPath: string; displayName: string }> {
  const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
  const localPath = getLocalPath(courseCode, courseName, context, file.display_name, downloadDir);

  mkdirSync(dirname(localPath), { recursive: true });

  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(localPath, buffer);

  return { localPath, displayName: file.display_name };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/lib/fileManager.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fileManager.ts tests/lib/fileManager.test.ts
git commit -m "feat: accept downloadDir in fileManager, remove hardcoded ~/Academics constant"
```

---

### Task 9: Update `downloadFiles.ts` to accept `downloadDir`

**Files:**
- Modify: `src/tools/downloadFiles.ts`
- Modify: `tests/tools/downloadFiles.test.ts`

- [ ] **Step 1: Update the failing test**

Replace `tests/tools/downloadFiles.test.ts` with:
```typescript
// tests/tools/downloadFiles.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('downloadFiles', () => {
  it('downloads files and returns local paths under the given downloadDir', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 344828267,
        display_name: 'Assignment 2.pdf',
        filename: 'Assignment2.pdf',
        url: 'https://babson.instructure.com/files/344828267/download',
        size: 1024,
        content_type: 'application/pdf',
      }),
      getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('fake pdf content')),
    };
    const mockCache = { recordDownloadedFile: vi.fn() };

    vi.mock('fs', () => ({
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      existsSync: vi.fn().mockReturnValue(false),
    }));

    const { downloadFiles } = await import('../../src/tools/downloadFiles.js');
    const result = await downloadFiles(
      mockClient as any,
      mockCache as any,
      [{ fileId: '344828267', courseId: '7779656', courseCode: 'FIN4507', courseName: 'Risk Management', context: 'Assignment2' }],
      '/tmp/TestAcademics'
    );

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Assignment 2.pdf');
    expect(result[0].localPath).toContain('FIN4507-RiskManagement');
    expect(result[0].localPath).toContain('Assignment2');
    expect(result[0].localPath).toContain('TestAcademics');
    expect(mockCache.recordDownloadedFile).toHaveBeenCalledWith(
      '344828267',
      '7779656',
      result[0].localPath,
      'Assignment 2.pdf'
    );
  });
});
```

Note: uses `vi.mock` (hoisted, static) instead of `vi.doMock` (dynamic) — this is compatible with both `vitest run` and Bun's runner.

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/tools/downloadFiles.test.ts
```

Expected: FAIL — `downloadFiles` doesn't accept a `downloadDir` param yet.

- [ ] **Step 3: Update `src/tools/downloadFiles.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { downloadCanvasFile } from '../lib/fileManager.js';

export interface DownloadRequest {
  fileId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  context: string;
}

export interface DownloadResult {
  fileId: string;
  displayName: string;
  localPath: string;
}

export async function downloadFiles(
  client: CanvasClient,
  cache: Cache,
  requests: DownloadRequest[],
  downloadDir: string
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (const req of requests) {
    const { localPath, displayName } = await downloadCanvasFile(
      client,
      req.courseId,
      req.fileId,
      req.courseCode,
      req.courseName,
      req.context,
      downloadDir
    );

    cache.recordDownloadedFile(req.fileId, req.courseId, localPath, displayName);

    results.push({ fileId: req.fileId, displayName, localPath });
  }

  return results;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/tools/downloadFiles.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/tools/downloadFiles.ts tests/tools/downloadFiles.test.ts
git commit -m "feat: thread downloadDir through downloadFiles"
```

---

### Task 10: Wire `config.timezone` and `config.downloadDir` into `index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update the four affected tool call sites**

In `src/index.ts`, make these targeted changes:

**Line 56 — `getUpcomingAssignments` call:**
```typescript
    const allCourses = courseId ? undefined : await getCourses(client);
    const assignments = await getUpcomingAssignments(client, { courseId }, allCourses, config.timezone);
```

**Line 68 — `getAssignmentGrades` call:**
```typescript
    const grades = await getAssignmentGrades(client, courseId, config.timezone);
```

**Line 94 — `getAssignmentDetails` call:**
```typescript
    const details = await getAssignmentDetails(client, courseId, assignmentId, config.timezone);
```

**Line 141 — `download_files` tool description and call:**
```typescript
server.tool(
  'download_files',
  'Download Canvas files to the configured download directory. Get fileIds from get_assignment_details or get_module_item.',
  ...
  async ({ files }) => {
    const results = await downloadFiles(client, cache, files, config.downloadDir);
```

- [ ] **Step 2: Verify the full build passes**

```bash
bun run build 2>&1
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Run all tests**

```bash
bun run test
```

Expected: all tests PASS (no failures).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: pass config.timezone and config.downloadDir to all tool call sites"
```

---

### Task 11: Install `@inquirer/prompts`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
bun add -D @inquirer/prompts
```

- [ ] **Step 2: Verify**

```bash
grep inquirer package.json
```

Expected: `"@inquirer/prompts": "^x.x.x"` under `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @inquirer/prompts dev dependency"
```

---

### Task 12: Create `scripts/setup.ts` — helpers and tests

**Files:**
- Create: `scripts/setup.ts` (helpers only)
- Create: `tests/scripts/setup.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/scripts/setup.test.ts`:
```typescript
// tests/scripts/setup.test.ts
import { describe, it, expect } from 'vitest';

describe('resolveClaudeDesktopConfigPath', () => {
  it('returns a path ending in claude_desktop_config.json', async () => {
    const { resolveClaudeDesktopConfigPath } = await import('../../scripts/setup.js');
    expect(resolveClaudeDesktopConfigPath()).toMatch(/claude_desktop_config\.json$/);
  });

  it('returns a path containing "Claude"', async () => {
    const { resolveClaudeDesktopConfigPath } = await import('../../scripts/setup.js');
    expect(resolveClaudeDesktopConfigPath()).toContain('Claude');
  });
});

describe('mergeAccessCanvasEntry', () => {
  it('adds accesscanvas to empty mcpServers', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const result = mergeAccessCanvasEntry({ mcpServers: {} }, '/path/to/dist/index.js');
    expect(result.mcpServers['accesscanvas']).toEqual({
      command: 'node',
      args: ['/path/to/dist/index.js'],
    });
  });

  it('overwrites existing accesscanvas entry without duplicating', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const existing = {
      mcpServers: {
        accesscanvas: { command: 'node', args: ['/old/path/index.js'] },
        other: { command: 'python', args: ['server.py'] },
      },
    };
    const result = mergeAccessCanvasEntry(existing, '/new/path/index.js');
    expect(Object.keys(result.mcpServers)).toHaveLength(2);
    expect((result.mcpServers['accesscanvas'] as any).args[0]).toBe('/new/path/index.js');
    expect(result.mcpServers['other']).toEqual({ command: 'python', args: ['server.py'] });
  });

  it('handles config missing mcpServers entirely', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const result = mergeAccessCanvasEntry({}, '/path/index.js');
    expect(result.mcpServers['accesscanvas']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test -- tests/scripts/setup.test.ts
```

Expected: FAIL — `scripts/setup.js` doesn't exist.

- [ ] **Step 3: Create `scripts/setup.ts` with helpers only**

```bash
mkdir -p scripts
```

Create `scripts/setup.ts`:
```typescript
import { input, password, confirm } from '@inquirer/prompts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

// ── Pure helpers (exported for testing) ──────────────────────────────────────

export function resolveClaudeDesktopConfigPath(): string {
  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

export function mergeAccessCanvasEntry(
  existingConfig: { mcpServers?: Record<string, unknown> },
  distPath: string
): { mcpServers: Record<string, unknown> } {
  const mcpServers = { ...(existingConfig.mcpServers ?? {}) };
  mcpServers['accesscanvas'] = { command: 'node', args: [distPath] };
  return { ...existingConfig, mcpServers };
}

// ── Main wizard (added in Task 13) ───────────────────────────────────────────
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test -- tests/scripts/setup.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/setup.ts tests/scripts/setup.test.ts
git commit -m "feat: add setup wizard helpers with tests"
```

---

### Task 13: Complete `scripts/setup.ts` — interactive wizard

**Files:**
- Modify: `scripts/setup.ts`

- [ ] **Step 1: Replace `scripts/setup.ts` with the full wizard**

```typescript
import { input, password, confirm } from '@inquirer/prompts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

// ── Pure helpers (exported for testing) ──────────────────────────────────────

export function resolveClaudeDesktopConfigPath(): string {
  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

export function mergeAccessCanvasEntry(
  existingConfig: { mcpServers?: Record<string, unknown> },
  distPath: string
): { mcpServers: Record<string, unknown> } {
  const mcpServers = { ...(existingConfig.mcpServers ?? {}) };
  mcpServers['accesscanvas'] = { command: 'node', args: [distPath] };
  return { ...existingConfig, mcpServers };
}

// ── Main wizard ───────────────────────────────────────────────────────────────

async function main() {
  // Stage 1 — Welcome banner
  console.log('\nAccessCanvas Setup');
  console.log('==================');
  console.log('This will configure AccessCanvas to connect Claude to your Canvas LMS.');
  console.log("You'll need: your Canvas portal URL and an API token (we'll show you how to get one).\n");

  // Stage 2 — Canvas base URL
  const baseUrl = await input({
    message: 'What is your Canvas portal URL?',
    default: 'https://babson.instructure.com',
  });

  // Stage 3 — Canvas API token (with live validation loop)
  console.log('\nTo get your Canvas API token:');
  console.log('  1. Log in to your Canvas portal');
  console.log('  2. Click your profile picture → Settings');
  console.log('  3. Scroll down to "Approved Integrations"');
  console.log('  4. Click "+ New Access Token"');
  console.log('  5. Give it a name like "Claude" and click Generate');
  console.log("  6. Copy the token — you won't be able to see it again after closing that page\n");

  let token = '';
  while (true) {
    token = await password({ message: 'Paste your Canvas token: (input is hidden)' });

    try {
      const res = await fetch(`${baseUrl}/api/v1/users/self`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.log("\nThat token didn't work (401 Unauthorized). Double-check you copied the full token.\n");
        continue;
      }
      if (!res.ok) {
        console.log(`\nCanvas returned an unexpected error (${res.status}). Check your URL and try again.\n`);
        continue;
      }
      const user = await res.json() as { name: string };
      console.log(`\nToken validated. Logged in as ${user.name}.\n`);
      break;
    } catch {
      console.log('\nCould not reach Canvas. Check your URL and internet connection.\n');
    }
  }

  // Stage 4 — Timezone confirmation
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log(`Detected timezone: ${detectedTimezone}`);
  const timezoneConfirmed = await confirm({
    message: 'Is this correct?',
    default: true,
  });

  let timezone = detectedTimezone;
  if (!timezoneConfirmed) {
    console.log('\nCommon timezones: America/New_York, America/Chicago, America/Denver, America/Los_Angeles\n');
    timezone = await input({
      message: 'Enter your timezone (IANA format):',
      default: detectedTimezone,
    });
  }

  // Stage 5 — Download folder
  if (platform() === 'darwin') {
    console.log("\nTip: To copy a folder's path in Finder — right-click the folder, hold the Option key, then click 'Copy \"FolderName\" as Pathname'.\n");
  } else if (platform() === 'win32') {
    console.log('\nTip: To find a folder\'s path in File Explorer — click the address bar at the top of the window. It shows the full path you can copy and paste here.\n');
  }

  const downloadDir = await input({
    message: 'Where should Canvas files be downloaded?',
    default: join(homedir(), 'Academics'),
  });

  // Write ~/.accesscanvas/config.json
  const configDir = join(homedir(), '.accesscanvas');
  const configPath = join(configDir, 'config.json');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ token, baseUrl, downloadDir, timezone }, null, 2));
  console.log(`\nConfig saved to ${configPath}`);

  // Stage 6 — Claude Desktop config
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const distPath = resolve(__dirname, '..', 'dist', 'index.js');
  const claudeConfigPath = resolveClaudeDesktopConfigPath();

  const entryPreview = [
    '  "accesscanvas": {',
    '    "command": "node",',
    `    "args": ["${distPath}"]`,
    '  }',
  ].join('\n');

  console.log('\nAlmost done! Claude Desktop needs to know where AccessCanvas is installed.');
  console.log('\nAdd this to your Claude Desktop config under "mcpServers":\n');
  console.log(entryPreview);
  console.log(`\nConfig file location:\n  ${claudeConfigPath}\n`);

  const autoWrite = await confirm({
    message: 'Want me to add this automatically?',
    default: true,
  });

  if (autoWrite) {
    let existingConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (existsSync(claudeConfigPath)) {
      try {
        existingConfig = JSON.parse(readFileSync(claudeConfigPath, 'utf-8'));
      } catch {
        existingConfig = { mcpServers: {} };
      }
    } else {
      mkdirSync(dirname(claudeConfigPath), { recursive: true });
    }
    const merged = mergeAccessCanvasEntry(existingConfig, distPath);
    writeFileSync(claudeConfigPath, JSON.stringify(merged, null, 2));
    console.log("\nDone. Restart Claude Desktop and you're all set.");
  } else {
    console.log('\nTo add it manually, paste the following into your Claude Desktop config under "mcpServers":\n');
    console.log(entryPreview);
  }
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Confirm helper tests still pass (main() must not be triggered on import)**

```bash
bun run test -- tests/scripts/setup.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/setup.ts
git commit -m "feat: complete setup wizard with timezone confirmation and Claude Desktop auto-config"
```

---

### Task 14: Add `setup` script to `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the setup script**

In `package.json`, update `scripts` to:
```json
"scripts": {
  "build": "tsc",
  "dev": "tsx src/index.ts",
  "setup": "tsx scripts/setup.ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Run the full test suite one final time**

```bash
bun run test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add npm run setup script"
```

---

### Task 15: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the manual Setup section**

Find the `## Setup` section and replace everything through the Claude Desktop instructions with:

```markdown
## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Run the setup wizard

```bash
npm run setup
```

The wizard will ask for your Canvas URL, API token (with live validation), timezone (auto-detected, confirm or override), and download folder. It offers to auto-configure Claude Desktop. No manual file editing needed.

### 3. Build

```bash
npm run build
```

### 4. Restart Claude Desktop

AccessCanvas will appear in Claude's tool list.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README to use setup wizard"
```

---

## Self-Review

**Spec coverage — timezone spec:**

| Requirement | Task |
|---|---|
| Fix `bun test` → `bun run test` | Task 1 |
| `timezone` in Config | Task 2 |
| `config.ts` reads timezone, falls back to system | Task 3 |
| `formatDateTime(isoString, timezone)` | Task 4 |
| All 3 date-using tools accept timezone | Tasks 5, 6, 7 |
| `index.ts` passes `config.timezone` | Task 10 |
| Setup wizard detects + confirms timezone | Task 13 |
| Test assertions are deterministic (explicit timezone) | Tasks 5, 6, 7 |

**Spec coverage — setup wizard spec:**

| Requirement | Task |
|---|---|
| `downloadDir` in Config | Task 2 |
| `config.ts` reads downloadDir, falls back to ~/Academics | Task 3 |
| `fileManager.ts` accepts downloadDir | Task 8 |
| `downloadFiles.ts` accepts downloadDir | Task 9 |
| `index.ts` passes `config.downloadDir` | Task 10 |
| `@inquirer/prompts` installed | Task 11 |
| Wizard: URL, token with live validation, timezone, downloadDir, Claude Desktop | Task 13 |
| Re-run safe (overwrites config + Claude Desktop entry) | Task 13 |
| `npm run setup` in package.json | Task 14 |
| README updated | Task 15 |

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `formatDateTime(isoString: string | null, timezone: string): string | null` — used identically in Tasks 4, 5, 6, 7.
- `getAssignmentGrades(client, courseId, timezone)` — defined Task 5, called Task 10.
- `getUpcomingAssignments(client, options, allCourses, timezone)` — defined Task 6, called Task 10.
- `getAssignmentDetails(client, courseId, assignmentId, timezone)` — defined Task 7, called Task 10.
- `downloadFiles(client, cache, requests, downloadDir)` — defined Task 9, called Task 10.
- `downloadCanvasFile(..., downloadDir)` — defined Task 8, used internally in Task 9.
