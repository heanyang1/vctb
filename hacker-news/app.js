

const selectedLinks = new Set();

function updateSelectedTextarea() {
    const ta = document.getElementById('selected-links');
    if (!ta) return;
    ta.value = Array.from(selectedLinks).join('\n');
}

function displayStories(stories) {
    const storiesList = document.getElementById("stories-list");
    stories.forEach(story => {
        if (story && story.title && story.url) {
            const li = document.createElement('li');
            li.className = 'story-item';
            const a = document.createElement('a');
            a.href = story.url;
            a.textContent = story.title;
            a.target = '_blank';
            a.style.flex = '1';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'story-checkbox';
            checkbox.dataset.url = story.url;
            checkbox.checked = selectedLinks.has(story.url);
            checkbox.addEventListener('change', (e) => {
                const url = e.target.dataset.url;
                if (e.target.checked) {
                    selectedLinks.add(url);
                } else {
                    selectedLinks.delete(url);
                }
                updateSelectedTextarea();
            });

            const commentsBtn = document.createElement('button');
            commentsBtn.className = 'comments-btn';
            commentsBtn.textContent = story.descendants
                ? `Comments (${story.descendants})`
                : 'Comments';
            commentsBtn.addEventListener('click', () => {
                const existing = li.querySelector('.comments-section');
                if (existing) {
                    existing.remove();
                    return;
                }
                const section = document.createElement('div');
                section.className = 'comments-section';
                li.appendChild(section);
                if (story.kids && story.kids.length > 0) {
                    displayComments(story.kids, section);
                } else {
                    section.textContent = 'No comments yet.';
                }
            });

            li.appendChild(checkbox);
            li.appendChild(a);
            const br = document.createElement('div');
            br.style.width = '100%';
            br.style.height = 0;
            li.appendChild(br);
            li.appendChild(commentsBtn);
            storiesList.appendChild(li);
        }
    });
}

function loadStories(numItems) {
    const storiesList = document.getElementById('stories-list');
    storiesList.innerHTML = '<li>Loading...</li>';
    fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
        .then(response => response.json())
        .then(async ids => {
            const topIds = ids.slice(0, numItems);
            const storyPromises = topIds.map(id =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
            );
            const stories = await Promise.all(storyPromises);
            storiesList.innerHTML = '';
            displayStories(stories);
        });
}

function fetchItem(id) {
    return fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); });
}

function timeAgo(unixTime) {
    const seconds = Math.floor((Date.now() - unixTime * 1000) / 1000);
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
}

function renderComment(comment, li) {
    if (!comment || comment.deleted || comment.dead) {
        li.textContent = '[deleted]';
        return;
    }
    li.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    meta.textContent = comment.by + ' ' + timeAgo(comment.time);
    li.appendChild(meta);

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.innerHTML = comment.text || '';
    li.appendChild(text);

    if (comment.kids && comment.kids.length > 0) {
        const repliesBtn = document.createElement('button');
        repliesBtn.className = 'replies-btn';
        repliesBtn.textContent = `Replies (${comment.kids.length})`;
        li.appendChild(repliesBtn);

        const replies = document.createElement('div');
        replies.className = 'replies';
        repliesBtn.addEventListener('click', () => {
            const section = li.querySelector('.replies');
            if (section && section.children.length > 0) {
                section.remove();
                repliesBtn.textContent = `Replies (${comment.kids.length})`;
                return;
            }
            li.appendChild(replies);
            displayComments(comment.kids, replies);
            repliesBtn.textContent = 'Hide replies';
        });
    }
}

function displayComments(kids, container) {
    if (!kids || kids.length === 0) {
        container.textContent = 'No comments yet.';
        return;
    }
    const ul = document.createElement('ul');
    ul.className = 'comments-tree';
    container.innerHTML = '';
    container.appendChild(ul);
    kids.forEach(id => {
        const li = document.createElement('li');
        li.className = 'comment-item';
        li.textContent = 'Loading...';
        ul.appendChild(li);
        fetchItem(id).then(comment => renderComment(comment, li))
            .catch(() => { li.textContent = 'Failed to load comment'; });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const numInput = document.getElementById('num-items');
    const loadBtn = document.getElementById('load-btn');
    loadBtn.addEventListener('click', () => {
        let num = parseInt(numInput.value, 10);
        if (isNaN(num) || num < 1) num = 1;
        if (num > 100) num = 100;
        loadStories(num);
    });

    // Load default on page load
    loadStories(parseInt(numInput.value, 10) || 30);

    // Wire up clear button
    const clearBtn = document.getElementById('clear-selection');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            selectedLinks.clear();
            updateSelectedTextarea();
            document.querySelectorAll('.story-checkbox').forEach(cb => cb.checked = false);
        });
    }

    // Keep selectedLinks in sync if user edits textarea manually
    const ta = document.getElementById('selected-links');
    if (ta) {
        ta.addEventListener('input', () => {
            const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
            selectedLinks.clear();
            lines.forEach(l => selectedLinks.add(l));
            document.querySelectorAll('.story-checkbox').forEach(cb => {
                cb.checked = selectedLinks.has(cb.dataset.url);
            });
        });
    }

    // Copy button handler
    const copyBtn = document.getElementById('copy-selection');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const text = (ta && ta.value) ? ta.value : '';
            try {
                await navigator.clipboard.writeText(text);
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = orig, 1500);
            } catch (err) {
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Failed';
                setTimeout(() => copyBtn.textContent = orig, 2000);
            }
        });
    }

    // Initialize textarea from any existing selections
    updateSelectedTextarea();
});
