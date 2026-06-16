import { CanvasApiError } from '../lib/canvasClient.js';
import type { CanvasClient } from '../lib/canvasClient.js';
import type { CanvasFile, FileSummary } from '../types.js';

export async function listFiles(
  client: CanvasClient,
  courseId: string
): Promise<FileSummary[]> {
  let files: CanvasFile[];
  try {
    files = await client.getPaginated<CanvasFile>(`/api/v1/courses/${courseId}/files`);
  } catch (err) {
    // A professor can disable file export → Canvas responds 403. Absence is information, not an error.
    // Only 403 is absorbed — 401 (bad/expired token) and everything else must propagate.
    if (err instanceof CanvasApiError && err.status === 403) return [];
    throw err;
  }

  return files.map((f) => ({
    id: String(f.id),
    name: f.display_name,
    url: f.url,
    type: f.content_type,
    size: f.size,
  }));
}
