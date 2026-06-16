import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadFile } from '../../src/tools/downloadFile.js';

describe('downloadFile (tool)', () => {
  it('downloads a single file and returns path + displayName', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'accesscanvas-tool-'));
    try {
      const client = {
        get: vi.fn().mockResolvedValue({ id: 42, display_name: 'Notes.pdf', url: 'https://canvas/files/42/download', size: 5, content_type: 'application/pdf' }),
        getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('hello')),
      };
      const result = await downloadFile(client as any, { courseId: '7', fileId: '42' }, dir);
      expect(result.displayName).toBe('Notes.pdf');
      expect(existsSync(result.path)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
