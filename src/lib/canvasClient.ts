import type { Config } from '../types.js';

/** Error thrown on a non-2xx Canvas response. Carries the HTTP status as a
 * structured field so callers branch on `err.status` instead of parsing the message. */
export class CanvasApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'CanvasApiError';
  }
}

export class CanvasClient {
  private token: string;
  private baseUrl: string;

  constructor(config: Config) {
    this.token = config.token;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      throw new CanvasApiError(
        res.status,
        `Canvas API error ${res.status} ${res.statusText} — ${url.toString()}`
      );
    }

    return res.json() as Promise<T>;
  }

  async getPaginated<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = this.baseUrl + path;

    const initialParams = new URLSearchParams(params);
    initialParams.set('per_page', '100');
    nextUrl += '?' + initialParams.toString();

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) {
        throw new CanvasApiError(res.status, `Canvas API error ${res.status} ${res.statusText} — ${nextUrl}`);
      }

      const page = (await res.json()) as T[];
      results.push(...page);

      const linkHeader = res.headers.get('Link');
      nextUrl = parseLinkNext(linkHeader);
    }

    return results;
  }

  async getFileBuffer(downloadUrl: string): Promise<Buffer> {
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      throw new CanvasApiError(res.status, `File download error ${res.status} — ${downloadUrl}`);
    }

    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
