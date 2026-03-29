# AccessCanvas MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local TypeScript MCP server that gives Claude read-only access to Babson's Canvas LMS — courses, grades, assignments, module navigation, and file downloads.

**Architecture:** Stdio MCP server with 8 tools. Live Canvas API calls for time-sensitive data (grades, assignments, announcements); SQLite cache at `~/.accesscanvas/cache.db` for stable content (modules, pages). Files downloaded to `~/Canvas/{CourseName}/{Context}/`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `better-sqlite3`, `node-html-parser`, `zod`, `vitest`, Node.js 18+

---

## File Map

```
AccessCanvas/
  src/
    index.ts                        — MCP server entry, registers all tools
    types.ts                        — shared TypeScript interfaces
    lib/
      config.ts                     — load ~/.accesscanvas/config.json
      canvasClient.ts               — authenticated Canvas REST client w/ pagination
      htmlParser.ts                 — extract files/links from HTML content
      cache.ts                      — SQLite read/write helpers
      fileManager.ts                — download files, organize to ~/Canvas/
    tools/
      getCourses.ts                 — list enrolled courses
      getUpcomingAssignments.ts     — assignments due within N days
      getGrades.ts                  — current grades per course
      getAnnouncements.ts           — recent announcements
      getAssignmentDetails.ts       — assignment details + embedded files
      getCourseModules.ts           — module structure (cache-backed)
      getModuleItem.ts              — page/file content (cache-backed)
      downloadFiles.ts              — download files to local folder
  tests/
    lib/
      config.test.ts
      canvasClient.test.ts
      htmlParser.test.ts
      cache.test.ts
      fileManager.test.ts
    tools/
      getCourses.test.ts
      getUpcomingAssignments.test.ts
      getGrades.test.ts
      getAnnouncements.test.ts
      getAssignmentDetails.test.ts
      getCourseModules.test.ts
      getModuleItem.test.ts
      downloadFiles.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
  claude-desktop-config.json        — snippet to add to Claude Desktop MCP config
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize project**

```bash
cd /Users/ishanpatel/Projects/AccessCanvas
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk better-sqlite3 node-html-parser zod
npm install --save-dev typescript @types/node @types/better-sqlite3 vitest tsx
```

- [ ] **Step 3: Write `package.json`**

Replace the generated package.json with:

```json
{
  "name": "accesscanvas",
  "version": "1.0.0",
  "description": "MCP server for Babson Canvas LMS",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^9.0.0",
    "node-html-parser": "^6.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
*.js.map
~/.accesscanvas/
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/lib src/tools tests/lib tests/tools
```

- [ ] **Step 8: Verify setup compiles**

```bash
echo 'console.log("hello")' > src/index.ts
npx tsx src/index.ts
```

Expected output: `hello`

- [ ] **Step 9: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "feat: initialize AccessCanvas MCP project scaffold"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
// Canvas API response shapes
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollments?: Array<{
    type: string;
    computed_current_score: number | null;
    computed_current_grade: string | null;
    computed_final_score: number | null;
    computed_final_grade: string | null;
  }>;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  submission_types: string[];
  course_id: number;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items_url: string;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  position: number;
  indent: number;
  type: 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool';
  content_id?: number;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  locked_for_user?: boolean;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  content_type: string;
}

export interface CanvasPage {
  page_id: number;
  url: string;
  title: string;
  body: string;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string;
  posted_at: string;
}

// MCP tool output shapes (trimmed — only what Claude needs)
export interface FileRef {
  name: string;
  fileId: string | null;
  apiEndpoint: string | null;
}

export interface ExternalLink {
  title: string;
  url: string;
}

export interface ParsedContent {
  plainText: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export interface ModuleItemSummary {
  id: string;
  title: string;
  type: string;
  locked: boolean;
  fileId?: string;
  pageUrl?: string;
  assignmentId?: string;
  externalUrl?: string;
  password?: string;
  discussionId?: string;
}

export interface ModuleSummary {
  id: string;
  name: string;
  items: ModuleItemSummary[];
}

// Config
export interface Config {
  token: string;
  baseUrl: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Config Loader

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/lib/config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
    expect(() => loadConfig(join(tmpDir, 'missing.json'))).toThrow(
      /config file not found/i
    );
  });

  it('throws if token is missing', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ baseUrl: 'https://babson.instructure.com' }));
    const { loadConfig } = await import('../../src/lib/config.js');
    expect(() => loadConfig(configPath)).toThrow(/token/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/config.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/lib/config.ts`**

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config } from '../types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.accesscanvas', 'config.json');

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config {
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Create it with: { "token": "...", "baseUrl": "https://babson.instructure.com" }`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  if (!raw.token) {
    throw new Error('Config missing required field: token');
  }
  if (!raw.baseUrl) {
    throw new Error('Config missing required field: baseUrl');
  }

  return { token: raw.token, baseUrl: raw.baseUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/config.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts tests/lib/config.test.ts
git commit -m "feat: add config loader"
```

---

## Task 4: Canvas API Client

**Files:**
- Create: `src/lib/canvasClient.ts`
- Create: `tests/lib/canvasClient.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/canvasClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CanvasClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('adds Authorization header to requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      json: async () => [{ id: 1, name: 'Test Course' }],
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'my-token', baseUrl: 'https://babson.instructure.com' });
    await client.get('/api/v1/courses');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://babson.instructure.com/api/v1/courses',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      })
    );
  });

  it('follows pagination via Link header', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (h: string) =>
            h === 'Link'
              ? '<https://babson.instructure.com/api/v1/courses?page=2>; rel="next"'
              : null,
        },
        json: async () => [{ id: 1, name: 'Course 1' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => [{ id: 2, name: 'Course 2' }],
      });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'tok', baseUrl: 'https://babson.instructure.com' });
    const results = await client.getPaginated('/api/v1/courses');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, name: 'Course 1' });
    expect(results[1]).toEqual({ id: 2, name: 'Course 2' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'bad', baseUrl: 'https://babson.instructure.com' });
    await expect(client.get('/api/v1/courses')).rejects.toThrow('401');
  });

  it('downloads binary file as Buffer', async () => {
    const fakeData = new Uint8Array([1, 2, 3]).buffer;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => fakeData,
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'tok', baseUrl: 'https://babson.instructure.com' });
    const buf = await client.getFileBuffer('https://babson.instructure.com/files/123/download');

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/canvasClient.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/lib/canvasClient.ts`**

```typescript
import type { Config } from '../types.js';

export class CanvasClient {
  private token: string;
  private baseUrl: string;

  constructor(config: Config) {
    this.token = config.token;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      throw new Error(
        `Canvas API error ${res.status} ${res.statusText} — ${url.toString()}`
      );
    }

    return res.json() as Promise<T>;
  }

  async getPaginated<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = this.baseUrl + path;

    const initialParams = new URLSearchParams(params);
    initialParams.set('per_page', '100');
    nextUrl += '?' + initialParams.toString();

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) {
        throw new Error(`Canvas API error ${res.status} ${res.statusText} — ${nextUrl}`);
      }

      const page = (await res.json()) as T[];
      results.push(...page);

      const linkHeader = res.headers.get('Link');
      nextUrl = parseLinkNext(linkHeader);
    }

    return results;
  }

  async getFileBuffer(downloadUrl: string): Promise<Buffer> {
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      throw new Error(`File download error ${res.status} — ${downloadUrl}`);
    }

    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/canvasClient.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvasClient.ts tests/lib/canvasClient.test.ts
git commit -m "feat: add Canvas API client with pagination"
```

---

## Task 5: HTML Parser

**Files:**
- Create: `src/lib/htmlParser.ts`
- Create: `tests/lib/htmlParser.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/htmlParser.test.ts
import { describe, it, expect } from 'vitest';

describe('parseContent', () => {
  it('extracts file with data-api-endpoint attribute', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a
      title="Assignment 2.pdf"
      href="viewer/files/Uploaded%20Media/Assignment%202.pdf"
      data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828267"
      data-api-returntype="File">Assignment 2.pdf</a></p>`;

    const result = parseContent(html);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('Assignment 2.pdf');
    expect(result.files[0].apiEndpoint).toBe(
      'https://babson.instructure.com/api/v1/courses/7779656/files/344828267'
    );
    expect(result.files[0].fileId).toBe('344828267');
  });

  it('falls back to href when no data-api-endpoint', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a
      class="instructure_file_link"
      title="Syllabus.pdf"
      href="viewer/files/Syllabus.pdf">Syllabus.pdf</a></p>`;

    const result = parseContent(html);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('Syllabus.pdf');
    expect(result.files[0].apiEndpoint).toBeNull();
    expect(result.files[0].fileId).toBeNull();
  });

  it('extracts external links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a href="https://babson.webex.com/recording/abc" >Session Recording</a></p>`;

    const result = parseContent(html);

    expect(result.externalLinks).toHaveLength(1);
    expect(result.externalLinks[0].title).toBe('Session Recording');
    expect(result.externalLinks[0].url).toBe('https://babson.webex.com/recording/abc');
  });

  it('strips HTML tags to produce plain text', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<h3><strong>Learning Objectives</strong></h3><ul><li>Understand risk</li><li>Measure risk</li></ul>`;

    const result = parseContent(html);

    expect(result.plainText).toContain('Learning Objectives');
    expect(result.plainText).toContain('Understand risk');
    expect(result.plainText).toContain('Measure risk');
  });

  it('does not double-count files and external links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `
      <a data-api-endpoint="https://babson.instructure.com/api/v1/courses/1/files/99"
         href="viewer/files/file.pdf" title="file.pdf">file.pdf</a>
      <a href="https://google.com">Google</a>
    `;

    const result = parseContent(html);
    expect(result.files).toHaveLength(1);
    expect(result.externalLinks).toHaveLength(1);
  });

  it('returns empty arrays for content with no files or links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p>Please complete the reading before class.</p>`;
    const result = parseContent(html);
    expect(result.files).toHaveLength(0);
    expect(result.externalLinks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/htmlParser.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/lib/htmlParser.ts`**

```typescript
import { parse } from 'node-html-parser';
import type { ParsedContent, FileRef, ExternalLink } from '../types.js';

const CANVAS_FILE_URL = /\/api\/v1\/courses\/\d+\/files\/(\d+)/;
const CANVAS_VIEWER_FILE = /viewer\/files\//;
const EXTERNAL_URL = /^https?:\/\//;

export function parseContent(html: string): ParsedContent {
  const root = parse(html);
  const files: FileRef[] = [];
  const externalLinks: ExternalLink[] = [];

  for (const anchor of root.querySelectorAll('a')) {
    const apiEndpoint = anchor.getAttribute('data-api-endpoint') ?? null;
    const href = anchor.getAttribute('href') ?? '';
    const title = (anchor.getAttribute('title') || anchor.text || href).trim();

    if (apiEndpoint && CANVAS_FILE_URL.test(apiEndpoint)) {
      const match = apiEndpoint.match(CANVAS_FILE_URL);
      files.push({
        name: title,
        fileId: match ? match[1] : null,
        apiEndpoint,
      });
      continue;
    }

    if (CANVAS_VIEWER_FILE.test(href)) {
      files.push({ name: title, fileId: null, apiEndpoint: null });
      continue;
    }

    if (EXTERNAL_URL.test(href)) {
      externalLinks.push({ title, url: href });
    }
  }

  const plainText = root.text.replace(/\s+/g, ' ').trim();

  return { plainText, files, externalLinks };
}

export function extractPasswordFromTitle(title: string): string | undefined {
  const match = title.match(/\(password:\s*([^)]+)\)/i);
  return match ? match[1].trim() : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/htmlParser.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/htmlParser.ts tests/lib/htmlParser.test.ts
git commit -m "feat: add HTML parser for Canvas content"
```

---

## Task 6: Cache Layer

**Files:**
- Create: `src/lib/cache.ts`
- Create: `tests/lib/cache.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('Cache', () => {
  let cache: Awaited<ReturnType<typeof import('../../src/lib/cache.js').openCache>>;

  beforeEach(async () => {
    const { openCache } = await import('../../src/lib/cache.js');
    cache = openCache(':memory:');
  });

  it('stores and retrieves module structure', () => {
    const data = [{ id: '1', name: 'Syllabus', items: [] }];
    cache.setModuleStructure('course-123', data);
    const result = cache.getModuleStructure('course-123');
    expect(result).toEqual(data);
  });

  it('returns null for uncached module structure', () => {
    const result = cache.getModuleStructure('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves cached page content', () => {
    cache.setPage('item-456', 'course-123', 'Syllabus Week 1', '<p>content</p>');
    const result = cache.getPage('item-456');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Syllabus Week 1');
    expect(result!.content).toBe('<p>content</p>');
    expect(result!.courseId).toBe('course-123');
  });

  it('returns null for uncached page', () => {
    expect(cache.getPage('nonexistent')).toBeNull();
  });

  it('records and retrieves downloaded file', () => {
    cache.recordDownloadedFile('file-789', 'course-123', '/Users/test/Canvas/file.pdf', 'file.pdf');
    const result = cache.getDownloadedFile('file-789');
    expect(result).not.toBeNull();
    expect(result!.localPath).toBe('/Users/test/Canvas/file.pdf');
    expect(result!.displayName).toBe('file.pdf');
  });

  it('overwrites module structure on second set', () => {
    cache.setModuleStructure('course-123', [{ id: '1', name: 'Old', items: [] }]);
    cache.setModuleStructure('course-123', [{ id: '2', name: 'New', items: [] }]);
    const result = cache.getModuleStructure('course-123');
    expect(result![0].name).toBe('New');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/cache.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/lib/cache.ts`**

```typescript
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ModuleSummary } from '../types.js';

export interface CachedPage {
  id: string;
  courseId: string;
  title: string;
  content: string;
  fetchedAt: string;
}

export interface CachedDownload {
  fileId: string;
  courseId: string;
  localPath: string;
  displayName: string;
  fetchedAt: string;
}

export interface Cache {
  getModuleStructure(courseId: string): ModuleSummary[] | null;
  setModuleStructure(courseId: string, data: ModuleSummary[]): void;
  getPage(itemId: string): CachedPage | null;
  setPage(itemId: string, courseId: string, title: string, content: string): void;
  recordDownloadedFile(fileId: string, courseId: string, localPath: string, displayName: string): void;
  getDownloadedFile(fileId: string): CachedDownload | null;
}

export function openCache(dbPath?: string): Cache {
  const resolvedPath = dbPath ?? join(homedir(), '.accesscanvas', 'cache.db');

  if (resolvedPath !== ':memory:') {
    mkdirSync(join(homedir(), '.accesscanvas'), { recursive: true });
  }

  const db = new Database(resolvedPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS module_structure (
      course_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_pages (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloaded_files (
      file_id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      display_name TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);

  return {
    getModuleStructure(courseId: string): ModuleSummary[] | null {
      const row = db
        .prepare('SELECT data FROM module_structure WHERE course_id = ?')
        .get(courseId) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },

    setModuleStructure(courseId: string, data: ModuleSummary[]): void {
      db.prepare(
        'INSERT OR REPLACE INTO module_structure (course_id, data, fetched_at) VALUES (?, ?, ?)'
      ).run(courseId, JSON.stringify(data), new Date().toISOString());
    },

    getPage(itemId: string): CachedPage | null {
      const row = db
        .prepare('SELECT * FROM cached_pages WHERE id = ?')
        .get(itemId) as any;
      if (!row) return null;
      return {
        id: row.id,
        courseId: row.course_id,
        title: row.title,
        content: row.content,
        fetchedAt: row.fetched_at,
      };
    },

    setPage(itemId: string, courseId: string, title: string, content: string): void {
      db.prepare(
        'INSERT OR REPLACE INTO cached_pages (id, course_id, title, content, fetched_at) VALUES (?, ?, ?, ?, ?)'
      ).run(itemId, courseId, title, content, new Date().toISOString());
    },

    recordDownloadedFile(fileId: string, courseId: string, localPath: string, displayName: string): void {
      db.prepare(
        'INSERT OR REPLACE INTO downloaded_files (file_id, course_id, local_path, display_name, fetched_at) VALUES (?, ?, ?, ?, ?)'
      ).run(fileId, courseId, localPath, displayName, new Date().toISOString());
    },

    getDownloadedFile(fileId: string): CachedDownload | null {
      const row = db
        .prepare('SELECT * FROM downloaded_files WHERE file_id = ?')
        .get(fileId) as any;
      if (!row) return null;
      return {
        fileId: row.file_id,
        courseId: row.course_id,
        localPath: row.local_path,
        displayName: row.display_name,
        fetchedAt: row.fetched_at,
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/cache.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.ts tests/lib/cache.test.ts
git commit -m "feat: add SQLite cache layer"
```

---

## Task 7: File Manager

**Files:**
- Create: `src/lib/fileManager.ts`
- Create: `tests/lib/fileManager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lib/fileManager.test.ts
import { describe, it, expect } from 'vitest';

describe('sanitizeName', () => {
  it('replaces spaces with underscores', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Risk Management')).toBe('RiskManagement');
  });

  it('removes special characters', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('Course: 101 & More!')).toBe('Course101More');
  });

  it('preserves dots, hyphens, and underscores in filenames', async () => {
    const { sanitizeName } = await import('../../src/lib/fileManager.js');
    expect(sanitizeName('assignment_2.qmd')).toBe('assignment_2.qmd');
  });
});

describe('getLocalPath', () => {
  it('builds correct path under ~/Canvas', async () => {
    const { getLocalPath } = await import('../../src/lib/fileManager.js');
    const path = getLocalPath('Risk Management', 'Assignment 2', 'Assignment 2.pdf');
    expect(path).toContain('Canvas');
    expect(path).toContain('RiskManagement');
    expect(path).toContain('Assignment2');
    expect(path).toContain('Assignment2.pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/fileManager.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/lib/fileManager.ts`**

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

const CANVAS_ROOT = join(homedir(), 'Canvas');

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export function getLocalPath(courseName: string, context: string, filename: string): string {
  return join(
    CANVAS_ROOT,
    sanitizeName(courseName),
    sanitizeName(context),
    sanitizeName(filename)
  );
}

export async function downloadCanvasFile(
  client: CanvasClient,
  courseId: string,
  fileId: string,
  courseName: string,
  context: string
): Promise<{ localPath: string; displayName: string }> {
  const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
  const localPath = getLocalPath(courseName, context, file.display_name);

  mkdirSync(dirname(localPath), { recursive: true });

  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(localPath, buffer);

  return { localPath, displayName: file.display_name };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/fileManager.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/fileManager.ts tests/lib/fileManager.test.ts
git commit -m "feat: add file manager for organizing Canvas downloads"
```

---

## Task 8: Tool — get_courses

**Files:**
- Create: `src/tools/getCourses.ts`
- Create: `tests/tools/getCourses.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/getCourses.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getCourses', () => {
  it('returns trimmed course list', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: '2026SP-01:RISK MANAGEMENT', course_code: 'FIN4507', enrollments: [] },
        { id: 7779627, name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', course_code: 'QTM3310', enrollments: [] },
      ]),
    };

    const { getCourses } = await import('../../src/tools/getCourses.js');
    const result = await getCourses(mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '7779656', name: '2026SP-01:RISK MANAGEMENT', code: 'FIN4507' });
    expect(result[1]).toEqual({ id: '7779627', name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', code: 'QTM3310' });
  });

  it('calls correct Canvas endpoint', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getCourses } = await import('../../src/tools/getCourses.js');
    await getCourses(mockClient as any);
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses',
      expect.objectContaining({ enrollment_state: 'active' })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getCourses.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getCourses.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
}

export async function getCourses(client: CanvasClient): Promise<CourseInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
  });

  return courses.map((c) => ({
    id: String(c.id),
    name: c.name,
    code: c.course_code,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getCourses.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getCourses.ts tests/tools/getCourses.test.ts
git commit -m "feat: add get_courses tool"
```

---

## Task 9: Tool — get_upcoming_assignments

**Files:**
- Create: `src/tools/getUpcomingAssignments.ts`
- Create: `tests/tools/getUpcomingAssignments.test.ts`

- [ ] **Step 1: Write failing test**

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
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue(mockAssignments),
    };

    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    const result = await getUpcomingAssignments(mockClient as any, { courseId: '7779627' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('54079881');
    expect(result[0].title).toBe('Assignment 2: Data Management in R');
    expect(result[0].courseId).toBe('7779627');
    expect(result[0].dueAt).toBe('2026-04-04T23:59:59-04:00');
    expect(result[0].submissionType).toBe('online_upload');
    expect(result[0].pointsPossible).toBe(100);
  });

  it('fetches across all provided courses when no courseId given', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue(mockAssignments),
    };

    const mockCourses = [
      { id: '7779656', name: 'Risk Management', code: 'FIN4507' },
      { id: '7779627', name: 'PBA', code: 'QTM3310' },
    ];

    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    await getUpcomingAssignments(mockClient as any, {}, mockCourses);

    expect(mockClient.getPaginated).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getUpcomingAssignments.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getUpcomingAssignments.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import type { CourseInfo } from './getCourses.js';

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
  options: { courseId?: string; daysAhead?: number },
  allCourses?: CourseInfo[]
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
        dueAt: a.due_at,
        submissionType: a.submission_types[0] ?? 'none',
        pointsPossible: a.points_possible,
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getUpcomingAssignments.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getUpcomingAssignments.ts tests/tools/getUpcomingAssignments.test.ts
git commit -m "feat: add get_upcoming_assignments tool"
```

---

## Task 10: Tool — get_grades

**Files:**
- Create: `src/tools/getGrades.ts`
- Create: `tests/tools/getGrades.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/getGrades.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getGrades', () => {
  it('returns grade info for all courses', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 7779656,
          name: '2026SP-01:RISK MANAGEMENT',
          course_code: 'FIN4507',
          enrollments: [{
            type: 'student',
            computed_current_score: 88.5,
            computed_current_grade: 'B+',
            computed_final_score: 88.5,
            computed_final_grade: 'B+',
          }],
        },
        {
          id: 7779627,
          name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS',
          course_code: 'QTM3310',
          enrollments: [{
            type: 'student',
            computed_current_score: null,
            computed_current_grade: null,
            computed_final_score: null,
            computed_final_grade: null,
          }],
        },
      ]),
    };

    const { getGrades } = await import('../../src/tools/getGrades.js');
    const result = await getGrades(mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      courseId: '7779656',
      courseName: '2026SP-01:RISK MANAGEMENT',
      currentScore: 88.5,
      currentGrade: 'B+',
      finalScore: 88.5,
      finalGrade: 'B+',
    });
    expect(result[1].currentScore).toBeNull();
  });

  it('filters to a specific course when courseId provided', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: 'Risk Management', course_code: 'FIN4507',
          enrollments: [{ type: 'student', computed_current_score: 90, computed_current_grade: 'A-', computed_final_score: 90, computed_final_grade: 'A-' }] },
        { id: 7779627, name: 'PBA', course_code: 'QTM3310',
          enrollments: [{ type: 'student', computed_current_score: 85, computed_current_grade: 'B', computed_final_score: 85, computed_final_grade: 'B' }] },
      ]),
    };

    const { getGrades } = await import('../../src/tools/getGrades.js');
    const result = await getGrades(mockClient as any, '7779656');

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('7779656');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getGrades.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getGrades.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface GradeInfo {
  courseId: string;
  courseName: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
}

export async function getGrades(
  client: CanvasClient,
  courseId?: string
): Promise<GradeInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
    'include[]': 'total_scores',
  });

  const filtered = courseId
    ? courses.filter((c) => String(c.id) === courseId)
    : courses;

  return filtered.map((c) => {
    const enrollment = (c.enrollments ?? []).find((e) => e.type === 'student');
    return {
      courseId: String(c.id),
      courseName: c.name,
      currentScore: enrollment?.computed_current_score ?? null,
      currentGrade: enrollment?.computed_current_grade ?? null,
      finalScore: enrollment?.computed_final_score ?? null,
      finalGrade: enrollment?.computed_final_grade ?? null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getGrades.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getGrades.ts tests/tools/getGrades.test.ts
git commit -m "feat: add get_grades tool"
```

---

## Task 11: Tool — get_announcements

**Files:**
- Create: `src/tools/getAnnouncements.ts`
- Create: `tests/tools/getAnnouncements.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/getAnnouncements.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getAnnouncements', () => {
  it('returns trimmed announcements with plain text body', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 1001,
          title: 'Assignment 2 Due Date Extended',
          message: '<p>The due date for <strong>Assignment 2</strong> has been extended to April 10.</p>',
          posted_at: '2026-03-28T10:00:00-04:00',
        },
      ]),
    };

    const { getAnnouncements } = await import('../../src/tools/getAnnouncements.js');
    const result = await getAnnouncements(mockClient as any, '7779627');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1001');
    expect(result[0].title).toBe('Assignment 2 Due Date Extended');
    expect(result[0].body).toContain('Assignment 2');
    expect(result[0].body).not.toContain('<strong>');
    expect(result[0].postedAt).toBe('2026-03-28T10:00:00-04:00');
  });

  it('respects limit parameter', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getAnnouncements } = await import('../../src/tools/getAnnouncements.js');
    await getAnnouncements(mockClient as any, '7779627', 3);
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7779627/discussion_topics',
      expect.objectContaining({ only_announcements: 'true', per_page: '3' })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getAnnouncements.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getAnnouncements.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasDiscussionTopic } from '../types.js';

export interface AnnouncementSummary {
  id: string;
  title: string;
  postedAt: string;
  body: string;
}

export async function getAnnouncements(
  client: CanvasClient,
  courseId: string,
  limit: number = 5
): Promise<AnnouncementSummary[]> {
  const topics = await client.getPaginated<CanvasDiscussionTopic>(
    `/api/v1/courses/${courseId}/discussion_topics`,
    { only_announcements: 'true', per_page: String(limit), order_by: 'posted_at' }
  );

  return topics.slice(0, limit).map((t) => ({
    id: String(t.id),
    title: t.title,
    postedAt: t.posted_at,
    body: parseContent(t.message).plainText,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getAnnouncements.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getAnnouncements.ts tests/tools/getAnnouncements.test.ts
git commit -m "feat: add get_announcements tool"
```

---

## Task 12: Tool — get_assignment_details

**Files:**
- Create: `src/tools/getAssignmentDetails.ts`
- Create: `tests/tools/getAssignmentDetails.test.ts`

- [ ] **Step 1: Write failing test**

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
    const result = await getAssignmentDetails(mockClient as any, '7779656', '54079881');

    expect(result.id).toBe('54079881');
    expect(result.title).toBe('Group Assignment 2');
    expect(result.dueAt).toBe('2026-03-25T07:59:59-04:00');
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
    const result = await getAssignmentDetails(mockClient as any, '7779627', '99');

    expect(result.files).toHaveLength(0);
    expect(result.description).toContain('Complete the quiz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getAssignmentDetails.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getAssignmentDetails.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';

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
  assignmentId: string
): Promise<AssignmentDetails> {
  const a = await client.get<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  );

  const parsed = parseContent(a.description ?? '');

  return {
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: a.due_at,
    pointsPossible: a.points_possible,
    submissionType: a.submission_types[0] ?? 'none',
    description: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getAssignmentDetails.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getAssignmentDetails.ts tests/tools/getAssignmentDetails.test.ts
git commit -m "feat: add get_assignment_details tool"
```

---

## Task 13: Tool — get_course_modules

**Files:**
- Create: `src/tools/getCourseModules.ts`
- Create: `tests/tools/getCourseModules.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/getCourseModules.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockModules = [
  { id: 12538783, name: 'Syllabus & Schedule', position: 1, items_count: 1, items_url: '' },
];

const mockItems = [
  {
    id: 132722315,
    title: 'FIN4507 Syllabus_2026Spring.pdf',
    type: 'File',
    content_id: 344828267,
    indent: 0,
    position: 1,
    locked_for_user: false,
    url: 'https://babson.instructure.com/api/v1/courses/7779656/files/344828267',
    page_url: undefined,
    external_url: undefined,
  },
];

describe('getCourseModules', () => {
  it('fetches and returns module structure', async () => {
    const mockClient = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce(mockModules)
        .mockResolvedValueOnce(mockItems),
    };
    const mockCache = {
      getModuleStructure: vi.fn().mockReturnValue(null),
      setModuleStructure: vi.fn(),
    };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Syllabus & Schedule');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].type).toBe('File');
    expect(result[0].items[0].fileId).toBe('344828267');
    expect(mockCache.setModuleStructure).toHaveBeenCalled();
  });

  it('returns cached result without API call', async () => {
    const cached = [{ id: '1', name: 'Cached Module', items: [] }];
    const mockClient = { getPaginated: vi.fn() };
    const mockCache = {
      getModuleStructure: vi.fn().mockReturnValue(cached),
      setModuleStructure: vi.fn(),
    };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656');

    expect(result).toEqual(cached);
    expect(mockClient.getPaginated).not.toHaveBeenCalled();
  });

  it('extracts password from ExternalUrl title', async () => {
    const mockClient = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce([{ id: 1, name: 'Class Slides', position: 1, items_count: 1, items_url: '' }])
        .mockResolvedValueOnce([{
          id: 132566583,
          title: 'Class Slides (password: Strat2026)',
          type: 'ExternalUrl',
          external_url: 'https://babson-my.sharepoint.com/...',
          indent: 0,
          position: 1,
          locked_for_user: false,
        }]),
    };
    const mockCache = { getModuleStructure: vi.fn().mockReturnValue(null), setModuleStructure: vi.fn() };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656', true);

    expect(result[0].items[0].password).toBe('Strat2026');
    expect(result[0].items[0].externalUrl).toBe('https://babson-my.sharepoint.com/...');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getCourseModules.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getCourseModules.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { extractPasswordFromTitle } from '../lib/htmlParser.js';
import type { CanvasModule, CanvasModuleItem, ModuleSummary, ModuleItemSummary } from '../types.js';

export async function getCourseModules(
  client: CanvasClient,
  cache: Cache,
  courseId: string,
  forceRefresh: boolean = false
): Promise<ModuleSummary[]> {
  if (!forceRefresh) {
    const cached = cache.getModuleStructure(courseId);
    if (cached) return cached;
  }

  const modules = await client.getPaginated<CanvasModule>(
    `/api/v1/courses/${courseId}/modules`
  );

  const result: ModuleSummary[] = [];

  for (const mod of modules) {
    const items = await client.getPaginated<CanvasModuleItem>(
      `/api/v1/courses/${courseId}/modules/${mod.id}/items`
    );

    const mappedItems: ModuleItemSummary[] = items.map((item) =>
      mapModuleItem(item)
    );

    result.push({ id: String(mod.id), name: mod.name, items: mappedItems });
  }

  cache.setModuleStructure(courseId, result);
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
      return {
        ...base,
        title: cleanTitle,
        externalUrl: item.external_url ?? undefined,
        password,
      };
    }
    case 'Discussion':
      return { ...base, discussionId: item.content_id ? String(item.content_id) : undefined };
    default:
      return base;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getCourseModules.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getCourseModules.ts tests/tools/getCourseModules.test.ts
git commit -m "feat: add get_course_modules tool with cache"
```

---

## Task 14: Tool — get_module_item

**Files:**
- Create: `src/tools/getModuleItem.ts`
- Create: `tests/tools/getModuleItem.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/getModuleItem.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getModuleItem', () => {
  it('fetches and caches a WikiPage item', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        page_id: 999,
        url: 'session-1-notes',
        title: 'Session 1 Notes',
        body: `<p>Key concepts:</p>
          <a title="slides.pdf" href="viewer/files/slides.pdf"
            data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779627/files/111"
            data-api-returntype="File">Slides</a>`,
      }),
    };
    const mockCache = {
      getPage: vi.fn().mockReturnValue(null),
      setPage: vi.fn(),
      getModuleStructure: vi.fn().mockReturnValue([
        {
          id: '1', name: 'Introduction', items: [
            { id: '888', title: 'Session 1 Notes', type: 'Page', pageUrl: 'session-1-notes', locked: false }
          ]
        }
      ]),
    };

    const { getModuleItem } = await import('../../src/tools/getModuleItem.js');
    const result = await getModuleItem(mockClient as any, mockCache as any, '7779627', '888');

    expect(result.title).toBe('Session 1 Notes');
    expect(result.plainText).toContain('Key concepts');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileId).toBe('111');
    expect(mockCache.setPage).toHaveBeenCalled();
  });

  it('returns cached page without API call', async () => {
    const mockClient = { get: vi.fn() };
    const mockCache = {
      getPage: vi.fn().mockReturnValue({
        id: '888',
        courseId: '7779627',
        title: 'Cached Page',
        content: '<p>Cached content</p>',
        fetchedAt: '2026-03-01T00:00:00Z',
      }),
      setPage: vi.fn(),
      getModuleStructure: vi.fn().mockReturnValue(null),
    };

    const { getModuleItem } = await import('../../src/tools/getModuleItem.js');
    const result = await getModuleItem(mockClient as any, mockCache as any, '7779627', '888');

    expect(result.title).toBe('Cached Page');
    expect(mockClient.get).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/getModuleItem.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/getModuleItem.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { parseContent } from '../lib/htmlParser.js';
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
  cache: Cache,
  courseId: string,
  moduleItemId: string,
  forceRefresh: boolean = false
): Promise<ModuleItemContent> {
  if (!forceRefresh) {
    const cached = cache.getPage(moduleItemId);
    if (cached) {
      const parsed = parseContent(cached.content);
      return {
        id: moduleItemId,
        title: cached.title,
        plainText: parsed.plainText,
        files: parsed.files,
        externalLinks: parsed.externalLinks,
      };
    }
  }

  // Look up item type from cached module structure
  const modules = cache.getModuleStructure(courseId);
  let itemType: string | undefined;
  let pageUrl: string | undefined;
  let fileId: string | undefined;

  if (modules) {
    for (const mod of modules) {
      const found = mod.items.find((i) => i.id === moduleItemId);
      if (found) {
        itemType = found.type;
        pageUrl = found.pageUrl;
        fileId = found.fileId;
        break;
      }
    }
  }

  let title: string;
  let html: string;

  if (itemType === 'File' && fileId) {
    const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
    title = file.display_name;
    html = `<a href="${file.url}" data-api-endpoint="${file.url}">${file.display_name}</a>`;
  } else if (pageUrl) {
    const page = await client.get<CanvasPage>(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
    title = page.title;
    html = page.body;
  } else {
    throw new Error(
      `Cannot fetch module item ${moduleItemId}: type unknown and not in cache. Call get_course_modules first.`
    );
  }

  cache.setPage(moduleItemId, courseId, title, html);
  const parsed = parseContent(html);

  return {
    id: moduleItemId,
    title,
    plainText: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/getModuleItem.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/getModuleItem.ts tests/tools/getModuleItem.test.ts
git commit -m "feat: add get_module_item tool with cache"
```

---

## Task 15: Tool — download_files

**Files:**
- Create: `src/tools/downloadFiles.ts`
- Create: `tests/tools/downloadFiles.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tools/downloadFiles.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('downloadFiles', () => {
  it('downloads files and returns local paths', async () => {
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

    // Mock fs operations
    const mockMkdirSync = vi.fn();
    const mockWriteFileSync = vi.fn();
    vi.doMock('fs', () => ({
      mkdirSync: mockMkdirSync,
      writeFileSync: mockWriteFileSync,
      existsSync: vi.fn().mockReturnValue(false),
    }));

    const { downloadFiles } = await import('../../src/tools/downloadFiles.js');
    const result = await downloadFiles(
      mockClient as any,
      mockCache as any,
      [{ fileId: '344828267', courseId: '7779656', courseName: 'Risk Management', context: 'Assignment2' }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Assignment 2.pdf');
    expect(result[0].localPath).toContain('RiskManagement');
    expect(result[0].localPath).toContain('Assignment2');
    expect(mockCache.recordDownloadedFile).toHaveBeenCalledWith(
      '344828267',
      '7779656',
      result[0].localPath,
      'Assignment 2.pdf'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/downloadFiles.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write `src/tools/downloadFiles.ts`**

```typescript
import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { downloadCanvasFile } from '../lib/fileManager.js';

export interface DownloadRequest {
  fileId: string;
  courseId: string;
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
  requests: DownloadRequest[]
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (const req of requests) {
    const { localPath, displayName } = await downloadCanvasFile(
      client,
      req.courseId,
      req.fileId,
      req.courseName,
      req.context
    );

    cache.recordDownloadedFile(req.fileId, req.courseId, localPath, displayName);

    results.push({ fileId: req.fileId, displayName, localPath });
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tools/downloadFiles.test.ts
```

Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/tools/downloadFiles.ts tests/tools/downloadFiles.test.ts
git commit -m "feat: add download_files tool"
```

---

## Task 16: MCP Server Entry Point

**Files:**
- Create: `src/index.ts` (replace placeholder)

- [ ] **Step 1: Write `src/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadConfig } from './lib/config.js';
import { CanvasClient } from './lib/canvasClient.js';
import { openCache } from './lib/cache.js';

import { getCourses } from './tools/getCourses.js';
import { getUpcomingAssignments } from './tools/getUpcomingAssignments.js';
import { getGrades } from './tools/getGrades.js';
import { getAnnouncements } from './tools/getAnnouncements.js';
import { getAssignmentDetails } from './tools/getAssignmentDetails.js';
import { getCourseModules } from './tools/getCourseModules.js';
import { getModuleItem } from './tools/getModuleItem.js';
import { downloadFiles } from './tools/downloadFiles.js';

const config = loadConfig();
const client = new CanvasClient(config);
const cache = openCache();

const server = new McpServer({
  name: 'accesscanvas',
  version: '1.0.0',
});

server.tool(
  'get_courses',
  'List all active enrolled courses at Babson',
  {},
  async () => {
    const courses = await getCourses(client);
    return { content: [{ type: 'text', text: JSON.stringify(courses, null, 2) }] };
  }
);

server.tool(
  'get_upcoming_assignments',
  'List upcoming assignments due within N days. If courseId is omitted, returns assignments across all courses.',
  {
    courseId: z.string().optional().describe('Canvas course ID. Omit to get all courses.'),
    daysAhead: z.number().optional().describe('Number of days to look ahead. Default: 14.'),
  },
  async ({ courseId, daysAhead }) => {
    const allCourses = courseId ? undefined : await getCourses(client);
    const assignments = await getUpcomingAssignments(client, { courseId, daysAhead }, allCourses);
    return { content: [{ type: 'text', text: JSON.stringify(assignments, null, 2) }] };
  }
);

server.tool(
  'get_grades',
  'Get current grades for all courses or a specific course.',
  {
    courseId: z.string().optional().describe('Canvas course ID. Omit to get grades for all courses.'),
  },
  async ({ courseId }) => {
    const grades = await getGrades(client, courseId);
    return { content: [{ type: 'text', text: JSON.stringify(grades, null, 2) }] };
  }
);

server.tool(
  'get_announcements',
  'Get recent announcements for a course.',
  {
    courseId: z.string().describe('Canvas course ID'),
    limit: z.number().optional().describe('Number of announcements to return. Default: 5.'),
  },
  async ({ courseId, limit }) => {
    const announcements = await getAnnouncements(client, courseId, limit);
    return { content: [{ type: 'text', text: JSON.stringify(announcements, null, 2) }] };
  }
);

server.tool(
  'get_assignment_details',
  'Get full details for a specific assignment, including any downloadable files embedded in the description.',
  {
    courseId: z.string().describe('Canvas course ID'),
    assignmentId: z.string().describe('Canvas assignment ID'),
  },
  async ({ courseId, assignmentId }) => {
    const details = await getAssignmentDetails(client, courseId, assignmentId);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }
);

server.tool(
  'get_course_modules',
  'Get the full module structure for a course. Cached after first fetch. Use forceRefresh to re-sync.',
  {
    courseId: z.string().describe('Canvas course ID'),
    forceRefresh: z.boolean().optional().describe('Re-fetch from Canvas even if cached. Default: false.'),
  },
  async ({ courseId, forceRefresh }) => {
    const modules = await getCourseModules(client, cache, courseId, forceRefresh);
    return { content: [{ type: 'text', text: JSON.stringify(modules, null, 2) }] };
  }
);

server.tool(
  'get_module_item',
  'Get the content of a specific module item (a page or file). Returns plain text body and any embedded files. Call get_course_modules first to discover item IDs.',
  {
    courseId: z.string().describe('Canvas course ID'),
    moduleItemId: z.string().describe('Module item ID from get_course_modules'),
    forceRefresh: z.boolean().optional().describe('Re-fetch even if cached. Default: false.'),
  },
  async ({ courseId, moduleItemId, forceRefresh }) => {
    const content = await getModuleItem(client, cache, courseId, moduleItemId, forceRefresh);
    return { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] };
  }
);

server.tool(
  'download_files',
  'Download Canvas files to ~/Canvas/{CourseName}/{Context}/. Get fileIds from get_assignment_details or get_module_item.',
  {
    files: z.array(z.object({
      fileId: z.string().describe('Canvas file ID'),
      courseId: z.string().describe('Canvas course ID'),
      courseName: z.string().describe('Human-readable course name for folder organization'),
      context: z.string().describe('Folder context, e.g. "Assignment2" or "Syllabus"'),
    })).describe('Files to download'),
  },
  async ({ files }) => {
    const results = await downloadFiles(client, cache, files);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Build to verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up MCP server entry point with all 8 tools"
```

---

## Task 17: Claude Desktop Config + Setup Doc

**Files:**
- Create: `claude-desktop-config.json`
- Create: `README.md`

- [ ] **Step 1: Create `claude-desktop-config.json`**

This is the snippet to add to `~/Library/Application Support/Claude/claude_desktop_config.json` under `"mcpServers"`:

```json
{
  "accesscanvas": {
    "command": "node",
    "args": ["/Users/ishanpatel/Projects/AccessCanvas/dist/index.js"]
  }
}
```

- [ ] **Step 2: Create `README.md`**

```markdown
# AccessCanvas

MCP server that connects Claude to Babson College's Canvas LMS.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create config file**
   ```bash
   mkdir -p ~/.accesscanvas
   cat > ~/.accesscanvas/config.json << 'EOF'
   {
     "token": "YOUR_CANVAS_API_TOKEN",
     "baseUrl": "https://babson.instructure.com"
   }
   EOF
   ```
   Get your token: Canvas → Account → Settings → New Access Token

3. **Build**
   ```bash
   npm run build
   ```

4. **Connect to Claude Desktop**

   Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "accesscanvas": {
         "command": "node",
         "args": ["/Users/ishanpatel/Projects/AccessCanvas/dist/index.js"]
       }
     }
   }
   ```
   Restart Claude Desktop.

## Tools

| Tool | Description |
|------|-------------|
| `get_courses` | List enrolled courses |
| `get_upcoming_assignments` | Assignments due soon |
| `get_grades` | Current grades |
| `get_announcements` | Recent announcements |
| `get_assignment_details` | Assignment details + files |
| `get_course_modules` | Course module structure |
| `get_module_item` | Page or file content |
| `download_files` | Download files to ~/Canvas/ |

## File Storage

Downloaded files land at `~/Canvas/{CourseName}/{Context}/`.
Cache stored at `~/.accesscanvas/cache.db`.
```

- [ ] **Step 3: Build the final production artifact**

```bash
npm run build
```

Expected: `dist/index.js` created with no errors

- [ ] **Step 4: Smoke test (requires real config)**

```bash
node dist/index.js
```

Expected: Server starts and waits on stdin (no crash). Ctrl+C to exit.

- [ ] **Step 5: Commit**

```bash
git add claude-desktop-config.json README.md dist/
git commit -m "feat: add Claude Desktop config and setup README"
```

---

## Self-Review Checklist

- [x] **get_courses** — Task 8 ✓
- [x] **get_upcoming_assignments** — Task 9 ✓
- [x] **get_grades** — Task 10 ✓
- [x] **get_announcements** — Task 11 ✓
- [x] **get_assignment_details** — Task 12 ✓
- [x] **get_course_modules** — Task 13 ✓ (password extraction, all item types)
- [x] **get_module_item** — Task 14 ✓ (cache-backed, falls back to API)
- [x] **download_files** — Task 15 ✓
- [x] **HTML parser** — Task 5 ✓ (`data-api-endpoint` + href fallback)
- [x] **SQLite cache** — Task 6 ✓
- [x] **Config loader** — Task 3 ✓
- [x] **MCP server wired up** — Task 16 ✓
- [x] **Claude Desktop config** — Task 17 ✓
- [x] **Error handling** — 401/403/404 handled in CanvasClient.get() (Task 4)
- [x] **Pagination** — CanvasClient.getPaginated() (Task 4)
- [x] **Token efficiency** — All tools return trimmed structs, not raw API blobs
