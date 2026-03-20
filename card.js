/* ──────────────────────────────────────────────
   JESTY CARD — Premium collectible trading card
   ────────────────────────────────────────────── */

const SLOT_COLORS = {
  lime:   { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
  pink:   { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
  sky:    { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' },
  purple: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' },
  mint:   { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
  peach:  { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' },
};

const SOURCE_COLOR = { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };
const COLOR_KEYS = ['lime', 'pink', 'sky', 'purple', 'mint', 'peach'];

// Inscription config
const JESTY_FEE_SATS = 5000;                    // Jesty platform fee in sats
const JESTY_REFERRAL = 'YOUR_REFERRAL_CODE';     // OrdinalsBot referral code — replace after registering
const PROXY_BASE = 'https://jesty-proxy.hey-9f5.workers.dev';

// BTC price cache
let btcPriceUsd = null;

// State captured for inscription generation
const cardState = {};
const ALL_EXPRESSIONS = [
  'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
  'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
];

(async function initCard() {
  // Apply theme (dark/light) from user preference
  if (typeof JestyTheme !== 'undefined') JestyTheme.init();

  // Inject shared SVG symbols (faces + accessories)
  JestyCharacters.init();

  // Load data
  const data = await JestyStorage.getJestyData();
  if (!data) return;

  const profile = data.profile || {};
  const traits = profile.traits || {};
  const roasts = data.roasts || [];
  const totalRoasts = profile.total_roasts || 0;
  const userName = profile.user_name || 'Unknown';

  // Color
  const colorResult = await chrome.storage.local.get(['jestyColor']);
  const userColor = colorResult.jestyColor || SLOT_COLORS.purple;
  document.documentElement.style.setProperty('--user-color', userColor.body);
  document.documentElement.style.setProperty('--user-color-shadow', userColor.shadow);
  document.documentElement.style.setProperty('--user-color-highlight', userColor.highlight);

  // Categories
  const categories = (profile.top_categories || []).filter(c => {
    const n = (c.name || c.category || '').toLowerCase();
    return n !== 'other' && n !== 'others';
  }).slice(0, 4);

  // Mood counts — find the user's dominant mood
  const moodCounts = {};
  roasts.forEach(r => { if (r.mood) moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
  const topMood = sortedMoods.length ? sortedMoods[0][0] : 'smug';
  const topMoodPct = sortedMoods.length ? Math.round(sortedMoods[0][1] / roasts.length * 100) : 0;

  // Dominant trait
  const traitDefs = [
    { key: 'procrastinator_score', label: 'Procrastinator', short: 'The Procrastinator' },
    { key: 'night_owl_score', label: 'Night Owl', short: 'The Night Owl' },
    { key: 'tab_hoarder_score', label: 'Tab Hoarder', short: 'The Tab Hoarder' },
    { key: 'impulse_shopper_score', label: 'Impulse Shopper', short: 'The Impulse Shopper' }
  ];
  const topTrait = traitDefs.reduce((best, t) => {
    const val = traits[t.key] || 0;
    return val > (best.val || 0) ? { ...t, val } : best;
  }, { short: 'Under Investigation', label: 'Unknown', val: 0 });

  // Total tabs seen (sum of all category counts, including filtered-out ones)
  const allCategories = profile.top_categories || [];
  const totalTabsSeen = allCategories.reduce((sum, c) => sum + (c.count || 0), 0);

  // ── Page header icon ──
  const headerIcon = document.getElementById('card-header-icon');
  if (headerIcon) {
    const iconSymbol = document.getElementById('face-smug');
    if (iconSymbol) {
      const vb = iconSymbol.getAttribute('viewBox') || '-15 -10 150 140';
      let iconContent = iconSymbol.innerHTML;
      iconContent = iconContent.replace(/id="clip-([^"]+)"/g, 'id="clip-$1-hdr"');
      iconContent = iconContent.replace(/url\(#clip-([^)]+)\)/g, 'url(#clip-$1-hdr)');
      iconContent = recolorSvg(iconContent, SOURCE_COLOR, userColor);
      headerIcon.innerHTML = `<svg viewBox="${vb}">${iconContent}</svg>`;
    }
  }

  // ── Render card front ──

  // Load previously used verdict hashes for deduplication
  const { jestyCardHashes = [] } = await chrome.storage.local.get(['jestyCardHashes']);

  // Verdict (the main roast — dominates the card)
  const verdict = generateCardVerdict(categories, traits, topTrait, totalRoasts, topMood, jestyCardHashes);
  document.getElementById('card-verdict-text').textContent = verdict;

  // Store this verdict's hash so it's never reused
  const verdictHash = hashVerdict(verdict);
  if (!jestyCardHashes.includes(verdictHash)) {
    jestyCardHashes.push(verdictHash);
    await chrome.storage.local.set({ jestyCardHashes });
  }

  // Face + accessories peeking from bottom of verdict box
  await renderVerdictFace(topMood, userColor);

  // Face badge (island-style clipped circle, no accessories)
  renderCardFace(topMood, userColor);

  // Bottom row — face badge + name + stats
  document.getElementById('card-name').textContent = userName;
  document.getElementById('card-roasts').textContent = `${totalRoasts} Roasts`;
  document.getElementById('card-tabs').textContent = `${totalTabsSeen} Tabs`;

  // ── Card back: pattern generator face grid ──
  renderCardBackPattern();

  // ── Conclusion roast (beside the card) ──
  document.getElementById('card-conclusion').innerHTML = `
    <div class="card-conclusion-label">The Verdict</div>
    <div class="card-conclusion-text">${esc(generateConclusion(categories, traits, topTrait, totalRoasts, userName, topMood, topMoodPct))}</div>
  `;

  // ── 3D Tilt ──
  initTilt();

  // ── Flip ──
  const cardBody = document.getElementById('card-body');
  document.getElementById('card-flip-btn').addEventListener('click', () => {
    cardBody.classList.add('flip-transition');
    cardBody.classList.toggle('flipped');
    setTimeout(() => cardBody.classList.remove('flip-transition'), 700);
  });

  // ── Share menu ──
  const shareBtn = document.getElementById('card-share-btn');
  const shareMenu = document.getElementById('card-share-menu');
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shareMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    if (shareMenu && !shareMenu.classList.contains('hidden')) {
      shareMenu.classList.add('hidden');
    }
  });
  shareMenu.addEventListener('click', (e) => e.stopPropagation());
  shareMenu.addEventListener('click', async (e) => {
    const option = e.target.closest('.card-share-option');
    if (!option) return;
    const action = option.dataset.action;
    shareMenu.classList.add('hidden');
    if (action === 'copy') await copyCardImage();
    else if (action === 'twitter') await shareCardToTwitter();
    else if (action === 'download') await downloadCardImage();
  });

  // ── Inscription download ──
  cardState.cardId = `${Date.now()}-${verdictHash}`;
  cardState.userName = userName;
  cardState.userId = String(profile.user_id || '').slice(-6).toUpperCase();
  cardState.topTrait = topTrait;
  cardState.totalRoasts = totalRoasts;
  cardState.totalTabsSeen = totalTabsSeen;
  cardState.categories = categories;
  cardState.userColor = userColor;
  cardState.verdict = document.getElementById('card-verdict-text').textContent;
  cardState.faceSvg = document.getElementById('card-face-area').innerHTML;
  cardState.verdictFaceSvg = document.getElementById('card-verdict-face').innerHTML;

  // ── Inscription flow ──
  const inscribeBtn = document.getElementById('card-inscribe-btn');
  const overlay = document.getElementById('inscribe-overlay');
  const sizeEl = document.getElementById('inscribe-size');

  // Pre-compute file size for display
  const previewHtml = generateInscriptionHTML();
  const fileSizeKB = (new Blob([previewHtml]).size / 1024).toFixed(1);
  sizeEl.textContent = `Card file size: ${fileSizeKB} KB`;

  function closeInscribeModal() {
    overlay.classList.remove('open');
    stopPolling();
    // Reset to address step after a beat so the transition isn't visible
    setTimeout(() => showInscribeStep('address'), 300);
  }

  inscribeBtn.addEventListener('click', () => overlay.classList.add('open'));
  document.getElementById('inscribe-close-btn').addEventListener('click', closeInscribeModal);

  // Close overlay on background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeInscribeModal();
  });

  // Submit to OrdinalsBot
  document.getElementById('inscribe-submit-btn').addEventListener('click', submitInscription);

  // Payment step close
  document.getElementById('inscribe-pay-close').addEventListener('click', closeInscribeModal);

  // Error step buttons
  document.getElementById('inscribe-error-cancel').addEventListener('click', closeInscribeModal);
  document.getElementById('inscribe-error-download').addEventListener('click', downloadInscription);

})();

/* ── Strip SVG to only facial features (eyes, eyebrows, mouth) ── */
function extractFaceFeatures(svgContent) {
  let c = svgContent;
  // Remove <defs> blocks (clipPath definitions)
  c = c.replace(/<defs>[\s\S]*?<\/defs>/gi, '');
  // Remove <g clip-path="...">...</g> blocks (body highlights/shading)
  c = c.replace(/<g\s+clip-path="[^"]*">[\s\S]*?<\/g>/gi, '');
  // Remove all elements filled or stroked with body/limb/shadow/highlight colors
  const stripColors = [
    SOURCE_COLOR.body, SOURCE_COLOR.limb, SOURCE_COLOR.shadow, SOURCE_COLOR.highlight
  ];
  for (const color of stripColors) {
    const esc = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Remove elements with fill="color"
    c = c.replace(new RegExp(`<(?:path|ellipse|circle|rect)[^>]*?fill="${esc}"[^>]*?\\/?>`, 'gi'), '');
    // Remove elements with stroke="color"
    c = c.replace(new RegExp(`<(?:path|ellipse|circle|rect)[^>]*?stroke="${esc}"[^>]*?\\/?>`, 'gi'), '');
  }
  return c.trim();
}

/* ── Render face features + accessories in verdict box ── */
async function renderVerdictFace(mood, userColor) {
  const verdictFace = document.getElementById('card-verdict-face');
  const symbol = document.getElementById(`face-${mood}`);
  if (!verdictFace || !symbol) return;

  const vb = symbol.getAttribute('viewBox') || '-15 -10 150 140';

  // Extract only eyes, eyebrows, mouth — strip body blob, arms, legs, highlights
  const faceFeatures = extractFaceFeatures(symbol.innerHTML);

  // Add equipped accessories (recolored to user's color)
  let accSvg = '';
  let equipped = { hat: null, glasses: null };
  if (typeof JestyAccessories !== 'undefined') {
    await JestyAccessories.init();
    equipped = JestyAccessories.getEquipped();
  }
  for (const slot of ['hat', 'glasses']) {
    const accId = equipped[slot];
    if (!accId) continue;
    const accSymbol = document.getElementById(`acc-${accId}`);
    if (!accSymbol) continue;
    const anchor = getAccAnchor(accId, mood, slot);
    let accContent = accSymbol.innerHTML;
    accContent = recolorSvg(accContent, SOURCE_COLOR, userColor);
    let transform = `translate(${anchor.x}, ${anchor.y})`;
    if (anchor.rotate) {
      const accVb = accSymbol.getAttribute('viewBox');
      const [, , symW, symH] = accVb ? accVb.split(/\s+/).map(Number) : [0, 0, 44, 30];
      transform += ` rotate(${anchor.rotate}, ${symW / 2}, ${symH / 2})`;
    }
    accSvg += `<g transform="${transform}">${accContent}</g>`;
  }

  verdictFace.innerHTML = `<svg viewBox="${vb}">${faceFeatures}${accSvg}</svg>`;
}

/* ── Render plain face (no accessories) as island-style clipped badge ── */
function renderCardFace(mood, userColor) {
  const faceArea = document.getElementById('card-face-area');
  const symbol = document.getElementById(`face-${mood}`);
  if (!symbol || !faceArea) return;

  const vb = symbol.getAttribute('viewBox') || '-15 -10 150 140';
  let faceContent = symbol.innerHTML;
  faceContent = faceContent.replace(/id="clip-([^"]+)"/g, 'id="clip-$1-card"');
  faceContent = faceContent.replace(/url\(#clip-([^)]+)\)/g, 'url(#clip-$1-card)');
  faceContent = recolorSvg(faceContent, SOURCE_COLOR, userColor);

  faceArea.innerHTML = `<svg viewBox="${vb}">${faceContent}</svg>`;
}

/* ── Accessory anchor lookup (mirrors accessories.js logic) ── */
function getAccAnchor(accId, mood, slot) {
  // Per-accessory overrides
  const ACC_ANCHORS = {
    'bandana': {
      smug: { x: 35, y: 6, rotate: -3 }, suspicious: { x: 35, y: 4, rotate: 8 },
      yikes: { x: 37, y: -2, rotate: -2 }, eyeroll: { x: 33, y: 10, rotate: -5 },
      disappointed: { x: 37, y: 26, rotate: 2 }, melting: { x: 35, y: 8, rotate: -2 },
      dead: { x: 35, y: 10, rotate: 10 }, thinking: { x: 33, y: 6, rotate: -7 },
      happy: { x: 35, y: 2, rotate: -2 }, impressed: { x: 35, y: 6, rotate: -2 },
      manic: { x: 35, y: 4, rotate: -6 }, petty: { x: 35, y: 10, rotate: 5 },
      chaotic: { x: 37, y: 6, rotate: -10 }, dramatic: { x: 35, y: 8, rotate: 7 },
      tender: { x: 35, y: 8, rotate: -2 }
    },
    'beret': {
      smug: { x: 28, y: -8, rotate: -12 }, suspicious: { x: 28, y: -12, rotate: -6 },
      yikes: { x: 30, y: -16, rotate: -10 }, eyeroll: { x: 26, y: -6, rotate: -15 },
      disappointed: { x: 30, y: 12, rotate: -10 }, melting: { x: 28, y: -8, rotate: -12 },
      dead: { x: 28, y: -6, rotate: -4 }, thinking: { x: 26, y: -10, rotate: -17 },
      happy: { x: 28, y: -14, rotate: -12 }, impressed: { x: 28, y: -10, rotate: -12 },
      manic: { x: 28, y: -12, rotate: -16 }, petty: { x: 28, y: -6, rotate: -9 },
      chaotic: { x: 30, y: -10, rotate: -20 }, dramatic: { x: 28, y: -8, rotate: -7 },
      tender: { x: 28, y: -8, rotate: -12 }
    },
    'headband': {
      smug: { x: 30, y: 8, rotate: 0 }, suspicious: { x: 30, y: 6, rotate: 6 },
      yikes: { x: 32, y: 0, rotate: 0 }, eyeroll: { x: 28, y: 12, rotate: -3 },
      disappointed: { x: 32, y: 28, rotate: 0 }, melting: { x: 30, y: 10, rotate: 0 },
      dead: { x: 30, y: 12, rotate: 8 }, thinking: { x: 28, y: 8, rotate: -5 },
      happy: { x: 30, y: 4, rotate: 0 }, impressed: { x: 30, y: 8, rotate: 0 },
      manic: { x: 30, y: 6, rotate: -4 }, petty: { x: 30, y: 12, rotate: 3 },
      chaotic: { x: 32, y: 8, rotate: -8 }, dramatic: { x: 30, y: 10, rotate: 5 },
      tender: { x: 30, y: 10, rotate: 0 }
    }
  };

  // Default slot anchors
  const ANCHORS = {
    hat: {
      smug: { x: 36, y: -2, rotate: 0 }, suspicious: { x: 36, y: -6, rotate: 6 },
      yikes: { x: 38, y: -10, rotate: 0 }, eyeroll: { x: 34, y: 0, rotate: -3 },
      disappointed: { x: 38, y: 18, rotate: 0 }, melting: { x: 36, y: -2, rotate: 0 },
      dead: { x: 36, y: 0, rotate: 8 }, thinking: { x: 34, y: -4, rotate: -5 },
      happy: { x: 36, y: -8, rotate: 0 }, impressed: { x: 36, y: -4, rotate: 0 },
      manic: { x: 36, y: -6, rotate: -4 }, petty: { x: 36, y: 0, rotate: 3 },
      chaotic: { x: 38, y: -4, rotate: -8 }, dramatic: { x: 36, y: -2, rotate: 5 },
      tender: { x: 36, y: -2, rotate: 0 }
    },
    glasses: {
      smug: { x: 32, y: 42, rotate: 0 }, suspicious: { x: 32, y: 40, rotate: 3 },
      yikes: { x: 34, y: 34, rotate: 0 }, eyeroll: { x: 32, y: 44, rotate: -2 },
      disappointed: { x: 34, y: 54, rotate: 0 }, melting: { x: 32, y: 42, rotate: 0 },
      dead: { x: 32, y: 44, rotate: 5 }, thinking: { x: 32, y: 40, rotate: -3 },
      happy: { x: 32, y: 38, rotate: 0 }, impressed: { x: 32, y: 40, rotate: 0 },
      manic: { x: 32, y: 38, rotate: -3 }, petty: { x: 32, y: 42, rotate: 2 },
      chaotic: { x: 34, y: 40, rotate: -8 }, dramatic: { x: 32, y: 42, rotate: 5 },
      tender: { x: 32, y: 40, rotate: 0 }
    }
  };

  const map = ACC_ANCHORS[accId] || ANCHORS[slot];
  return (map && map[mood]) || (map && map['smug']) || { x: 0, y: 0, rotate: 0 };
}

/* ── Back backgrounds: 6 colors + dark + light ── */
const BACK_BACKGROUNDS = [
  { key: 'lime',   bg: '#EBF34F', exclude: 'lime' },
  { key: 'pink',   bg: '#FF8FA3', exclude: 'pink' },
  { key: 'sky',    bg: '#87CEEB', exclude: 'sky' },
  { key: 'purple', bg: '#A78BFA', exclude: 'purple' },
  { key: 'mint',   bg: '#34D399', exclude: 'mint' },
  { key: 'peach',  bg: '#FDBA74', exclude: 'peach' },
  { key: 'dark',   bg: '#1C1917', exclude: null },
  { key: 'light',  bg: '#FAF8F5', exclude: null },
];

/* ── Card back pattern: full face grid, no text, no transparency ── */
function renderCardBackPattern() {
  const cardBack = document.getElementById('card-back');
  const pattern = document.getElementById('card-back-pattern');
  if (!pattern || !cardBack) return;

  // Pick random background
  const bgChoice = BACK_BACKGROUNDS[Math.floor(Math.random() * BACK_BACKGROUNDS.length)];
  cardBack.style.background = bgChoice.bg;

  // Store for share image reuse
  cardState.backBg = bgChoice.bg;
  cardState.backExclude = bgChoice.exclude;

  // Build allowed color list — exclude the color matching the background
  const allowedColors = COLOR_KEYS.filter(k => k !== bgChoice.exclude);

  const rows = 18;
  const evenCols = 11;
  const oddCols = 10;

  let html = '';
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? evenCols : oddCols;
    const isOdd = r % 2 !== 0;
    html += `<div class="card-back-row${isOdd ? ' offset' : ''}">`;
    for (let c = 0; c < cols; c++) {
      const colorKey = allowedColors[Math.floor(Math.random() * allowedColors.length)];
      const expr = ALL_EXPRESSIONS[Math.floor(Math.random() * ALL_EXPRESSIONS.length)];
      const symbol = document.getElementById(`face-${expr}`);
      if (!symbol) continue;

      const uid = `bp-${r}-${c}`;
      let content = symbol.innerHTML;
      content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
      content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);
      content = recolorSvg(content, SOURCE_COLOR, SLOT_COLORS[colorKey]);

      html += `<div class="card-back-cell"><svg viewBox="-15 -10 150 140">${content}</svg></div>`;
    }
    html += '</div>';
  }

  pattern.innerHTML = html;
}

/* ── Recolor SVG content from source palette to target palette ── */
function recolorSvg(content, from, to) {
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    if (from[key] && to[key]) {
      content = content.replace(new RegExp(escapeRegex(from[key]), 'gi'), to[key]);
    }
  }
  return content;
}

/* ── 3D Tilt with constrained rotation ── */
function initTilt() {
  const scene = document.getElementById('card-scene');
  const body = document.getElementById('card-body');
  const glow = document.getElementById('card-glow');

  const MAX_TILT_X = 15;
  const MAX_TILT_Y = 12;

  let isDragging = false;
  let startX, startY;

  scene.addEventListener('mousemove', (e) => {
    if (isDragging || body.classList.contains('flipped')) return;
    const rect = scene.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const rotY = clamp((x - 0.5) * 2 * MAX_TILT_Y, -MAX_TILT_Y, MAX_TILT_Y);
    const rotX = clamp((0.5 - y) * 2 * MAX_TILT_X, -MAX_TILT_X, MAX_TILT_X);

    body.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    glow.style.setProperty('--glow-x', (x * 100) + '%');
    glow.style.setProperty('--glow-y', (y * 100) + '%');
  });

  scene.addEventListener('mouseleave', () => {
    if (!isDragging) {
      body.style.transition = 'transform 0.4s ease-out';
      body.style.transform = 'rotateX(0) rotateY(0)';
      setTimeout(() => body.style.transition = 'transform 0.1s ease-out', 400);
    }
  });

  scene.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    body.style.transition = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    body.style.transform = `rotateX(${clamp(-dy * 0.3, -MAX_TILT_X * 1.5, MAX_TILT_X * 1.5)}deg) rotateY(${clamp(dx * 0.3, -MAX_TILT_Y * 1.5, MAX_TILT_Y * 1.5)}deg)`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    body.style.transition = 'transform 0.4s ease-out';
    body.style.transform = 'rotateX(0) rotateY(0)';
    setTimeout(() => body.style.transition = 'transform 0.1s ease-out', 400);
  });

  scene.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = scene.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    body.style.transform = `rotateX(${clamp((0.5 - y) * 2 * MAX_TILT_X, -MAX_TILT_X, MAX_TILT_X)}deg) rotateY(${clamp((x - 0.5) * 2 * MAX_TILT_Y, -MAX_TILT_Y, MAX_TILT_Y)}deg)`;
  }, { passive: false });

  scene.addEventListener('touchend', () => {
    body.style.transition = 'transform 0.4s ease-out';
    body.style.transform = 'rotateX(0) rotateY(0)';
    setTimeout(() => body.style.transition = 'transform 0.1s ease-out', 400);
  });
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/* ── Rarity from trait score ── */
function getRarityLabel(score) {
  if (score >= 0.8) return '★ LEGENDARY';
  if (score >= 0.6) return '★ RARE';
  if (score >= 0.4) return '★ UNCOMMON';
  return '★ COMMON';
}

