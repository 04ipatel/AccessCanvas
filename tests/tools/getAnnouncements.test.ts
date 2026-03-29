// tests/tools/getAnnouncements.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getAnnouncements', () => {
  it('returns trimmed announcements with plain text body', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 1001,
          title: 'Assignment 2 Due Date Extended',
          message: '<p>The due date for <strong>Assignment 2</strong> has been extended to April 10.</p>',
          posted_at: '2026-03-28T10:00:00-04:00',
        },
      ]),
    };

    const { getAnnouncements } = await import('../../src/tools/getAnnouncements.js');
    const result = await getAnnouncements(mockClient as any, '7779627');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1001');
    expect(result[0].title).toBe('Assignment 2 Due Date Extended');
    expect(result[0].body).toContain('Assignment 2');
    expect(result[0].body).not.toContain('<strong>');
    expect(result[0].postedAt).toBe('2026-03-28T10:00:00-04:00');
  });

  it('respects limit parameter', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getAnnouncements } = await import('../../src/tools/getAnnouncements.js');
    await getAnnouncements(mockClient as any, '7779627', 3);
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7779627/discussion_topics',
      expect.objectContaining({ only_announcements: 'true', per_page: '3' })
    );
  });
});
