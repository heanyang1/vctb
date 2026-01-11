mod tiler_core;
use crate::tiler_core::{SerTile, generate_tiling};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn generate_tiles(size: i32) -> JsValue {
    let map = generate_tiling(size);
    let mut vec = Vec::with_capacity(map.len());
    for ((x, y), t) in map {
        vec.push(SerTile {
            x,
            y,
            top: t.top,
            bottom: t.bottom,
            left: t.left,
            right: t.right,
        });
    }
    // Convert to JsValue using serde_wasm_bindgen so JS receives proper objects
    serde_wasm_bindgen::to_value(&vec).unwrap()
}
