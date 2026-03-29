# AccessCanvas MCP Server — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

AccessCanvas is a local TypeScript MCP server that connects Claude to Babson College's Canvas LMS. It gives Claude read-only access to courses, assignments, grades, modules, and files — allowing Claude to help navigate academic life, assist with assignments, and plan around deadlines.

The server runs locally, connects to Claude via stdio transport, and uses a SQLite cache for stable content while always hitting Canvas live for time-sensitive data.

---

## Scope

**In scope:**
- Reading courses, grades, assignments, announcements
- Navigating module structure (including syllabi buried in modules)
- Parsing HTML content to extract embedded file links
- Downloading files to an organized local folder structure
- Caching stable content (syllabi, module structure, pages) to minimize API calls and token usage

**Out of scope:**
- Submitting assignments (read-only by design)
- Accessing password-protected external files (SharePoint, etc.) — the MCP surfaces the URL and any password found in the item title
- Downloading files gated behind LTI tools (e.g. Honorlock exam items)

---

## Courses (Babson Spring 2026)

| Course | Canvas ID | Notes |
|--------|-----------|-------|
| Risk Management | 7779656 | Syllabus as direct Attachment; assignments embed files via `data-api-endpoint` |
| Predictive Business Analytics | 7779627 | 13 modules; mix of Attachments, WikiPages, Assignments, ExternalUrls, ContextExternalTools |
| Strategic Problem Solving | — | Slides on SharePoint with password in item title; WikiPages reference PDF files |
| Real Estate Investments | — | Could not be exported; structure unknown; API access works normally |

---

## Architecture

```
Claude (MCP client)
      │  stdio
      ▼
AccessCanvas MCP Server (TypeScript / Node.js)
      ├── MCP Tool Layer         — tool definitions, input validation, response formatting
      ├── Canvas API Client      — authenticated REST wrapper (babson.instructure.com)
      ├── HTML Parser            — extracts file links and data-api-endpoint attrs from content
      ├── Cache Layer            — SQLite at ~/.accesscanvas/cache.db
      └── File Manager           — downloads and organizes files at ~/Canvas/
```

**Config:** `~/.accesscanvas/config.json`
```json
{
  "token": "YOUR_CANVAS_API_TOKEN",
  "baseUrl": "https://babson.instructure.com"
}
```

---

## Data Freshness Strategy

| Data type | Strategy | Rationale |
|-----------|----------|-----------|
| Grades | Always live | Changes when professors update |
| Assignments (list + details) | Always live | Due dates and files can change |
| Announcements | Always live | New ones appear constantly |
| Module structure | Cache-backed | Rarely changes mid-semester |
| WikiPage / page content | Cache-backed | Stable once published |
| Downloaded files | Cached on disk | Professor rarely replaces files |

Cache entries store a `fetched_at` timestamp. The MCP does not auto-expire cache — refresh is triggered explicitly (user asks to re-sync a course).

---

## MCP Tools

### 1. `get_courses`
List all active enrolled courses.

**Returns:** course id, name, course code, term
**Source:** Canvas API live
**Endpoint:** `GET /api/v1/courses?enrollment_state=active`

---

### 2. `get_upcoming_assignments`
List assignments due within a time window, across all or a specific course.

**Inputs:** `courseId` (optional), `daysAhead` (default: 14)
**Returns:** assignment title, course, due date, submission type, points possible
**Source:** Canvas API live
**Endpoint:** `GET /api/v1/courses/:id/assignments?bucket=upcoming&order_by=due_at`

---

### 3. `get_grades`
Return current grades for all courses or a specific course.

**Inputs:** `courseId` (optional)
**Returns:** course name, current score, current grade, final score
**Source:** Canvas API live
**Endpoint:** `GET /api/v1/courses?enrollment_type=student&include[]=total_scores`

---

### 4. `get_announcements`
Return recent announcements for a course.

**Inputs:** `courseId`, `limit` (default: 5)
**Returns:** title, posted date, message body (plain text stripped from HTML)
**Source:** Canvas API live
**Endpoint:** `GET /api/v1/courses/:id/discussion_topics?only_announcements=true`

---

### 5. `get_assignment_details`
Return full details for a specific assignment, including all downloadable files extracted from its HTML content.

**Inputs:** `courseId`, `assignmentId`
**Returns:** title, due date, description (plain text), list of attached files (name + Canvas file ID + download URL)
**Source:** Canvas API live
**Endpoint:** `GET /api/v1/courses/:id/assignments/:id`
**HTML parsing:** Extract `data-api-endpoint` attributes and `href` links from `content` HTML to build the file list.

---

### 6. `get_course_modules`
Return the full module structure for a course — all modules and their items with types and titles.

**Inputs:** `courseId`, `forceRefresh` (default: false)
**Returns:** array of modules, each with name and array of items (id, title, type, locked status)
**Source:** Cache-backed (fetches from Canvas if not cached or `forceRefresh=true`)
**Endpoints:**
- `GET /api/v1/courses/:id/modules`
- `GET /api/v1/courses/:id/modules/:id/items`

