use serde::Serialize;
use std::{collections::HashMap, fmt::Display};

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Color {
    R,
    G,
    B,
    W,
}

impl Display for Color {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Color::R => write!(f, "red"),
            Color::G => write!(f, "green"),
            Color::B => write!(f, "blue"),
            Color::W => write!(f, "white"),
        }
    }
}

#[derive(Clone, Copy, Serialize)]
pub struct Tile {
    pub top: Color,
    pub bottom: Color,
    pub left: Color,
    pub right: Color,
}

impl Tile {
    fn compatible_with(
        &self,
        up: Option<&Tile>,
        down: Option<&Tile>,
        left: Option<&Tile>,
        right: Option<&Tile>,
    ) -> bool {
        up.map_or(true, |t| self.top == t.bottom)
            && down.map_or(true, |t| self.bottom == t.top)
            && left.map_or(true, |t| self.left == t.right)
            && right.map_or(true, |t| self.right == t.left)
    }
}

impl Display for Tile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "[t:{} b:{} l:{} r:{}]",
            self.top, self.bottom, self.left, self.right
        )
    }
}

#[derive(Clone, Copy)]
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Clone)]
struct TilePos {
    dir: Direction,
    total_step: usize,
    step: usize,
    pos: (i32, i32),
}

impl TilePos {
    pub fn new() -> Self {
        TilePos {
            dir: Direction::Up,
            total_step: 1,
            step: 0,
            pos: (0, 0),
        }
    }
    fn get_diff(&self) -> (i32, i32) {
        match &self.dir {
            Direction::Up => (0, 1),
            Direction::Down => (0, -1),
            Direction::Left => (-1, 0),
            Direction::Right => (1, 0),
        }
    }
    fn next_dir(&self) -> (Direction, usize) {
        match &self.dir {
            Direction::Up => (Direction::Right, self.total_step),
            Direction::Right => (Direction::Down, self.total_step + 1),
            Direction::Down => (Direction::Left, self.total_step),
            Direction::Left => (Direction::Up, self.total_step + 1),
        }
    }
}

impl Iterator for TilePos {
    type Item = (i32, i32);
    fn next(&mut self) -> Option<Self::Item> {
        let (x, y) = self.pos;
        let (dx, dy) = self.get_diff();
        self.pos = (x + dx, y + dy);
        self.step += 1;
        if self.step == self.total_step {
            self.step = 0;
            (self.dir, self.total_step) = self.next_dir();
        }
        return Some((x, y));
    }
}

pub struct WangTiler {
    size: i32,
    tiles: Vec<Tile>,
}

impl WangTiler {
    pub fn new(tiles: Vec<Tile>, size: i32) -> Self {
        WangTiler { size, tiles }
    }

    fn next_tiles(&self, x: i32, y: i32, visited: &HashMap<(i32, i32), Tile>) -> Vec<&Tile> {
        let left = visited.get(&(x - 1, y));
        let right = visited.get(&(x + 1, y));
        let up = visited.get(&(x, y + 1));
        let down = visited.get(&(x, y - 1));
        self.tiles
            .iter()
            .filter(|&tile| tile.compatible_with(up, down, left, right))
            .collect::<Vec<_>>()
    }

    pub fn generate(&self, mut pos: TilePos, visited: &mut HashMap<(i32, i32), Tile>) -> bool {
        let (x, y) = pos.next().unwrap().clone();
        if x.abs() >= self.size.abs() || y.abs() >= self.size.abs() {
            return true;
        }
        for tile in self.next_tiles(x, y, &visited) {
            visited.insert((x, y), *tile);
            if self.generate(pos.clone(), visited) {
                return true;
            }
            visited.remove(&(x, y));
        }
        return false;
    }
}

#[derive(Serialize)]
pub struct SerTile {
    pub x: i32,
    pub y: i32,
    pub top: Color,
    pub bottom: Color,
    pub left: Color,
    pub right: Color,
}

pub fn generate_tiling(size: i32) -> HashMap<(i32, i32), Tile> {
    let tiles = vec![
        Tile {
            top: Color::R,
            bottom: Color::R,
            left: Color::G,
            right: Color::R,
        },
        Tile {
            top: Color::B,
            bottom: Color::B,
            left: Color::G,
            right: Color::R,
        },
        Tile {
            top: Color::R,
            bottom: Color::G,
            left: Color::G,
            right: Color::G,
        },
        Tile {
            top: Color::W,
            bottom: Color::R,
            left: Color::B,
            right: Color::B,
        },
        Tile {
            top: Color::B,
            bottom: Color::W,
            left: Color::B,
            right: Color::B,
        },
        Tile {
            top: Color::W,
            bottom: Color::R,
            left: Color::W,
            right: Color::W,
        },
        Tile {
            top: Color::R,
            bottom: Color::B,
            left: Color::W,
            right: Color::G,
        },
        Tile {
            top: Color::B,
            bottom: Color::B,
            left: Color::R,
            right: Color::W,
        },
        Tile {
            top: Color::B,
            bottom: Color::W,
            left: Color::R,
            right: Color::R,
        },
        Tile {
            top: Color::G,
            bottom: Color::B,
            left: Color::R,
            right: Color::G,
        },
        Tile {
            top: Color::R,
            bottom: Color::R,
            left: Color::G,
            right: Color::W,
        },
    ];
    let mut tile_map = HashMap::new();
    let tiler = WangTiler::new(tiles, size);
    tiler.generate(TilePos::new(), &mut tile_map);
    tile_map
}

