# Setup Wizard Design

**Date:** 2026-04-01
**Status:** Approved

## Overview

An interactive CLI setup wizard for AccessCanvas that guides users through configuration — Canvas token, base URL, download folder, and Claude Desktop integration — with no manual file editing required. Designed for non-technical users on both Mac and Windows.

---

## Goals

- Zero manual file editing for first-time setup
- Works on Mac and Windows (Node.js + npm, no bun required for users)
- Validates the Canvas token live before saving
- Offers to auto-write the Claude Desktop config with confirmation
- Safe to re-run (updates existing config without duplicating entries)
- Non-technical users can complete setup without leaving the terminal

---

## New Files

- `scripts/setup.ts` — the setup wizard script

## Modified Files

- `package.json` — add `"setup": "tsx scripts/setup.ts"` to scripts
- `src/types.ts` — add `downloadDir: string` to `Config` interface
- `src/lib/config.ts` — read `downloadDir`, fall back to `~/Academics` if missing
- `src/lib/fileManager.ts` — accept `downloadDir` as a parameter instead of hardcoded constant
- `src/index.ts` — pass `config.downloadDir` into fileManager at startup

---

## Setup Script Flow

Users run: `npm run setup`

### Stage 1 — Welcome Banner

Prints a clear header explaining what the script will do:

```
AccessCanvas Setup
==================
This will configure AccessCanvas to connect Claude to your Canvas LMS.
You'll need: your Canvas portal URL and an API token (we'll show you how to get one).
```

### Stage 2 — Canvas Base URL

Prompt with default pre-filled:

```
What is your Canvas portal URL?
❯ https://babson.instructure.com
```

Users at other institutions replace the domain (e.g. `https://canvas.harvard.edu`). Babson is the default.

### Stage 3 — Canvas API Token

Before prompting, print inline instructions:

```
To get your Canvas API token:
  1. Log in to your Canvas portal
  2. Click your profile picture → Settings
  3. Scroll down to "Approved Integrations"
  4. Click "+ New Access Token"
  5. Give it a name like "Claude" and click Generate
  6. Copy the token — you won't be able to see it again after closing that page

Paste your Canvas token: (input is hidden)
```

Input is masked (password field via `@inquirer/prompts`).

After the user submits, the script makes a live validation call:

```
GET /api/v1/users/self
Authorization: Bearer <token>
```

- **Success:** "Token validated. Logged in as [Full Name]." → continue
- **Failure:** "That token didn't work (401 Unauthorized). Double-check you copied the full token." → re-prompt, does not exit

### Stage 4 — Download Folder

Before prompting, print platform-specific path tip:

- **Mac:** "Tip: To copy a folder's path in Finder — right-click the folder, hold the Option key, then click 'Copy "FolderName" as Pathname'."
- **Windows:** "Tip: To find a folder's path in File Explorer — click the address bar at the top of the window. It shows the full path you can copy and paste here."

Prompt with platform-sensible default pre-filled:

```
Where should Canvas files be downloaded?
❯ /Users/yourname/Academics          (Mac)
❯ C:\Users\yourname\Academics        (Windows)
```

User can accept the default (Enter) or type/paste any absolute path (e.g. `/Users/yourname/Desktop/CanvasFiles`).

Config is written to `~/.accesscanvas/config.json` after this step:

```json
{
  "token": "...",
  "baseUrl": "https://babson.instructure.com",
  "downloadDir": "/Users/yourname/Academics"
}
```

### Stage 5 — Claude Desktop Config

The script detects platform and resolves the Claude Desktop config path:

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

It prints the exact JSON entry and asks for confirmation before touching anything:

```
Almost done! Claude Desktop needs to know where AccessCanvas is installed.

Add this to your Claude Desktop config under "mcpServers":

  "accesscanvas": {
    "command": "node",
    "args": ["/Users/yourname/Projects/AccessCanvas/dist/index.js"]
  }

Config file location:
  /Users/yourname/Library/Application Support/Claude/claude_desktop_config.json

Want me to add this automatically? (Y/n)
```

**If confirmed:**
1. Read existing `claude_desktop_config.json` (create with empty `{ "mcpServers": {} }` if missing)
2. Merge `accesscanvas` entry into `mcpServers` (overwrites if already present — safe to re-run)
3. Write back with 2-space JSON formatting
4. Print: "Done. Restart Claude Desktop and you're all set."

**If declined:**
Print the JSON block again with a note to add it manually, then exit cleanly.

---

## Config Backward Compatibility

`downloadDir` is optional in `config.ts`. If missing (existing users who configured manually), it falls back to `~/Academics`. Existing users are not broken by this change and do not need to re-run setup.

---

## Dependencies

- `@inquirer/prompts` — interactive CLI prompts (password masking, confirmations, text input with defaults)
- `tsx` — already a dev dependency, used to run the script via `npm run setup`

No runtime dependencies added (setup script is dev-time only).

---

## README Changes

The README setup section updates to:

```
1. npm install
2. npm run setup        ← new: guided wizard replaces manual config steps
3. npm run build
4. Restart Claude Desktop
```

The manual "create config.json" and "edit claude_desktop_config.json" sections are removed. The wizard handles both.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Bad Canvas token | Re-prompts, does not exit |
| Config file already exists | Overwrites with new values |
| `accesscanvas` already in Claude Desktop config | Overwrites entry, no duplicate |
| Claude Desktop config file missing | Creates it with minimal valid structure |
| User declines auto-write | Prints JSON block, exits cleanly |
| Non-standard Canvas URL | Accepted as-is after token validation passes against it |
