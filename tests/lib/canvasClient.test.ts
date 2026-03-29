// tests/lib/canvasClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CanvasClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('adds Authorization header to requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      json: async () => [{ id: 1, name: 'Test Course' }],
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'my-token', baseUrl: 'https://babson.instructure.com' });
    await client.get('/api/v1/courses');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://babson.instructure.com/api/v1/courses',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      })
    );
  });

  it('follows pagination via Link header', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (h: string) =>
            h === 'Link'
              ? '<https://babson.instructure.com/api/v1/courses?page=2>; rel="next"'
              : null,
        },
        json: async () => [{ id: 1, name: 'Course 1' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => [{ id: 2, name: 'Course 2' }],
      });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'tok', baseUrl: 'https://babson.instructure.com' });
    const results = await client.getPaginated('/api/v1/courses');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, name: 'Course 1' });
    expect(results[1]).toEqual({ id: 2, name: 'Course 2' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'bad', baseUrl: 'https://babson.instructure.com' });
    await expect(client.get('/api/v1/courses')).rejects.toThrow('401');
  });

  it('downloads binary file as Buffer', async () => {
    const fakeData = new Uint8Array([1, 2, 3]).buffer;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => fakeData,
    });

    const { CanvasClient } = await import('../../src/lib/canvasClient.js');
    const client = new CanvasClient({ token: 'tok', baseUrl: 'https://babson.instructure.com' });
    const buf = await client.getFileBuffer('https://babson.instructure.com/files/123/download');

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(3);
  });
});
