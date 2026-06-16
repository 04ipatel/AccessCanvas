# Decisions Log

Numbered log of non-obvious architectural decisions. Newest first.

---

## D3 — AccessCanvas v2: remove SQLite, drop unused dependency (2026-06-16 13:24 JST)

**Decided:** v2 is stateless — the `better-sqlite3` dependency, `@types/better-sqlite3`, and `src/lib/cache.ts` are removed entirely. Every tool fetches fresh from Canvas.

**Why:** With no cache there is no native module to compile (the v1 `better-sqlite3` v9→v12 Node-compat note is gone) and no second store to keep fresh. The downstream course-brain vault is the durable layer; a server-side cache only duplicated it. See D2.

**Rejected:** Keeping `better-sqlite3` "just in case" — dead weight that forces native compilation on install.

---

## D2 — AccessCanvas v2: stateless, no cache (2026-06-16 13:24 JST)

**Decided:** v2 holds no state. No SQLite cache, no cached-vs-live tool split, no `forceRefresh`. The response envelope is `{ data, _fetchedAt }` only — no `_fromCache`/`_hint`.

**Why:**
- The downstream vault (the course brain) is the cache; a server-side cache duplicates it and creates a second thing to keep fresh.
- Rate limits are a non-issue at student scale (~60–100 requests for a full ~6-course sync, well under Canvas's per-token leaky bucket even hourly).
- Latency only lands in scheduled background syncs, where 20–60s is free. Interactive questions read the vault downstream, not Canvas.
- A stale cached deadline is the single most dangerous failure mode; statelessness eliminates that class of error entirely.

**Rejected:**
- *SQLite cache (v1 model):* cache-invalidation complexity, stale-data risk, redundant with the vault.
- *In-memory per-run dedupe:* deferred. A pure additive optimization if a single automation run ever proves chatty; no rework required to add later.

---

## D1 — AccessCanvas reframed as a pure Canvas-access layer (2026-06-16 13:24 JST)

**Decided:** AccessCanvas is *only* the layer that talks to Canvas — 9 read-only primitives (`list_courses`, `get_assignments`, `get_grades`, `get_assignment_grades`, `get_announcements`, `get_modules`, `get_module_item`, `list_files`, `download_file`). It does zero reasoning.

**Why:** Canvas is an incomplete source of truth for a student's courses (deadlines announced in lecture, schedules in syllabus PDFs, professors disabling exports). The intelligence — a Karpathy-style "truth + append-only log" course brain per class, source reconciliation, PDF reading, Granola lecture transcripts, study scheduling — belongs **downstream**, in Claude Desktop automations that consume these primitives. Keeping the access layer dumb and reliable makes that downstream work trivial and keeps the dangerous failure mode (wrong deadline) out of the foundation.

**Rejected:**
- *Building the vault/wiki/reconciliation into AccessCanvas:* over-scopes the tool; the access layer must stay a boring, reliable data tap.
- *Convenience primitives like "due this week":* date-window logic is judgment that belongs to the consumer; `get_assignments` returns the full set and the caller filters.
- *Keeping v1's `1.0.0`:* this is a fresh design; restarted at `0.1.0` per the new-project convention.

**Out of scope (downstream, not this repo):** the course-brain vault, Truth/Log model, reconciliation, Granola, PDF extraction, any Tier-2 grade-optimization logic.
