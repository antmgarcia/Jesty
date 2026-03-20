/**
 * Jesty Generator — Pattern Art Creator
 * One-click generate a massive zigzag pattern. Always overflows the viewport.
 * Floating island with actions: Add text, Download, Generate.
 */
const JestyGenerator = (() => {
  'use strict';

  const COLOR_KEYS = ['lime', 'pink', 'sky', 'purple', 'mint', 'peach'];

  const ALL_EXPRESSIONS = [
    'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
    'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
  ];

  const CELL_W = 52;
  const CELL_H = 48;
  const GAP_X = 4;
  const GAP_Y = 2;
  const OFFSET_X = 28;

  const ZOOM_PRESETS = [
    { min: 100, max: 140, weight: 3 },
    { min: 150, max: 220, weight: 4 },
    { min: 230, max: 320, weight: 3 },
  ];

  const ROAST_QUOTES = [
    "Your mom would be proud of this browser.",
    "You browse like a raccoon with WiFi.",
    "Your screen time filed a restraining order.",
    "Even your bookmarks are embarrassed.",
    "Your browser is seeing other people.",
    "You peaked and your tabs prove it.",
    "Your WiFi router is begging for mercy.",
    "The FBI agent watching you quit.",
    "Your productivity left the chat.",
    "This browser history needs therapy.",
    "You click like it's a personality trait.",
    "Your tabs have abandonment issues.",
    "Somewhere a therapist just flinched.",
    "You treat tabs like emotional baggage.",
    "Your browser is a cry for help.",
  ];

  const RATIOS = {
    'download-portrait':  { label: '4:5', w: 1080, h: 1350, maxTextH: 340 },
    'download-square':    { label: '1:1', w: 1080, h: 1080, maxTextH: 260 },
    'download-landscape': { label: '16:9', w: 1920, h: 1080, maxTextH: 200 },
  };

  const ROAST_MODES = ['off', 'top', 'center', 'bottom'];

  // ── State ──

  let grid = [];
  let rows = 30;
  let evenCols = 16;
  let oddCols = 15;
  let zoom = 100;
  let panX = 0;
  let panY = 0;
  let roastText = '';
  let roastMode = 'off';
  let xpAwarded = false;
  let exportTheme = 'auto'; // 'auto' | 'light' | 'dark'

  // Canvas drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;


  // ── Init ──

  function init() {
    // Start screen
    const startCloseBtn = document.getElementById('generator-start-close');
    const startBtn = document.getElementById('generator-start-btn');
    if (startCloseBtn) startCloseBtn.addEventListener('click', hide);
    if (startBtn) startBtn.addEventListener('click', showGeneratorView);

    // Generator view
    const closeBtn = document.getElementById('generator-overlay-close');
    const backdrop = document.getElementById('generator-overlay-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (backdrop) backdrop.addEventListener('click', hide);

    // Island buttons
    const generateBtn = document.getElementById('generator-island-generate');
    if (generateBtn) generateBtn.addEventListener('click', generate);

    const roastBtn = document.getElementById('generator-island-text');
    if (roastBtn) roastBtn.addEventListener('click', toggleRoast);

    const themeBtn = document.getElementById('generator-island-theme');
    if (themeBtn) themeBtn.addEventListener('click', toggleExportTheme);

    // Download menu
    const shareBtn = document.getElementById('generator-island-share');
    const shareMenu = document.getElementById('generator-share-menu');
    if (shareBtn && shareMenu) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareMenu.classList.toggle('hidden');
      });
      shareMenu.addEventListener('click', (e) => e.stopPropagation());
      shareMenu.addEventListener('click', handleShareAction);
    }
    document.addEventListener('click', () => {
      if (shareMenu && !shareMenu.classList.contains('hidden')) {
        shareMenu.classList.add('hidden');
      }
    });

    // Pan / drag (Figma-like canvas)
    initPan();
  }

  // ── Canvas Pan ──

  function initPan() {
    const viewport = document.getElementById('generator-viewport');
    if (!viewport) return;

    viewport.addEventListener('pointerdown', onPanStart);
    viewport.addEventListener('pointermove', onPanMove);
    viewport.addEventListener('pointerup', onPanEnd);
    viewport.addEventListener('pointercancel', onPanEnd);
    viewport.addEventListener('pointerleave', onPanEnd);
  }

  function onPanStart(e) {
    if (e.target.closest('.generator-island')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    const viewport = document.getElementById('generator-viewport');
    if (viewport) {
      viewport.classList.add('grabbing');
      viewport.setPointerCapture(e.pointerId);
    }
  }

  function onPanMove(e) {
    if (!isDragging) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
    applyTransform();
  }

  function onPanEnd() {
    if (!isDragging) return;
    isDragging = false;
    const viewport = document.getElementById('generator-viewport');
    if (viewport) viewport.classList.remove('grabbing');
  }

  // ── Show / Hide ──

  function show() {
    xpAwarded = false;
    roastMode = 'off';
    roastText = '';
    exportTheme = 'auto';

    const overlay = document.getElementById('generator-overlay');
    if (overlay) overlay.classList.remove('hidden');

    const startScreen = document.getElementById('generator-start');
    const genView = document.getElementById('generator-view');
    if (startScreen) startScreen.classList.remove('hidden');
    if (genView) genView.classList.add('hidden');
  }

  function showGeneratorView() {
    const startScreen = document.getElementById('generator-start');
    const genView = document.getElementById('generator-view');
    if (startScreen) startScreen.classList.add('hidden');
    if (genView) genView.classList.remove('hidden');

    generate();
  }

  function hide() {
    const overlay = document.getElementById('generator-overlay');
    if (overlay) overlay.classList.add('hidden');
    const shareMenu = document.getElementById('generator-share-menu');
    if (shareMenu) shareMenu.classList.add('hidden');
  }

  // ── Download Menu ──

  async function handleShareAction(e) {
    const option = e.target.closest('.generator-share-option');
    if (!option) return;
    const action = option.dataset.action;
    const menu = document.getElementById('generator-share-menu');
    if (menu) menu.classList.add('hidden');

    if (action === 'copy') {
      await copyPatternImage();
    } else if (RATIOS[action]) {
      await downloadWithRatio(RATIOS[action]);
    }
  }

  async function copyPatternImage() {
    const ratio = RATIOS['download-square'];
    const svgString = buildExportSvg(ratio);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = async () => {
      const cvs = document.createElement('canvas');
      cvs.width = ratio.w;
      cvs.height = ratio.h;
      cvs.getContext('2d').drawImage(img, 0, 0, ratio.w, ratio.h);
      URL.revokeObjectURL(url);

      cvs.toBlob(async (pngBlob) => {
        if (!pngBlob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
        } catch (err) {}
        showDownloadCheck();
        maybeAwardXP();
      }, 'image/png');
    };
    img.src = url;
  }

  // ── Check Animation ──

  function showDownloadCheck() {
    const btn = document.getElementById('generator-island-share');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-pop"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  }

  // ── Options ──

  // ── Theme Toggle ──

  const THEME_ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const THEME_ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function toggleExportTheme() {
    const cycle = ['auto', 'light', 'dark'];
    exportTheme = cycle[(cycle.indexOf(exportTheme) + 1) % cycle.length];

    const btn = document.getElementById('generator-island-theme');
    const viewport = document.getElementById('generator-viewport');
    if (!viewport) return;

    // Remove previous overrides
    viewport.classList.remove('generator-theme-light', 'generator-theme-dark');

    if (exportTheme === 'light') {
      viewport.classList.add('generator-theme-light');
      if (btn) { btn.classList.add('active'); btn.innerHTML = THEME_ICON_SUN; }
    } else if (exportTheme === 'dark') {
      viewport.classList.add('generator-theme-dark');
      if (btn) { btn.classList.add('active'); btn.innerHTML = THEME_ICON_MOON; }
    } else {
      if (btn) { btn.classList.remove('active'); btn.innerHTML = THEME_ICON_SUN; }
    }

    // Update roast overlay color
    updateRoastOverlay();
  }

  function toggleRoast() {
    const idx = ROAST_MODES.indexOf(roastMode);
    roastMode = ROAST_MODES[(idx + 1) % ROAST_MODES.length];
    if (roastMode !== 'off' && !roastText) {
      roastText = ROAST_QUOTES[Math.floor(Math.random() * ROAST_QUOTES.length)];
    }
    const btn = document.getElementById('generator-island-text');
    if (btn) btn.classList.toggle('active', roastMode !== 'off');
    updateRoastOverlay();
  }

  // ── Roast Overlay ──

  function updateRoastOverlay() {
    const old = document.getElementById('generator-roast-overlay');
    if (old) old.remove();

    if (roastMode === 'off') return;

    const el = document.createElement('div');
    el.id = 'generator-roast-overlay';
    el.className = `generator-roast-overlay generator-roast--${roastMode}`;
    el.textContent = roastText;

    const viewport = document.getElementById('generator-viewport');
    if (!viewport) return;
    viewport.appendChild(el);
  }

  // ── Generate ──

  function generate() {
    panX = 0;
    panY = 0;

    // Pick zoom first so we know how many cells we actually need
    const preset = pickWeightedPreset();
    zoom = preset.min + Math.floor(Math.random() * (preset.max - preset.min + 1));

    const viewport = document.getElementById('generator-viewport');
    if (!viewport) return;
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;
    const scale = zoom / 100;

    // Compute grid: viewport / scale * 3 for pan headroom
    const neededW = (vw / scale) * 3;
    const neededH = (vh / scale) * 3;
    evenCols = Math.ceil(neededW / (CELL_W + GAP_X)) + 2;
    oddCols = evenCols - 1;
    rows = Math.ceil(neededH / (CELL_H + GAP_Y)) + 2;

    grid = [];
    for (let r = 0; r < rows; r++) {
      const cols = r % 2 === 0 ? evenCols : oddCols;
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
          expression: ALL_EXPRESSIONS[Math.floor(Math.random() * ALL_EXPRESSIONS.length)]
        });
      }
      grid.push(row);
    }

    if (roastMode !== 'off') {
      roastText = ROAST_QUOTES[Math.floor(Math.random() * ROAST_QUOTES.length)];
    }

    renderGrid();
    applyTransform();
    updateRoastOverlay();
  }

  function pickWeightedPreset() {
    const total = ZOOM_PRESETS.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (const p of ZOOM_PRESETS) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return ZOOM_PRESETS[0];
  }

  // ── Grid Rendering (DOM) ──

  function renderGrid() {
    const canvas = document.getElementById('generator-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    for (let r = 0; r < grid.length; r++) {
      const row = document.createElement('div');
      row.className = 'generator-row';
      if (r % 2 !== 0) row.classList.add('offset');

      for (let c = 0; c < grid[r].length; c++) {
        const cell = document.createElement('div');
        cell.className = 'generator-cell';

        const data = grid[r][c];
        const combo = { expression: data.expression, hat: null, glasses: null, color: data.color };
        cell.innerHTML = typeof buildTierComboSvg === 'function'
          ? buildTierComboSvg(combo, 44, 40)
          : `<svg viewBox="-15 -10 150 140" width="44" height="40"><use href="#face-${data.expression}"/></svg>`;

        row.appendChild(cell);
      }
      canvas.appendChild(row);
    }
  }

  function applyTransform() {
    const canvas = document.getElementById('generator-canvas');
    const viewport = document.getElementById('generator-viewport');
    if (!canvas || !viewport) return;

    const scale = zoom / 100;
    const gridW = evenCols * (CELL_W + GAP_X);
    const gridH = rows * (CELL_H + GAP_Y);
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;

    // Center the scaled grid in the viewport, then apply pan offset
    const cx = (vw - gridW * scale) / 2 + panX;
    const cy = (vh - gridH * scale) / 2 + panY;

    canvas.style.transform = `translate(${cx}px, ${cy}px) scale(${scale})`;
  }

  // ── Export SVG ──

  function buildExportSvg(ratio) {
    const targetW = ratio.w;
    const targetH = ratio.h;
    const maxTextH = ratio.maxTextH || Math.round(targetH * 0.2);
    const scale = zoom / 100;
    const bg = getComputedBg();

    // Figure out how many cells we need to fill the export canvas at this zoom
    const neededW = targetW / scale;
    const neededH = targetH / scale;
    const exportCols = Math.ceil(neededW / (CELL_W + GAP_X)) + 2;
    const exportRows = Math.ceil(neededH / (CELL_H + GAP_Y)) + 2;

    // Build cells — reuse grid data, wrapping if export needs more than we have
    let inner = '';
    for (let r = 0; r < exportRows; r++) {
      const isOdd = r % 2 !== 0;
      const cols = isOdd ? exportCols - 1 : exportCols;
      const baseX = isOdd ? OFFSET_X : 0;
      const y = r * (CELL_H + GAP_Y);

      for (let c = 0; c < cols; c++) {
        const srcRow = r % grid.length;
        const srcCol = c % grid[srcRow].length;
        const data = grid[srcRow][srcCol];
        const x = baseX + c * (CELL_W + GAP_X);
        const cellSvg = buildExportCellSvg(data, r, c);
        inner += `<svg x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" viewBox="-15 -10 150 140">${cellSvg}</svg>`;
      }
    }

    // Center the grid in the export canvas
    const totalGridW = exportCols * (CELL_W + GAP_X);
    const totalGridH = exportRows * (CELL_H + GAP_Y);
    const cx = (targetW - totalGridW * scale) / 2;
    const cy = (targetH - totalGridH * scale) / 2;

    // Roast text overlay — measure DOM line breaks, fit within maxTextH
    let roastSvg = '';
    if (roastMode !== 'off' && roastText) {
      const viewport = document.getElementById('generator-viewport');
      const vpW = viewport ? viewport.offsetWidth : 350;
      const scaleFactor = targetW / vpW;

      // Start with proportional font size, shrink if text block exceeds maxTextH
      let fontSize = Math.round(56 * scaleFactor);
      let lines = measureTextLines(roastText, vpW);
      const barPadRatio = 0.6;

      // Shrink font until text + padding fits within maxTextH
      while (fontSize > 16) {
        const lineH = fontSize;
        const totalH = lines.length * lineH + fontSize * barPadRatio * 2;
        if (totalH <= maxTextH) break;
        fontSize -= 2;
        // Re-measure at smaller font — fewer line breaks
        lines = measureTextLines(roastText, vpW, fontSize);
      }

      const lineH = fontSize;
      const barPad = Math.round(fontSize * barPadRatio);
      const totalTextH = lines.length * lineH;
      const barH = Math.min(totalTextH + barPad * 2, maxTextH);

      let baseY;
      let barSvg = '';

      if (roastMode === 'top') {
        barSvg = `<rect x="0" y="0" width="${targetW}" height="${barH}" fill="${bg}"/>`;
        baseY = (barH - totalTextH) / 2 + lineH * 0.85;
      } else if (roastMode === 'bottom') {
        barSvg = `<rect x="0" y="${targetH - barH}" width="${targetW}" height="${barH}" fill="${bg}"/>`;
        baseY = targetH - barH + (barH - totalTextH) / 2 + lineH * 0.85;
      } else {
        baseY = (targetH - totalTextH) / 2 + lineH * 0.85;
      }

      const tspans = lines.map((line, i) =>
        `<tspan x="${Math.round(targetW / 2)}" dy="${i === 0 ? 0 : lineH}">${escapeXml(line)}</tspan>`
      ).join('');

      const ls = Math.round(fontSize * (-2 / 56));
      const textFill = getComputedTextColor();
      roastSvg = `${barSvg}<text x="${Math.round(targetW / 2)}" y="${Math.round(baseY)}" font-family="DM Sans, sans-serif" font-weight="700" font-size="${fontSize}" fill="${textFill}" text-anchor="middle" letter-spacing="${ls}">${tspans}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${targetW}" height="${targetH}"><rect width="${targetW}" height="${targetH}" fill="${bg}"/><g transform="translate(${cx},${cy}) scale(${scale})">${inner}</g>${roastSvg}</svg>`;
  }

  function getComputedBg() {
    if (exportTheme === 'light') return '#F5F3F0';
    if (exportTheme === 'dark') return '#1F1F23';
    const viewport = document.getElementById('generator-viewport');
    if (viewport) {
      const bg = getComputedStyle(viewport).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return '#EFEBE6';
  }

  function getComputedTextColor() {
    if (exportTheme === 'light') return '#1C1917';
    if (exportTheme === 'dark') return '#F4F4F5';
    const val = getComputedStyle(document.documentElement).getPropertyValue('--jesty-text').trim();
    return val || '#1C1917';
  }

  function buildExportCellSvg(data, r, c) {
    const colors = typeof SLOT_COLORS !== 'undefined' ? SLOT_COLORS[data.color] : null;
    const symbol = document.getElementById(`face-${data.expression}`);
    if (!symbol) return '';

    const uid = `gen-${r}-${c}`;
    let content = symbol.innerHTML;
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);

    if (colors && typeof currentColor !== 'undefined') {
      for (const key of ['body', 'limb', 'shadow', 'highlight']) {
        const from = currentColor[key];
        if (from) {
          content = content.replace(new RegExp(escapeRegex(from), 'gi'), colors[key]);
        }
      }
    }

    return content;
  }

  function measureTextLines(text, containerWidth, fontSizePx) {
    const fs = fontSizePx || 56;
    const div = document.createElement('div');
    const ls = Math.round(fs * (-2 / 56));
    div.style.cssText = `position:absolute;visibility:hidden;left:-9999px;font-family:'DM Sans',sans-serif;font-size:${fs}px;font-weight:700;letter-spacing:${ls}px;line-height:1;padding:10px 12px;width:${containerWidth}px;text-align:center;box-sizing:border-box;`;

    const words = text.split(' ');
    div.innerHTML = words.map(w => `<span>${w}</span>`).join(' ');
    document.body.appendChild(div);

    const spans = div.querySelectorAll('span');
    const lines = [];
    let currentLine = [];
    let lastTop = -1;

    spans.forEach(span => {
      const top = span.getBoundingClientRect().top;
      if (lastTop >= 0 && Math.abs(top - lastTop) > 2) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
      currentLine.push(span.textContent);
      lastTop = top;
    });
    if (currentLine.length) lines.push(currentLine.join(' '));

    document.body.removeChild(div);
    return lines.length ? lines : [text];
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Download PNG ──

  async function downloadWithRatio(ratio) {
    const svgString = buildExportSvg(ratio);

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = async () => {
      const cvs = document.createElement('canvas');
      cvs.width = ratio.w;
      cvs.height = ratio.h;
      cvs.getContext('2d').drawImage(img, 0, 0, ratio.w, ratio.h);
      URL.revokeObjectURL(url);

      cvs.toBlob(async (pngBlob) => {
        if (!pngBlob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(pngBlob);
        a.download = `jesty-pattern-${ratio.label.replace(':', 'x')}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        showDownloadCheck();
        maybeAwardXP();
      }, 'image/png');
    };
    img.src = url;
  }

  async function maybeAwardXP() {
    if (!xpAwarded) {
      xpAwarded = true;
      if (typeof awardXP === 'function') {
        await awardXP(20);
        if (typeof showXPToast === 'function') showXPToast(20);
      }
    }
  }

  // ── Public API ──

  return { init, show, hide };
})();
