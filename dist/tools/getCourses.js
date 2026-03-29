export async function getCourses(client) {
    const courses = await client.getPaginated('/api/v1/courses', {
        enrollment_state: 'active',
        enrollment_type: 'student',
    });
    return courses.map((c) => ({
        id: String(c.id),
        name: c.name,
        code: c.course_code,
    }));
}
