# AccessCanvas — System Architecture & Role

This document describes the **whole system** AccessCanvas is part of, and exactly where AccessCanvas fits. If you read one doc to understand the design intent, read this one.

## The problem this system solves

Canvas is not a reliable source of truth for a student's courses:

- Professors announce deadlines aloud in lecture that never reach the Canvas Assignments tab.
- The real schedule often lives in a syllabus PDF, and drifts when a class runs ahead or behind.
- Some professors disable Canvas export features, so data you'd expect isn't available through the API.

So a tool that just reads Canvas and answers "what's due this week?" gives confident-but-wrong answers. The fix isn't to read Canvas harder — it's to treat Canvas as **one input among several** into a curated, trustworthy per-course knowledge base, and to keep the part that talks to Canvas dumb and reliable.

## The two layers

The system is deliberately split into two layers. **This repository is only the bottom layer.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2 — Intelligence (downstream, NOT this repo)                   │
│  Claude Desktop automations + scheduled tasks                       │
│                                                                     │
│   • Per-course "brain" — a Karpathy-style LLM wiki:                  │
│       Truth (top)  = curated, trusted facts (schedule, deadlines,   │
│                       grading, materials)                           │
│       Log (bottom) = append-only stream of new signals, each        │
│                       timestamped + sourced + [unreconciled]        │
│   • Reconciliation — promote important Log entries into Truth        │
│       (human-confirmed for high-stakes changes like a moved exam)   │
│   • Other sources Claude pulls itself: Granola lecture transcripts, │
│       syllabus PDFs, anything not on Canvas                         │
│   • Grade-optimization behaviors: "exam in 2 weeks → schedule 3     │
│       study sessions", assignment help, material prep               │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ consumes
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — AccessCanvas (THIS repo)                                   │
│  A lean, stateless, read-only MCP server: the layer that talks      │
│  to Canvas. 9 primitives, fetch-fresh, no state, no judgment.       │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ reads
                                 ▼
                          Babson Canvas LMS
```

### Tier 1 — AccessCanvas (what this repo is)

AccessCanvas is **only the layer that talks to Canvas.** It exposes 9 clean primitives that pull data out of Canvas and nothing else. It is:

- **Stateless** — every call fetches fresh from Canvas. No cache. (A stale cached deadline is the single most dangerous failure mode; statelessness eliminates that class of error.)
- **Read-only** — the one exception is `download_file`, which writes a Canvas file to local disk. AccessCanvas never writes to Canvas.
- **Judgment-free** — it returns *all* assignments, not "what's due this week." Any filtering, ranking, or interpretation is the consumer's job. The moment the access layer makes a judgment call, it becomes something that can be wrong.

The mental model: **AccessCanvas is the clean-water tap. Claude is the chef.** We build a really good tap, not the whole restaurant. A reliable, boring data tap makes the smart downstream work trivial — and keeps the dangerous failure mode (a wrong deadline) out of the foundation.

### Tier 2 — the intelligence (what consumes AccessCanvas, built elsewhere)

Everything clever lives downstream, in Claude Desktop automations and scheduled tasks that call AccessCanvas's primitives. The intended shape is a **per-course "brain"** — a Karpathy-style LLM wiki, one document per course:

- **Truth** at the top: curated, trusted facts — grading scheme, deadlines, exams, materials.
- **Log** at the bottom: an append-only stream of new signals (grades posted, announcements, a deadline mentioned in a Granola lecture transcript, a Canvas change), each timestamped, sourced, and marked `[unreconciled]` until promoted.

A sync runs (manually or on a schedule): Claude pulls Canvas data via AccessCanvas, pulls non-Canvas sources (Granola, syllabus PDFs) itself, appends new signals to the Log, then reconciles the important ones into Truth — human-confirmed for high-stakes changes. On top of that trustworthy base sit the grade-optimization behaviors: study scheduling, assignment help, material prep.

**None of Tier 2 is built in this repo.** AccessCanvas's primitives are *designed to make Tier 2 trivial* — but the vault, the Truth/Log model, reconciliation, Granola, PDF reading, and study scheduling all live downstream.

## The 9 primitives

All read-only and stateless except `download_file` (writes to local disk only). Every response is wrapped as `{ data, _fetchedAt }`.

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

## Why this split (the load-bearing decisions)

- **Reliability over coverage.** A small set of primitives that are always correct beats a large set that's sometimes wrong. See `decisions.md` D1.
- **Stateless, not cached.** The downstream brain is the durable store; a server-side cache would duplicate it and risk staleness. See `decisions.md` D2.
- **The vault is downstream, not here.** Keeping the access layer dumb keeps the dangerous failure mode out of the foundation and lets the intelligence evolve independently. See `decisions.md` D1.

## Related docs

- `decisions.md` — numbered architectural decisions (D1–D3) with rationale and rejected alternatives.
- `someday.md` — known limitations and deferred ideas.
- `../superpowers/specs/2026-06-16-accesscanvas-v2-design.md` — the full v2 design spec.
