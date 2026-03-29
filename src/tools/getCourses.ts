import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasCourse } from '../types.js';

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
}

export async function getCourses(client: CanvasClient): Promise<CourseInfo[]> {
  const courses = await client.getPaginated<CanvasCourse>('/api/v1/courses', {
    enrollment_state: 'active',
    enrollment_type: 'student',
  });

  return courses.map((c) => ({
    id: String(c.id),
    name: c.name,
    code: c.course_code,
  }));
}
