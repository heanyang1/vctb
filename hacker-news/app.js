

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

            li.appendChild(checkbox);
            li.appendChild(a);
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
