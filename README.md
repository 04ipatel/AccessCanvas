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

Then create `~/.accesscanvas/config.json` with your Canvas API token:

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

| Tool | Description |
|------|-------------|
| `get_courses` | List all active enrolled courses |
| `get_upcoming_assignments` | Assignments due soon (optionally filter by course) |
| `get_grades` | Current grades for all courses or a specific course |
| `get_announcements` | Recent announcements for a course |
| `get_assignment_details` | Full assignment details including embedded files |
| `get_course_modules` | Course module structure — cached after first fetch |
| `get_module_item` | Content of a specific module page or file — cached |
| `download_files` | Download Canvas files to `~/Academics/` |

## Caching

Module structure and page content are cached in SQLite at `~/.accesscanvas/cache.db` to avoid redundant API calls. Every tool response includes a `_fetchedAt` timestamp. Cache-backed responses also include `_fromCache: true` and a hint.

To force a fresh fetch: ask Claude to "refresh" the modules or pass `forceRefresh: true`.

Inspect the cache directly:

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
npm test          # run tests
npm run test:watch  # watch mode
npm run build     # compile TypeScript
```
