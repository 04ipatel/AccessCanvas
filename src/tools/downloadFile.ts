import type { CanvasClient } from '../lib/canvasClient.js';
import { downloadFile as downloadToDisk } from '../lib/fileManager.js';
import type { DownloadFileRequest, DownloadFileResult } from '../lib/fileManager.js';

export type { DownloadFileRequest, DownloadFileResult };

export async function downloadFile(
  client: CanvasClient,
  req: DownloadFileRequest,
  downloadDir: string
): Promise<DownloadFileResult> {
  return downloadToDisk(client, req, downloadDir);
}