/* ── Simple string hash for deduplication ── */
function hashVerdict(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

/* ── Card verdict (depth roast — the H1 of the card) ── */
function generateCardVerdict(categories, traits, topTrait, totalRoasts, topMood, usedHashes) {
  const allVerdicts = _buildVerdictCandidates(categories, traits, topTrait, totalRoasts, topMood);

  // Try to find one that hasn't been used
  const unused = allVerdicts.filter(v => !usedHashes.includes(hashVerdict(v)));
  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)];
  }

  // All used — pick random (very unlikely with enough templates)
  return allVerdicts[Math.floor(Math.random() * allVerdicts.length)];
}

function _buildVerdictCandidates(categories, traits, topTrait, totalRoasts, topMood) {
  const top = categories[0];
  const second = categories[1];
  const topName = top ? formatCat(top.name || top.category || '') : '';
  const secName = second ? formatCat(second.name || second.category || '') : '';
  const traitPct = Math.round(topTrait.val * 100);
  const candidates = [];

  if (top && second && topTrait.val > 0.5) {
    candidates.push(
      `${traitPct}% ${topTrait.label.toLowerCase()}. ${topName} leads your tabs. This isn't a hobby, it's a diagnosis.`,
      `${topName} on top, ${secName} pretending to help. You're ${traitPct}% ${topTrait.label.toLowerCase()} and the data doesn't lie.`,
      `Your browser says ${topName}. Your soul says ${secName}. Jesty says ${traitPct}% ${topTrait.label.toLowerCase()}.`,
    );
  }

  if (topTrait.val > 0.6) {
    candidates.push(`${traitPct}% ${topTrait.label.toLowerCase()}. ${totalRoasts} roasts and zero signs of change.`);
  }

  if (totalRoasts > 100) {
    candidates.push(`${totalRoasts} roasts survived. You've been judged more than a reality show contestant.`);
  }

  candidates.push(`Still under investigation. But the early evidence isn't looking great.`);

  return candidates;
}

