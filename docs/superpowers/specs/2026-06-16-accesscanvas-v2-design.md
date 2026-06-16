# AccessCanvas v2 — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Supersedes:** the v1 cached/live-tool MCP server

## Problem

AccessCanvas v1 was built on the assumption that Canvas is the source of truth for a student's courses. In practice it isn't:

- Professors announce deadlines aloud in lecture that never appear in Canvas's Assignments tab.
- The real schedule often lives in a syllabus PDF (and drifts when the class runs ahead/behind).
- Some professors disable Canvas export features, so data the tool expects isn't available.

The result: v1's higher-level answers ("what's due this week", "download my slides") were unreliable — not because the use cases were wrong, but because Canvas alone is an incomplete, sometimes-stale source.

v1 also grew machinery that no longer fits: a SQLite cache, a cached-vs-live tool split, and response-wrapping metadata (`_fromCache`, `_hint`).

## What AccessCanvas Is (and Is Not)

**AccessCanvas is the layer that talks to Canvas. Nothing more.** It exposes a small set of clean, read-only primitives to pull data out of Canvas, plus a file download. It is stateless.

The intelligence — reconciling sources, maintaining a per-course knowledge base, reading PDFs, scheduling study — lives **downstream**, in Claude Desktop automations and scheduled tasks that *consume* AccessCanvas. AccessCanvas's job is to make that downstream work trivial by being a reliable, boring data tap.

### The downstream usage pattern (context only — NOT built here)

The intended consumer is a "course brain" per course, maintained by Claude — a Karpathy-style LLM wiki:

- **Truth** (top of the doc): curated, trusted facts — grading scheme, deadlines, exams, materials.
- **Log** (bottom, append-only): timestamped, sourced signals — grades posted, announcements, lecture mentions (from Granola), Canvas changes — each marked `[unreconciled]` until promoted into Truth.

Claude runs sync on a schedule: pull Canvas data via AccessCanvas, pull Granola separately, append new signals to the Log, then reconcile the important ones into Truth (human-confirmed for high-stakes changes like a moved deadline).

This pattern is documented here so the primitive surface is shaped to serve it. **None of it — the vault, Truth/Log, reconciliation, Granola, PDF reading, scheduling — is in scope for this repo.**

## Goals

- A thin, read-only, **stateless** Canvas-access MCP server.
- Nine clean primitives with uniform, predictable response shapes.
- Reuse the genuinely conducive v1 building blocks (Canvas REST client, HTML parser, date formatting, config, file download).
- Delete everything that doesn't serve the new scope (cache, tool-split, response-wrapping metadata).
- Fully testable core (vitest, mocked Canvas responses), TDD for client + parsers.

## Non-Goals (explicitly out of scope)

- The course-brain vault, Truth/Log model, or reconciliation.
- Granola or any non-Canvas source.
- Caching of any kind (stateless — see Decision: Stateless below).
- PDF/text extraction of downloaded files (Claude does this).
- Any Tier-2 "optimization" logic: study scheduling, grade prediction, calendar writes, "do the work for me."

## Architecture

Flat `src/` (this tool is small; no monorepo split needed).

```
src/
  index.ts        — MCP server entry; registers the 8 tools, uniform response wrapper
  types.ts        — shared TypeScript interfaces
  lib/
    canvasClient.ts  — Canvas REST client (get, getPaginated, getFileBuffer)   [KEEP]
    htmlParser.ts    — extract file links + plain text from Canvas HTML         [KEEP]
    dateUtils.ts     — format Canvas UTC timestamps → local TZ                  [KEEP]
    config.ts        — load ~/.accesscanvas/config.json                         [KEEP]
    fileManager.ts   — download a Canvas file to disk                           [SIMPLIFY]
  tools/          — one file per primitive                                       [REWRITE]
scripts/setup.ts  — setup wizard                                                 [KEEP]
```

### Keep (conducive Canvas-access bones)

- **`canvasClient.ts`** — unchanged. `get<T>`, `getPaginated<T>` (Link-header pagination), `getFileBuffer`.
- **`htmlParser.ts`** — unchanged. Extracts embedded Canvas file refs (`data-api-endpoint`) and plain text from page/assignment HTML.
- **`dateUtils.ts`** — unchanged. `formatDateTime(iso, timezone)`.
- **`config.ts`** — unchanged. Loads `{ token, baseUrl, downloadDir, timezone }`.
- **`scripts/setup.ts`** — unchanged. Setup wizard + Claude Desktop config.

### Simplify

- **`fileManager.ts`** — v1 imposed a folder layout (`courseCode-courseName/context/filename`). In v2 the vault layout is Claude's job, so `downloadFile` must **not** impose structure. New contract: write to an explicit `dest` path if given, else flat into `downloadDir`; return the absolute path written. Keep `sanitizeName` for safe filenames.

### Drop

- **`lib/cache.ts`** (SQLite) — deleted entirely.
- The **cached-vs-live tool split**.
- The **`withMeta` `_fromCache` / `_hint` machinery** in `index.ts`.

### Rewrite

