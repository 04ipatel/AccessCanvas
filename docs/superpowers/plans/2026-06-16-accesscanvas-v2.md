# AccessCanvas v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild AccessCanvas as a lean, stateless, read-only Canvas-access MCP server exposing 9 clean primitives.

**Architecture:** Strip all caching and response-wrapping machinery. Keep the conducive Canvas-access libs (`canvasClient`, `htmlParser`, `dateUtils`, `config`). Simplify `fileManager` to not impose folder layout. Rewrite every tool as a thin, stateless function over the Canvas client, and rewrite `index.ts` to register the 9 tools with one uniform `{ data, _fetchedAt }` envelope.

**Tech Stack:** TypeScript (strict, ESM), `@modelcontextprotocol/sdk`, `zod`, `node-html-parser`, vitest, run via `bun run`.

**Reference spec:** `docs/superpowers/specs/2026-06-16-accesscanvas-v2-design.md`

**Branch:** `0.1.0-v2-rebuild` (created via `superpowers:using-git-worktrees` at execution time). Do NOT merge or push without explicit user permission.

---

## File Structure (end state)

```
src/
  index.ts        — REWRITE: register 9 tools, uniform { data, _fetchedAt } envelope
  types.ts        — MODIFY: add term to CourseInfo source, add CanvasFile listing usage; remove no types (cache types live in cache.ts which is deleted)
  lib/
    canvasClient.ts  — KEEP unchanged
    htmlParser.ts    — KEEP unchanged
    dateUtils.ts     — KEEP unchanged
    config.ts        — KEEP unchanged
    fileManager.ts   — REWRITE: downloadFile(client, {courseId, fileId, dest?}, downloadDir)
    cache.ts         — DELETE
  tools/
    listCourses.ts        — RENAME/MODIFY from getCourses.ts (add term)
    getAssignments.ts     — NEW (merges getUpcomingAssignments + getAssignmentDetails)
    getGrades.ts          — KEEP (already stateless)
    getAssignmentGrades.ts— KEEP (already stateless)
    getAnnouncements.ts   — KEEP (already stateless)
    getModules.ts         — REWRITE from getCourseModules.ts (remove cache)
    getModuleItem.ts      — REWRITE (remove cache; resolve item via live getModules)
    listFiles.ts          — NEW
    downloadFile.ts       — REWRITE from downloadFiles.ts (single file, dest, no imposed layout)
  (DELETE) tools/getCourses.ts, getUpcomingAssignments.ts, getAssignmentDetails.ts, getCourseModules.ts, downloadFiles.ts
tests/
  lib/fileManager.test.ts — REWRITE
  tools/*.test.ts         — one per tool (rewrite/new)
  (DELETE) tests/lib/cache.test.ts
```

**Naming contract (used across tasks):**
- Tool functions are named exactly as the file: `listCourses`, `getAssignments`, `getGrades`, `getAssignmentGrades`, `getAnnouncements`, `getModules`, `getModuleItem`, `listFiles`, `downloadFile`.
- MCP tool names (snake_case) in `index.ts`: `list_courses`, `get_assignments`, `get_grades`, `get_assignment_grades`, `get_announcements`, `get_modules`, `get_module_item`, `list_files`, `download_file`.
- Envelope helper: `withMeta(data)` returns `{ data, _fetchedAt: <ISO> }` — no other fields.

---

## Task 1: Foundation — delete cache, simplify fileManager, update types

**Files:**
- Delete: `src/lib/cache.ts`, `tests/lib/cache.test.ts`
- Delete: `src/tools/getCourses.ts`, `src/tools/getUpcomingAssignments.ts`, `src/tools/getAssignmentDetails.ts`, `src/tools/getCourseModules.ts`, `src/tools/downloadFiles.ts`
- Delete (old tests, replaced later): `tests/tools/getUpcomingAssignments.test.ts`, `tests/tools/getAssignmentDetails.test.ts`, `tests/tools/getCourseModules.test.ts`, `tests/tools/downloadFiles.test.ts`
- Rewrite: `src/lib/fileManager.ts`
- Test: `tests/lib/fileManager.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Delete cache, obsolete tools, and their tests**

```bash
git rm src/lib/cache.ts tests/lib/cache.test.ts \
  src/tools/getCourses.ts src/tools/getUpcomingAssignments.ts \
  src/tools/getAssignmentDetails.ts src/tools/getCourseModules.ts \
  src/tools/downloadFiles.ts \
  tests/tools/getUpcomingAssignments.test.ts tests/tools/getAssignmentDetails.test.ts \
  tests/tools/getCourseModules.test.ts tests/tools/downloadFiles.test.ts
