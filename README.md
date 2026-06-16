# By ishu
A tool that lets Claude (the AI) read your Canvas courses, assignments, grades, and files. Ask Claude things like "what's due this week?" or "download the files from Assignment 2" and it just works.

Reach out if you have questions or want new features.

---

## What you need before starting

- A Mac or Windows computer
- [Claude Desktop](https://claude.ai/download) installed
- A Babson Canvas account
- About 10 minutes

---

## Step 1 — Install Node.js

Node.js is the engine that runs this tool. You probably don't have it yet.

1. Go to [nodejs.org](https://nodejs.org)
2. Click the big green **"LTS"** download button
3. Open the downloaded file and follow the installer

To confirm it worked, open Terminal (Mac) or Command Prompt (Windows) and type:
```
node --version
```
You should see something like `v20.11.0`. Any number above 18 is fine.

---

## Step 2 — Download AccessCanvas

In Terminal, run:
```bash
git clone https://github.com/04ipatel/AccessCanvas.git
cd AccessCanvas
```

If you get `git: command not found`, install Git from [git-scm.com](https://git-scm.com) first.

---

## Step 3 — Install dependencies

```bash
npm install
```

This downloads the packages AccessCanvas needs. Takes about 30 seconds.

---

## Step 4 — Run the setup wizard

```bash
npm run setup
```

The wizard will walk you through everything:

**Canvas URL** — just press Enter to use the Babson default (`https://babson.instructure.com`).

**API token** — this is how Canvas knows it's you. To get one:
1. Log in to Canvas
2. Click your profile picture (top right) → **Settings**
3. Scroll down to **Approved Integrations**
4. Click **+ New Access Token**
5. Name it anything (e.g. "Claude") → click **Generate Token**
6. Copy the token — you won't be able to see it again after closing that window

Paste it into the wizard. It will validate the token live and tell you if it worked.

**Timezone** — the wizard detects yours automatically. Just press Enter to confirm.

**Download folder** — where Canvas files will be saved on your computer. Press Enter to use the default (`~/Academics`).

**Claude Desktop config** — the wizard will ask if it should configure Claude Desktop automatically. Say yes. This is what connects Claude to AccessCanvas.

---

## Step 5 — Build

```bash
npm run build
```

Compiles the code. Takes a few seconds.

---

## Step 6 — Restart Claude Desktop

Fully quit Claude Desktop and reopen it. AccessCanvas will appear in Claude's tool list (look for the tools icon in the chat bar).

---

## You're done

Try asking Claude:
- *"What assignments do I have coming up?"*
- *"Show me my grades for QTM3310"*
- *"Download the files from Assignment 2 in FIN4507"*

---

## Tools Claude can use

| Tool | What it does |
|------|-------------|
| `list_courses` | Lists your active courses |
| `get_assignments` | Every assignment for a course — due dates, points, instructions, attached files |
| `get_grades` | Your overall grade in each course |
| `get_assignment_grades` | Scores and submission status, assignment by assignment |
| `get_announcements` | Recent announcements for a course |
| `get_modules` | Module/week structure for a course |
| `get_module_item` | Content of a specific module page |
| `list_files` | Files a course makes available |
| `download_file` | Downloads a file to your computer |

---

## Troubleshooting

**Claude doesn't show AccessCanvas after restarting**
Make sure you ran `npm run build` before restarting. If still missing, check that the setup wizard successfully wrote the Claude Desktop config (it will confirm this at the end).

**Token keeps getting rejected**
Make sure you copied the full token — they're long. Regenerate one in Canvas if needed.

**`npm install` fails**
Your Node.js version might be too old. Re-download from nodejs.org and pick the LTS version.

**Files are downloading to the wrong place**
Re-run `npm run setup` — it will let you change the download folder.

---

## Development

```bash
npm test           # run tests
npm run test:watch # watch mode
npm run build      # compile TypeScript
```
