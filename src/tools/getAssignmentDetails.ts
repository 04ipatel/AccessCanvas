import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasAssignment, FileRef, ExternalLink } from '../types.js';

function localDateFromISO(isoString: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoString));
}

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
  assignmentId: string
): Promise<AssignmentDetails> {
  const a = await client.get<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  );

  const parsed = parseContent(a.description ?? '');

  return {
    id: String(a.id),
    courseId,
    title: a.name,
    dueAt: a.due_at ? localDateFromISO(a.due_at) : null,
    pointsPossible: a.points_possible,
    submissionType: a.submission_types[0] ?? 'none',
    description: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