```

Note: `getCourses.test.ts`, `getGrades.test.ts`, `getAssignmentGrades.test.ts`, `getAnnouncements.test.ts`, `getModuleItem.test.ts` are kept for now; they are rewritten in their respective tasks. The build will be red until those tasks complete — that is expected within this rebuild branch.

- [ ] **Step 2: Add `FileSummary` type and `term` field to types.ts**

In `src/types.ts`, add to the "MCP tool output shapes" section:

```typescript
export interface FileSummary {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}
```

Add an optional `term` to the `CanvasCourse` interface (Canvas returns it with `include[]=term`):

```typescript
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  term?: { name: string } | null;
  enrollments?: Array<{
    type: string;
    computed_current_score: number | null;
    computed_current_grade: string | null;
    computed_final_score: number | null;
    computed_final_grade: string | null;
  }>;
}
```

- [ ] **Step 3: Write the failing test for the new fileManager**

Replace the entire contents of `tests/lib/fileManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, isAbsolute } from 'path';
import { sanitizeName, downloadFile } from '../../src/lib/fileManager.js';

describe('sanitizeName', () => {
  it('strips spaces and unsafe characters', () => {
    expect(sanitizeName('Week 3: Slides (final).pdf')).toBe('Week3Slidesfinal.pdf');
  });
  it('keeps dots, hyphens, underscores', () => {
    expect(sanitizeName('case_study-2.v1.pdf')).toBe('case_study-2.v1.pdf');
  });
});

