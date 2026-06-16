import { describe, it, expect, vi } from 'vitest';
import { getModules } from '../../src/tools/getModules.js';

describe('getModules', () => {
  it('maps modules and items, fetching items per module', async () => {
    const client = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce([{ id: 10, name: 'Week 1', position: 1, items_count: 2, items_url: 'x' }])
        .mockResolvedValueOnce([
          { id: 100, title: 'Lecture 1', type: 'Page', page_url: 'lecture-1', locked_for_user: false },
          { id: 101, title: 'Slides', type: 'File', content_id: 555, locked_for_user: false },
        ]),
    };
    const result = await getModules(client as any, '7');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '10', name: 'Week 1' });
    expect(result[0].items[0]).toMatchObject({ id: '100', title: 'Lecture 1', type: 'Page', pageUrl: 'lecture-1' });
    expect(result[0].items[1]).toMatchObject({ id: '101', title: 'Slides', type: 'File', fileId: '555' });
    expect(client.getPaginated).toHaveBeenNthCalledWith(1, '/api/v1/courses/7/modules');
    expect(client.getPaginated).toHaveBeenNthCalledWith(2, '/api/v1/courses/7/modules/10/items');
  });

  it('extracts password and cleans title for ExternalUrl items', async () => {
    const client = {
      getPaginated: vi.fn()
        .mockResolvedValueOnce([{ id: 10, name: 'Links', position: 1, items_count: 1, items_url: 'x' }])
        .mockResolvedValueOnce([
          { id: 200, title: 'Zoom recording (password: ab12)', type: 'ExternalUrl', external_url: 'https://zoom/x', locked_for_user: false },
        ]),
    };
    const result = await getModules(client as any, '7');
    expect(result[0].items[0]).toMatchObject({ title: 'Zoom recording', externalUrl: 'https://zoom/x', password: 'ab12' });
  });
});
