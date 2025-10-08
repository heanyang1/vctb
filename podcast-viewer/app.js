// Simple Podcast Viewer (vanilla JS)
// - Searches iTunes Search API for podcasts
// - Fetches podcast RSS and lists episodes with direct download links
// Note: Many RSS feeds disallow CORS. We use the AllOrigins proxy as a fallback.

const ITUNES_API = 'https://itunes.apple.com/search?media=podcast&term=';
const CORS_PROXY = 'https://api.allorigins.win/raw?url='; // lightweight public proxy

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else e.setAttribute(k, v);
    });
    children.forEach(c => { if (c == null) return; if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else e.appendChild(c); });
    return e;
}

async function searchPodcasts(query) {
    const url = ITUNES_API + encodeURIComponent(query);
    const res = await fetch(url, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
    if (!res.ok) throw new Error('iTunes search failed');
    const data = await res.json();
    return data.results || [];
}

async function fetchRSSContent(feedUrl) {
    try {
        // First try direct fetch (some feeds support CORS)
        let res = await fetch(feedUrl, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
        if (res.ok) return await res.text();

        // otherwise try proxy
        console.warn('Direct fetch failed, trying proxy for', feedUrl);
    } catch (err) {
        // fallthrough to proxy
    }

    const proxied = CORS_PROXY + encodeURIComponent(feedUrl);
    const res2 = await fetch(proxied, { headers: { 'User-Agent': 'PodcastViewer/1.0' } });
    if (!res2.ok) throw new Error('Failed to fetch feed via proxy');
    return await res2.text();
}

function parseRSS(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid RSS/XML');

    const feed = doc.querySelector('channel');
    const podcast = {
        title: (feed.querySelector('title') || {}).textContent || 'Unknown',
        description: (feed.querySelector('description') || {}).textContent || '',
        image: (feed.querySelector('image url') || feed.querySelector('itunes\\:image') || {}).textContent || (feed.querySelector('image') ? feed.querySelector('image').getAttribute('href') : '')
    };

    const items = Array.from(doc.querySelectorAll('item'));
    const episodes = items.map(item => {
        const enclosure = item.querySelector('enclosure');
        const url = enclosure ? enclosure.getAttribute('url') : (item.querySelector('link') || {}).textContent || '';
        const length = enclosure ? parseInt(enclosure.getAttribute('length') || '0', 10) : 0;
        const type = enclosure ? enclosure.getAttribute('type') : '';

        return {
            title: (item.querySelector('title') || {}).textContent || 'Untitled',
            description: (item.querySelector('description') || item.querySelector('itunes\\:summary') || {}).textContent || '',
            url,
            length,
            type,
            pubDate: (item.querySelector('pubDate') || {}).textContent || ''
        };
    }).filter(e => e.url);

    return { podcast, episodes };
}

function clearChildren(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function showResults(results) {
    const container = $('resultsList');
    clearChildren(container);
    if (!results.length) { container.textContent = 'No results'; return; }

    results.forEach(r => {
        const art = el('div', { class: 'pod-art', style: `background-image:url(${r.artworkUrl100 || ''})` });
        const info = el('div', { class: 'pod-info' },
            el('div', { class: 'pod-title' }, r.collectionName || r.trackName || 'Untitled'),
            el('div', { class: 'pod-author' }, r.artistName || '')
        );

        const item = el('div', { class: 'pod-item' });
        item.appendChild(art);
        item.appendChild(info);

        item.addEventListener('click', () => selectPodcast(r));
        container.appendChild(item);
    });
}

async function selectPodcast(result) {
    const feedUrl = result.feedUrl || result.feedUrl || result.feedUrl; // normalize
    $('episodesTitle').textContent = result.collectionName || result.title || 'Episodes';
    $('episodesMeta').textContent = `by ${result.artistName || result.artist || 'Unknown'}`;
    const list = $('episodesList');
    clearChildren(list);
    list.textContent = 'Loading episodes...';

    try {
        const xml = await fetchRSSContent(feedUrl);
        const { podcast, episodes } = parseRSS(xml);

        clearChildren(list);
        if (!episodes.length) { list.textContent = 'No episodes found.'; return; }

        episodes.forEach(ep => {
            const epNode = el('div', { class: 'episode' });
            epNode.appendChild(el('div', { class: 'title' }, ep.title));
            if (ep.pubDate) epNode.appendChild(el('div', { class: 'pub' }, ep.pubDate));
            if (ep.length) epNode.appendChild(el('div', { class: 'meta' }, `Size: ${Math.round(ep.length / 1024 / 1024 * 10) / 10} MB`));

            const dl = el('a', { class: 'download-btn', href: ep.url, target: '_blank', rel: 'noopener' }, 'Download');
            epNode.appendChild(dl);

            list.appendChild(epNode);
        });

    } catch (err) {
        clearChildren(list);
        list.textContent = 'Failed to load episodes: ' + err.message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('searchBtn').addEventListener('click', async () => {
        const q = $('query').value.trim();
        if (!q) return;
        $('resultsList').textContent = 'Searching...';
        try {
            const results = await searchPodcasts(q);
            showResults(results);
        } catch (err) {
            $('resultsList').textContent = 'Search failed: ' + err.message;
        }
    });

    $('query').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('searchBtn').click(); });
});
