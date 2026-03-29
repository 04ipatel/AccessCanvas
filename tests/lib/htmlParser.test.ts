// tests/lib/htmlParser.test.ts
import { describe, it, expect } from 'vitest';

describe('parseContent', () => {
  it('extracts file with data-api-endpoint attribute', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a
      title="Assignment 2.pdf"
      href="viewer/files/Uploaded%20Media/Assignment%202.pdf"
      data-api-endpoint="https://babson.instructure.com/api/v1/courses/7779656/files/344828267"
      data-api-returntype="File">Assignment 2.pdf</a></p>`;

    const result = parseContent(html);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('Assignment 2.pdf');
    expect(result.files[0].apiEndpoint).toBe(
      'https://babson.instructure.com/api/v1/courses/7779656/files/344828267'
    );
    expect(result.files[0].fileId).toBe('344828267');
  });

  it('falls back to href when no data-api-endpoint', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a
      class="instructure_file_link"
      title="Syllabus.pdf"
      href="viewer/files/Syllabus.pdf">Syllabus.pdf</a></p>`;

    const result = parseContent(html);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe('Syllabus.pdf');
    expect(result.files[0].apiEndpoint).toBeNull();
    expect(result.files[0].fileId).toBeNull();
  });

  it('extracts external links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p><a href="https://babson.webex.com/recording/abc" >Session Recording</a></p>`;

    const result = parseContent(html);

    expect(result.externalLinks).toHaveLength(1);
    expect(result.externalLinks[0].title).toBe('Session Recording');
    expect(result.externalLinks[0].url).toBe('https://babson.webex.com/recording/abc');
  });

  it('strips HTML tags to produce plain text', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<h3><strong>Learning Objectives</strong></h3><ul><li>Understand risk</li><li>Measure risk</li></ul>`;

    const result = parseContent(html);

    expect(result.plainText).toContain('Learning Objectives');
    expect(result.plainText).toContain('Understand risk');
    expect(result.plainText).toContain('Measure risk');
  });

  it('does not double-count files and external links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `
      <a data-api-endpoint="https://babson.instructure.com/api/v1/courses/1/files/99"
         href="viewer/files/file.pdf" title="file.pdf">file.pdf</a>
      <a href="https://google.com">Google</a>
    `;

    const result = parseContent(html);
    expect(result.files).toHaveLength(1);
    expect(result.externalLinks).toHaveLength(1);
  });

  it('returns empty arrays for content with no files or links', async () => {
    const { parseContent } = await import('../../src/lib/htmlParser.js');
    const html = `<p>Please complete the reading before class.</p>`;
    const result = parseContent(html);
    expect(result.files).toHaveLength(0);
    expect(result.externalLinks).toHaveLength(0);
  });
});
