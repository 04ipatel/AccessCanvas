import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, isAbsolute } from 'path';
import { sanitizeName, downloadFile } from '../../src/lib/fileManager.js';

describe('sanitizeName', () => {
  it('strips spaces and unsafe characters', () => {
    expect(sanitizeName('Week 3: Slides (final).pdf')).toBe('Week3Slidesfinal.pdf');
  });
  it('keeps dots, hyphens, underscores', () => {
    expect(sanitizeName('case_study-2.v1.pdf')).toBe('case_study-2.v1.pdf');
  });
});

describe('downloadFile', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'accesscanvas-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const mockClient = () => ({
    get: vi.fn().mockResolvedValue({
      id: 42, display_name: 'Syllabus Final.pdf', filename: 'syll.pdf',
      url: 'https://canvas/files/42/download', size: 100, content_type: 'application/pdf',
    }),
    getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('PDFDATA')),
  });

  it('writes to downloadDir when no dest given, returns path + displayName', async () => {
    const client = mockClient();
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42' }, dir);
    expect(result.displayName).toBe('Syllabus Final.pdf');
    expect(result.path).toBe(join(dir, 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(result.path, 'utf-8')).toBe('PDFDATA');
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/files/42');
  });

  it('writes into a relative dest joined under downloadDir', async () => {
    const client = mockClient();
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42', dest: 'finance-200/materials' }, dir);
    expect(result.path).toBe(join(dir, 'finance-200/materials', 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
  });

  it('writes into an absolute dest as-is', async () => {
    const client = mockClient();
    const abs = join(dir, 'absolute-target');
    const result = await downloadFile(client as any, { courseId: '7', fileId: '42', dest: abs }, dir);
    expect(isAbsolute(result.path)).toBe(true);
    expect(result.path).toBe(join(abs, 'SyllabusFinal.pdf'));
    expect(existsSync(result.path)).toBe(true);
  });
});
