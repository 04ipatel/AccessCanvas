import type { CanvasClient } from '../lib/canvasClient.js';
import type { Cache } from '../lib/cache.js';
import { downloadCanvasFile } from '../lib/fileManager.js';

export interface DownloadRequest {
  fileId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  context: string;
}

export interface DownloadResult {
  fileId: string;
  displayName: string;
  localPath: string;
}

export async function downloadFiles(
  client: CanvasClient,
  cache: Cache,
  requests: DownloadRequest[],
  downloadDir: string
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (const req of requests) {
    const { localPath, displayName } = await downloadCanvasFile(
      client,
      req.courseId,
      req.fileId,
      req.courseCode,
      req.courseName,
      req.context,
      downloadDir
    );

    cache.recordDownloadedFile(req.fileId, req.courseId, localPath, displayName);

    results.push({ fileId: req.fileId, displayName, localPath });
  }

  return results;
}
