import { generateTiling } from './tiler.js';

function colorFor(c: unknown): string {
    switch (c) {
        case 'R': case 'R"': return 'red';
        case 'G': case 'G"': return 'green';
        case 'B': case 'B"': return 'blue';
        case 'W': case 'W"': return 'white';
    }
    if (typeof c === 'object' && c !== null) {
        const keys = Object.keys(c);
        if (keys.length) {
            return colorFor(keys[0]);
        }
    }
    return 'black';
}

const sizeInput = document.getElementById('sizeInput') as HTMLInputElement | null;
const genBtn = document.getElementById('genBtn') as HTMLButtonElement | null;
const status = document.getElementById('status') as HTMLElement | null;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const cell = 40;
const offsetX = canvas.width / 2;
const offsetY = canvas.height / 2;

function renderTiles(tiles: Array<{ x: number; y: number; top: unknown; bottom: unknown; left: unknown; right: unknown }>): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const t of tiles) {
        const x = t.x * cell + offsetX;
        const y = -t.y * cell + offsetY;
        ctx.strokeStyle = '#222';
        ctx.strokeRect(x - cell / 2, y - cell / 2, cell, cell);
        const half = cell / 2;

        function fillTriangle(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, fill: string): void {
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        }

        ctx.fillStyle = '#fff';
        ctx.fillRect(x - half, y - half, cell, cell);
        fillTriangle(x - half, y - half, x + half, y - half, x, y - half + half, colorFor(t.top));
        fillTriangle(x - half, y + half, x + half, y + half, x, y + half - half, colorFor(t.bottom));
        fillTriangle(x - half, y - half, x - half, y + half, x - half + half, y, colorFor(t.left));
        fillTriangle(x + half, y - half, x + half, y + half, x + half - half, y, colorFor(t.right));
    }
}

function generateAndRender(size: number): void {
    try {
        if (status) status.textContent = 'Generating...';
        const tiles = generateTiling(size);
        renderTiles(tiles);
        if (status) status.textContent = `Generated ${tiles.length} tiles (size ${size})`;
    } catch (e) {
        console.error('generate_tiles failed', e);
        if (status) status.textContent = 'Generation failed; see console';
    }
}

if (genBtn) {
    genBtn.addEventListener('click', () => {
        const v = parseInt(sizeInput?.value || '5', 10);
        if (isNaN(v) || v < 1) return;
        generateAndRender(v);
    });
}
if (sizeInput) {
    sizeInput.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter') genBtn?.click();
    });
}

generateAndRender(parseInt(sizeInput?.value || '5', 10));
