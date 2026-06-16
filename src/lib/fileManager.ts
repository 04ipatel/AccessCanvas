import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export interface DownloadFileRequest {
  courseId: string;
  fileId: string;
  dest?: string;
}

export interface DownloadFileResult {
  path: string;
  displayName: string;
}

/**
 * Downloads a Canvas file to local disk. AccessCanvas does NOT impose any folder
 * layout — the caller decides placement via `dest`:
 *   - no dest        → write flat into downloadDir
 *   - relative dest  → join(downloadDir, dest)
 *   - absolute dest  → use as-is
 * Filename comes from the Canvas display_name (sanitized).
 */
export async function downloadFile(
  client: CanvasClient,
  req: DownloadFileRequest,
  downloadDir: string
): Promise<DownloadFileResult> {
  const file = await client.get<CanvasFile>(
    `/api/v1/courses/${req.courseId}/files/${req.fileId}`
  );

  const targetDir = req.dest
    ? (isAbsolute(req.dest) ? req.dest : join(downloadDir, req.dest))
    : downloadDir;

  const path = join(targetDir, sanitizeName(file.display_name));

  mkdirSync(dirname(path), { recursive: true });
  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(path, buffer);

  return { path, displayName: file.display_name };
}