- **`index.ts`** — register the 8 primitives; one thin uniform wrapper (structured data + `_fetchedAt` only).
- **`src/tools/*`** — rewritten as thin, stateless functions over `canvasClient` (+ `htmlParser`, `dateUtils`, `fileManager` where relevant). No cache argument anywhere.

## The Primitive Surface (9 tools)

All are read-only except `downloadFile` (writes to local disk only). All are stateless. Param names use `courseId` to match Canvas IDs.

| Tool | Params | Returns |
|---|---|---|
| `listCourses` | — | active enrolled courses: `{ id, name, code, term }[]` |
| `getAssignments` | `{ courseId }` | `{ id, name, due, points, description, url }[]` (due formatted in config TZ; `null` if no due date) |
| `getGrades` | `{ courseId? }` | current course-level score(s); all courses if `courseId` omitted |
| `getAssignmentGrades` | `{ courseId }` | per-assignment scores: `{ name, score, pointsPossible, grade, missing, late, due }[]` |
| `getAnnouncements` | `{ courseId, limit? }` | `{ title, postedAt, body }[]` (default `limit` 5) |
| `getModules` | `{ courseId }` | module structure + items: `{ id, name, items: { id, title, type, ... }[] }[]` |
| `getModuleItem` | `{ courseId, moduleItemId }` | `{ plainText, files: FileRef[], externalLinks: ExternalLink[] }` (HTML parsed via `htmlParser`) |
| `listFiles` | `{ courseId }` | files Canvas exposes for the course: `{ id, name, url, type, size }[]` (empty if export disabled) |
| `downloadFile` | `{ courseId, fileId, dest? }` | downloads to `dest` (or flat `downloadDir`); returns `{ path, displayName }` |

Notes:
- `getAssignments` replaces v1's `get_upcoming_assignments` + `get_assignment_details`. It returns **all** assignments for a course with full detail (including embedded file refs parsed from the description). "Upcoming / due this week" is a filter Claude applies — not a primitive. This keeps AccessCanvas free of date-window logic.
- `listFiles` is new: a direct course Files listing, so Claude can discover downloadable files without walking modules. Returns empty when a professor has disabled file export (surfaced honestly, not an error).
- `downloadFile` takes a single file (not a batch). Batching is the caller's loop; keeps the primitive atomic. `dest` lets Claude place the file directly into the course vault folder it manages.

### Response shape

Every tool returns JSON text:

```json
{ "data": <result>, "_fetchedAt": "<ISO timestamp>" }
```

No `_fromCache`, no `_hint`, no cache metadata. `_fetchedAt` is the only envelope field, so a consumer always knows data freshness.

## Decision: Stateless (no cache)

v1 cached stable endpoints (modules, pages) in SQLite. v2 drops all caching:

- **The vault is the cache.** Downstream, Claude persists Canvas data into the course brain on each sync; an internal cache would duplicate that store and create a second thing to keep fresh.
- **Rate limits aren't a constraint at student scale.** Canvas uses a per-token leaky bucket; a full sync of ~6 courses is ~60–100 requests, well under the limit even hourly.
- **Latency lands where it's free.** Live AccessCanvas calls happen inside scheduled syncs, where a 20–60s full pull is irrelevant. Interactive questions ("what's due this week") read the vault, not Canvas — instant regardless.
- **Staleness is the dangerous failure mode.** A cached deadline that has moved is exactly the "messed up something important" error to design against. Stateless cannot have it.

If a single automation run ever proves chatty, an in-process (per-run, in-memory) dedupe can be added later — a pure addition, no rework.

## Error Handling

- Canvas API non-2xx → throw with status, statusText, and URL (current `canvasClient` behavior, kept).
- Missing/disabled data (e.g. file export off) → return an empty list, not an error. The absence is information.
- Config missing/invalid → fail fast at startup with a message pointing to `bun run setup` (current `config` behavior, kept).
- `downloadFile` to an unwritable `dest` → throw with the attempted path.

## Configuration

Unchanged from v1. `~/.accesscanvas/config.json`:

```json
{ "token": "...", "baseUrl": "https://...instructure.com", "downloadDir": "~/Academics", "timezone": "America/New_York" }
```

`bun run setup` wizard unchanged.

## Testing

- vitest, run with `bun run test`.
- Unit tests per tool with mocked Canvas responses (existing pattern).
- TDD for `canvasClient`, `htmlParser`, `dateUtils`, `fileManager` (pure-logic core).
- Each tool test asserts the response shape (`{ data, _fetchedAt }`) and correct field mapping.
- `downloadFile` test asserts path resolution for both `dest`-given and flat-`downloadDir` cases.

## Net Effect

- Roughly half the v1 code deleted (cache, tool-split, metadata machinery).
- Surface: "9 tools + cache machinery" → "9 clean stateless primitives."
- AccessCanvas becomes a reliable, boring Canvas data tap; the karpathy-wiki and all optimization live downstream in Claude automations that consume it.

## Resolved Decisions

- **Versioning:** restart at `0.1.0` per the new-project convention. This rebuild is treated as a fresh project, not a continuation of v1's `1.0.0`.
- **`getGrades` + `getAssignmentGrades`:** keep both. Course-level summary and per-assignment breakdown serve different downstream consumers; the per-assignment breakdown is what a grade-optimization agent needs.
