// tests/scripts/setup.test.ts
import { describe, it, expect } from 'vitest';

describe('resolveClaudeDesktopConfigPath', () => {
  it('returns a path ending in claude_desktop_config.json', async () => {
    const { resolveClaudeDesktopConfigPath } = await import('../../scripts/setup.js');
    expect(resolveClaudeDesktopConfigPath()).toMatch(/claude_desktop_config\.json$/);
  });

  it('returns a path containing "Claude"', async () => {
    const { resolveClaudeDesktopConfigPath } = await import('../../scripts/setup.js');
    expect(resolveClaudeDesktopConfigPath()).toContain('Claude');
  });
});

describe('mergeAccessCanvasEntry', () => {
  it('adds accesscanvas to empty mcpServers', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const result = mergeAccessCanvasEntry({ mcpServers: {} }, '/path/to/dist/index.js');
    expect(result.mcpServers['accesscanvas']).toEqual({
      command: 'node',
      args: ['/path/to/dist/index.js'],
    });
  });

  it('overwrites existing accesscanvas entry without duplicating', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const existing = {
      mcpServers: {
        accesscanvas: { command: 'node', args: ['/old/path/index.js'] },
        other: { command: 'python', args: ['server.py'] },
      },
    };
    const result = mergeAccessCanvasEntry(existing, '/new/path/index.js');
    expect(Object.keys(result.mcpServers)).toHaveLength(2);
    expect((result.mcpServers['accesscanvas'] as any).args[0]).toBe('/new/path/index.js');
    expect(result.mcpServers['other']).toEqual({ command: 'python', args: ['server.py'] });
  });

  it('handles config missing mcpServers entirely', async () => {
    const { mergeAccessCanvasEntry } = await import('../../scripts/setup.js');
    const result = mergeAccessCanvasEntry({}, '/path/index.js');
    expect(result.mcpServers['accesscanvas']).toBeDefined();
  });
});