describe('downloadFile', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'accesscanvas-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const mockClient = () => ({
    get: vi.fn().mockResolvedValue({
      id: 42, display_name: 'Syllabus Final.pdf', filename: 'syll.pdf',
      url: 'https://canvas/files/42/download', size: 100, content_type: 'application/pdf',
    }),
    getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('PDFDATA')),
  });

  it('writes to downloadDir when no dest given, returns path + displayName', async () => {
    const client = mockClient();
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42' }, dir);
    expect(result.displayName).toBe('Syllabus Final.pdf');
    expect(result.path).toBe(join(dir, 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(result.path, 'utf-8')).toBe('PDFDATA');
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/files/42');
  });

  it('writes into a relative dest joined under downloadDir', async () => {
    const client = mockClient();
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42', dest: 'finance-200/materials' }, dir);
    expect(result.path).toBe(join(dir, 'finance-200/materials', 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
  });

  it('writes into an absolute dest as-is', async () => {
    const client = mockClient();
    const abs = join(dir, 'absolute-target');
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42', dest: abs }, dir);
    expect(isAbsolute(result.path)).toBe(true);
    expect(result.path).toBe(join(abs, 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test, verify it fails**

Run: `bun run test -- tests/lib/fileManager.test.ts`
Expected: FAIL — `downloadFile` is not exported (old file exports `downloadCanvasFile`).

- [ ] **Step 5: Rewrite fileManager.ts**

Replace the entire contents of `src/lib/fileManager.ts`:

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export interface DownloadFileRequest {
  courseId: string;
  fileId: string;
  dest?: string;
}

export interface DownloadFileResult {
  path: string;
  displayName: string;
}

/**
 * Downloads a Canvas file to local disk. AccessCanvas does NOT impose any folder
 * layout — the caller decides placement via `dest`:
 *   - no dest        → write flat into downloadDir
 *   - relative dest  → join(downloadDir, dest)
 *   - absolute dest  → use as-is
 * Filename comes from the Canvas display_name (sanitized).
 */
export async function downloadFile(
  client: CanvasClient,
  req: DownloadFileRequest,
  downloadDir: string
): Promise<DownloadFileResult> {
  const file = await client.get<CanvasFile>(
    `/api/v1/courses/${req.courseId}/files/${req.fileId}`
  );

  const targetDir = req.dest
    ? (isAbsolute(req.dest) ? req.dest : join(downloadDir, req.dest))
    : downloadDir;

  const path = join(targetDir, sanitizeName(file.display_name));

  mkdirSync(dirname(path), { recursive: true });
  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(path, buffer);

  return { path, displayName: file.display_name };
}
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `bun run test -- tests/lib/fileManager.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): remove cache, simplify fileManager, update types (0.1.0a)"
```

---

## Task 2: `listCourses`

**Files:**
- Create: `src/tools/listCourses.ts`
- Test: `tests/tools/listCourses.test.ts`
- Delete: `tests/tools/getCourses.test.ts` (replaced)

- [ ] **Step 1: Write the failing test**

Create `tests/tools/listCourses.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { listCourses } from '../../src/tools/listCourses.js';

describe('listCourses', () => {
  it('returns trimmed course list with term', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: '2026SP-01:RISK MANAGEMENT', course_code: 'FIN4507', term: { name: '2026 Spring' } },
        { id: 7779627, name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', course_code: 'QTM3310', term: null },
      ]),
    };
    const result = await listCourses(client as any);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '7779656', name: '2026SP-01:RISK MANAGEMENT', code: 'FIN4507', term: '2026 Spring' });
    expect(result[1]).toEqual({ id: '7779627', name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', code: 'QTM3310', term: null });
  });

  it('requests active student enrollments and includes term', async () => {
    const client = { getPaginated: vi.fn().mockResolvedValue([]) };
    await listCourses(client as any);
    expect(client.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses',
      expect.objectContaining({ enrollment_state: 'active', enrollment_type: 'student', 'include[]': 'term' })
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/listCourses.test.ts`
Expected: FAIL — module `listCourses.js` not found.

- [ ] **Step 3: Implement**

Create `src/tools/listCourses.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
  term: string | null;
}

export async function listCourses(client: CanvasClient): Promise<CourseInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
    'include[]': 'term',
  });

  return courses.map((c) => ({
    id: String(c.id),
    name: c.name,
    code: c.course_code,
    term: c.term?.name ?? null,
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/listCourses.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Delete the obsolete test and commit**

```bash
git rm tests/tools/getCourses.test.ts
git add -A
git commit -m "feat(tools): listCourses with term (0.1.0b)"
```

---

## Task 3: `getAssignments` (merges upcoming + details)

**Files:**
- Create: `src/tools/getAssignments.ts`
- Test: `tests/tools/getAssignments.test.ts`

Returns ALL assignments for a course with full detail (description parsed to text, embedded files, external links). No date-window filtering — that is the caller's job.

- [ ] **Step 1: Write the failing test**

Create `tests/tools/getAssignments.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getAssignments } from '../../src/tools/getAssignments.js';

describe('getAssignments', () => {
  it('returns full assignment detail with parsed description and files', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 555, name: 'Case Study 2', course_id: 7,
          description: '<p>Read the case. <a data-api-endpoint="https://canvas/api/v1/courses/7/files/99" href="x">rubric.pdf</a></p>',
          due_at: '2026-06-12T03:59:00Z', points_possible: 20,
          submission_types: ['online_upload'],
          html_url: 'https://canvas/courses/7/assignments/555',
        },
      ]),
    };
    const result = await getAssignments(client as any, '7', 'America/New_York');
    expect(result).toHaveLength(1);
    const a = result[0];
    expect(a.id).toBe('555');
    expect(a.courseId).toBe('7');
    expect(a.title).toBe('Case Study 2');
    expect(a.pointsPossible).toBe(20);
    expect(a.submissionType).toBe('online_upload');
    expect(a.url).toBe('https://canvas/courses/7/assignments/555');
    expect(a.dueAt).toMatch(/2026-06-11/); // 03:59 UTC → prior evening ET
    expect(a.description).toContain('Read the case.');
    expect(a.files).toEqual([{ name: 'rubric.pdf', fileId: '99', apiEndpoint: 'https://canvas/api/v1/courses/7/files/99' }]);
  });

  it('handles null description and null due date', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 1, name: 'No-due assignment', course_id: 7, description: null, due_at: null, points_possible: 0, submission_types: [], html_url: 'u' },
      ]),
    };
    const result = await getAssignments(client as any, '7', 'America/New_York');
    expect(result[0].dueAt).toBeNull();
    expect(result[0].description).toBe('');
    expect(result[0].files).toEqual([]);
    expect(result[0].submissionType).toBe('none');
  });

  it('requests assignments ordered by due date', async () => {
    const client = { getPaginated: vi.fn().mockResolvedValue([]) };
    await getAssignments(client as any, '7', 'America/New_York');
    expect(client.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7/assignments',
      expect.objectContaining({ order_by: 'due_at' })
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/getAssignments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/getAssignments.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import { formatDateTime } from '../lib/dateUtils.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';

export interface AssignmentDetail {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionType: string;
  url: string;
  description: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export async function getAssignments(
  client: CanvasClient,
  courseId: string,
  timezone: string
): Promise<AssignmentDetail[]> {
  const assignments = await client.getPaginated<CanvasAssignment & { html_url?: string }>(
    `/api/v1/courses/${courseId}/assignments`,
    { order_by: 'due_at' }
  );

  return assignments.map((a) => {
    const parsed = parseContent(a.description ?? '');
    return {
      id: String(a.id),
      courseId: String(a.course_id ?? courseId),
      title: a.name,
      dueAt: formatDateTime(a.due_at, timezone),
      pointsPossible: a.points_possible,
      submissionType: a.submission_types[0] ?? 'none',
      url: a.html_url ?? '',
      description: parsed.plainText,
      files: parsed.files,
      externalLinks: parsed.externalLinks,
    };
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/getAssignments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): getAssignments merges upcoming + details, stateless (0.1.0c)"
```

---

## Task 4: `getGrades` (keep, verify stateless)

**Files:**
- Keep: `src/tools/getGrades.ts` (already stateless — no change needed)
- Test: `tests/tools/getGrades.test.ts` (verify it still passes unchanged)

- [ ] **Step 1: Run the existing test**

Run: `bun run test -- tests/tools/getGrades.test.ts`
Expected: PASS. `getGrades.ts` already takes only `(client, courseId?)` and uses no cache.

- [ ] **Step 2: Confirm no cache import**

Open `src/tools/getGrades.ts` and confirm there is no `import ... cache`. There is none. No code change required.

- [ ] **Step 3: Commit (no-op marker only if anything changed)**

If nothing changed, skip the commit. Otherwise:

```bash
git add -A && git commit -m "chore(tools): confirm getGrades stateless (0.1.0d)"
```

---

## Task 5: `getAssignmentGrades` (keep, verify stateless)

**Files:**
- Keep: `src/tools/getAssignmentGrades.ts` (already stateless)
- Test: `tests/tools/getAssignmentGrades.test.ts`

- [ ] **Step 1: Run the existing test**

Run: `bun run test -- tests/tools/getAssignmentGrades.test.ts`
Expected: PASS. The function signature `(client, courseId, timezone)` is already stateless.

- [ ] **Step 2: Confirm no cache import**

Open `src/tools/getAssignmentGrades.ts`; confirm no cache import. None present. No change required.

---

## Task 6: `getAnnouncements` (keep, verify stateless)

**Files:**
- Keep: `src/tools/getAnnouncements.ts` (already stateless)
- Test: `tests/tools/getAnnouncements.test.ts`

- [ ] **Step 1: Run the existing test**

Run: `bun run test -- tests/tools/getAnnouncements.test.ts`
Expected: PASS. Signature `(client, courseId, limit?)`, no cache.

- [ ] **Step 2: Confirm no cache import** — none present. No change required.

---

## Task 7: `getModules` (rewrite stateless)

**Files:**
- Create: `src/tools/getModules.ts`
- Test: `tests/tools/getModules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/getModules.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getModules } from '../../src/tools/getModules.js';

describe('getModules', () => {
  it('maps modules and items, fetching items per module', async () => {
    const client = {
      getPaginated: vi.fn()
        // first call: modules
        .mockResolvedValueOnce([{ id: 10, name: 'Week 1', position: 1, items_count: 2, items_url: 'x' }])
        // second call: items of module 10
        .mockResolvedValueOnce([
          { id: 100, title: 'Lecture 1', type: 'Page', page_url: 'lecture-1', locked_for_user: false },
          { id: 101, title: 'Slides', type: 'File', content_id: 555, locked_for_user: false },
        ]),
    };
    const result = await getModules(client as any, '7');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '10', name: 'Week 1' });
    expect(result[0].items[0]).toMatchObject({ id: '100', title: 'Lecture 1', type: 'Page', pageUrl: 'lecture-1' });
    expect(result[0].items[1]).toMatchObject({ id: '101', title: 'Slides', type: 'File', fileId: '555' });
    expect(client.getPaginated).toHaveBeenNthCalledWith(1, '/api/v1/courses/7/modules');
    expect(client.getPaginated).toHaveBeenNthCalledWith(2, '/api/v1/courses/7/modules/10/items');
  });

  it('extracts password and cleans title for ExternalUrl items', async () => {
    const client = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce([{ id: 10, name: 'Links', position: 1, items_count: 1, items_url: 'x' }])
        .mockResolvedValueOnce([
          { id: 200, title: 'Zoom recording (password: ab12)', type: 'ExternalUrl', external_url: 'https://zoom/x', locked_for_user: false },
        ]),
    };
    const result = await getModules(client as any, '7');
    expect(result[0].items[0]).toMatchObject({ title: 'Zoom recording', externalUrl: 'https://zoom/x', password: 'ab12' });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/getModules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/getModules.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { extractPasswordFromTitle } from '../lib/htmlParser.js';
import type { CanvasModule, CanvasModuleItem, ModuleSummary, ModuleItemSummary } from '../types.js';

export async function getModules(
  client: CanvasClient,
  courseId: string
): Promise<ModuleSummary[]> {
  const modules = await client.getPaginated<CanvasModule>(
    `/api/v1/courses/${courseId}/modules`
  );

  const result: ModuleSummary[] = [];

  for (const mod of modules) {
    const items = await client.getPaginated<CanvasModuleItem>(
      `/api/v1/courses/${courseId}/modules/${mod.id}/items`
    );
    result.push({
      id: String(mod.id),
      name: mod.name,
      items: items.map(mapModuleItem),
    });
  }

  return result;
}

function mapModuleItem(item: CanvasModuleItem): ModuleItemSummary {
  const base: ModuleItemSummary = {
    id: String(item.id),
    title: item.title,
    type: item.type,
    locked: item.locked_for_user ?? false,
  };

  switch (item.type) {
    case 'File':
      return { ...base, fileId: item.content_id ? String(item.content_id) : undefined };
    case 'Page':
      return { ...base, pageUrl: item.page_url ?? undefined };
    case 'Assignment':
      return { ...base, assignmentId: item.content_id ? String(item.content_id) : undefined };
    case 'ExternalUrl': {
      const password = extractPasswordFromTitle(item.title);
      const cleanTitle = item.title.replace(/\s*\(password:[^)]+\)/i, '').trim();
      return { ...base, title: cleanTitle, externalUrl: item.external_url ?? undefined, password };
    }
    case 'Discussion':
      return { ...base, discussionId: item.content_id ? String(item.content_id) : undefined };
    default:
      return base;
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/getModules.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): getModules stateless (0.1.0e)"
```

---

## Task 8: `getModuleItem` (rewrite stateless)

**Files:**
- Rewrite: `src/tools/getModuleItem.ts`
- Test: `tests/tools/getModuleItem.test.ts` (rewrite)

Stateless: resolve the item by calling `getModules` live, find the item by id, then fetch its page/file content. Keep graceful text responses for item types that have dedicated tools (Assignment, Discussion) or cannot be fetched (SubHeader, Quiz, ExternalTool).

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/tools/getModuleItem.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// getModuleItem calls getModules internally; mock that module.
vi.mock('../../src/tools/getModules.js', () => ({
  getModules: vi.fn(),
}));
import { getModules } from '../../src/tools/getModules.js';
import { getModuleItem } from '../../src/tools/getModuleItem.js';

describe('getModuleItem', () => {
  it('fetches a Page item and returns parsed content', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '100', title: 'Lecture 1', type: 'Page', pageUrl: 'lecture-1', locked: false }] },
    ]);
    const client = {
      get: vi.fn().mockResolvedValue({ title: 'Lecture 1', body: '<p>Welcome. <a data-api-endpoint="https://canvas/api/v1/courses/7/files/99" href="x">notes.pdf</a></p>' }),
    };
    const result = await getModuleItem(client as any, '7', '100');
    expect(result.title).toBe('Lecture 1');
    expect(result.plainText).toContain('Welcome.');
    expect(result.files).toEqual([{ name: 'notes.pdf', fileId: '99', apiEndpoint: 'https://canvas/api/v1/courses/7/files/99' }]);
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/pages/lecture-1');
  });

  it('fetches a File item via the files endpoint', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '101', title: 'Slides', type: 'File', fileId: '555', locked: false }] },
    ]);
    const client = {
      get: vi.fn().mockResolvedValue({ display_name: 'Slides.pdf', url: 'https://canvas/files/555/download' }),
    };
    const result = await getModuleItem(client as any, '7', '101');
    expect(result.title).toBe('Slides.pdf');
    expect(result.files[0]).toMatchObject({ name: 'Slides.pdf' });
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/files/555');
  });

  it('returns a guidance message for Assignment items', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '102', title: 'Case 2', type: 'Assignment', assignmentId: '555', locked: false }] },
    ]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '102');
    expect(result.plainText).toContain('get_assignments');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('returns a not-found message when the item is absent', async () => {
    (getModules as any).mockResolvedValue([{ id: '10', name: 'Week 1', items: [] }]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '999');
    expect(result.plainText).toContain('not found');
    expect(client.get).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/getModuleItem.test.ts`
Expected: FAIL — current `getModuleItem` signature takes a cache argument and imports `cache.js` (now deleted), so the import itself errors.

- [ ] **Step 3: Implement**

Replace the entire contents of `src/tools/getModuleItem.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import { getModules } from './getModules.js';
import type { CanvasFile, CanvasPage, ParsedContent } from '../types.js';

export interface ModuleItemContent {
  id: string;
  title: string;
  plainText: string;
  files: ParsedContent['files'];
  externalLinks: ParsedContent['externalLinks'];
}

export async function getModuleItem(
  client: CanvasClient,
  courseId: string,
  moduleItemId: string
): Promise<ModuleItemContent> {
  const modules = await getModules(client, courseId);

  let found;
  for (const mod of modules) {
    found = mod.items.find((i) => i.id === moduleItemId);
    if (found) break;
  }

  if (!found) {
    return empty(moduleItemId, 'Unknown item',
      `Module item ${moduleItemId} not found in course ${courseId}. Call get_modules to list valid item IDs.`);
  }

  // Types with dedicated tools or no fetchable content.
  if (found.type === 'Assignment' && found.assignmentId) {
    return empty(moduleItemId, found.title,
      `This is an assignment. Use get_assignments with courseId: ${courseId} to see its full description, files, and due date.`);
  }
  if (found.type === 'Discussion') {
    return empty(moduleItemId, found.title,
      `This is a discussion. Use get_announcements with courseId: ${courseId}, or open it directly on Canvas.`);
  }
  if (found.type === 'ExternalUrl') {
    return empty(moduleItemId, found.title,
      `This is an external link: ${found.externalUrl ?? '(none)'}${found.password ? ` (password: ${found.password})` : ''}`);
  }
  if (found.type === 'SubHeader' || found.type === 'ExternalTool' || found.type === 'Quiz') {
    return empty(moduleItemId, found.title,
      `This item (type: ${found.type}) cannot be fetched directly. Access it through Canvas.`);
  }

  let title: string;
  let html: string;

  if (found.type === 'File' && found.fileId) {
    const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${found.fileId}`);
    title = file.display_name;
    html = `<a href="${file.url}" data-api-endpoint="${file.url}">${file.display_name}</a>`;
  } else if (found.pageUrl) {
    const page = await client.get<CanvasPage>(`/api/v1/courses/${courseId}/pages/${found.pageUrl}`);
    title = page.title;
    html = page.body;
  } else {
    return empty(moduleItemId, found.title,
      `Could not determine how to fetch this module item (type: ${found.type}).`);
  }

  const parsed = parseContent(html);
  return { id: moduleItemId, title, plainText: parsed.plainText, files: parsed.files, externalLinks: parsed.externalLinks };
}

function empty(id: string, title: string, plainText: string): ModuleItemContent {
  return { id, title, plainText, files: [], externalLinks: [] };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/getModuleItem.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): getModuleItem stateless via live module lookup (0.1.0f)"
```

---

## Task 9: `listFiles` (new)

**Files:**
- Create: `src/tools/listFiles.ts`
- Test: `tests/tools/listFiles.test.ts`

Lists files Canvas exposes for a course. When a professor disables file export, Canvas returns 403; surface that as an empty list, not an error.

- [ ] **Step 1: Write the failing test**

Create `tests/tools/listFiles.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { listFiles } from '../../src/tools/listFiles.js';

describe('listFiles', () => {
  it('returns mapped file summaries', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 99, display_name: 'Syllabus.pdf', filename: 'syll.pdf', url: 'u', size: 1024, content_type: 'application/pdf' },
      ]),
    };
    const result = await listFiles(client as any, '7');
    expect(result).toEqual([{ id: '99', name: 'Syllabus.pdf', url: 'u', type: 'application/pdf', size: 1024 }]);
    expect(client.getPaginated).toHaveBeenCalledWith('/api/v1/courses/7/files');
  });

  it('returns empty list when Canvas returns 403 (export disabled)', async () => {
    const client = {
      getPaginated: vi.fn().mockRejectedValue(new Error('Canvas API error 403 Forbidden — /api/v1/courses/7/files')),
    };
    const result = await listFiles(client as any, '7');
    expect(result).toEqual([]);
  });

  it('rethrows non-403 errors', async () => {
    const client = {
      getPaginated: vi.fn().mockRejectedValue(new Error('Canvas API error 500 Server Error — /api/v1/courses/7/files')),
    };
    await expect(listFiles(client as any, '7')).rejects.toThrow('500');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/listFiles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/listFiles.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasFile, FileSummary } from '../types.js';

export async function listFiles(
  client: CanvasClient,
  courseId: string
): Promise<FileSummary[]> {
  let files: CanvasFile[];
  try {
    files = await client.getPaginated<CanvasFile>(`/api/v1/courses/${courseId}/files`);
  } catch (err) {
    // A professor can disable file export → Canvas responds 403. Absence is information, not an error.
    if (err instanceof Error && /\b40[13]\b/.test(err.message)) return [];
    throw err;
  }

  return files.map((f) => ({
    id: String(f.id),
    name: f.display_name,
    url: f.url,
    type: f.content_type,
    size: f.size,
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/listFiles.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): listFiles with graceful export-disabled handling (0.1.0g)"
```

---

## Task 10: `downloadFile` (single-file tool wrapper)

**Files:**
- Create: `src/tools/downloadFile.ts`
- Test: `tests/tools/downloadFile.test.ts`

Thin wrapper over `fileManager.downloadFile` (already tested in Task 1). The tool layer exists so `index.ts` imports from `tools/` uniformly and to keep a stable tool-level type.

- [ ] **Step 1: Write the failing test**

Create `tests/tools/downloadFile.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadFile } from '../../src/tools/downloadFile.js';

describe('downloadFile (tool)', () => {
  it('downloads a single file and returns path + displayName', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'accesscanvas-tool-'));
    try {
      const client = {
        get: vi.fn().mockResolvedValue({ id: 42, display_name: 'Notes.pdf', url: 'https://canvas/files/42/download', size: 5, content_type: 'application/pdf' }),
        getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('hello')),
      };
      const result = await downloadFile(client as any, { courseId: '7', fileId: '42' }, dir);
      expect(result.displayName).toBe('Notes.pdf');
      expect(existsSync(result.path)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- tests/tools/downloadFile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/downloadFile.ts`:

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { downloadFile as downloadToDisk } from '../lib/fileManager.js';
import type { DownloadFileRequest, DownloadFileResult } from '../lib/fileManager.js';

export type { DownloadFileRequest, DownloadFileResult };

export async function downloadFile(
  client: CanvasClient,
  req: DownloadFileRequest,
  downloadDir: string
): Promise<DownloadFileResult> {
  return downloadToDisk(client, req, downloadDir);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test -- tests/tools/downloadFile.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): downloadFile single-file tool wrapper (0.1.0h)"
```

---

## Task 11: Rewrite `index.ts` — register the 9 tools

**Files:**
- Rewrite: `src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

Replace the entire contents of `src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadConfig } from './lib/config.js';
import { CanvasClient } from './lib/canvasClient.js';

import { listCourses } from './tools/listCourses.js';
import { getAssignments } from './tools/getAssignments.js';
import { getGrades } from './tools/getGrades.js';
import { getAssignmentGrades } from './tools/getAssignmentGrades.js';
import { getAnnouncements } from './tools/getAnnouncements.js';
import { getModules } from './tools/getModules.js';
import { getModuleItem } from './tools/getModuleItem.js';
import { listFiles } from './tools/listFiles.js';
import { downloadFile } from './tools/downloadFile.js';

function withMeta(data: unknown) {
  return { data, _fetchedAt: new Date().toISOString() };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(withMeta(data), null, 2) }] };
}

const config = loadConfig();
const client = new CanvasClient(config);

const server = new McpServer({ name: 'accesscanvas', version: '0.1.0' });

server.tool(
  'list_courses',
  'List active enrolled courses (id, name, code, term).',
  {},
  async () => ok(await listCourses(client))
);

server.tool(
  'get_assignments',
  'List all assignments for a course with full detail: due date, points, parsed description, embedded files, and external links. Filter by date yourself — this returns the full set.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getAssignments(client, courseId, config.timezone))
);

server.tool(
  'get_grades',
  'Get current course-level grades. Omit courseId for all courses.',
  { courseId: z.string().optional().describe('Canvas course ID; omit for all courses') },
  async ({ courseId }) => ok(await getGrades(client, courseId))
);

server.tool(
  'get_assignment_grades',
  'Get per-assignment scores for a course: score, points possible, grade, and missing/late flags.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getAssignmentGrades(client, courseId, config.timezone))
);

server.tool(
  'get_announcements',
  'Get recent announcements for a course.',
  {
    courseId: z.string().describe('Canvas course ID'),
    limit: z.number().optional().describe('Max announcements to return (default 5)'),
  },
  async ({ courseId, limit }) => ok(await getAnnouncements(client, courseId, limit))
);

server.tool(
  'get_modules',
  'Get the full module structure for a course: modules and their items (pages, files, assignments, links).',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getModules(client, courseId))
);

