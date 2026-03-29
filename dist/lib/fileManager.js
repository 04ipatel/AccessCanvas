import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
const CANVAS_ROOT = join(homedir(), 'Canvas');
export function sanitizeName(name) {
    return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9._\-]/g, '');
}
export function getLocalPath(courseName, context, filename) {
    return join(CANVAS_ROOT, sanitizeName(courseName), sanitizeName(context), sanitizeName(filename));
}
export async function downloadCanvasFile(client, courseId, fileId, courseName, context) {
    const file = await client.get(`/api/v1/courses/${courseId}/files/${fileId}`);
    const localPath = getLocalPath(courseName, context, file.display_name);
    mkdirSync(dirname(localPath), { recursive: true });
    const buffer = await client.getFileBuffer(file.url);
    writeFileSync(localPath, buffer);
    return { localPath, displayName: file.display_name };
}
