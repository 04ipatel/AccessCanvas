# AccessCanvas

MCP server that connects Claude to Babson College's Canvas LMS. Gives Claude read-only access to courses, assignments, grades, announcements, module content, and files.

## Requirements

- Node.js 18+
- A Babson Canvas API token

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create config file

```bash
mkdir -p ~/.accesscanvas
```

Then create `~/.accesscanvas/config.json`:

```json
{
  "token": "YOUR_CANVAS_API_TOKEN",
  "baseUrl": "https://babson.instructure.com"
}
```

Get your token: Canvas → Account → Settings → Approved Integrations → New Access Token

### 3. Build

```bash
npm run build
```

### 4. Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` under `"mcpServers"`:

```json
{
  "accesscanvas": {
    "command": "node",
    "args": ["/Users/ishanpatel/Projects/AccessCanvas/dist/index.js"]
  }
}
```

Restart Claude Desktop.

## Tools

### Live (always fetches fresh data)

| Tool | Description |
|------|-------------|
| `get_courses` | List all active enrolled courses |
| `get_upcoming_assignments` | Assignments due soon, optionally filtered by course |
| `get_grades` | Current course-level grades for all courses or one course |
| `get_assignment_grades` | Individual assignment scores for a course — use this to break down a grade or identify missing/late work |
| `get_announcements` | Recent announcements for a course |
| `get_assignment_details` | Full assignment details including description and embedded files |
| `download_files` | Download Canvas files to `~/Academics/{CourseName}/{Context}/` |

### Cached (fetched once, stored locally)

| Tool | Parameters | Description |
|------|------------|-------------|
| `get_course_modules` | `courseId`, `forceRefresh?` | Full module structure for a course. Cached after first fetch. |
| `get_module_item` | `courseId`, `moduleItemId`, `forceRefresh?` | Content of a module page or file. Cached after first fetch. |

Every tool response includes a `_fetchedAt` timestamp. Cached responses also include `_fromCache: true` and a reminder to use `forceRefresh: true` if the data may be stale.

## Caching

Module structure and page content are stored in SQLite at `~/.accesscanvas/cache.db`. All other tools always hit the Canvas API directly.

Inspect the cache:

```bash
sqlite3 ~/.accesscanvas/cache.db "SELECT course_id, fetched_at FROM module_structure;"
sqlite3 ~/.accesscanvas/cache.db "SELECT id, title, fetched_at FROM cached_pages;"
```

## File Storage

Downloaded files are organized at:

```
~/Academics/{CourseName}/{Context}/{filename}
```

Example: `~/Academics/RiskManagement/Assignment2/CaseStudy.pdf`

## Development

```bash
npm test            # run tests
npm run test:watch  # watch mode
npm run build       # compile TypeScript
```
