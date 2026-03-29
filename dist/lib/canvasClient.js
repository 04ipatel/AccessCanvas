export class CanvasClient {
    token;
    baseUrl;
    constructor(config) {
        this.token = config.token;
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }
    async get(path, params) {
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
            throw new Error(`Canvas API error ${res.status} ${res.statusText} — ${url.toString()}`);
        }
        return res.json();
    }
    async getPaginated(path, params) {
        const results = [];
        let nextUrl = this.baseUrl + path;
        const initialParams = new URLSearchParams(params);
        initialParams.set('per_page', '100');
        nextUrl += '?' + initialParams.toString();
        while (nextUrl) {
            const res = await fetch(nextUrl, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!res.ok) {
                throw new Error(`Canvas API error ${res.status} ${res.statusText} — ${nextUrl}`);
            }
            const page = (await res.json());
            results.push(...page);
            const linkHeader = res.headers.get('Link');
            nextUrl = parseLinkNext(linkHeader);
        }
        return results;
    }
    async getFileBuffer(downloadUrl) {
        const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) {
            throw new Error(`File download error ${res.status} — ${downloadUrl}`);
        }
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    }
}
function parseLinkNext(linkHeader) {
    if (!linkHeader)
        return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
}
