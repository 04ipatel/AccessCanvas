import { describe, it, expect, vi } from 'vitest';
import { getAssignments } from '../../src/tools/getAssignments.js';

describe('getAssignments', () => {
  it('returns full assignment detail with parsed description and files', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 555, name: 'Case Study 2', course_id: 7,
          description: '<p>Read the case. <a data-api-endpoint="https://canvas/api/v1/courses/7/files/99" href="x">rubric.pdf</a></p>',
          due_at: '2026-06-12T03:59:00Z', points_possible: 20,
          submission_types: ['online_upload'],
          html_url: 'https://canvas/courses/7/assignments/555',
        },
      ]),
    };
    const result = await getAssignments(client as any, '7', 'America/New_York');
    expect(result).toHaveLength(1);
    const a = result[0];
    expect(a.id).toBe('555');
    expect(a.courseId).toBe('7');
    expect(a.title).toBe('Case Study 2');
    expect(a.pointsPossible).toBe(20);
    expect(a.submissionType).toBe('online_upload');
    expect(a.url).toBe('https://canvas/courses/7/assignments/555');
    expect(a.dueAt).toMatch(/2026-06-11/);
    expect(a.description).toContain('Read the case.');
    expect(a.files).toEqual([{ name: 'rubric.pdf', fileId: '99', apiEndpoint: 'https://canvas/api/v1/courses/7/files/99' }]);
  });

  it('handles null description and null due date', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 1, name: 'No-due assignment', course_id: 7, description: null, due_at: null, points_possible: 0, submission_types: [], html_url: 'u' },
      ]),
    };
    const result = await getAssignments(client as any, '7', 'America/New_York');
    expect(result[0].dueAt).toBeNull();
    expect(result[0].description).toBe('');
    expect(result[0].files).toEqual([]);
    expect(result[0].submissionType).toBe('none');
  });

  it('requests assignments ordered by due date', async () => {
    const client = { getPaginated: vi.fn().mockResolvedValue([]) };
    await getAssignments(client as any, '7', 'America/New_York');
    expect(client.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7/assignments',
      expect.objectContaining({ order_by: 'due_at' })
    );
  });
});
