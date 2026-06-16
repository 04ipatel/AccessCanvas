import type { CanvasClient } from '../lib/canvasClient.js';
import { extractPasswordFromTitle } from '../lib/htmlParser.js';
import type { CanvasModule, CanvasModuleItem, ModuleSummary, ModuleItemSummary } from '../types.js';

export async function getModules(
  client: CanvasClient,
  courseId: string
): Promise<ModuleSummary[]> {
  const modules = await client.getPaginated<CanvasModule>(
    `/api/v1/courses/${courseId}/modules`
  );

  // Item fetches are independent — run them concurrently rather than serially.
  return Promise.all(
    modules.map(async (mod) => {
      const items = await client.getPaginated<CanvasModuleItem>(
        `/api/v1/courses/${courseId}/modules/${mod.id}/items`
      );
      return {
        id: String(mod.id),
        name: mod.name,
        items: items.map(mapModuleItem),
      };
    })
  );
}

function mapModuleItem(item: CanvasModuleItem): ModuleItemSummary {
  const base: ModuleItemSummary = {
    id: String(item.id),
    title: item.title,
    type: item.type,
    locked: item.locked_for_user ?? false,
  };

  switch (item.type) {
    case 'File':
      return { ...base, fileId: item.content_id ? String(item.content_id) : undefined };
    case 'Page':
      return { ...base, pageUrl: item.page_url ?? undefined };
    case 'Assignment':
      return { ...base, assignmentId: item.content_id ? String(item.content_id) : undefined };
    case 'ExternalUrl': {
      const password = extractPasswordFromTitle(item.title);
      const cleanTitle = item.title.replace(/\s*\(password:[^)]+\)/i, '').trim();
      return { ...base, title: cleanTitle, externalUrl: item.external_url ?? undefined, password };
    }
    case 'Discussion':
      return { ...base, discussionId: item.content_id ? String(item.content_id) : undefined };
    default:
      return base;
  }
}
