import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export function getLocalPath(
  courseCode: string,
  courseName: string,
  context: string,
  filename: string,
  downloadDir: string
): string {
  const folderName = `${courseCode}-${sanitizeName(courseName)}`;
  return join(downloadDir, folderName, sanitizeName(context), sanitizeName(filename));
}

export async function downloadCanvasFile(
  client: CanvasClient,
  courseId: string,
  fileId: string,
  courseCode: string,
  courseName: string,
  context: string,
  downloadDir: string
): Promise<{ localPath: string; displayName: string }> {
  const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
  const localPath = getLocalPath(courseCode, courseName, context, file.display_name, downloadDir);

  mkdirSync(dirname(localPath), { recursive: true });

  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(localPath, buffer);

  return { localPath, displayName: file.display_name };
}
