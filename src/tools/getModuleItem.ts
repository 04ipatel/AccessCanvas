import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { parseContent } from '../lib/htmlParser.js';
import type { CanvasFile, CanvasPage, ParsedContent } from '../types.js';

export interface ModuleItemContent {
  id: string;
  title: string;
  plainText: string;
  files: ParsedContent['files'];
  externalLinks: ParsedContent['externalLinks'];
  fromCache: boolean;
  fetchedAt: string;
}

export async function getModuleItem(
  client: CanvasClient,
  cache: Cache,
  courseId: string,
  moduleItemId: string,
  forceRefresh: boolean = false
): Promise<ModuleItemContent> {
  if (!forceRefresh) {
    const cached = cache.getPage(moduleItemId);
    if (cached) {
      const parsed = parseContent(cached.content);
      return {
        id: moduleItemId,
        title: cached.title,
        plainText: parsed.plainText,
        files: parsed.files,
        externalLinks: parsed.externalLinks,
        fromCache: true,
        fetchedAt: cached.fetchedAt,
      };
    }
  }

  // Look up item type from cached module structure
  const modules = cache.getModuleStructure(courseId);
  let itemType: string | undefined;
  let pageUrl: string | undefined;
  let fileId: string | undefined;
  let assignmentId: string | undefined;
  let discussionId: string | undefined;
  let itemTitle: string | undefined;

  if (modules) {
    for (const mod of modules.data) {
      const found = mod.items.find((i) => i.id === moduleItemId);
      if (found) {
        itemType = found.type;
        pageUrl = found.pageUrl;
        fileId = found.fileId;
        assignmentId = found.assignmentId;
        discussionId = found.discussionId;
        itemTitle = found.title;
        break;
      }
    }
  }

  const fetchedAt = new Date().toISOString();

  // Graceful handling for types that have dedicated tools
  if (itemType === 'Assignment' && assignmentId) {
    return {
      id: moduleItemId,
      title: itemTitle ?? 'Assignment',
      plainText: `This is an assignment. Use get_assignment_details with courseId: ${courseId} and assignmentId: ${assignmentId} to view the full description, files, and due date.`,
      files: [],
      externalLinks: [],
      fromCache: false,
      fetchedAt,
    };
  }

  if (itemType === 'Discussion' && discussionId) {
    return {
      id: moduleItemId,
      title: itemTitle ?? 'Discussion',
      plainText: `This is a discussion. Use get_announcements with courseId: ${courseId} to view course announcements, or access this discussion directly on Canvas.`,
      files: [],
      externalLinks: [],
      fromCache: false,
      fetchedAt,
    };
  }

  if (itemType === 'SubHeader' || itemType === 'ExternalTool' || itemType === 'Quiz') {
    return {
      id: moduleItemId,
      title: itemTitle ?? itemType ?? 'Module item',
      plainText: `This item (type: ${itemType}) cannot be fetched directly. Access it through Canvas.`,
      files: [],
      externalLinks: [],
      fromCache: false,
      fetchedAt,
    };
  }

  let title: string;
  let html: string;

  if (itemType === 'File' && fileId) {
    const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
    title = file.display_name;
    html = `<a href="${file.url}" data-api-endpoint="${file.url}">${file.display_name}</a>`;
  } else if (pageUrl) {
    const page = await client.get<CanvasPage>(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
    title = page.title;
    html = page.body;
  } else {
    return {
      id: moduleItemId,
      title: itemTitle ?? 'Unknown item',
      plainText: modules
        ? `Could not determine how to fetch this module item (type: ${itemType ?? 'unknown'}). It may be a type not supported for direct content fetching.`
        : `Module structure not in cache. Call get_course_modules for courseId: ${courseId} first, then retry.`,
      files: [],
      externalLinks: [],
      fromCache: false,
      fetchedAt,
    };
  }

  cache.setPage(moduleItemId, courseId, title, html);
  const parsed = parseContent(html);

  return {
    id: moduleItemId,
    title,
    plainText: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
    fromCache: false,
    fetchedAt,
  };
}
