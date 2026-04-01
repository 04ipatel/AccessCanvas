import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';
import { formatDateTime } from '../lib/dateUtils.js';

export interface AssignmentDetails {
  id: string;
  courseId: string;
  title: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionType: string;
  description: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export async function getAssignmentDetails(
  client: CanvasClient,
  courseId: string,
  assignmentId: string,
  timezone: string
): Promise<AssignmentDetails> {
  const a = await client.get<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  );

  const parsed = parseContent(a.description ?? '');

  return {
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: formatDateTime(a.due_at, timezone),
    pointsPossible: a.points_possible,
    submissionType: a.submission_types[0] ?? 'none',
    description: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
