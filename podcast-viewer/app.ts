const ITUNES_API = 'https://itunes.apple.com/search?media=podcast&term=';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function $(id: string): HTMLElement | null {
    return document.getElementById(id);
}

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    ...children: (string | HTMLElement | null | undefined)[]
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else e.setAttribute(k, v);
    }
    for (const c of children) {
        if (c == null) continue;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
    }
    return e;
}

async function searchPodcasts(query: string): Promise<Record<string, unknown>[]> {
    const url = ITUNES_API + encodeURIComponent(query);
    const res = await fetch(url, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
    if (!res.ok) throw new Error('iTunes search failed');
    const data = await res.json();
    return (data.results || []) as Record<string, unknown>[];
}

async function fetchRSSContent(feedUrl: string): Promise<string> {
    try {
        let res = await fetch(feedUrl, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
        if (res.ok) return await res.text();
        console.warn('Direct fetch failed, trying proxy for', feedUrl);
    } catch {
        /* fall through to proxy */
    }

    const proxied = CORS_PROXY + encodeURIComponent(feedUrl);
    const res2 = await fetch(proxied, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
    if (!res2.ok) throw new Error('Failed to fetch feed via proxy');
    return await res2.text();
}

function parseRSS(xmlText: string): { podcast: Record<string, string>; episodes: Record<string, unknown>[] } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid RSS/XML');

    const feed = doc.querySelector('channel');
    const podcast: Record<string, string> = {
        title: feed?.querySelector('title')?.textContent || 'Unknown',
        description: feed?.querySelector('description')?.textContent || '',
        image: feed?.querySelector('image url')?.textContent
            || feed?.querySelector('itunes\\:image')?.textContent
            || feed?.querySelector('image')?.getAttribute('href')
            || ''
    };

    const items = Array.from(doc.querySelectorAll('item'));
    const episodes = items.map(item => {
        const enclosure = item.querySelector('enclosure');
        const url = enclosure ? enclosure.getAttribute('url') : item.querySelector('link')?.textContent || '';
        const length = enclosure ? parseInt(enclosure.getAttribute('length') || '0', 10) : 0;
        const type = enclosure ? enclosure.getAttribute('type') : '';

        return {
            title: item.querySelector('title')?.textContent || 'Untitled',
            description: item.querySelector('description')?.textContent
                || item.querySelector('itunes\\:summary')?.textContent || '',
            url,
            length,
            type,
            pubDate: item.querySelector('pubDate')?.textContent || ''
        };
    }).filter(e => e.url);

    return { podcast, episodes };
}

function clearChildren(node: HTMLElement): void {
    while (node.firstChild) node.removeChild(node.firstChild);
}

function showResults(results: Record<string, unknown>[]): void {
    const container = $('resultsList');
    if (!container) return;
    clearChildren(container);
    if (!results.length) { container.textContent = 'No results'; return; }

    for (const r of results) {
        const art = el('div', { class: 'pod-art', style: `background-image:url(${r.artworkUrl100 || ''})` });
        const info = el('div', { class: 'pod-info' },
            el('div', { class: 'pod-title' }, (r.collectionName || r.trackName || 'Untitled') as string),
            el('div', { class: 'pod-author' }, (r.artistName || '') as string)
        );
        const item = el('div', { class: 'pod-item' });
        item.appendChild(art);
        item.appendChild(info);
        item.addEventListener('click', () => selectPodcast(r));
        container.appendChild(item);
    }
}

async function selectPodcast(result: Record<string, unknown>): Promise<void> {
    const feedUrl = (result.feedUrl || result.feedUrl) as string;
    const titleEl = $('episodesTitle');
    const metaEl = $('episodesMeta');
    const list = $('episodesList');
    if (titleEl) titleEl.textContent = (result.collectionName || result.title || 'Episodes') as string;
    if (metaEl) metaEl.textContent = `by ${(result.artistName || result.artist || 'Unknown') as string}`;
    if (!list) return;
    clearChildren(list);
    list.textContent = 'Loading episodes...';

    try {
        const xml = await fetchRSSContent(feedUrl);
        const { episodes } = parseRSS(xml);

        clearChildren(list);
        if (!episodes.length) { list.textContent = 'No episodes found.'; return; }

        for (const ep of episodes) {
            const epNode = el('div', { class: 'episode' });
            epNode.appendChild(el('div', { class: 'title' }, ep.title as string));
            if (ep.pubDate) epNode.appendChild(el('div', { class: 'pub' }, ep.pubDate as string));
            if (ep.length) {
                const mb = Math.round((ep.length as number) / 1024 / 1024 * 10) / 10;
                epNode.appendChild(el('div', { class: 'meta' }, `Size: ${mb} MB`));
            }
            const dl = el('a', { class: 'download-btn', href: ep.url as string, target: '_blank', rel: 'noopener' }, 'Download');
            epNode.appendChild(dl);
            list.appendChild(epNode);
        }
    } catch (err) {
        clearChildren(list);
        list.textContent = 'Failed to load episodes: ' + (err as Error).message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = $('searchBtn') as HTMLButtonElement | null;
    const queryInput = $('query') as HTMLInputElement | null;

    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const q = queryInput?.value.trim() || '';
            if (!q) return;
            const resultsList = $('resultsList');
            if (resultsList) resultsList.textContent = 'Searching...';
            try {
                const results = await searchPodcasts(q);
                showResults(results);
            } catch (err) {
                const resultsList = $('resultsList');
                if (resultsList) resultsList.textContent = 'Search failed: ' + (err as Error).message;
            }
        });
    }
    if (queryInput) {
        queryInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') searchBtn?.click();
        });
    }
});
