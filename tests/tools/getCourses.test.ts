// tests/tools/getCourses.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('getCourses', () => {
  it('returns trimmed course list', async () => {
    const mockClient = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: '2026SP-01:RISK MANAGEMENT', course_code: 'FIN4507', enrollments: [] },
        { id: 7779627, name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', course_code: 'QTM3310', enrollments: [] },
      ]),
    };

    const { getCourses } = await import('../../src/tools/getCourses.js');
    const result = await getCourses(mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '7779656', name: '2026SP-01:RISK MANAGEMENT', code: 'FIN4507' });
    expect(result[1]).toEqual({ id: '7779627', name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', code: 'QTM3310' });
  });

  it('calls correct Canvas endpoint', async () => {
    const mockClient = { getPaginated: vi.fn().mockResolvedValue([]) };
    const { getCourses } = await import('../../src/tools/getCourses.js');
    await getCourses(mockClient as any);
    expect(mockClient.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses',
      expect.objectContaining({ enrollment_state: 'active' })
    );
  });
});