**Item types handled:**
| Type | Behavior |
|------|----------|
| `Attachment` | Returns Canvas file ID for download |
| `WikiPage` | Returns page URL for `get_module_item` |
| `Assignment` | Returns assignment ID for `get_assignment_details` |
| `ExternalUrl` | Returns URL (and password if present in title) |
| `DiscussionTopic` | Returns topic ID and title |
| `ContextModuleSubHeader` | Returns as section label only |
| `ContextExternalTool` | Returns title only, flags as inaccessible |

---

### 7. `get_module_item`
Fetch and cache the content of a specific module item (WikiPage or Attachment page).

**Inputs:** `courseId`, `moduleItemId`, `forceRefresh` (default: false)
**Returns:** title, plain-text body, list of embedded files (name + Canvas file ID + download URL)
**Source:** Cache-backed
**Behavior:** Looks up the item type from the cached module structure to select the right endpoint:
- For WikiPage: `GET /api/v1/courses/:id/pages/:page_url`
- For Attachment: `GET /api/v1/courses/:id/files/:content_id`
**HTML parsing:** Same parser as `get_assignment_details` — extracts `data-api-endpoint` and file `href` links.

---

### 8. `download_files`
Download one or more Canvas files to the organized local folder structure.

**Inputs:** `files` (array of `{ fileId, courseId, context }` where context is e.g. "Assignment8" or "Syllabus")
**Returns:** list of local paths where files were saved
**Behavior:**
1. Calls `GET /api/v1/courses/:id/files/:id` to get the file's `url` and `display_name`
2. Downloads the file using the authenticated Canvas download URL
3. Saves to `~/Canvas/{CourseName}/{Context}/{filename}`
4. Records the download in `downloaded_files` cache table

**Path sanitization:** Course and context names have spaces replaced with underscores, special characters stripped.

---

## Local Storage

### SQLite — `~/.accesscanvas/cache.db`

**`courses`**
```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT,
  code TEXT,
  fetched_at TEXT
);
```

**`module_structure`**
```sql
CREATE TABLE module_structure (
  course_id TEXT PRIMARY KEY,
  data TEXT,        -- JSON blob of full module tree
  fetched_at TEXT
);
```

**`cached_pages`**
```sql
CREATE TABLE cached_pages (
  id TEXT PRIMARY KEY,   -- Canvas page/item ID
  course_id TEXT,
  title TEXT,
  content TEXT,          -- raw HTML
  fetched_at TEXT
);
```

**`downloaded_files`**
```sql
CREATE TABLE downloaded_files (
  file_id TEXT PRIMARY KEY,
  course_id TEXT,
  local_path TEXT,
  display_name TEXT,
  fetched_at TEXT
);
```

### File Organization — `~/Canvas/`
```
~/Canvas/
  RiskManagement/
    Syllabus/
      FIN4507_Syllabus_2026Spring.pdf
    Assignment1/
      Assignment1.pdf
    Assignment2/
      Assignment2.pdf
      JPMorganChase.pdf
      MS.xlsx
  PredictiveBusinessAnalytics/
    Assignment2_DataManagementInR/
      assignment2.qmd
  StrategicProblemSolving/
    Syllabus/
      STR3000_Spring2026_Syllabus.pdf
```

---

## HTML Parser

A shared utility used by `get_assignment_details` and `get_module_item`. Given an HTML string, it returns:

```typescript
interface ParsedContent {
  plainText: string;       // HTML stripped to readable text
  files: {
    name: string;
    apiEndpoint: string | null;  // from data-api-endpoint attr
    href: string | null;         // fallback href if no API endpoint
  }[];
  externalLinks: {
    title: string;
    url: string;
  }[];
}
```

Priority for file extraction: `data-api-endpoint` attribute → `href` attribute matching `/viewer/files/` or Canvas file URL pattern.

---

## Project Structure

```
AccessCanvas/
  src/
    index.ts              — MCP server entry point, tool registration
    tools/
      getCourses.ts
      getUpcomingAssignments.ts
      getGrades.ts
      getAnnouncements.ts
      getAssignmentDetails.ts
      getCourseModules.ts
      getModuleItem.ts
      downloadFiles.ts
    lib/
      canvasClient.ts     — authenticated Canvas REST client
      htmlParser.ts       — shared HTML parsing utility
      cache.ts            — SQLite read/write helpers
      fileManager.ts      — file download and path organization
      config.ts           — load ~/.accesscanvas/config.json
  docs/
    superpowers/specs/
      2026-03-28-canvas-mcp-design.md
  package.json
  tsconfig.json
  README.md
```

---

## Error Handling

- **401 Unauthorized:** Surface clearly — token is missing or expired
- **403 Forbidden:** Item is locked on Canvas — return a message indicating it's locked
- **404 Not Found:** Course or item doesn't exist — return descriptive error
- **Rate limiting:** Canvas API rate limits at ~700 req/hour. Tools batch requests where possible and the cache reduces repeat calls.
- **Missing `data-api-endpoint`:** Fall back to href-based file extraction; if neither present, return the item as a named file with no download URL

---

## Response Design Principle

All tool responses are trimmed to only what Claude needs. No raw Canvas API blobs. This keeps token usage low and makes the server usable on a standard $20/month Claude subscription.

---

## Out of Scope (Future)

- Real-time Canvas webhooks
- Calendar integration (due dates → Google Calendar)
- Submission upload
- Multi-institution support
