// tests/tools/downloadFiles.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('downloadFiles', () => {
  it('downloads files and returns local paths', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 344828267,
        display_name: 'Assignment 2.pdf',
        filename: 'Assignment2.pdf',
        url: 'https://babson.instructure.com/files/344828267/download',
        size: 1024,
        content_type: 'application/pdf',
      }),
      getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('fake pdf content')),
    };
    const mockCache = { recordDownloadedFile: vi.fn() };

    // Mock fs operations
    const mockMkdirSync = vi.fn();
    const mockWriteFileSync = vi.fn();
    vi.doMock('fs', () => ({
      mkdirSync: mockMkdirSync,
      writeFileSync: mockWriteFileSync,
      existsSync: vi.fn().mockReturnValue(false),
    }));

    const { downloadFiles } = await import('../../src/tools/downloadFiles.js');
    const result = await downloadFiles(
      mockClient as any,
      mockCache as any,
      [{ fileId: '344828267', courseId: '7779656', courseName: 'Risk Management', context: 'Assignment2' }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Assignment 2.pdf');
    expect(result[0].localPath).toContain('RiskManagement');
    expect(result[0].localPath).toContain('Assignment2');
    expect(mockCache.recordDownloadedFile).toHaveBeenCalledWith(
      '344828267',
      '7779656',
      result[0].localPath,
      'Assignment 2.pdf'
    );
  });
});
