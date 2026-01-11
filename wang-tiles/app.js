(async () => {
  let m = null;
  try {
    m = await import('./pkg/wang_tiles.js');
  } catch (e2) {
    console.error('Failed to load wasm module from ./pkg and ../pkg', e1, e2);
    return;
  }

  const init = m.default || m.init || (async () => { });
  try { await init(); } catch (e) { console.error('wasm init failed', e); return; }

  const generate_tiles = m.generate_tiles;
  if (typeof generate_tiles !== 'function') {
    console.error('generate_tiles not found on wasm module', m);
    return;
  }

  const sizeInput = document.getElementById('sizeInput');
  const genBtn = document.getElementById('genBtn');
  const status = document.getElementById('status');
  const canvas = document.getElementById('c');
  if (!canvas) { console.error('canvas not found'); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) { console.error('2D context not available'); return; }

  const cell = 40;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const offsetX = canvas.width / 2;
  const offsetY = canvas.height / 2;

  function colorFor(c) {
    switch (c) {
      case 'R': case 'R\"': return 'red';
      case 'G': case 'G\"': return 'green';
      case 'B': case 'B\"': return 'blue';
      case 'W': case 'W\"': return 'white';
    }
    // sometimes serde produces {"R":[]} style; handle object-like variants
    if (typeof c === 'object') {
      if (c && Object.keys(c).length) {
        const k = Object.keys(c)[0];
        return colorFor(k);
      }
    }
    return 'black';
  }

  function renderTiles(tiles) {
    console.log('rendering tiles', tiles);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tiles.forEach(t => {
      const x = t.x * cell + offsetX;
      const y = -t.y * cell + offsetY; // invert y for canvas
      ctx.strokeStyle = '#222';
      ctx.strokeRect(x - cell / 2, y - cell / 2, cell, cell);
      const half = cell / 2;
      // draw triangular wedges for each side to mimic SVG style
      function fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y, fill) {
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }

      // background (white)
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - half, y - half, cell, cell);

      // top triangle (base along top edge)
      fillTriangle(x - half, y - half, x + half, y - half, x, y - half + half, colorFor(t.top));
      // bottom triangle (base along bottom edge)
      fillTriangle(x - half, y + half, x + half, y + half, x, y + half - half, colorFor(t.bottom));
      // left triangle (base along left edge)
      fillTriangle(x - half, y - half, x - half, y + half, x - half + half, y, colorFor(t.left));
      // right triangle (base along right edge)
      fillTriangle(x + half, y - half, x + half, y + half, x + half - half, y, colorFor(t.right));

      // (removed center white diamond to avoid white squares in tile centers)
    });
  }

  function generateAndRender(size) {
    try {
      status.textContent = 'Generating...';
      const tiles = generate_tiles(size);
      renderTiles(tiles);
      status.textContent = `Generated ${tiles.length} tiles (size ${size})`;
    } catch (e) {
      console.error('generate_tiles failed', e);
      status.textContent = 'Generation failed; see console';
    }
  }

  genBtn.addEventListener('click', () => {
    const v = parseInt(sizeInput.value || '5', 10);
    if (isNaN(v) || v < 1) return;
    generateAndRender(v);
  });
  sizeInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') genBtn.click();
  });

  // initial render
  generateAndRender(parseInt(sizeInput.value || '5', 10));
})();
