type Color = 'R' | 'G' | 'B' | 'W';

interface Tile {
    top: Color;
    bottom: Color;
    left: Color;
    right: Color;
}

interface TileData extends Tile {
    x: number;
    y: number;
}

type Direction = 'Up' | 'Down' | 'Left' | 'Right';

class TilePos {
    private dir: Direction = 'Up';
    private totalStep: number = 1;
    private step: number = 0;
    private x: number = 0;
    private y: number = 0;

    next(): [number, number] {
        const result: [number, number] = [this.x, this.y];
        const [dx, dy] = this.getDiff();
        this.x += dx;
        this.y += dy;
        this.step++;
        if (this.step === this.totalStep) {
            this.step = 0;
            [this.dir, this.totalStep] = this.nextDir();
        }
        return result;
    }

    private getDiff(): [number, number] {
        switch (this.dir) {
            case 'Up': return [0, 1];
            case 'Down': return [0, -1];
            case 'Left': return [-1, 0];
            case 'Right': return [1, 0];
        }
    }

    private nextDir(): [Direction, number] {
        switch (this.dir) {
            case 'Up': return ['Right', this.totalStep];
            case 'Right': return ['Down', this.totalStep + 1];
            case 'Down': return ['Left', this.totalStep];
            case 'Left': return ['Up', this.totalStep + 1];
        }
    }

    clone(): TilePos {
        const p = new TilePos();
        p.dir = this.dir;
        p.totalStep = this.totalStep;
        p.step = this.step;
        p.x = this.x;
        p.y = this.y;
        return p;
    }
}

class WangTiler {
    private size: number;
    private tiles: Tile[];

    constructor(tiles: Tile[], size: number) {
        this.tiles = tiles;
        this.size = size;
    }

    private compatibleWith(tile: Tile, up: Tile | null, down: Tile | null, left: Tile | null, right: Tile | null): boolean {
        return (!up || tile.top === up.bottom) &&
            (!down || tile.bottom === down.top) &&
            (!left || tile.left === left.right) &&
            (!right || tile.right === right.left);
    }

    private nextTiles(x: number, y: number, visited: Map<string, Tile>): Tile[] {
        const key = (xx: number, yy: number) => `${xx},${yy}`;
        const left = visited.get(key(x - 1, y)) ?? null;
        const right = visited.get(key(x + 1, y)) ?? null;
        const up = visited.get(key(x, y + 1)) ?? null;
        const down = visited.get(key(x, y - 1)) ?? null;
        return this.tiles.filter(t => this.compatibleWith(t, up, down, left, right));
    }

    generate(pos: TilePos, visited: Map<string, Tile>): boolean {
        const [x, y] = pos.next();
        if (Math.abs(x) >= this.size || Math.abs(y) >= this.size) {
            return true;
        }
        const candidates = this.nextTiles(x, y, visited);
        for (const tile of candidates) {
            visited.set(`${x},${y}`, tile);
            if (this.generate(pos.clone(), visited)) {
                return true;
            }
            visited.delete(`${x},${y}`);
        }
        return false;
    }
}

export function generateTiling(size: number): TileData[] {
    const tiles: Tile[] = [
        { top: 'R', bottom: 'R', left: 'G', right: 'R' },
        { top: 'B', bottom: 'B', left: 'G', right: 'R' },
        { top: 'R', bottom: 'G', left: 'G', right: 'G' },
        { top: 'W', bottom: 'R', left: 'B', right: 'B' },
        { top: 'B', bottom: 'W', left: 'B', right: 'B' },
        { top: 'W', bottom: 'R', left: 'W', right: 'W' },
        { top: 'R', bottom: 'B', left: 'W', right: 'G' },
        { top: 'B', bottom: 'B', left: 'R', right: 'W' },
        { top: 'B', bottom: 'W', left: 'R', right: 'R' },
        { top: 'G', bottom: 'B', left: 'R', right: 'G' },
        { top: 'R', bottom: 'R', left: 'G', right: 'W' },
    ];
    const visited = new Map<string, Tile>();
    const tiler = new WangTiler(tiles, size);
    tiler.generate(new TilePos(), visited);
    return Array.from(visited.entries()).map(([key, tile]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, ...tile };
    });
}
