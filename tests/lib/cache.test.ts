// tests/lib/cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('Cache', () => {
  let cache: Awaited<ReturnType<typeof import('../../src/lib/cache.js').openCache>>;

  beforeEach(async () => {
    const { openCache } = await import('../../src/lib/cache.js');
    cache = openCache(':memory:');
  });

  it('stores and retrieves module structure', () => {
    const data = [{ id: '1', name: 'Syllabus', items: [] }];
    cache.setModuleStructure('course-123', data);
    const result = cache.getModuleStructure('course-123');
    expect(result).toEqual(data);
  });

  it('returns null for uncached module structure', () => {
    const result = cache.getModuleStructure('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves cached page content', () => {
    cache.setPage('item-456', 'course-123', 'Syllabus Week 1', '<p>content</p>');
    const result = cache.getPage('item-456');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Syllabus Week 1');
    expect(result!.content).toBe('<p>content</p>');
    expect(result!.courseId).toBe('course-123');
  });

  it('returns null for uncached page', () => {
    expect(cache.getPage('nonexistent')).toBeNull();
  });

  it('records and retrieves downloaded file', () => {
    cache.recordDownloadedFile('file-789', 'course-123', '/Users/test/Canvas/file.pdf', 'file.pdf');
    const result = cache.getDownloadedFile('file-789');
    expect(result).not.toBeNull();
    expect(result!.localPath).toBe('/Users/test/Canvas/file.pdf');
    expect(result!.displayName).toBe('file.pdf');
  });

  it('overwrites module structure on second set', () => {
    cache.setModuleStructure('course-123', [{ id: '1', name: 'Old', items: [] }]);
    cache.setModuleStructure('course-123', [{ id: '2', name: 'New', items: [] }]);
    const result = cache.getModuleStructure('course-123');
    expect(result![0].name).toBe('New');
  });
});
