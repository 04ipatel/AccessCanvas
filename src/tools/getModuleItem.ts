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

  // Locked items (unmet prerequisites) return 403 from Canvas — surface a message instead of throwing.
  if (found.locked) {
    return empty(moduleItemId, found.title,
      `This item is locked (prerequisites not met). Complete the required steps in Canvas to unlock it.`);
  }

  if (found.type === 'Assignment') {
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

  if (found.type === 'File' && found.fileId) {
    const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${found.fileId}`);
    // Structured response — no need to round-trip through parseContent.
    return {
      id: moduleItemId,
      title: file.display_name,
      plainText: file.display_name,
      files: [{ name: file.display_name, fileId: found.fileId, apiEndpoint: `/api/v1/courses/${courseId}/files/${found.fileId}` }],
      externalLinks: [],
    };
  }

  if (found.pageUrl) {
    const page = await client.get<CanvasPage>(`/api/v1/courses/${courseId}/pages/${found.pageUrl}`);
    const parsed = parseContent(page.body ?? '');
    return { id: moduleItemId, title: page.title, plainText: parsed.plainText, files: parsed.files, externalLinks: parsed.externalLinks };
  }

  return empty(moduleItemId, found.title,
    `This item (type: ${found.type}) cannot be fetched directly. Access it through Canvas.`);
}

function empty(id: string, title: string, plainText: string): ModuleItemContent {
  return { id, title, plainText, files: [], externalLinks: [] };
}
