# Agent Guidelines for vctb Repository

This repository contains multiple mini-projects:
- `wang-tiles/`: Wang tile generation (TypeScript implementation)
- `hacker-news/`, `podcast-viewer/`, `matrix-visualizer/`, `media-player/`: Web apps written in TypeScript

## Build, Lint, and Test Commands

### Build TypeScript

```bash
npm run build
```

Compiles `.ts` files to `.js` in each project directory.

### Serve

```bash
python3 -m http.server 8000
# Then open http://localhost:8000/project-name/
```

## Code Style Guidelines

### TypeScript

**General:**
- Use strict TypeScript with explicit types
- Use ES6+ features (const/let, arrow functions, async/await)
- 2 spaces for indentation

**Naming:**
- Functions/variables/interfaces: `camelCase` (e.g., `generateTiling`, `Tile`)
- Types: `PascalCase` (e.g., `WangTiler`, `TileData`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `ITUNES_API`)

**DOM Manipulation:**
- Cast `getElementById` results with `as HTML*Element | null`
- Use optional chaining (`?.`) for nullable elements
- Create elements via `document.createElement`

**Error Handling:**
- Use try/catch for async operations
- Throw `Error` objects with meaningful messages
- Display errors to user via DOM

**HTTP/API:**
- Always set `User-Agent` header
- Handle non-ok responses with proper error messages
- Use CORS proxies as fallback when needed (see podcast-viewer)

## Common Patterns

### TypeScript Module Structure
```typescript
// tiler.ts
export interface Tile { ... }
export function generateTiling(size: number): Tile[] { ... }

// app.ts
import { generateTiling } from './tiler.js';
```

### Async Pattern
```typescript
async function fetchData(url: string): Promise<Data> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'App/1.0' } });
        if (!res.ok) throw new Error('Failed: ' + res.status);
        return await res.json();
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}
```
