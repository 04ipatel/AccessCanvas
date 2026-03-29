import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import type { CourseInfo } from './getCourses.js';

export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  submissionType: string;
  pointsPossible: number;
}

export async function getUpcomingAssignments(
  client: CanvasClient,
  options: { courseId?: string },
  allCourses?: CourseInfo[]
): Promise<AssignmentSummary[]> {
  const courseIds = options.courseId
    ? [options.courseId]
    : (allCourses ?? []).map((c) => c.id);

  const results: AssignmentSummary[] = [];

  for (const courseId of courseIds) {
    const assignments = await client.getPaginated<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments`,
      { bucket: 'upcoming', order_by: 'due_at', per_page: '50' }
    );

    for (const a of assignments) {
      results.push({
        id: String(a.id),
        courseId: String(a.course_id ?? courseId),
        title: a.name,
        dueAt: a.due_at ? a.due_at.slice(0, 10) : null,
        submissionType: a.submission_types[0] ?? 'none',
        pointsPossible: a.points_possible,
      });
    }
  }

  return results;
}
