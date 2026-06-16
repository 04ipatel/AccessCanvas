import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import { formatDateTime } from '../lib/dateUtils.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';

export interface AssignmentDetail {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionType: string;
  url: string;
  description: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export async function getAssignments(
  client: CanvasClient,
  courseId: string,
  timezone: string
): Promise<AssignmentDetail[]> {
  const assignments = await client.getPaginated<CanvasAssignment & { html_url?: string }>(
    `/api/v1/courses/${courseId}/assignments`,
    { order_by: 'due_at' }
  );

  return assignments.map((a) => {
    const parsed = parseContent(a.description ?? '');
    return {
      id: String(a.id),
      courseId: String(a.course_id ?? courseId),
      title: a.name,
      dueAt: formatDateTime(a.due_at, timezone),
      pointsPossible: a.points_possible,
      submissionType: a.submission_types[0] ?? 'none',
      url: a.html_url ?? '',
      description: parsed.plainText,
      files: parsed.files,
      externalLinks: parsed.externalLinks,
    };
  });
}
