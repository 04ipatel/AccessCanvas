// tests/tools/getGrades.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getGrades', () => {
  it('returns grade info for all courses', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        {
          id: 7779656,
          name: '2026SP-01:RISK MANAGEMENT',
          course_code: 'FIN4507',
          enrollments: [{
            type: 'student',
            computed_current_score: 88.5,
            computed_current_grade: 'B+',
            computed_final_score: 88.5,
            computed_final_grade: 'B+',
          }],
        },
        {
          id: 7779627,
          name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS',
          course_code: 'QTM3310',
          enrollments: [{
            type: 'student',
            computed_current_score: null,
            computed_current_grade: null,
            computed_final_score: null,
            computed_final_grade: null,
          }],
        },
      ]),
    };

    const { getGrades } = await import('../../src/tools/getGrades.js');
    const result = await getGrades(mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      courseId: '7779656',
      courseName: '2026SP-01:RISK MANAGEMENT',
      currentScore: 88.5,
      currentGrade: 'B+',
      finalScore: 88.5,
      finalGrade: 'B+',
    });
    expect(result[1].currentScore).toBeNull();
  });

  it('filters to a specific course when courseId provided', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: 'Risk Management', course_code: 'FIN4507',
          enrollments: [{ type: 'student', computed_current_score: 90, computed_current_grade: 'A-', computed_final_score: 90, computed_final_grade: 'A-' }] },
        { id: 7779627, name: 'PBA', course_code: 'QTM3310',
          enrollments: [{ type: 'student', computed_current_score: 85, computed_current_grade: 'B', computed_final_score: 85, computed_final_grade: 'B' }] },
      ]),
    };

    const { getGrades } = await import('../../src/tools/getGrades.js');
    const result = await getGrades(mockClient as any, '7779656');

    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('7779656');
  });
});
