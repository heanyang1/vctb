# Agent Guidelines for vctb Repository

This repository contains multiple mini-projects:
- `wang-tiles/`: Rust/WASM library for Wang tile generation
- `hacker-news/`, `podcast-viewer/`, `matrix-visualizer/`, `media-player/`: Vanilla JS/HTML static apps

## Build, Lint, and Test Commands

### Rust (wang-tiles)

**Build:**
```bash
cd wang-tiles
cargo build
```

**Build WASM:**
```bash
cd wang-tiles
cargo build --target wasm32-unknown-unknown
# Or with wasm-pack:
wasm-pack build --target web
```

**Run tests:**
```bash
cd wang-tiles
cargo test
```

**Run a single test:**
```bash
cd wang-tiles
cargo test test_name_here
# Or run tests matching a pattern:
cargo test name_pattern
```

**Lint (clippy):**
```bash
cd wang-tiles
cargo clippy
cargo clippy -- -D warnings  # treat warnings as errors
```

**Format:**
```bash
cd wang-tiles
cargo fmt
cargo fmt -- --check  # check without modifying
```

**Note:** This project uses Rust edition 2024 (experimental). Ensure you have a nightly toolchain or recent stable that supports it.

### JavaScript Projects

These are vanilla JS projects with no build system. They can be served directly:
```bash
python3 -m http.server 8000
# Then open http://localhost:8000/project-name/
```

## Code Style Guidelines

### Rust (wang-tiles)

**Formatting:**
- Use `cargo fmt` for automatic formatting
- 4 spaces for indentation
- Max line length: 100 (default)

**Naming:**
- Types/structs/enums: `PascalCase` (e.g., `WangTiler`, `Color`)
- Functions/methods: `snake_case` (e.g., `generate_tiling`, `next_tiles`)
- Variables: `snake_case` (e.g., `tile_map`, `visited`)
- Constants: `SCREAMING_SNAKE_CASE`
- Private fields: prefix with underscore (e.g., `dir: Direction`)

**Imports:**
- Group by: std, external (crate), local (self:: or super::)
- Use `use` statements at module level, not inline
- Avoid wildcard imports except for `wasm_bindgen::prelude::*`

**Types:**
- Prefer explicit types in public APIs
- Use generics where appropriate for flexibility
- Derive `Serialize` for types that need JS interop

**Error Handling:**
- Use `Result<T, E>` for fallible operations
- Use `unwrap()` sparingly (only in test code or when failure is impossible)
- Propagate errors with `?` operator

**WASM-specific:**
- Mark public API with `#[wasm_bindgen]`
- Use `JsValue` for boundary types
- Avoid Rust panics that would crash WASM runtime

### JavaScript (podcast-viewer, hacker-news, etc.)

**General:**
- Vanilla JS, no frameworks
- Use ES6+ features (const/let, arrow functions, async/await)
- 2 spaces for indentation

**Naming:**
- Functions/variables: `camelCase` (e.g., `searchPodcasts`, `feedUrl`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `ITUNES_API`)
- CSS classes: `kebab-case` (e.g., `pod-item`, `episode`)

**Error Handling:**
- Use try/catch for async operations
- Throw `Error` objects with meaningful messages
- Display errors to user via DOM

**HTTP/API:**
- Always set `User-Agent` header
- Handle non-ok responses with proper error messages
- Use CORS proxies as fallback when needed (see podcast-viewer)

**DOM Manipulation:**
- Use `document.getElementById` for element selection
- Create elements via `document.createElement`
- Use helper functions for element creation (see podcast-viewer's `el()`)
- Clean up innerHTML or use `clearChildren()` pattern

**Security:**
- Use `rel="noopener"` for external links
- Sanitize user input before displaying
- Avoid `eval()` or `innerHTML` with untrusted content

## Common Patterns

### Rust Module Structure
```rust
// src/lib.rs
mod module_name;
pub use module_name::{PublicType, public_function};

// src/module_name.rs
use std::collections::HashMap;
use serde::Serialize;

pub struct PublicStruct { ... }
struct PrivateStruct { ... }

pub fn public_function() { ... }
fn private_function() { ... }
```

### JavaScript Async Pattern
```javascript
async function fetchData() {
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

## Testing Guidelines

- Place tests in `tests/` directory or inline with `#[cfg(test)]`
- Use descriptive test names: `test_name_describes_scenario`
- Test both success and failure paths
- For WASM: test the Rust logic separately from JS integration