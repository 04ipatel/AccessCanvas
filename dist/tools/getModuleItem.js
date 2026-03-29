import { parseContent } from '../lib/htmlParser.js';
export async function getModuleItem(client, cache, courseId, moduleItemId, forceRefresh = false) {
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
    let itemType;
    let pageUrl;
    let fileId;
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
    let title;
    let html;
    if (itemType === 'File' && fileId) {
        const file = await client.get(`/api/v1/courses/${courseId}/files/${fileId}`);
        title = file.display_name;
        html = `<a href="${file.url}" data-api-endpoint="${file.url}">${file.display_name}</a>`;
    }
    else if (pageUrl) {
        const page = await client.get(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
        title = page.title;
        html = page.body;
    }
    else {
        throw new Error(`Cannot fetch module item ${moduleItemId}: type unknown and not in cache. Call get_course_modules first.`);
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
