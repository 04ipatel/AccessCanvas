import { downloadCanvasFile } from '../lib/fileManager.js';
export async function downloadFiles(client, cache, requests) {
    const results = [];
    for (const req of requests) {
        const { localPath, displayName } = await downloadCanvasFile(client, req.courseId, req.fileId, req.courseName, req.context);
        cache.recordDownloadedFile(req.fileId, req.courseId, localPath, displayName);
        results.push({ fileId: req.fileId, displayName, localPath });
    }
    return results;
}
