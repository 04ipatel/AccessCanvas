import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { extractPasswordFromTitle } from '../lib/htmlParser.js';
import type { CanvasModule, CanvasModuleItem, ModuleSummary, ModuleItemSummary } from '../types.js';

export interface CourseModulesResult {
  modules: ModuleSummary[];
  fromCache: boolean;
  fetchedAt: string;
}

export async function getCourseModules(
  client: CanvasClient,
  cache: Cache,
  courseId: string,
  forceRefresh: boolean = false
): Promise<CourseModulesResult> {
  if (!forceRefresh) {
    const cached = cache.getModuleStructure(courseId);
    if (cached) return { modules: cached.data, fromCache: true, fetchedAt: cached.fetchedAt };
  }

  const modules = await client.getPaginated<CanvasModule>(
    `/api/v1/courses/${courseId}/modules`
  );

  const result: ModuleSummary[] = [];

  for (const mod of modules) {
    const items = await client.getPaginated<CanvasModuleItem>(
      `/api/v1/courses/${courseId}/modules/${mod.id}/items`
    );

    const mappedItems: ModuleItemSummary[] = items.map((item) =>
      mapModuleItem(item)
    );

    result.push({ id: String(mod.id), name: mod.name, items: mappedItems });
  }

  const fetchedAt = new Date().toISOString();
  cache.setModuleStructure(courseId, result);
  return { modules: result, fromCache: false, fetchedAt };
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
      return {
        ...base,
        title: cleanTitle,
        externalUrl: item.external_url ?? undefined,
        password,
      };
    }
    case 'Discussion':
      return { ...base, discussionId: item.content_id ? String(item.content_id) : undefined };
    default:
      return base;
  }
}