/* ── Conclusion roast (long-form, beside the card) ── */
function generateConclusion(categories, traits, topTrait, totalRoasts, name, topMood, topMoodPct) {
  const parts = [];
  const traitPct = Math.round(topTrait.val * 100);

  if (totalRoasts > 200) {
    parts.push(`${name}, after ${totalRoasts} roasts, Jesty has compiled enough evidence to write a biography.`);
  } else if (totalRoasts > 50) {
    parts.push(`${name}, ${totalRoasts} roasts in and the pattern is clear.`);
  } else {
    parts.push(`${name}, it's early, but the signs are already there.`);
  }

  if (topTrait.val > 0.5) {
    const traitLines = {
      'procrastinator_score': `You score ${traitPct}% on procrastination. That's not a flaw, that's a talent you've been perfecting your whole life.`,
      'night_owl_score': `${traitPct}% night owl. The sun has filed a missing persons report.`,
      'tab_hoarder_score': `${traitPct}% tab hoarder. Every tab is a promise to your future self that present-you has no intention of keeping.`,
      'impulse_shopper_score': `${traitPct}% impulse shopper. Your browser history reads like a credit card statement you're afraid to open.`
    };
    parts.push(traitLines[topTrait.key] || `Your dominant trait is ${topTrait.label.toLowerCase()} at ${traitPct}%. Noted.`);
  }

  if (topMoodPct > 40) {
    const moodLines = {
      'smug': `Jesty's been smug ${topMoodPct}% of the time. You make it too easy.`,
      'suspicious': `${topMoodPct}% suspicious. Your tabs raise questions. Jesty has concerns.`,
      'yikes': `${topMoodPct}% yikes. Your browsing regularly triggers secondhand embarrassment.`,
      'disappointed': `${topMoodPct}% disappointed. Jesty expected more from you. Jesty was wrong.`,
      'eyeroll': `${topMoodPct}% eyeroll. You're predictable in the most unpredictable way.`,
      'melting': `${topMoodPct}% melting. Your tab situation is genuinely overwhelming.`,
      'dead': `${topMoodPct}% dead inside. Your tabs did that to Jesty.`,
    };
    if (moodLines[topMood]) parts.push(moodLines[topMood]);
  }

  const top = categories[0];
  if (top && top.count > 10) {
    const catName = formatCat(top.name || top.category || '');
    parts.push(`${catName} dominates your browsing with ${top.count} tabs spotted. At this point it's not a category, it's a lifestyle.`);
  }

  parts.push(`But hey, you keep coming back. And that's either resilience or something Jesty should be worried about.`);

  return parts.join(' ');
}

