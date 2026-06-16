import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/tools/getModules.js', () => ({
  getModules: vi.fn(),
}));
import { getModules } from '../../src/tools/getModules.js';
import { getModuleItem } from '../../src/tools/getModuleItem.js';

describe('getModuleItem', () => {
  it('fetches a Page item and returns parsed content', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '100', title: 'Lecture 1', type: 'Page', pageUrl: 'lecture-1', locked: false }] },
    ]);
    const client = {
      get: vi.fn().mockResolvedValue({ title: 'Lecture 1', body: '<p>Welcome. <a data-api-endpoint="https://canvas/api/v1/courses/7/files/99" href="x">notes.pdf</a></p>' }),
    };
    const result = await getModuleItem(client as any, '7', '100');
    expect(result.title).toBe('Lecture 1');
    expect(result.plainText).toContain('Welcome.');
    expect(result.files).toEqual([{ name: 'notes.pdf', fileId: '99', apiEndpoint: 'https://canvas/api/v1/courses/7/files/99' }]);
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/pages/lecture-1');
  });

  it('fetches a File item via the files endpoint', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '101', title: 'Slides', type: 'File', fileId: '555', locked: false }] },
    ]);
    const client = {
      get: vi.fn().mockResolvedValue({ display_name: 'Slides.pdf', url: 'https://canvas/files/555/download' }),
    };
    const result = await getModuleItem(client as any, '7', '101');
    expect(result.title).toBe('Slides.pdf');
    expect(result.files[0]).toEqual({ name: 'Slides.pdf', fileId: '555', apiEndpoint: '/api/v1/courses/7/files/555' });
    expect(client.get).toHaveBeenCalledWith('/api/v1/courses/7/files/555');
  });

  it('returns a guidance message for Assignment items', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '102', title: 'Case 2', type: 'Assignment', assignmentId: '555', locked: false }] },
    ]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '102');
    expect(result.plainText).toContain('get_assignments');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('returns a not-found message when the item is absent', async () => {
    (getModules as any).mockResolvedValue([{ id: '10', name: 'Week 1', items: [] }]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '999');
    expect(result.plainText).toContain('not found');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('returns a locked message without fetching when the item is locked', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '103', title: 'Gated Page', type: 'Page', pageUrl: 'gated', locked: true }] },
    ]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '103');
    expect(result.plainText).toContain('locked');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('handles a Page with a null body without crashing', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '104', title: 'Empty Page', type: 'Page', pageUrl: 'empty', locked: false }] },
    ]);
    const client = { get: vi.fn().mockResolvedValue({ title: 'Empty Page', body: null }) };
    const result = await getModuleItem(client as any, '7', '104');
    expect(result.title).toBe('Empty Page');
    expect(result.plainText).toBe('');
    expect(result.files).toEqual([]);
  });

  it('directs Assignment items even when assignmentId is missing', async () => {
    (getModules as any).mockResolvedValue([
      { id: '10', name: 'Week 1', items: [{ id: '105', title: 'Mystery', type: 'Assignment', locked: false }] },
    ]);
    const client = { get: vi.fn() };
    const result = await getModuleItem(client as any, '7', '105');
    expect(result.plainText).toContain('get_assignments');
    expect(client.get).not.toHaveBeenCalled();
  });
});
