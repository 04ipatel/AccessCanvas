import { input, password, confirm } from '@inquirer/prompts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

// ── Pure helpers (exported for testing) ──────────────────────────────────────

export function resolveClaudeDesktopConfigPath(): string {
  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

export function mergeAccessCanvasEntry(
  existingConfig: { mcpServers?: Record<string, unknown> },
  distPath: string
): { mcpServers: Record<string, unknown> } {
  const mcpServers = { ...(existingConfig.mcpServers ?? {}) };
  mcpServers['accesscanvas'] = { command: 'node', args: [distPath] };
  return { ...existingConfig, mcpServers };
}

// ── Main wizard ───────────────────────────────────────────────────────────────

async function main() {
  // Stage 1 — Welcome banner
  console.log('\nAccessCanvas Setup');
  console.log('==================');
  console.log('This will configure AccessCanvas to connect Claude to your Canvas LMS.');
  console.log("You'll need: your Canvas portal URL and an API token (we'll show you how to get one).\n");

  // Stage 2 — Canvas base URL
  const baseUrl = await input({
    message: 'What is your Canvas portal URL?',
    default: 'https://babson.instructure.com',
  });

  // Stage 3 — Canvas API token (with live validation loop)
  console.log('\nTo get your Canvas API token:');
  console.log('  1. Log in to your Canvas portal');
  console.log('  2. Click your profile picture → Settings');
  console.log('  3. Scroll down to "Approved Integrations"');
  console.log('  4. Click "+ New Access Token"');
  console.log('  5. Give it a name like "Claude" and click Generate');
  console.log("  6. Copy the token — you won't be able to see it again after closing that page\n");

  let token = '';
  while (true) {
    token = await password({ message: 'Paste your Canvas token: (input is hidden)' });

    try {
      const res = await fetch(`${baseUrl}/api/v1/users/self`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.log("\nThat token didn't work (401 Unauthorized). Double-check you copied the full token.\n");
        continue;
      }
      if (!res.ok) {
        console.log(`\nCanvas returned an unexpected error (${res.status}). Check your URL and try again.\n`);
        continue;
      }
      const user = await res.json() as { name: string };
      console.log(`\nToken validated. Logged in as ${user.name}.\n`);
      break;
    } catch {
      console.log('\nCould not reach Canvas. Check your URL and internet connection.\n');
    }
  }

  // Stage 4 — Timezone confirmation
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log(`Detected timezone: ${detectedTimezone}`);
  const timezoneConfirmed = await confirm({
    message: 'Is this correct?',
    default: true,
  });

  let timezone = detectedTimezone;
  if (!timezoneConfirmed) {
    console.log('\nCommon timezones: America/New_York, America/Chicago, America/Denver, America/Los_Angeles\n');
    while (true) {
      timezone = await input({
        message: 'Enter your timezone (IANA format):',
        default: detectedTimezone,
      });
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        break;
      } catch {
        console.log(`\n"${timezone}" is not a valid IANA timezone. Try again.\n`);
      }
    }
  }

  // Stage 5 — Download folder
  if (platform() === 'darwin') {
    console.log("\nTip: To copy a folder's path in Finder — right-click the folder, hold the Option key, then click 'Copy \"FolderName\" as Pathname'.\n");
  } else if (platform() === 'win32') {
    console.log('\nTip: To find a folder\'s path in File Explorer — click the address bar at the top of the window. It shows the full path you can copy and paste here.\n');
  }

  const downloadDir = await input({
    message: 'Where should Canvas files be downloaded?',
    default: join(homedir(), 'Academics'),
  });

  // Write ~/.accesscanvas/config.json
  const configDir = join(homedir(), '.accesscanvas');
  const configPath = join(configDir, 'config.json');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ token, baseUrl, downloadDir, timezone }, null, 2));
  console.log(`\nConfig saved to ${configPath}`);

  // Stage 6 — Claude Desktop config
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const distPath = resolve(__dirname, '..', 'dist', 'index.js');
  const claudeConfigPath = resolveClaudeDesktopConfigPath();

  const entryPreview = [
    '  "accesscanvas": {',
    '    "command": "node",',
    `    "args": ["${distPath}"]`,
    '  }',
  ].join('\n');

  console.log('\nAlmost done! Claude Desktop needs to know where AccessCanvas is installed.');
  console.log('\nAdd this to your Claude Desktop config under "mcpServers":\n');
  console.log(entryPreview);
  console.log(`\nConfig file location:\n  ${claudeConfigPath}\n`);

  const autoWrite = await confirm({
    message: 'Want me to add this automatically?',
    default: true,
  });

  if (autoWrite) {
    let existingConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (existsSync(claudeConfigPath)) {
      try {
        existingConfig = JSON.parse(readFileSync(claudeConfigPath, 'utf-8'));
      } catch {
        existingConfig = { mcpServers: {} };
      }
    } else {
      mkdirSync(dirname(claudeConfigPath), { recursive: true });
    }
    const merged = mergeAccessCanvasEntry(existingConfig, distPath);
    writeFileSync(claudeConfigPath, JSON.stringify(merged, null, 2));
    console.log("\nDone. Restart Claude Desktop and you're all set.");
  } else {
    console.log('\nTo add it manually, paste the following into your Claude Desktop config under "mcpServers":\n');
    console.log(entryPreview);
  }
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  });
}
