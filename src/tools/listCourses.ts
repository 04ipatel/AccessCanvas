import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
  term: string | null;
}

export async function listCourses(client: CanvasClient): Promise<CourseInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
    'include[]': 'term',
  });

  return courses.map((c) => ({
    id: String(c.id),
    name: c.name,
    code: c.course_code,
    term: c.term?.name ?? null,
  }));
}
