// tests/tools/getCourseModules.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockModules = [
  { id: 12538783, name: 'Syllabus & Schedule', position: 1, items_count: 1, items_url: '' },
];

const mockItems = [
  {
    id: 132722315,
    title: 'FIN4507 Syllabus_2026Spring.pdf',
    type: 'File',
    content_id: 344828267,
    indent: 0,
    position: 1,
    locked_for_user: false,
    url: 'https://babson.instructure.com/api/v1/courses/7779656/files/344828267',
    page_url: undefined,
    external_url: undefined,
  },
];

describe('getCourseModules', () => {
  it('fetches and returns module structure', async () => {
    const mockClient = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce(mockModules)
        .mockResolvedValueOnce(mockItems),
    };
    const mockCache = {
      getModuleStructure: vi.fn().mockReturnValue(null),
      setModuleStructure: vi.fn(),
    };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Syllabus & Schedule');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].type).toBe('File');
    expect(result[0].items[0].fileId).toBe('344828267');
    expect(mockCache.setModuleStructure).toHaveBeenCalled();
  });

  it('returns cached result without API call', async () => {
    const cached = [{ id: '1', name: 'Cached Module', items: [] }];
    const mockClient = { getPaginated: vi.fn() };
    const mockCache = {
      getModuleStructure: vi.fn().mockReturnValue(cached),
      setModuleStructure: vi.fn(),
    };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656');

    expect(result).toEqual(cached);
    expect(mockClient.getPaginated).not.toHaveBeenCalled();
  });

  it('extracts password from ExternalUrl title', async () => {
    const mockClient = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce([{ id: 1, name: 'Class Slides', position: 1, items_count: 1, items_url: '' }])
        .mockResolvedValueOnce([{
          id: 132566583,
          title: 'Class Slides (password: Strat2026)',
          type: 'ExternalUrl',
          external_url: 'https://babson-my.sharepoint.com/...',
          indent: 0,
          position: 1,
          locked_for_user: false,
        }]),
    };
    const mockCache = { getModuleStructure: vi.fn().mockReturnValue(null), setModuleStructure: vi.fn() };

    const { getCourseModules } = await import('../../src/tools/getCourseModules.js');
    const result = await getCourseModules(mockClient as any, mockCache as any, '7779656', true);

    expect(result[0].items[0].password).toBe('Strat2026');
    expect(result[0].items[0].externalUrl).toBe('https://babson-my.sharepoint.com/...');
  });
});
