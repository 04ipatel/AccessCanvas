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
bun run test -- tests/tools/getAssignments.test.ts
```

## What This Is

A lean, **stateless**, read-only MCP (Model Context Protocol) server: the layer that talks to Babson College's Canvas LMS. It exposes 9 clean primitives that pull data out of Canvas — courses, assignments, grades, announcements, modules, files — and nothing else. Every call fetches fresh from Canvas; there is no cache.

Config lives at `~/.accesscanvas/config.json` (requires `token`, `baseUrl`, `downloadDir`, `timezone`). Run `bun run setup` to configure. Downloaded files land where the caller specifies (default: the configured `downloadDir`, `~/Academics/`).

**Scope boundary (important):** AccessCanvas is *only* the Canvas-access layer. The higher-level intelligence — maintaining a per-course knowledge base (a Karpathy-style "truth + append-only log" course brain), reconciling sources, reading PDFs, pulling lecture transcripts (Granola), scheduling study — lives **downstream**, in Claude Desktop automations and scheduled tasks that consume these primitives. None of that is built in this repo. AccessCanvas's job is to be a reliable, boring data tap.

## Architecture

```
src/
├── index.ts          — MCP server entry point; registers all 9 tools, wraps responses in { data, _fetchedAt }
├── types.ts          — Shared TypeScript interfaces
├── lib/
│   ├── canvasClient.ts   — Canvas REST API client (get, getPaginated, getFileBuffer)
│   ├── config.ts         — Loads ~/.accesscanvas/config.json
│   ├── fileManager.ts    — Downloads a Canvas file to disk (caller-specified dest, no imposed layout)
│   ├── htmlParser.ts     — Parses Canvas HTML; extracts file links, external URLs, plain text
│   └── dateUtils.ts      — Formats Canvas UTC timestamps → 'YYYY-MM-DD H:MM AM/PM TZ'
└── tools/            — One file per MCP tool
```

## The 9 Tools

All are read-only and stateless except `download_file` (writes to local disk only). All responses are wrapped as `{ data, _fetchedAt }`.

| Tool | Purpose |
|------|---------|
| `list_courses` | Active enrolled courses (id, name, code, term) |
| `get_assignments` | All assignments for a course with full detail (due, points, parsed description, embedded files). Date filtering is the caller's job. |
| `get_grades` | Current course-level grades (all courses, or one) |
| `get_assignment_grades` | Per-assignment scores with missing/late flags |
| `get_announcements` | Recent announcements for a course |
| `get_modules` | Module structure + items for a course |
| `get_module_item` | Content of one module page/file (text + embedded files) |
| `list_files` | Files Canvas exposes for a course (empty if export disabled) |
| `download_file` | Download one Canvas file to disk (optional `dest` directory) |

## Key Patterns

- New tools go in `src/tools/`, get registered in `src/index.ts`. Each tool is a thin, stateless function over `CanvasClient`.
- Use `CanvasClient.getPaginated<T>()` for any Canvas endpoint that paginates (most list endpoints do).
- Canvas file links are embedded in HTML as `data-api-endpoint` attributes — `htmlParser.ts` extracts them.
- Filenames are sanitized before writing to disk (spaces and special chars removed).
- Missing/disabled data (e.g. a professor disables file export → Canvas 403) is returned as an empty list, not an error. Absence is information.
- No caching, no `forceRefresh`, no `_fromCache`/`_hint`. If freshness or persistence is needed, that's the downstream consumer's responsibility.
