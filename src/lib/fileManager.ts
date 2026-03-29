import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { CanvasClient } from './canvasClient.js';
import type { CanvasFile } from '../types.js';

const CANVAS_ROOT = '/Users/ishanpatel/Academics';

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}

export function getLocalPath(courseName: string, context: string, filename: string): string {
  return join(
    CANVAS_ROOT,
    sanitizeName(courseName),
    sanitizeName(context),
    sanitizeName(filename)
  );
}

export async function downloadCanvasFile(
  client: CanvasClient,
  courseId: string,
  fileId: string,
  courseName: string,
  context: string
): Promise<{ localPath: string; displayName: string }> {
  const file = await client.get<CanvasFile>(`/api/v1/courses/${courseId}/files/${fileId}`);
  const localPath = getLocalPath(courseName, context, file.display_name);

  mkdirSync(dirname(localPath), { recursive: true });

  const buffer = await client.getFileBuffer(file.url);
  writeFileSync(localPath, buffer);

  return { localPath, displayName: file.display_name };
}
