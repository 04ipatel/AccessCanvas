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

// ── Main wizard (added in Task 13) ───────────────────────────────────────────
