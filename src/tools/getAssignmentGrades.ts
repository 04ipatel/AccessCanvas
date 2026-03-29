import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasAssignment } from '../types.js';
import { localDateFromISO } from '../lib/dateUtils.js';

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
  courseId: string
): Promise<AssignmentGrade[]> {
  const assignments = await client.getPaginated<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments`,
    { 'include[]': 'submission', order_by: 'due_at' }
  );

  return assignments.map((a) => ({
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: a.due_at ? localDateFromISO(a.due_at) : null,
    pointsPossible: a.points_possible,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    submittedAt: a.submission?.submitted_at ?? null,
    missing: a.submission?.missing ?? false,
    late: a.submission?.late ?? false,
  }));
}
