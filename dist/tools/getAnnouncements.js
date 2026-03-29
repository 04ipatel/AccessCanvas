import { parseContent } from '../lib/htmlParser.js';
export async function getAnnouncements(client, courseId, limit = 5) {
    const topics = await client.getPaginated(`/api/v1/courses/${courseId}/discussion_topics`, { only_announcements: 'true', per_page: String(limit), order_by: 'posted_at' });
    return topics.slice(0, limit).map((t) => ({
        id: String(t.id),
        title: t.title,
        postedAt: t.posted_at,
        body: parseContent(t.message).plainText,
    }));
}
