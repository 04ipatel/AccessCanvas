import type { CanvasClient } from '../lib/canvasClient.js';
import { parseContent } from '../lib/htmlParser.js';
import { getModules } from './getModules.js';
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
  courseId: string,
  moduleItemId: string
): Promise<ModuleItemContent> {
  const modules = await getModules(client, courseId);

  let found;
  for (const mod of modules) {
    found = mod.items.find((i) => i.id === moduleItemId);
    if (found) break;
  }

  if (!found) {
    return empty(moduleItemId, 'Unknown item',
      `Module item ${moduleItemId} not found in course ${courseId}. Call get_modules to list valid item IDs.`);
  }

  if (found.type === 'Assignment' && found.assignmentId) {
    return empty(moduleItemId, found.title,
      `This is an assignment. Use get_assignments with courseId: ${courseId} to see its full description, files, and due date.`);
  }
  if (found.type === 'Discussion') {
    return empty(moduleItemId, found.title,
      `This is a discussion. Use get_announcements with courseId: ${courseId}, or open it directly on Canvas.`);
  }
  if (found.type === 'ExternalUrl') {
    return empty(moduleItemId, found.title,
      `This is an external link: ${found.externalUrl ?? '(none)'}${found.password ? ` (password: ${found.password})` : ''}`);
  }
  if (found.type === 'SubHeader' || found.type === 'ExternalTool' || found.type === 'Quiz') {
    return empty(moduleItemId, found.title,
      `This item (type: ${found.type}) cannot be fetched directly. Access it through Canvas.`);
  }

  let title: string;
  let html: string;

  if (found.type === 'File' && found.fileId) {
    const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${found.fileId}`);
    title = file.display_name;
    const apiEndpoint = `/api/v1/courses/${courseId}/files/${found.fileId}`;
    html = `<a href="${file.url}" data-api-endpoint="${apiEndpoint}">${file.display_name}</a>`;
  } else if (found.pageUrl) {
    const page = await client.get<CanvasPage>(`/api/v1/courses/${courseId}/pages/${found.pageUrl}`);
    title = page.title;
    html = page.body;
  } else {
    return empty(moduleItemId, found.title,
      `Could not determine how to fetch this module item (type: ${found.type}).`);
  }

  const parsed = parseContent(html);
  return { id: moduleItemId, title, plainText: parsed.plainText, files: parsed.files, externalLinks: parsed.externalLinks };
}

function empty(id: string, title: string, plainText: string): ModuleItemContent {
  return { id, title, plainText, files: [], externalLinks: [] };
}
