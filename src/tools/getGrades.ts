import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface GradeInfo {
  courseId: string;
  courseName: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
}

export async function getGrades(
  client: CanvasClient,
  courseId?: string
): Promise<GradeInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
    'include[]': 'total_scores',
  });

  const filtered = courseId
    ? courses.filter((c) => String(c.id) === courseId)
    : courses;

  return filtered.map((c) => {
    const enrollment = (c.enrollments ?? []).find((e) => e.type === 'student');
    return {
      courseId: String(c.id),
      courseName: c.name,
      currentScore: enrollment?.computed_current_score ?? null,
      currentGrade: enrollment?.computed_current_grade ?? null,
      finalScore: enrollment?.computed_final_score ?? null,
      finalGrade: enrollment?.computed_final_grade ?? null,
    };
  });
}
