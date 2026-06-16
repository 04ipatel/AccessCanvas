import { describe, it, expect, vi } from 'vitest';
import { listFiles } from '../../src/tools/listFiles.js';
import { CanvasApiError } from '../../src/lib/canvasClient.js';

describe('listFiles', () => {
  it('returns mapped file summaries', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 99, display_name: 'Syllabus.pdf', filename: 'syll.pdf', url: 'u', size: 1024, content_type: 'application/pdf' },
      ]),
    };
    const result = await listFiles(client as any, '7');
    expect(result).toEqual([{ id: '99', name: 'Syllabus.pdf', url: 'u', type: 'application/pdf', size: 1024 }]);
    expect(client.getPaginated).toHaveBeenCalledWith('/api/v1/courses/7/files');
  });

  it('returns empty list when Canvas returns 403 (export disabled)', async () => {
    const client = {
      getPaginated: vi.fn().mockRejectedValue(new CanvasApiError(403, 'Canvas API error 403 Forbidden — /api/v1/courses/7/files')),
    };
    const result = await listFiles(client as any, '7');
    expect(result).toEqual([]);
  });

  it('rethrows 401 (bad/expired token) — never swallow an auth failure', async () => {
    const client = {
      getPaginated: vi.fn().mockRejectedValue(new CanvasApiError(401, 'Canvas API error 401 Unauthorized — /api/v1/courses/7/files')),
    };
    await expect(listFiles(client as any, '7')).rejects.toThrow('401');
  });

  it('rethrows non-403 errors', async () => {
    const client = {
      getPaginated: vi.fn().mockRejectedValue(new CanvasApiError(500, 'Canvas API error 500 Server Error — /api/v1/courses/7/files')),
    };
    await expect(listFiles(client as any, '7')).rejects.toThrow('500');
  });
});
