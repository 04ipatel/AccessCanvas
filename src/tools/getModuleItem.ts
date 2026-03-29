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
      };
    }
  }

  // Look up item type from cached module structure
  const modules = cache.getModuleStructure(courseId);
  let itemType: string | undefined;
  let pageUrl: string | undefined;
  let fileId: string | undefined;

  if (modules) {
    for (const mod of modules) {
      const found = mod.items.find((i) => i.id === moduleItemId);
      if (found) {
        itemType = found.type;
        pageUrl = found.pageUrl;
        fileId = found.fileId;
        break;
      }
    }
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
    throw new Error(
      `Cannot fetch module item ${moduleItemId}: type unknown and not in cache. Call get_course_modules first.`
    );
  }

  cache.setPage(moduleItemId, courseId, title, html);
  const parsed = parseContent(html);

  return {
    id: moduleItemId,
    title,
    plainText: parsed.plainText,
    files: parsed.files,
    externalLinks: parsed.externalLinks,
  };
}
