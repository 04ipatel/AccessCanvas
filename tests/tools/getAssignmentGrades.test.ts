// tests/tools/getAssignmentGrades.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockAssignments = [
  {
    id: 54079881,
    name: 'Assignment 2: Data Management',
    due_at: '2026-04-01T03:59:00Z',
    points_possible: 100,
    submission_types: ['online_upload'],
    course_id: 7779627,
    description: null,
    unlock_at: null,
    lock_at: null,
    submission: {
      score: 88,
      grade: 'B+',
      submitted_at: '2026-03-30T20:00:00Z',
      missing: false,
      late: false,
      workflow_state: 'graded',
    },
  },
  {
    id: 54079882,
    name: 'Quiz 1',
    due_at: '2026-03-15T03:59:00Z',
    points_possible: 50,
    submission_types: ['online_quiz'],
    course_id: 7779627,
    description: null,
    unlock_at: null,
    lock_at: null,
    submission: {
      score: null,
      grade: null,
      submitted_at: null,
      missing: true,
      late: false,
      workflow_state: 'unsubmitted',
    },
  },
];

describe('getAssignmentGrades', () => {
  it('returns graded assignments with scores', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('54079881');
    expect(result[0].title).toBe('Assignment 2: Data Management');
    expect(result[0].pointsPossible).toBe(100);
    expect(result[0].score).toBe(88);
    expect(result[0].grade).toBe('B+');
    expect(result[0].missing).toBe(false);
    expect(result[0].late).toBe(false);
  });

  it('returns null score for unsubmitted assignments', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');

    expect(result[1].score).toBeNull();
    expect(result[1].missing).toBe(true);
    expect(result[1].submittedAt).toBeNull();
  });

  it('calls correct Canvas endpoint with submission include', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses/7779627/assignments',
      expect.objectContaining({ 'include[]': 'submission' })
    );
  });

  it('formats dueAt as date+time+timezone in specified timezone', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue(mockAssignments) };
    const { getAssignmentGrades } = await import('../../src/tools/getAssignmentGrades.js');
    const result = await getAssignmentGrades(mockClient as any, '7779627', 'America/New_York');
    // 2026-04-01T03:59:00Z in EDT (UTC-4) = 2026-03-31 11:59 PM EDT
    expect(result[0].dueAt).toBe('2026-03-31 11:59 PM EDT');
    // 2026-03-30T20:00:00Z in EDT (UTC-4) = 2026-03-30 4:00 PM EDT
    expect(result[0].submittedAt).toBe('2026-03-30 4:00 PM EDT');
  });
});
