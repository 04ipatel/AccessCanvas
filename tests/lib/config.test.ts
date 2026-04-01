// tests/lib/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'accesscanvas-test-' + Date.now());
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads token and baseUrl from config file', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'test-token-123',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.token).toBe('test-token-123');
    expect(config.baseUrl).toBe('https://babson.instructure.com');
  });

  it('throws if config file is missing', async () => {
    const { loadConfig } = await import('../../src/lib/config.js');
    expect(() => loadConfig(join(tmpDir, 'missing.json'))).toThrow(/config file not found/i);
  });

  it('throws if token is missing', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ baseUrl: 'https://babson.instructure.com' }));
    const { loadConfig } = await import('../../src/lib/config.js');
    expect(() => loadConfig(configPath)).toThrow(/token/i);
  });

  it('reads downloadDir from config when present', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
      downloadDir: '/custom/path',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.downloadDir).toBe('/custom/path');
  });

  it('falls back to ~/Academics when downloadDir is absent', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.downloadDir).toBe(join(homedir(), 'Academics'));
  });

  it('reads timezone from config when present', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
      timezone: 'America/Chicago',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.timezone).toBe('America/Chicago');
  });

  it('falls back to system timezone when timezone is absent', async () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      token: 'tok',
      baseUrl: 'https://babson.instructure.com',
    }));
    const { loadConfig } = await import('../../src/lib/config.js');
    const config = loadConfig(configPath);
    expect(config.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
