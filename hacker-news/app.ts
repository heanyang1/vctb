const selectedLinks: Set<string> = new Set();

function updateSelectedTextarea(): void {
    const ta = document.getElementById('selected-links') as HTMLTextAreaElement | null;
    if (!ta) return;
    ta.value = Array.from(selectedLinks).join('\n');
}

function displayStories(stories: Array<Record<string, unknown>>): void {
    const storiesList = document.getElementById("stories-list") as HTMLUListElement | null;
    if (!storiesList) return;
    for (const story of stories) {
        if (story && story.title && story.url) {
            const li = document.createElement('li');
            li.className = 'story-item';
            const a = document.createElement('a');
            a.href = story.url as string;
            a.textContent = story.title as string;
            a.target = '_blank';
            a.style.flex = '1';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'story-checkbox';
            checkbox.dataset.url = story.url as string;
            checkbox.checked = selectedLinks.has(story.url as string);
            checkbox.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLInputElement;
                const url = target.dataset.url;
                if (!url) return;
                if (target.checked) selectedLinks.add(url);
                else selectedLinks.delete(url);
                updateSelectedTextarea();
            });

            const commentsBtn = document.createElement('button');
            commentsBtn.className = 'comments-btn';
            commentsBtn.textContent = story.descendants
                ? `Comments (${story.descendants})` : 'Comments';
            commentsBtn.addEventListener('click', () => {
                const existing = li.querySelector('.comments-section');
                if (existing) { existing.remove(); return; }
                const section = document.createElement('div');
                section.className = 'comments-section';
                li.appendChild(section);
                const kids = story.kids as number[] | undefined;
                if (kids && kids.length > 0)
                    displayComments(kids, section);
                else section.textContent = 'No comments yet.';
            });

            li.appendChild(checkbox);
            li.appendChild(a);
            const br = document.createElement('div');
            br.style.width = '100%';
            br.style.height = '0';
            li.appendChild(br);
            li.appendChild(commentsBtn);
            storiesList.appendChild(li);
        }
    }
}

function loadStories(numItems: number): void {
    const storiesList = document.getElementById('stories-list') as HTMLUListElement | null;
    if (storiesList) storiesList.innerHTML = '<li>Loading...</li>';
    fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
        .then(response => response.json())
        .then(async (ids: number[]) => {
            const topIds = ids.slice(0, numItems);
            const storyPromises = topIds.map(id =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
            );
            const stories = await Promise.all(storyPromises);
            if (storiesList) storiesList.innerHTML = '';
            displayStories(stories);
        });
}

function fetchItem(id: number): Promise<Record<string, unknown>> {
    return fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); });
}

function timeAgo(unixTime: number): string {
    const seconds = Math.floor((Date.now() - unixTime * 1000) / 1000);
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
}

function renderComment(comment: Record<string, unknown> | null, li: HTMLLIElement): void {
    if (!comment || comment.deleted || comment.dead) {
        li.textContent = '[deleted]';
        return;
    }
    li.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    meta.textContent = (comment.by as string) + ' ' + timeAgo(comment.time as number);
    li.appendChild(meta);
    const text = document.createElement('div');
    text.className = 'comment-text';
    text.innerHTML = (comment.text as string) || '';
    li.appendChild(text);
    const kids = comment.kids as number[] | undefined;
    if (kids && kids.length > 0) {
        const repliesBtn = document.createElement('button');
        repliesBtn.className = 'replies-btn';
        repliesBtn.textContent = `Replies (${kids.length})`;
        li.appendChild(repliesBtn);
        const replies = document.createElement('div');
        replies.className = 'replies';
        repliesBtn.addEventListener('click', () => {
            const section = li.querySelector('.replies');
            if (section && section.children.length > 0) {
                section.remove();
                repliesBtn.textContent = `Replies (${kids.length})`;
                return;
            }
            li.appendChild(replies);
            displayComments(kids, replies);
            repliesBtn.textContent = 'Hide replies';
        });
    }
}

function displayComments(kids: number[], container: HTMLElement): void {
    if (!kids || kids.length === 0) {
        container.textContent = 'No comments yet.';
        return;
    }
    const ul = document.createElement('ul');
    ul.className = 'comments-tree';
    container.innerHTML = '';
    container.appendChild(ul);
    for (const id of kids) {
        const li = document.createElement('li');
        li.className = 'comment-item';
        li.textContent = 'Loading...';
        ul.appendChild(li);
        fetchItem(id).then(comment => renderComment(comment, li))
            .catch(() => { li.textContent = 'Failed to load comment'; });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const numInput = document.getElementById('num-items') as HTMLInputElement | null;
    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement | null;
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            let num = parseInt(numInput?.value || '30', 10);
            if (isNaN(num) || num < 1) num = 1;
            if (num > 100) num = 100;
            loadStories(num);
        });
    }
    loadStories(parseInt(numInput?.value || '30', 10) || 30);

    const clearBtn = document.getElementById('clear-selection') as HTMLButtonElement | null;
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            selectedLinks.clear();
            updateSelectedTextarea();
            document.querySelectorAll('.story-checkbox').forEach(cb => {
                (cb as HTMLInputElement).checked = false;
            });
        });
    }

    const ta = document.getElementById('selected-links') as HTMLTextAreaElement | null;
    if (ta) {
        ta.addEventListener('input', () => {
            const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
            selectedLinks.clear();
            for (const l of lines) selectedLinks.add(l);
            document.querySelectorAll('.story-checkbox').forEach(cb => {
                const input = cb as HTMLInputElement;
                input.checked = selectedLinks.has(input.dataset.url || '');
            });
        });
    }

    const copyBtn = document.getElementById('copy-selection') as HTMLButtonElement | null;
    if (copyBtn && ta) {
        copyBtn.addEventListener('click', async () => {
            const text = ta.value;
            try {
                await navigator.clipboard.writeText(text);
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = orig, 1500);
            } catch (err) {
                copyBtn.textContent = 'Failed';
                setTimeout(() => copyBtn.textContent = 'Copy', 2000);
            }
        });
    }
    updateSelectedTextarea();
});
