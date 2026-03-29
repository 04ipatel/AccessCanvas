// tests/tools/getModuleItem.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getModuleItem', () => {
  it('fetches and caches a WikiPage item', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        page_id: 999,
        url: 'session-1-notes',
        title: 'Session 1 Notes',
        body: `<p>Key concepts:</p>
          <a title="slides.pdf" href="viewer/files/slides.pdf"
            data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779627/files/111"
            data-api-returntype="File">Slides</a>`,
      }),
    };
    const mockCache = {
      getPage: vi.fn().mockReturnValue(null),
      setPage: vi.fn(),
      getModuleStructure: vi.fn().mockReturnValue([
        {
          id: '1', name: 'Introduction', items: [
            { id: '888', title: 'Session 1 Notes', type: 'Page', pageUrl: 'session-1-notes', locked: false }
          ]
        }
      ]),
    };

    const { getModuleItem } = await import('../../src/tools/getModuleItem.js');
    const result = await getModuleItem(mockClient as any, mockCache as any, '7779627', '888');

    expect(result.title).toBe('Session 1 Notes');
    expect(result.plainText).toContain('Key concepts');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileId).toBe('111');
    expect(mockCache.setPage).toHaveBeenCalled();
  });

  it('returns cached page without API call', async () => {
    const mockClient = { get: vi.fn() };
    const mockCache = {
      getPage: vi.fn().mockReturnValue({
        id: '888',
        courseId: '7779627',
        title: 'Cached Page',
        content: '<p>Cached content</p>',
        fetchedAt: '2026-03-01T00:00:00Z',
      }),
      setPage: vi.fn(),
      getModuleStructure: vi.fn().mockReturnValue(null),
    };

    const { getModuleItem } = await import('../../src/tools/getModuleItem.js');
    const result = await getModuleItem(mockClient as any, mockCache as any, '7779627', '888');

    expect(result.title).toBe('Cached Page');
    expect(mockClient.get).not.toHaveBeenCalled();
  });
});
