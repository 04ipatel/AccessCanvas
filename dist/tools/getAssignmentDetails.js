import { parseContent } from '../lib/htmlParser.js';
export async function getAssignmentDetails(client, courseId, assignmentId) {
    const a = await client.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
    const parsed = parseContent(a.description ?? '');
    return {
        id: String(a.id),
        courseId,
        title: a.name,
        dueAt: a.due_at,
        pointsPossible: a.points_possible,
        submissionType: a.submission_types[0] ?? 'none',
        description: parsed.plainText,
        files: parsed.files,
        externalLinks: parsed.externalLinks,
    };
}
