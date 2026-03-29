import { parse } from 'node-html-parser';
const CANVAS_FILE_URL = /\/api\/v1\/courses\/\d+\/files\/(\d+)/;
const CANVAS_VIEWER_FILE = /viewer\/files\//;
const EXTERNAL_URL = /^https?:\/\//;
export function parseContent(html) {
    const root = parse(html);
    const files = [];
    const externalLinks = [];
    for (const anchor of root.querySelectorAll('a')) {
        const apiEndpoint = anchor.getAttribute('data-api-endpoint') ?? null;
        const href = anchor.getAttribute('href') ?? '';
        const title = (anchor.getAttribute('title') || anchor.text || href).trim();
        if (apiEndpoint && CANVAS_FILE_URL.test(apiEndpoint)) {
            const match = apiEndpoint.match(CANVAS_FILE_URL);
            files.push({
                name: title,
                fileId: match ? match[1] : null,
                apiEndpoint,
            });
            continue;
        }
        if (CANVAS_VIEWER_FILE.test(href)) {
            files.push({ name: title, fileId: null, apiEndpoint: null });
            continue;
        }
        if (EXTERNAL_URL.test(href)) {
            externalLinks.push({ title, url: href });
        }
    }
    const plainText = root.text.replace(/\s+/g, ' ').trim();
    return { plainText, files, externalLinks };
}
export function extractPasswordFromTitle(title) {
    const match = title.match(/\(password:\s*([^)]+)\)/i);
    return match ? match[1].trim() : undefined;
}
