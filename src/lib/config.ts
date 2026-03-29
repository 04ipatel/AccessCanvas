import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config } from '../types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.accesscanvas', 'config.json');

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config {
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Create it with: { "token": "...", "baseUrl": "https://babson.instructure.com" }`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  if (!raw.token) {
    throw new Error('Config missing required field: token');
  }
  if (!raw.baseUrl) {
    throw new Error('Config missing required field: baseUrl');
  }

  return { token: raw.token, baseUrl: raw.baseUrl };
}
