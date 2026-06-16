import { describe, it, expect, vi } from 'vitest';
import { listCourses } from '../../src/tools/listCourses.js';

describe('listCourses', () => {
  it('returns trimmed course list with term', async () => {
    const client = {
      getPaginated: vi.fn().mockResolvedValue([
        { id: 7779656, name: '2026SP-01:RISK MANAGEMENT', course_code: 'FIN4507', term: { name: '2026 Spring' } },
        { id: 7779627, name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', course_code: 'QTM3310', term: null },
      ]),
    };
    const result = await listCourses(client as any);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '7779656', name: '2026SP-01:RISK MANAGEMENT', code: 'FIN4507', term: '2026 Spring' });
    expect(result[1]).toEqual({ id: '7779627', name: '2026SP-04:PREDICTIVE BUSINESS ANALYTICS', code: 'QTM3310', term: null });
  });

  it('requests active student enrollments and includes term', async () => {
    const client = { getPaginated: vi.fn().mockResolvedValue([]) };
    await listCourses(client as any);
    expect(client.getPaginated).toHaveBeenCalledWith(
      '/api/v1/courses',
      expect.objectContaining({ enrollment_state: 'active', enrollment_type: 'student', 'include[]': 'term' })
    );
  });
});
