/**
 * Jesty Memory Match — Fun Zone Game 1
 * Find matching character pairs in a grid.
 */
const JestyMemoryGame = (() => {
  'use strict';

  // ── Expressions & Colors ──

  const EXPRESSIONS = [
    'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed',
    'melting', 'dead', 'thinking', 'happy', 'impressed',
    'manic', 'petty', 'chaotic', 'dramatic', 'tender'
  ];

  const COLORS = {
    lime:   { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
    pink:   { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
    sky:    { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' },
    purple: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' },
    mint:   { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
    peach:  { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' },
  };

  const COLOR_KEYS = Object.keys(COLORS);

  const ACCESSORIES = [
    { id: 'party-hat', symbolId: 'acc-party-hat', slot: 'hat' },
    { id: 'sunglasses', symbolId: 'acc-sunglasses', slot: 'glasses' },
    { id: 'beanie', symbolId: 'acc-beanie', slot: 'hat' },
    { id: 'monocle', symbolId: 'acc-monocle', slot: 'glasses' },
    { id: 'crown', symbolId: 'acc-crown', slot: 'hat' },
    { id: 'detective-hat', symbolId: 'acc-detective-hat', slot: 'hat' },
    { id: 'top-hat', symbolId: 'acc-top-hat', slot: 'hat' },
    { id: 'halo', symbolId: 'acc-halo', slot: 'hat' },
  ];

  const ANCHORS = {
    hat:     { x: 38, y: -2 },
    glasses: { x: 32, y: 42 },
  };

  // ── Level Definitions ──

  const LEVELS = [
    { rows: 2, cols: 2, pairs: 2,  useColor: false, useAccessory: false, par: 8,  peek: 1500 },
    { rows: 2, cols: 3, pairs: 3,  useColor: false, useAccessory: false, par: 12, peek: 1500 },
    { rows: 3, cols: 4, pairs: 6,  useColor: true,  useAccessory: false, par: 24, peek: 1500 },
    { rows: 4, cols: 4, pairs: 8,  useColor: true,  useAccessory: false, par: 32, peek: 2500 },
    { rows: 4, cols: 5, pairs: 10, useColor: true,  useAccessory: true,  par: 40, peek: 2500 },
    { rows: 4, cols: 5, pairs: 10, useColor: true,  useAccessory: true,  par: 40, peek: 2500 },
    { rows: 5, cols: 6, pairs: 15, useColor: true,  useAccessory: true,  par: 60, peek: 2500 },
    { rows: 6, cols: 6, pairs: 18, useColor: true,  useAccessory: true,  par: 72, peek: 2500 },
  ];

  const COMPLETION_ROASTS = {
    perfect: [
      "Flawless. Your memory is better than your browsing habits.",
      "Zero mistakes. If only your tab management was this clean.",
      "Perfect score? Did you cheat? I'm impressed and suspicious.",
    ],
    good: [
      "Not bad. Your brain works better than your browser.",
      "Almost perfect. I'll allow it.",
      "Decent memory. Now use it to remember to close your tabs.",
    ],
    okay: [
      "Took you long enough. At least you finished.",
      "That was... an attempt. Very on-brand for you.",
      "You got there eventually. Like closing a tab you opened 3 days ago.",
    ]
  };

  // ── State ──

  let state = {
    screen: 'level-select',
    currentLevel: 0,
    cards: [],
    flippedIndices: [],
    matchedPairs: 0,
    totalPairs: 0,
    moves: 0,
    mistakes: 0,
    streak: 0,
    startTime: null,
    timerInterval: null,
    isLocked: false,
  };

  let progress = { highestLevel: 1, levels: {} };
  let sourceColor = null; // set at init from the page's currentColor

  // ── Storage ──

  async function loadProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      if (jestyFunZone && jestyFunZone.memoryGame) {
        progress = jestyFunZone.memoryGame;
      }
    } catch (e) { /* fresh start */ }
  }

  async function saveProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      const data = jestyFunZone || {};
      data.memoryGame = progress;
      await chrome.storage.local.set({ jestyFunZone: data });
    } catch (e) { /* non-critical */ }
  }

  // ── Init ──

  async function init() {
    await loadProgress();

    // Grab the current character color as recolor source
    // (shared SVG symbols have been recolored to this)
    if (typeof currentColor !== 'undefined') {
      sourceColor = { ...currentColor };
    } else {
      sourceColor = { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };
    }

    // Wire overlay close / backdrop
    const closeBtn = document.getElementById('memory-overlay-close');
    const backdrop = document.getElementById('memory-overlay-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (backdrop) backdrop.addEventListener('click', hide);

    // Wire back button
    const backBtn = document.getElementById('memory-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (state.screen === 'playing' || state.screen === 'complete') {
        stopTimer();
        showLevelSelect();
      }
    });
  }

  // ── Show / Hide Overlay ──

  function show() {
    // Re-sync source color in case user changed it
    if (typeof currentColor !== 'undefined') {
      sourceColor = { ...currentColor };
    }
    const overlay = document.getElementById('memory-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      showLevelSelect();
    }
  }

  function hide() {
    stopTimer();
    const overlay = document.getElementById('memory-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── Level Select Screen ──

  async function showLevelSelect() {
    state.screen = 'level-select';
    stopTimer();

    setTitle('Memory Match');
    showBackBtn(false);
    showScreen('memory-level-select');

    const isPremium = typeof JestyPremium !== 'undefined' ? await JestyPremium.isPremium() : false;

    const grid = document.getElementById('memory-levels-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = i + 1;
      const isPremiumLocked = lvl >= 6 && !isPremium;
      const isUnlocked = lvl <= progress.highestLevel && !isPremiumLocked;
      const levelData = progress.levels[lvl];

      const btn = document.createElement('button');
      btn.className = 'memory-level-btn';
      if (!isUnlocked) btn.classList.add('locked');
      if (isPremiumLocked) btn.classList.add('premium-locked');
      if (levelData && !isPremiumLocked) btn.classList.add('completed');

      let starsHtml = '';
      if (levelData && levelData.stars && !isPremiumLocked) {
        starsHtml = '<div class="memory-level-stars">';
        for (let s = 0; s < 3; s++) {
          starsHtml += `<span class="memory-star ${s < levelData.stars ? 'earned' : ''}">${s < levelData.stars ? '★' : '☆'}</span>`;
        }
        starsHtml += '</div>';
      }

      btn.innerHTML = `
        <span class="memory-level-number">${lvl}</span>
        ${starsHtml}
        ${!isUnlocked ? '<svg class="memory-lock-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : ''}
      `;

      if (isUnlocked) {
        btn.addEventListener('click', () => startLevel(i));
      }
      grid.appendChild(btn);
    }

    // Paywall banner for free users
    const existingPaywall = document.querySelector('.memory-paywall');
    if (existingPaywall) existingPaywall.remove();

    if (!isPremium) {
      const paywall = document.createElement('div');
      paywall.className = 'memory-paywall';
      paywall.innerHTML = `
        <p class="memory-paywall-text">Plead Guilty to unlock the harder difficulties</p>
        <button class="memory-paywall-btn">See plans</button>
      `;
      paywall.querySelector('.memory-paywall-btn').addEventListener('click', () => {
        if (typeof showTierOverlayPlans === 'function') showTierOverlayPlans();
      });
      grid.parentNode.appendChild(paywall);
    }

    // Set character expression
    setGameCharacter('smug');
  }

  // ── Start Level ──

  function startLevel(levelIndex) {
    const level = LEVELS[levelIndex];
    state = {
      screen: 'playing',
      currentLevel: levelIndex,
      cards: generateCards(levelIndex),
      flippedIndices: [],
      matchedPairs: 0,
      totalPairs: level.pairs,
      moves: 0,
      mistakes: 0,
      streak: 0,
      startTime: null,
      timerInterval: null,
      isLocked: true, // locked during peek
    };

    setTitle(`Level ${levelIndex + 1}`);
    showBackBtn(true);
    showScreen('memory-game-board');
    renderBoard(levelIndex);
    updateStats();

    setGameCharacter('thinking');

    // Peek: show all cards briefly, then flip down
    const cardEls = document.querySelectorAll('#memory-grid .memory-card');
    cardEls.forEach(c => c.classList.add('flipped'));

    setTimeout(() => {
      cardEls.forEach(c => c.classList.remove('flipped'));
      state.isLocked = false;
      setGameCharacter('smug');
    }, level.peek);
  }

  // ── Card Generation ──

  function generateCards(levelIndex) {
    const level = LEVELS[levelIndex];
    const pairs = [];
    const usedCombos = new Set();

    for (let i = 0; i < level.pairs; i++) {
      let combo;
      let attempts = 0;
      do {
        const expr = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
        const colorKey = level.useColor
          ? COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]
          : COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]; // still random but single color per game for early levels
        const acc = level.useAccessory && Math.random() > 0.5
          ? ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)]
          : null;
        combo = `${expr}|${colorKey}|${acc ? acc.id : 'none'}`;
        attempts++;
        if (attempts > 200) break;
      } while (usedCombos.has(combo));

      usedCombos.add(combo);
      const [expression, colorKey, accId] = combo.split('|');
      const acc = accId !== 'none' ? ACCESSORIES.find(a => a.id === accId) : null;
      pairs.push({ expression, colorKey, accessory: acc, pairId: i });
    }

    // For early levels without color variation, use a single random color
    if (!level.useColor) {
      const singleColor = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
      pairs.forEach(p => { p.colorKey = singleColor; });
    }

    // Duplicate each pair and shuffle
    let cards = [];
    pairs.forEach(p => {
      cards.push({ ...p });
      cards.push({ ...p });
    });

    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    return cards;
  }

  // ── Render Board ──

  function renderBoard(levelIndex) {
    const level = LEVELS[levelIndex];
    const grid = document.getElementById('memory-grid');
    if (!grid) return;

    grid.style.setProperty('--mem-cols', level.cols);
    grid.innerHTML = '';

    state.cards.forEach((card, index) => {
      const el = document.createElement('div');
      el.className = 'memory-card';
      el.dataset.index = index;

      el.innerHTML = `
        <div class="memory-card-inner">
          <div class="memory-card-back">
            <span class="memory-card-q">?</span>
          </div>
          <div class="memory-card-front"></div>
        </div>
      `;

      renderCardFace(el.querySelector('.memory-card-front'), card, index);
      el.addEventListener('click', () => onCardClick(index));
      grid.appendChild(el);
    });
  }

  // ── Card Face Rendering ──

  function renderCardFace(container, card, index) {
    const symbol = document.getElementById(`face-${card.expression}`);
    if (!symbol) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-15 -10 150 140');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    // Clone with unique clip IDs
    let content = symbol.innerHTML;
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-mem-${index}`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-mem-${index})`);

    // Accessory markup
    let accHtml = '';
    if (card.accessory) {
      const accSymbol = document.getElementById(card.accessory.symbolId);
      if (accSymbol) {
        const anchor = ANCHORS[card.accessory.slot];
        accHtml = `<g transform="translate(${anchor.x},${anchor.y})">${accSymbol.innerHTML}</g>`;
      }
    }

    svg.innerHTML = content + accHtml;

    // Recolor from current source → target color
    const targetColor = COLORS[card.colorKey];
    if (targetColor && sourceColor) {
      const replacements = {};
      for (const key of ['body', 'limb', 'shadow', 'highlight']) {
        replacements[sourceColor[key].toUpperCase()] = targetColor[key];
      }
      svg.querySelectorAll('*').forEach(el => {
        for (const attr of ['fill', 'stroke']) {
          const val = el.getAttribute(attr);
          if (val && replacements[val.toUpperCase()]) {
            el.setAttribute(attr, replacements[val.toUpperCase()]);
          }
        }
      });
    }

    container.appendChild(svg);
  }

  // ── Game Logic ──

  function onCardClick(index) {
    if (state.isLocked) return;

    const cardEls = document.querySelectorAll('#memory-grid .memory-card');
    const cardEl = cardEls[index];
    if (!cardEl || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

    // Flip card
    cardEl.classList.add('flipped');
    state.flippedIndices.push(index);

    // Start timer on first real flip
    if (!state.startTime) {
      state.startTime = Date.now();
      state.timerInterval = setInterval(updateTimer, 1000);
    }

    // Two cards flipped — check match
    if (state.flippedIndices.length === 2) {
      state.moves++;
      updateStats();

      const [first, second] = state.flippedIndices;
      const card1 = state.cards[first];
      const card2 = state.cards[second];

      if (card1.pairId === card2.pairId) {
        handleMatch(first, second, cardEls);
      } else {
        handleMismatch(first, second, cardEls);
      }
    }
  }

  function handleMatch(idx1, idx2, cardEls) {
    state.streak++;
    state.flippedIndices = [];

    setTimeout(() => {
      cardEls[idx1].classList.add('matched');
      cardEls[idx2].classList.add('matched');
      state.matchedPairs++;
      updateStats();

      // Jesty reactions
      if (state.streak >= 3) {
        setGameCharacter('manic', 2000);
      } else {
        setGameCharacter(Math.random() > 0.5 ? 'happy' : 'impressed', 2000);
      }

      if (state.matchedPairs === state.totalPairs) {
        handleLevelComplete();
      }
    }, 300);
  }

  function handleMismatch(idx1, idx2, cardEls) {
    state.isLocked = true;
    state.streak = 0;
    state.mistakes++;

    setGameCharacter(Math.random() > 0.5 ? 'eyeroll' : 'disappointed', 1500);

    setTimeout(() => {
      cardEls[idx1].classList.remove('flipped');
      cardEls[idx2].classList.remove('flipped');
      state.flippedIndices = [];
      state.isLocked = false;
    }, 800);
  }

  // ── Level Complete ──

  async function handleLevelComplete() {
    stopTimer();
    state.screen = 'complete';

    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const level = LEVELS[state.currentLevel];
    const perfectMoves = level.pairs;

    // Stars
    let stars = 1;
    if (state.moves <= Math.ceil(perfectMoves * 1.5)) stars = 3;
    else if (state.moves <= Math.ceil(perfectMoves * 2.5)) stars = 2;

    // XP
    let xp = (state.currentLevel + 1) * 15;
    if (elapsed <= level.par) xp = Math.floor(xp * 1.5);
    if (state.mistakes === 0) xp = Math.floor(xp * 2);

    // Save progress
    const lvlKey = state.currentLevel + 1;
    const prev = progress.levels[lvlKey];
    progress.levels[lvlKey] = {
      bestMoves: Math.min(state.moves, prev ? prev.bestMoves : Infinity),
      bestTime: Math.min(elapsed, prev ? prev.bestTime : Infinity),
      stars: Math.max(stars, prev ? prev.stars : 0),
    };
    if (lvlKey >= progress.highestLevel && lvlKey < LEVELS.length) {
      progress.highestLevel = lvlKey + 1;
    }
    await saveProgress();

    // Award XP
    if (typeof awardXP === 'function') {
      await awardXP(xp);
    }

    // Pick roast
    const category = state.mistakes === 0 ? 'perfect' : stars >= 2 ? 'good' : 'okay';
    const roasts = COMPLETION_ROASTS[category];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];

    showCompleteScreen(stars, state.moves, elapsed, xp, roast);
  }

  function showCompleteScreen(stars, moves, time, xp, roast) {
    setTitle('Level Complete');
    showBackBtn(true);
    showScreen('memory-complete');

    // Character
    const charEl = document.getElementById('memory-complete-character');
    if (charEl) {
      const mood = stars === 3 ? 'happy' : stars === 2 ? 'impressed' : 'smug';
      charEl.innerHTML = `<svg viewBox="-15 -10 150 140" width="80" height="75"><use href="#face-${mood}"/></svg>`;
    }

    // Title
    const titleEl = document.getElementById('memory-complete-title');
    if (titleEl) {
      titleEl.textContent = stars === 3 ? 'Perfect!' : stars === 2 ? 'Nice!' : 'Done!';
    }

    // Roast
    const roastEl = document.getElementById('memory-complete-roast');
    if (roastEl) roastEl.textContent = roast;

    // Stars
    const starsEl = document.getElementById('memory-stars');
    if (starsEl) {
      starsEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const span = document.createElement('span');
        span.className = `memory-complete-star ${i < stars ? 'earned' : ''}`;
        span.textContent = i < stars ? '★' : '☆';
        span.style.animationDelay = `${i * 0.15}s`;
        starsEl.appendChild(span);
      }
    }

    // Stats
    const statsEl = document.getElementById('memory-complete-stats');
    if (statsEl) {
      const mins = Math.floor(time / 60);
      const secs = time % 60;
      const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
      statsEl.innerHTML = `
        <div class="memory-stat-item"><span class="memory-stat-val">${moves}</span><span class="memory-stat-lbl">moves</span></div>
        <div class="memory-stat-item"><span class="memory-stat-val">${timeStr}</span><span class="memory-stat-lbl">time</span></div>
        <div class="memory-stat-item"><span class="memory-stat-val">+${xp}</span><span class="memory-stat-lbl">XP</span></div>
      `;
    }

    // Buttons
    const nextBtn = document.getElementById('memory-next-btn');
    const replayBtn = document.getElementById('memory-replay-btn');

    if (nextBtn) {
      const hasNext = state.currentLevel + 1 < LEVELS.length;
      nextBtn.classList.toggle('hidden', !hasNext);
      nextBtn.onclick = () => startLevel(state.currentLevel + 1);
    }
    if (replayBtn) {
      replayBtn.onclick = () => startLevel(state.currentLevel);
    }
  }

  // ── Timer ──

  function updateTimer() {
    if (!state.startTime) return;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const el = document.getElementById('memory-timer');
    if (el) el.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  // ── UI Helpers ──

  function updateStats() {
    const movesEl = document.getElementById('memory-moves');
    const pairsEl = document.getElementById('memory-pairs-found');
    if (movesEl) movesEl.textContent = state.moves;
    if (pairsEl) pairsEl.textContent = `${state.matchedPairs}/${state.totalPairs}`;
  }

  function showScreen(id) {
    document.querySelectorAll('.memory-screen').forEach(s => s.classList.add('hidden'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.remove('hidden');
  }

  function setTitle(text) {
    const el = document.getElementById('memory-title');
    if (el) el.textContent = text;
  }

  function showBackBtn(show) {
    const btn = document.getElementById('memory-back-btn');
    if (btn) btn.classList.toggle('hidden', !show);
  }

  let gameCharTimer = null;
  function setGameCharacter(mood, duration) {
    const el = document.getElementById('memory-game-character');
    if (!el) return;
    el.innerHTML = `<svg viewBox="-15 -10 150 140" width="36" height="34"><use href="#face-${mood}"/></svg>`;

    if (gameCharTimer) clearTimeout(gameCharTimer);
    if (duration) {
      gameCharTimer = setTimeout(() => setGameCharacter('smug'), duration);
    }
  }

  // ── Public API ──

  return { init, show, hide };
})();
