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
    if (err instanceof Error && /\b40[13]\b/.test(err.message)) return [];
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
