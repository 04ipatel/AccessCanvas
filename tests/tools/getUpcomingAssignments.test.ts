// tests/tools/getUpcomingAssignments.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockAssignments = [
  {
    id: 54079881,
    name: 'Assignment 2: Data Management in R',
    due_at: '2026-04-04T23:59:59-04:00',
    points_possible: 100,
    submission_types: ['online_upload'],
    course_id: 7779627,
    description: '<p>Complete the R exercises.</p>',
    unlock_at: null,
    lock_at: null,
  },
];

describe('getUpcomingAssignments', () => {
  it('returns trimmed upcoming assignments for a specific course', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue(mockAssignments),
    };

    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    const result = await getUpcomingAssignments(mockClient as any, { courseId: '7779627' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('54079881');
    expect(result[0].title).toBe('Assignment 2: Data Management in R');
    expect(result[0].courseId).toBe('7779627');
    expect(result[0].dueAt).toBe('2026-04-04');
    expect(result[0].submissionType).toBe('online_upload');
    expect(result[0].pointsPossible).toBe(100);
  });

  it('fetches across all provided courses when no courseId given', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue(mockAssignments),
    };

    const mockCourses = [
      { id: '7779656', name: 'Risk Management', code: 'FIN4507' },
      { id: '7779627', name: 'PBA', code: 'QTM3310' },
    ];

    const { getUpcomingAssignments } = await import('../../src/tools/getUpcomingAssignments.js');
    await getUpcomingAssignments(mockClient as any, {}, mockCourses);

    expect(mockClient.getPaginated).toHaveBeenCalledTimes(2);
  });
});
