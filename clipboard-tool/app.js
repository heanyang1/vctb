const textInput = document.getElementById('textInput');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

copyBtn.addEventListener('click', async () => {
    const text = textInput.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1500);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
});

clearBtn.addEventListener('click', () => {
    textInput.value = '';
});