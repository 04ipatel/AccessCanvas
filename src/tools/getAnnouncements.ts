import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasDiscussionTopic } from '../types.js';

export interface AnnouncementSummary {
  id: string;
  title: string;
  postedAt: string;
  body: string;
}

export async function getAnnouncements(
  client: CanvasClient,
  courseId: string,
  limit: number = 5
): Promise<AnnouncementSummary[]> {
  const topics = await client.getPaginated<CanvasDiscussionTopic>(
    `/api/v1/courses/${courseId}/discussion_topics`,
    { only_announcements: 'true', order_by: 'posted_at' }
  );

  return topics.slice(0, limit).map((t) => ({
    id: String(t.id),
    title: t.title,
    postedAt: t.posted_at,
    body: parseContent(t.message).plainText,
  }));
}
