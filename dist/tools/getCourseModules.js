import { extractPasswordFromTitle } from '../lib/htmlParser.js';
export async function getCourseModules(client, cache, courseId, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = cache.getModuleStructure(courseId);
        if (cached)
            return cached;
    }
    const modules = await client.getPaginated(`/api/v1/courses/${courseId}/modules`);
    const result = [];
    for (const mod of modules) {
        const items = await client.getPaginated(`/api/v1/courses/${courseId}/modules/${mod.id}/items`);
        const mappedItems = items.map((item) => mapModuleItem(item));
        result.push({ id: String(mod.id), name: mod.name, items: mappedItems });
    }
    cache.setModuleStructure(courseId, result);
    return result;
}
function mapModuleItem(item) {
    const base = {
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
