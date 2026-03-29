// tests/tools/getAssignmentDetails.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getAssignmentDetails', () => {
  it('returns assignment details with files parsed from HTML', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 54079881,
        name: 'Group Assignment 2',
        description: `<p><a
          title="Assignment 2.pdf"
          href="viewer/files/Assignment2.pdf"
          data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828267"
          data-api-returntype="File">Assignment 2.pdf</a></p>
          <p><a title="MS.xlsx" href="viewer/files/MS.xlsx"
          data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828268"
          data-api-returntype="File">MS.xlsx</a></p>`,
        due_at: '2026-03-25T07:59:59-04:00',
        points_possible: 100,
        submission_types: ['online_upload'],
        course_id: 7779656,
        unlock_at: null,
        lock_at: null,
      }),
    };

    const { getAssignmentDetails } = await import('../../src/tools/getAssignmentDetails.js');
    const result = await getAssignmentDetails(mockClient as any, '7779656', '54079881');

    expect(result.id).toBe('54079881');
    expect(result.title).toBe('Group Assignment 2');
    expect(result.dueAt).toBe('2026-03-25');
    expect(result.files).toHaveLength(2);
    expect(result.files[0].name).toBe('Assignment 2.pdf');
    expect(result.files[0].fileId).toBe('344828267');
    expect(result.files[1].name).toBe('MS.xlsx');
    expect(result.files[1].fileId).toBe('344828268');
  });

  it('handles assignment with no files gracefully', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        id: 99,
        name: 'Reading Quiz',
        description: '<p>Complete the quiz on Canvas.</p>',
        due_at: null,
        points_possible: 10,
        submission_types: ['external_tool'],
        course_id: 7779627,
        unlock_at: null,
        lock_at: null,
      }),
    };

    const { getAssignmentDetails } = await import('../../src/tools/getAssignmentDetails.js');
    const result = await getAssignmentDetails(mockClient as any, '7779627', '99');

    expect(result.files).toHaveLength(0);
    expect(result.description).toContain('Complete the quiz');
  });
});
