import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import { formatDateTime } from '../lib/dateUtils.js';

export interface AssignmentGrade {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
}

export async function getAssignmentGrades(
  client: CanvasClient,
  courseId: string,
  timezone: string
): Promise<AssignmentGrade[]> {
  const assignments = await client.getPaginated<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments`,
    { 'include[]': 'submission', order_by: 'due_at' }
  );

  return assignments.map((a) => ({
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: formatDateTime(a.due_at, timezone),
    pointsPossible: a.points_possible,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    submittedAt: formatDateTime(a.submission?.submitted_at ?? null, timezone),
    missing: a.submission?.missing ?? false,
    late: a.submission?.late ?? false,
  }));
}