/* ── Share: canvas-based image generation ── */

function generateCardShareBlob() {
  return new Promise(async (resolve, reject) => {
    try {
      const s = cardState;
      const uc = s.userColor;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1080;
      canvas.height = 1350;

      // ── Thick gold border (matches card back) ──
      const borderW = 16;
      const borderColor = '#D4A843';
      const borderInner = '#E8C96A';

      // Outer gold border
      ctx.fillStyle = borderColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Inner gold inset line
      ctx.strokeStyle = borderInner;
      ctx.lineWidth = 4;
      roundRect(ctx, borderW - 2, borderW - 2, canvas.width - (borderW - 2) * 2, canvas.height - (borderW - 2) * 2, 4);
      ctx.stroke();

      // ── Background: identical to card back (same bg color + face grid) ──
      const backBg = s.backBg || '#1C1917';
      const backExclude = s.backExclude || null;

      // Inset area for pattern
      const insetX = borderW;
      const insetY = borderW;
      const insetW = canvas.width - borderW * 2;
      const insetH = canvas.height - borderW * 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(insetX, insetY, insetW, insetH);
      ctx.clip();

      ctx.fillStyle = backBg;
      ctx.fillRect(insetX, insetY, insetW, insetH);

      // Same tile grid as card back — full opacity, honeycomb offset
      const tileSize = 54;
      const cols = Math.ceil(insetW / tileSize) + 2;
      const rows = Math.ceil(insetH / tileSize) + 1;
      const allowedColorKeys = COLOR_KEYS.filter(k => k !== backExclude);
      const patternFaces = await renderPatternTiles(cols, rows, tileSize, allowedColorKeys);
      if (patternFaces) {
        ctx.drawImage(patternFaces, insetX, insetY);
      }

      // ── Holographic shimmer (30% chance) ──
      if (Math.random() < 0.3) {
        const holo = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        holo.addColorStop(0,    'rgba(255, 100, 150, 0.18)');
        holo.addColorStop(0.2,  'rgba(255, 200, 80,  0.15)');
        holo.addColorStop(0.4,  'rgba(100, 255, 150, 0.18)');
        holo.addColorStop(0.6,  'rgba(80,  180, 255, 0.18)');
        holo.addColorStop(0.8,  'rgba(180, 100, 255, 0.15)');
        holo.addColorStop(1,    'rgba(255, 100, 180, 0.18)');
        ctx.fillStyle = holo;
        ctx.fillRect(insetX, insetY, insetW, insetH);

        // Second pass — perpendicular sweep for depth
        const holo2 = ctx.createLinearGradient(canvas.width, 0, 0, canvas.height);
        holo2.addColorStop(0,   'rgba(120, 255, 220, 0.12)');
        holo2.addColorStop(0.3, 'rgba(255, 255, 100, 0.10)');
        holo2.addColorStop(0.5, 'rgba(255, 120, 200, 0.12)');
        holo2.addColorStop(0.7, 'rgba(100, 200, 255, 0.10)');
        holo2.addColorStop(1,   'rgba(200, 120, 255, 0.12)');
        ctx.fillStyle = holo2;
        ctx.fillRect(insetX, insetY, insetW, insetH);
      }

      ctx.restore();

      // ── Card front (centered, scaled up) ──
      const cardW = 640;
      const cardH = 920;
      const cardX = (canvas.width - cardW) / 2;
      const cardY = (canvas.height - cardH) / 2;
      const cardR = 32;

      // Card shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 16;
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = '#FFFDF9';
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Card border (thick, secondary bg color)
      ctx.strokeStyle = '#F0EDEA';
      ctx.lineWidth = 10;
      roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.stroke();

      // ── Verdict box (user color rectangle) ──
      const vMargin = 20;
      const vTop = cardY + 12;
      const vLeft = cardX + vMargin;
      const vWidth = cardW - vMargin * 2;
      const vHeight = cardH - 90;
      const vRadius = 20;

      roundRect(ctx, vLeft, vTop, vWidth, vHeight, vRadius);
      ctx.fillStyle = uc.body;
      ctx.fill();

      // ── Verdict face (centered at bottom of verdict box) ──
      const verdictFaceEl = document.getElementById('card-verdict-face');
      if (verdictFaceEl && verdictFaceEl.innerHTML) {
        const faceSvg = verdictFaceEl.innerHTML;
        const faceImg = await svgToImage(faceSvg, '-15 -10 150 140', 200, 200);
        if (faceImg) {
          const faceX = vLeft + (vWidth - 200) / 2;
          const faceY = vTop + vHeight - 200 - 12;
          ctx.drawImage(faceImg, faceX, faceY, 200, 200);
        }
      }

      // ── Verdict text ──
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 40px "DM Sans", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const maxTextW = vWidth - 60;
      const lineHeight = 54;
      const words = s.verdict.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxTextW && line !== '') {
          lines.push(line.trim());
          line = word + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      const totalTextH = lines.length * lineHeight;
      const textY = vTop + (vHeight - totalTextH) / 2 - 20;
      lines.forEach((l, i) => ctx.fillText(l, vLeft + vWidth / 2, textY + i * lineHeight));

      // ── Bottom row: face badge + name + stat pills ──
      const bottomY = vTop + vHeight + 16;

      // Face badge (dark circle with face)
      const badgeR = 36;
      const badgeX = cardX + vMargin + badgeR;
      const badgeY = bottomY + badgeR / 2 + 2;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#1C1917';
      ctx.fill();

      // Draw face inside badge via clipping
      const faceAreaEl = document.getElementById('card-face-area');
      if (faceAreaEl && faceAreaEl.innerHTML) {
        const badgeFace = await svgToImage(faceAreaEl.innerHTML, '-15 -10 150 140', badgeR * 4, badgeR * 3.7);
        if (badgeFace) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(badgeFace, badgeX - badgeR * 2 + 7, badgeY - badgeR * 0.7, badgeR * 4, badgeR * 3.7);
          ctx.restore();
        }
      }

      // Name
      ctx.fillStyle = '#6B6560';
      ctx.font = '700 22px "DM Sans", -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.userName, badgeX + badgeR + 12, badgeY);

      // Stat pills
      const pillY = badgeY;
      ctx.textAlign = 'right';
      ctx.font = '700 18px "DM Sans", -apple-system, sans-serif';

      const tabsPill = `${s.totalTabsSeen} Tabs`;
      const roastsPill = `${s.totalRoasts} Roasts`;
      const pillPad = 16;
      const pillH = 28;
      const pillR = 14;

      // Tabs pill (rightmost)
      const tabsW = ctx.measureText(tabsPill).width + pillPad * 2;
      const tabsX = cardX + cardW - vMargin;
      drawPill(ctx, tabsX - tabsW, pillY - pillH / 2, tabsW, pillH, pillR, '#F0EDEA', '#9C968F', tabsPill);

      // Roasts pill
      const roastsW = ctx.measureText(roastsPill).width + pillPad * 2;
      const roastsX = tabsX - tabsW - 8;
      drawPill(ctx, roastsX - roastsW, pillY - pillH / 2, roastsW, pillH, pillR, '#F0EDEA', '#9C968F', roastsPill);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/* ── Render background pattern tiles as a single SVG → canvas ── */
function renderPatternTiles(cols, rows, tileSize, allowedColorKeys) {
  return new Promise((resolve) => {
    try {
      const totalW = (cols + 1) * tileSize;
      const totalH = rows * tileSize;
      const expressions = ALL_EXPRESSIONS;

      // Build one big SVG with all tiles as nested <svg> elements
      let innerSvg = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const expr = expressions[Math.floor(Math.random() * expressions.length)];
          const colorKey = allowedColorKeys[Math.floor(Math.random() * allowedColorKeys.length)];
          const color = SLOT_COLORS[colorKey];
          const symbol = document.getElementById(`face-${expr}`);
          if (!symbol) continue;

          const uid = `sp${r}_${c}`;
          let content = symbol.innerHTML;
          content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
          content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);
          content = recolorSvg(content, SOURCE_COLOR, color);

          const x = c * tileSize + (r % 2 === 1 ? Math.floor(tileSize / 2) : 0);
          const y = r * tileSize;

          innerSvg += `<svg x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" viewBox="-15 -10 150 140">${content}</svg>`;
        }
      }

      const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">${innerSvg}</svg>`;
      const blob = new Blob([fullSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const offscreen = document.createElement('canvas');
        offscreen.width = totalW;
        offscreen.height = totalH;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(offscreen);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/* ── Convert SVG content to Image element ── */
function svgToImage(svgContent, viewBox, width, height) {
  return new Promise((resolve) => {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${svgContent}</svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ── Draw a rounded rect path ── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Draw a stat pill ── */
function drawPill(ctx, x, y, w, h, r, bg, textColor, text) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = '700 18px "DM Sans", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

/* ── Share actions ── */
async function copyCardImage() {
  try {
    const blob = await generateCardShareBlob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showShareCheck();
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

async function shareCardToTwitter() {
  try {
    const blob = await generateCardShareBlob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showShareCheck();
  } catch (e) { /* best-effort clipboard copy */ }
  const text = `"${cardState.verdict}" — Jesty read my tabs and made me a trading card`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

async function downloadCardImage() {
  try {
    const blob = await generateCardShareBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jesty-card-${cardState.userId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Download failed:', e);
  }
}

function showShareCheck() {
  const btn = document.getElementById('card-share-btn');
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1500);
}

/* ── Inscription: self-contained HTML for Bitcoin ordinals ── */
function generateInscriptionHTML() {
  const s = cardState;
  const uc = s.userColor;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Jesty Card — ${esc(s.userName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--uc:${uc.body};--ucs:${uc.shadow};--uch:${uc.highlight}}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1C1917;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card-scene{perspective:1200px;width:320px;height:460px;cursor:grab}
.card-front{width:100%;height:100%;position:relative;border-radius:16px;overflow:hidden;background:#FFFDF9;color:#1C1917;border:5px solid #F0EDEA;box-shadow:0 8px 40px rgba(0,0,0,.15),0 2px 8px rgba(0,0,0,.1);transform-style:preserve-3d;transition:transform .1s ease-out;display:flex;flex-direction:column}
.card-glow{position:absolute;inset:0;pointer-events:none;z-index:10;border-radius:14px;opacity:0;transition:opacity .3s;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.3) 0%,transparent 60%)}
.card-scene:hover .card-glow{opacity:1}
.card-verdict{position:relative;margin:6px 10px 0;flex:1;display:flex;align-items:center;justify-content:center;background:var(--uc);border-radius:10px;overflow:hidden}
.card-verdict-face{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);pointer-events:none}
.card-verdict-face svg{width:100px;height:100px}
.card-verdict-text{position:relative;z-index:1;font-size:22px;font-weight:800;text-align:center;line-height:1.35;color:#1C1917;padding:20px 16px 24px}
.card-face-badge{width:36px;height:36px;flex-shrink:0;border-radius:50%;overflow:hidden;background:#1C1917;display:flex;align-items:center;justify-content:center;position:relative}
.card-face-badge svg{width:144px;height:132px;flex-shrink:0;margin-top:24px;margin-left:-14px}
.card-bottom-row{display:flex;align-items:center;gap:8px;padding:10px 14px}
.card-name{font-size:11px;font-weight:700;color:#6B6560;flex:1}
.card-stat-pill{font-size:9px;font-weight:700;color:#9C968F;background:#F0EDEA;padding:3px 8px;border-radius:10px}
</style>
</head>
<body>
<div class="card-scene" id="cs">
<div class="card-front" id="cf">
<div class="card-glow" id="cg"></div>
<div class="card-verdict">
<div class="card-verdict-face">${s.verdictFaceSvg}</div>
<span class="card-verdict-text">${esc(s.verdict)}</span>
</div>
<div class="card-bottom-row">
<div class="card-face-badge">${s.faceSvg}</div>
<span class="card-name">${esc(s.userName)}</span>
<span class="card-stat-pill">${s.totalRoasts} Roasts</span>
<span class="card-stat-pill">${s.totalTabsSeen} Tabs</span>
</div>
</div>
</div>
<script>
(function(){
var sc=document.getElementById('cs'),cf=document.getElementById('cf'),gl=document.getElementById('cg');
var MX=15,MY=12;
function cl(v,mn,mx){return Math.min(mx,Math.max(mn,v))}
sc.addEventListener('mousemove',function(e){
var r=sc.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
cf.style.transform='rotateX('+cl((.5-y)*2*MX,-MX,MX)+'deg) rotateY('+cl((x-.5)*2*MY,-MY,MY)+'deg)';
gl.style.setProperty('--gx',(x*100)+'%');gl.style.setProperty('--gy',(y*100)+'%');
});
sc.addEventListener('mouseleave',function(){
cf.style.transition='transform .4s ease-out';cf.style.transform='rotateX(0) rotateY(0)';
setTimeout(function(){cf.style.transition='transform .1s ease-out'},400);
});
sc.addEventListener('touchmove',function(e){
e.preventDefault();var t=e.touches[0],r=sc.getBoundingClientRect();
var x=(t.clientX-r.left)/r.width,y=(t.clientY-r.top)/r.height;
cf.style.transform='rotateX('+cl((.5-y)*2*MX,-MX,MX)+'deg) rotateY('+cl((x-.5)*2*MY,-MY,MY)+'deg)';
},{passive:false});
sc.addEventListener('touchend',function(){
cf.style.transition='transform .4s ease-out';cf.style.transform='rotateX(0) rotateY(0)';
setTimeout(function(){cf.style.transition='transform .1s ease-out'},400);
});
})();
</script>
</body>
</html>`;
}

function downloadInscription() {
  const html = generateInscriptionHTML();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jesty-card-${cardState.userId}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Show/hide inscription modal steps ── */
function showInscribeStep(step) {
  for (const s of ['address', 'loading', 'payment', 'error']) {
    const el = document.getElementById(`inscribe-step-${s}`);
    if (el) el.style.display = s === step ? '' : 'none';
  }
}

/* ── Validate Bitcoin address (basic check) ── */
function isValidBtcAddress(addr) {
  if (!addr) return false;
  // bc1 (bech32/taproot) | 3... (P2SH) | 1... (P2PKH)
  return /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr);
}

/* ── Fetch BTC/USD price ── */
async function fetchBtcPrice() {
  if (btcPriceUsd) return btcPriceUsd;
  try {
    const res = await fetch('https://mempool.space/api/v1/prices');
    const data = await res.json();
    btcPriceUsd = data.USD;
    return btcPriceUsd;
  } catch {
    try {
      // Fallback: CoinGecko
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await res.json();
      btcPriceUsd = data.bitcoin.usd;
      return btcPriceUsd;
    } catch {
      return null;
    }
  }
}

/* ── Format sats as USD (primary) + sats (secondary) ── */
function formatUsd(sats) {
  if (!btcPriceUsd || !sats) return formatSatsFallback(sats);
  const usd = (sats / 100000000) * btcPriceUsd;
  return `$${usd.toFixed(2)}`;
}

function formatSatsSecondary(sats) {
  return `${sats.toLocaleString()} sats`;
}

function formatSatsFallback(sats) {
  if (!sats) return '—';
  return sats.toLocaleString() + ' sats';
}

/* ── Render a payment amount cell (USD primary + sats secondary) ── */
function renderPaymentAmount(elId, sats) {
  const el = document.getElementById(elId);
  if (!el) return;
  const usd = formatUsd(sats);
  const satsText = formatSatsSecondary(sats);
  if (btcPriceUsd) {
    el.innerHTML = `${usd} <span class="inscribe-pay-sats">${satsText}</span>`;
  } else {
    el.textContent = satsText;
  }
}

/* ── Active polling state ── */
let inscriptionPollTimer = null;

function stopPolling() {
  if (inscriptionPollTimer) {
    clearInterval(inscriptionPollTimer);
    inscriptionPollTimer = null;
  }
}

/* ── Submit inscription order to OrdinalsBot ── */
async function submitInscription() {
  const addressInput = document.getElementById('inscribe-address');
  const errorEl = document.getElementById('inscribe-error');
  const address = addressInput.value.trim();

  // Validate
  if (!address) {
    errorEl.textContent = 'Please enter a Bitcoin address.';
    addressInput.focus();
    return;
  }
  if (!isValidBtcAddress(address)) {
    errorEl.textContent = 'Invalid Bitcoin address. Use a bc1, 3, or 1 address.';
    addressInput.focus();
    return;
  }
  errorEl.textContent = '';

  // Show loading
  showInscribeStep('loading');

  try {
    // Validate verdict uniqueness globally before inscribing
    const verdictText = cardState.verdict;
    const vHash = hashVerdict(verdictText);
    try {
      const checkRes = await fetch(`${PROXY_BASE}/api/verdict/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: vHash, verdict: verdictText })
      });
      const checkData = await checkRes.json();
      if (checkData.duplicate) {
        showInscribeStep('address');
        errorEl.textContent = 'This verdict has already been inscribed. Reload the card page to generate a new one.';
        return;
      }
    } catch (e) {
      // If API is unreachable, allow inscription (don't block on network failure)
      console.warn('Verdict uniqueness check failed, proceeding:', e.message);
    }

    // Fetch BTC price for USD display
    await fetchBtcPrice();

    // Generate the HTML and convert to base64 dataURL
    const html = generateInscriptionHTML();
    const base64 = btoa(unescape(encodeURIComponent(html)));
    const dataURL = `data:text/html;base64,${base64}`;
    const fileName = `jesty-card-${cardState.userId}.html`;
    const fileSize = new Blob([html]).size;

    // Create inscription order via OrdinalsBot API
    // additionalFee = Jesty platform fee, routed to referral account
    const orderBody = {
      files: [{
        dataURL: dataURL,
        name: fileName,
        size: fileSize,
        type: 'text/html'
      }],
      receiveAddress: address,
      fee: 10,
      postage: 546,
      additionalFee: JESTY_FEE_SATS
    };
    if (JESTY_REFERRAL !== 'YOUR_REFERRAL_CODE') {
      orderBody.referral = JESTY_REFERRAL;
    }

    const response = await fetch('https://api.ordinalsbot.com/inscribe', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderBody)
    });

    const result = await response.json();

    if (!response.ok || result.status === 'error') {
      throw new Error(result.error || result.message || 'Order creation failed');
    }

    if (!result.id) {
      throw new Error('No order ID returned');
    }

    // Show payment step with amounts (USD primary, sats secondary)
    const chainFee = result.chainFee || 0;
    const serviceFee = result.serviceFee || 0;
    const totalAmount = result.charge?.amount || (chainFee + serviceFee + JESTY_FEE_SATS);

    renderPaymentAmount('inscribe-pay-amount', totalAmount);
    renderPaymentAmount('inscribe-pay-chain', chainFee);
    renderPaymentAmount('inscribe-pay-service', serviceFee);
    renderPaymentAmount('inscribe-pay-jesty', JESTY_FEE_SATS);
    document.getElementById('inscribe-order-id').textContent = result.id;

    // Address may not be available yet — show placeholder and start polling
    const addressEl = document.getElementById('inscribe-pay-address');
    addressEl.textContent = 'Fetching address…';
    document.getElementById('inscribe-pay-qr').innerHTML = '';

    showInscribeStep('payment');

    // Poll for charge address + payment status
    pollOrderStatus(result.id);

  } catch (err) {
    console.error('Inscription order failed:', err);
    document.getElementById('inscribe-error-msg').textContent =
      `${err.message || 'Something went wrong'}. You can download the HTML file and inscribe it manually on any ordinals service.`;
    showInscribeStep('error');
  }
}

/* ── Poll OrdinalsBot for charge address and payment status ── */
function pollOrderStatus(orderId) {
  stopPolling();

  let addressFound = false;

  async function check() {
    try {
      const res = await fetch(`https://api.ordinalsbot.com/order?id=${encodeURIComponent(orderId)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();

      // Extract charge address when available
      if (!addressFound && data.charge?.address) {
        addressFound = true;
        const addr = data.charge.address;
        const amount = data.charge.amount || 0;

        document.getElementById('inscribe-pay-address').textContent = addr;

        // Update amount if refined
        if (amount) {
          renderPaymentAmount('inscribe-pay-amount', amount);
        }

        // Generate QR code (simple SVG-based — no external lib)
        generateBtcQR(addr, amount);

        // Wire copy button
        document.getElementById('inscribe-copy-btn').onclick = () => {
          navigator.clipboard.writeText(addr).then(() => {
            const btn = document.getElementById('inscribe-copy-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
          });
        };
      }

      // Check payment status
      const statusEl = document.getElementById('inscribe-pay-status');
      const state = data.state || '';

      if (data.paid || state === 'completed') {
        stopPolling();
        statusEl.className = 'inscribe-pay-status paid';
        statusEl.innerHTML = '<span>Payment confirmed! Your inscription is being processed.</span>';
        // Confirm verdict reservation permanently
        const vHash = hashVerdict(cardState.verdict);
        fetch(`${PROXY_BASE}/api/verdict/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: vHash })
        }).catch(() => {});
      } else if (state === 'waiting-confirmation') {
        statusEl.innerHTML = '<div class="inscribe-spinner inscribe-spinner-sm"></div><span>Payment detected, waiting for confirmation…</span>';
      } else if (state === 'prep' || state === 'queued') {
        stopPolling();
        statusEl.className = 'inscribe-pay-status paid';
        statusEl.innerHTML = '<span>Inscribing your card on Bitcoin…</span>';
      } else if (state === 'expired' || state === 'cancelled') {
        stopPolling();
        statusEl.innerHTML = '<span>Order expired or cancelled.</span>';
      }

    } catch (e) {
      console.warn('Poll error:', e);
    }
  }

  // First check immediately, then every 5 seconds
  check();
  inscriptionPollTimer = setInterval(check, 5000);
}

/* ── Simple BTC QR code as bitcoin: URI image ── */
function generateBtcQR(address, amountSats) {
  const qrContainer = document.getElementById('inscribe-pay-qr');
  // Use a bitcoin: URI — QR rendered via a third-party service image
  // This is a lightweight approach: encode as a simple URI QR via Google Charts API alternative
  const btcAmount = amountSats / 100000000;
  const uri = `bitcoin:${address}?amount=${btcAmount.toFixed(8)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uri)}`;
  qrContainer.innerHTML = `<img src="${qrUrl}" width="160" height="160" alt="QR Code" style="border-radius:8px">`;
}

/* ── Helpers ── */
function formatCat(raw) {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
