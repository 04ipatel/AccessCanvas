export async function getUpcomingAssignments(client, options, allCourses) {
    const courseIds = options.courseId
        ? [options.courseId]
        : (allCourses ?? []).map((c) => c.id);
    const results = [];
    for (const courseId of courseIds) {
        const assignments = await client.getPaginated(`/api/v1/courses/${courseId}/assignments`, { bucket: 'upcoming', order_by: 'due_at', per_page: '50' });
        for (const a of assignments) {
            results.push({
                id: String(a.id),
                courseId: String(a.course_id ?? courseId),
                title: a.name,
                dueAt: a.due_at,
                submissionType: a.submission_types[0] ?? 'none',
                pointsPossible: a.points_possible,
            });
        }
    }
    return results;
}