server.tool(
  'get_module_item',
  'Get the content of one module item (page or file): plain text plus any embedded files. Get item IDs from get_modules.',
  {
    courseId: z.string().describe('Canvas course ID'),
    moduleItemId: z.string().describe('Module item ID from get_modules'),
  },
  async ({ courseId, moduleItemId }) => ok(await getModuleItem(client, courseId, moduleItemId))
);

server.tool(
  'list_files',
  'List files Canvas exposes for a course. Returns an empty list if the professor disabled file export.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await listFiles(client, courseId))
);

server.tool(
  'download_file',
  'Download one Canvas file to local disk. `dest` (optional): a directory — absolute, or relative to the configured downloadDir. Filename comes from Canvas. Returns the written path. Get fileId from get_assignments, get_module_item, or list_files.',
  {
    courseId: z.string().describe('Canvas course ID'),
    fileId: z.string().describe('Canvas file ID'),
    dest: z.string().optional().describe('Target directory (absolute, or relative to downloadDir). Omit for flat downloadDir.'),
  },
  async ({ courseId, fileId, dest }) => ok(await downloadFile(client, { courseId, fileId, dest }, config.downloadDir))
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Build to verify everything compiles and resolves**

Run: `bun run build`
Expected: clean compile, `dist/index.js` produced, no unresolved imports (cache.js fully removed).

- [ ] **Step 3: Run the full test suite**

Run: `bun run test`
Expected: ALL tests pass. No references to deleted files remain.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(server): register 9 stateless tools, uniform envelope (0.1.0i)"
```

---

## Task 12: Version, docs, and full verification

**Files:**
- Modify: `package.json` (version → `0.1.0`)
- Modify: `CLAUDE.md` (update architecture + tool list)
- Modify: `README.md` (update tool list / remove cache mentions)
- Create: `docs/reference/decisions.md` (if absent) with the stateless decision

- [ ] **Step 1: Bump version**

In `package.json`, change `"version": "1.0.0"` to `"version": "0.1.0"`.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, replace the "What This Is" and "Architecture" sections so they describe: a stateless, read-only Canvas-access MCP server with 9 tools; no SQLite cache; the karpathy-wiki lives downstream in Claude automations (not this repo). Remove the "Two categories of tools" (live vs cached) section and the `_fromCache`/`_hint` references. List the 9 tools and note `download_file` takes an optional `dest`.

- [ ] **Step 3: Update README.md**

Remove cache/forceRefresh mentions. Update the tool list to the 9 v2 tools. Keep setup instructions (`bun run setup`) unchanged.

- [ ] **Step 4: Record the decision**

Create `docs/reference/decisions.md` if it does not exist, newest-first, with an entry (timestamp to the minute) recording: v2 is stateless (no cache); the vault/karpathy-wiki is downstream and out of scope; AccessCanvas is a pure Canvas-access layer of 9 primitives. Note rejected alternatives (SQLite cache, in-memory per-run cache deferred).

- [ ] **Step 5: Full build + test + smoke**

```bash
bun run build && bun run test
```
Expected: clean build, all tests green.

Smoke test against real Canvas (requires a valid `~/.accesscanvas/config.json`):

```bash
bun run dev
```
Then, from an MCP client (or Claude Desktop pointed at this server), call `list_courses` and confirm real courses return with a `_fetchedAt` and no cache fields. (This step is owner-run; record the result.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(release): v2 docs, version 0.1.0, decisions log (0.1.0j)"
```

---

## Self-Review (completed during plan authoring)

**Spec coverage:** every spec section maps to a task —
- 9 primitives → Tasks 2–10; stateless (no cache) → Task 1 (cache deleted) + every tool signature dropping the cache arg; `{ data, _fetchedAt }` envelope → Task 11; `fileManager` no-imposed-layout → Task 1; keep canvasClient/htmlParser/dateUtils/config → untouched; version `0.1.0` → Task 12; both grade tools kept → Tasks 4 & 5; error handling (403 → empty) → Task 9; docs → Task 12.

**Placeholder scan:** no TBD/TODO; every code step has complete code.

**Type consistency:** `CourseInfo` gains `term: string | null` (Task 2) consistent with `CanvasCourse.term` (Task 1). `DownloadFileRequest`/`DownloadFileResult` defined in Task 1, re-exported in Task 10, consumed in Task 11. `getModuleItem` consumes `ModuleSummary`/`ModuleItemSummary` from `getModules` (Tasks 7–8). MCP tool names and function names match the Naming Contract.

**Known consequence:** after Task 1 the tree is red (deleted modules still imported by old `index.ts`) until Task 11 rewrites `index.ts`. This is expected on the rebuild branch; the branch must be green before any merge to main per the project's push rules.
```
