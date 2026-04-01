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

Config lives at `~/.accesscanvas/config.json` (requires `token`, `baseUrl`, `downloadDir`, `timezone`). Run `bun run setup` to configure. SQLite cache at `~/.accesscanvas/cache.db`. Downloaded files land in the configured `downloadDir` (default: `~/Academics/`).

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
