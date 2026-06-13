const textInput = document.getElementById('textInput') as HTMLTextAreaElement | null;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement | null;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement | null;

if (copyBtn && textInput) {
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
}

if (clearBtn && textInput) {
    clearBtn.addEventListener('click', () => {
        textInput.value = '';
    });
}
