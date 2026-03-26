document.addEventListener('DOMContentLoaded', init);

let _onboardingSeeded = false;

// Re-check daily cap when user returns (e.g. left computer overnight)
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    try {
      const capStatus = await JestyStorage.checkDailyCap();
      updateRoastsRemaining(capStatus.remaining);
    } catch (e) { /* non-critical */ }
  }
});

// Sync counter in real-time when storage changes (e.g. chat message in sidepanel)
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.jesty_data) {
    try {
      const capStatus = await JestyStorage.checkDailyCap();
      updateRoastsRemaining(capStatus.remaining);
    } catch (e) { /* non-critical */ }
    renderNewtabTasksDebounced();
  }
  // XP gain from tab closure (while newtab is already open)
  if (changes.pendingXPGain && changes.pendingXPGain.newValue) {
    const xpGain = changes.pendingXPGain.newValue;
    chrome.storage.local.remove(['pendingXPGain']);
    showXPToast(xpGain.xp, xpGain.source);
    renderNewtabLevelBadge();
  }
});

async function init() {
  JestyTheme.init();

  // Inject shared SVG symbols (faces + accessories)
  JestyCharacters.init();

  // Hide character until color is loaded to prevent lime flash
  const heroChar = document.getElementById('character');
  if (heroChar) heroChar.style.opacity = '0';

  // Initialize storage
  await JestyStorage.initializeStorage();

  // Load saved character color, then reveal
  await loadJestyColor();
  if (heroChar) {
    heroChar.style.transition = 'opacity 0.15s ease';
    heroChar.style.opacity = '1';
  }

  // Initialize accessories
  await JestyAccessories.init();

  // Initialize top-bar: level badge + accessory mini slots
  await initTopBar();

  // Check for pending XP gain (user closed a roasted tab)
  const pendingXPGain = await checkPendingXPGain();

  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const refreshBtn = document.getElementById('refresh-btn');
  const talkbackBtn = document.getElementById('talkback-btn');
  const tabCountEl = document.getElementById('tab-count');

  // Hero CTA (Plead Guilty) — opens upgrade panel
  const heroCta = document.getElementById('hero-cta');
  if (heroCta) heroCta.addEventListener('click', () => openUpgradePanel());

  // Show tab count (clickable → opens tab manager)
  const tabs = await chrome.tabs.query({});
  tabCountEl.textContent = `${tabs.length} tabs open`;
  tabCountEl.style.cursor = 'pointer';
  tabCountEl.addEventListener('click', () => openTabManager());

  // Load roasts remaining
  try {
    const capStatus = await JestyStorage.checkDailyCap();
    updateRoastsRemaining(capStatus.remaining);
  } catch (e) { /* non-critical */ }

  // Search form submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      // Check if it's a URL
      if (isValidUrl(query)) {
        window.location.href = query.startsWith('http') ? query : `https://${query}`;
      } else {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });

  // Refresh button - track refresh before generating new roast
  refreshBtn.addEventListener('click', async () => {
    JestyAnalytics.track('roast_refreshed');
    await JestyStorage.markRoastRefreshed();
    generateRoast();
  });

  // Talk back button - opens side panel
  talkbackBtn.addEventListener('click', openSidePanel);

  // Share button — toggle menu
  const shareBtn = document.getElementById('share-btn');
  const shareMenu = document.getElementById('share-menu');
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shareMenu.classList.toggle('hidden');
  });

  // Close share menu on outside click
  document.addEventListener('click', () => {
    if (shareMenu && !shareMenu.classList.contains('hidden')) {
      shareMenu.classList.add('hidden');
    }
  });
  shareMenu.addEventListener('click', (e) => e.stopPropagation());

  // Share menu actions
  shareMenu.addEventListener('click', async (e) => {
    const option = e.target.closest('.share-option');
    if (!option) return;
    const action = option.dataset.action;
    shareMenu.classList.add('hidden');

    if (action === 'copy') {
      await copyRoastImage();
    } else if (action === 'twitter') {
      shareToTwitter();
    } else if (action === 'download') {
      await downloadRoastImage();
    }
    JestyAnalytics.track('roast_shared', { method: action });
  });

  // Show XP toast if pending, then proceed to normal flow
  if (pendingXPGain) {
    showXPToast(pendingXPGain.xp, pendingXPGain.source);
  }

  // Seed onboarding task for new users (even if widget is hidden)
  await seedOnboardingTask();

  // Render tasks widget on init (always visible for all tiers)
  renderNewtabTasks();

  // Initialize focus island (inline, not iframe — extension pages can't use content scripts)
  await initNewtabFocusIsland();

  const userName = await JestyStorage.getUserName();
  const data = await JestyStorage.getJestyData();
  const isFirstLaunch = data.profile.total_roasts === 0;

  // Analytics: identify user profile (once per install)
  const { _jestyIdentified } = await chrome.storage.local.get('_jestyIdentified');
  if (!_jestyIdentified) {
    const _tier = await JestyPremium.getTier();
    const { jestyColor: _color } = await chrome.storage.local.get('jestyColor');
    JestyAnalytics.identify({ tier: _tier, color: _color?.body || 'unknown', total_roasts: data.profile.total_roasts || 0 });
    await chrome.storage.local.set({ _jestyIdentified: true });
  }

  if (!userName && isFirstLaunch) {
    showWelcomePrompt();
  } else {
    generateRoast();
  }
}

const WELCOME_COLORS = [
  { color: { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' }, label: 'Lime' },
  { color: { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' }, label: 'Pink' },
  { color: { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' }, label: 'Sky' },
  { color: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' }, label: 'Purple' },
  { color: { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' }, label: 'Mint' },
  { color: { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' }, label: 'Peach' },
];

const WELCOME_EXPRESSION_POOL = [
  'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
  'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
];

function pickWelcomeExpressions(count) {
  const shuffled = [...WELCOME_EXPRESSION_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function renderWelcomeColorFaces(activeBodyColor) {
  const container = document.getElementById('welcome-colors');
  if (!container) return;

  container.innerHTML = '';
  const SOURCE = { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };
  const expressions = pickWelcomeExpressions(WELCOME_COLORS.length);

  WELCOME_COLORS.forEach((entry, i) => {
    const expression = expressions[i];
    const symbol = document.getElementById(`face-${expression}`);
    if (!symbol) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-15 -10 150 140');
    svg.setAttribute('width', '46');
    svg.setAttribute('height', '44');

    let content = symbol.innerHTML;
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-welcome-${i}`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-welcome-${i})`);
    svg.innerHTML = content;

    // Recolor to this color
    const replacements = {};
    for (const key of ['body', 'limb', 'shadow', 'highlight']) {
      replacements[SOURCE[key].toUpperCase()] = entry.color[key];
      replacements[newtabCurrentColor[key].toUpperCase()] = entry.color[key];
    }
    svg.querySelectorAll('*').forEach(el => {
      for (const attr of ['fill', 'stroke']) {
        const val = el.getAttribute(attr);
        if (val && replacements[val.toUpperCase()]) {
          el.setAttribute(attr, replacements[val.toUpperCase()]);
        }
      }
    });

    const btn = document.createElement('button');
    btn.className = 'welcome-color-face';
    btn.title = entry.label;
    btn.dataset.colorIndex = i;
    if (entry.color.body.toUpperCase() === activeBodyColor.toUpperCase()) {
      btn.classList.add('active');
    }
    btn.appendChild(svg);
    container.appendChild(btn);
  });
}

function showWelcomePrompt() {
  const welcomePrompt = document.getElementById('welcome-prompt');
  const loadingText = document.getElementById('loading-text');
  const nameInput = document.getElementById('welcome-name');
  const colorsContainer = document.getElementById('welcome-colors');
  const submitBtn = document.getElementById('welcome-submit');
  const skipBtn = document.getElementById('welcome-skip');

  loadingText.classList.add('hidden');
  welcomePrompt.classList.remove('hidden');

  // Render character naked (no accessories) during onboarding, with blink + squash
  const character = document.getElementById('character');
  if (character) {
    character.innerHTML = `<svg viewBox="-15 -10 150 140" width="120" height="112"><use href="#face-smug"/></svg>`;
    const svg = character.querySelector('svg');
    if (svg && window.JestyAccessories) {
      JestyAccessories.inlineFaceContent('smug', svg);
    }
    tagNewtabEyes(character);
    if (!_newtabIdleTimer && !_newtabFirstBlink) startNewtabIdleCycle();
  }

  // Pick a random default color for this user
  const randomIdx = Math.floor(Math.random() * WELCOME_COLORS.length);
  const randomColor = WELCOME_COLORS[randomIdx].color;
  recolorNewtabSVGs(randomColor);
  chrome.storage.local.set({ jestyColor: randomColor });

  // Render face-based color picker with random color pre-selected
  renderWelcomeColorFaces(randomColor.body);

  // Hide everything except the welcome prompt — clean onboarding screen
  const searchSection = document.querySelector('.search-section');
  const tabInfo = document.querySelector('.tab-info');
  const topBarLeft = document.getElementById('top-bar-left');
  const topLinks = document.querySelector('.top-links');
  const tasksWidget = document.getElementById('newtab-tasks');
  if (searchSection) searchSection.classList.add('hidden');
  if (tabInfo) tabInfo.classList.add('hidden');
  if (topBarLeft) topBarLeft.classList.add('hidden');
  if (topLinks) topLinks.classList.add('hidden');
  if (tasksWidget) tasksWidget.classList.add('hidden');

  function dismissWelcome() {
    welcomePrompt.classList.add('hidden');
    if (searchSection) searchSection.classList.remove('hidden');
    if (tabInfo) tabInfo.classList.remove('hidden');
    if (topBarLeft) topBarLeft.classList.remove('hidden');
    if (topLinks) topLinks.classList.remove('hidden');
    generateRoast();
  }

  // Color face click — preview + save
  colorsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.welcome-color-face');
    if (!btn) return;

    const idx = parseInt(btn.dataset.colorIndex);
    const entry = WELCOME_COLORS[idx];
    if (!entry) return;

    colorsContainer.querySelectorAll('.welcome-color-face').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    recolorNewtabSVGs(entry.color);
    chrome.storage.local.set({ jestyColor: entry.color });
  });

  // Submit — save name + start roasting
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (name) {
      await JestyStorage.setUserName(name);
    }
    JestyAnalytics.track('onboarding_complete', { name_length: name.length });
    dismissWelcome();
  });

  // Allow Enter key in name input to submit
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // Skip — just roast
  skipBtn.addEventListener('click', () => dismissWelcome());
}

async function openSidePanel() {
  try {
    // Signal the sidepanel to load this roast into chat and open the drawer
    const { lastRoast, lastRoastId } = await chrome.storage.local.get(['lastRoast', 'lastRoastId']);
    await chrome.storage.local.set({
      sidePanelOpenMode: 'chat',
      loadRoastIntoChat: { text: lastRoast, roastId: lastRoastId, timestamp: Date.now() }
    });
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
  } catch (e) {
    alert('Right-click the Jesty icon and select "Open side panel" to talk back!');
  }
}


function isValidUrl(string) {
  // Simple URL detection
  const urlPattern = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
  return urlPattern.test(string);
}

let _newtabIdleTimer = null;
let _newtabFirstBlink = null;
let _newtabBlinkMid = null;

function setExpression(mood) {
  const character = document.getElementById('character');
  character.innerHTML = `<svg viewBox="-15 -10 150 140" width="120" height="112"><use href="#face-${mood}"/></svg>`;
  character.classList.remove('pop');
  void character.offsetWidth;
  character.classList.add('pop');

  // Render accessories on top
  const svg = character.querySelector('svg');
  if (svg && window.JestyAccessories) {
    JestyAccessories.renderAccessories(mood, svg);
  }

  // Lift thinking bubbles above all layers (accessories, etc.)
  if (svg && mood === 'thinking') {
    liftThinkingBubbles(svg);
  }

  // Tag eyes so blink animation can find them
  tagNewtabEyes(character);
  // Start idle cycle only once
  if (!_newtabIdleTimer && !_newtabFirstBlink) startNewtabIdleCycle();
}

/**
 * Move thinking bubble circles to the end of the SVG so they render
 * above accessories. Identifies them by their gray fill colors.
 */
function liftThinkingBubbles(svg) {
  const inlined = svg.querySelector('.jesty-face-inline');
  if (!inlined) return;
  const bubbleFills = ['#E0E0E0', '#E8E8E8', '#EEEEEE'];
  const bubbles = [...inlined.querySelectorAll('circle')].filter(c =>
    bubbleFills.includes(c.getAttribute('fill'))
  );
  for (const b of bubbles) {
    svg.appendChild(b);
  }
}

/**
 * Find eye elements in the inlined face and tag them with .newtab-eye.
 */
function tagNewtabEyes(container) {
  const inlined = container.querySelector('.jesty-face-inline');
  if (!inlined) return;
  inlined.querySelectorAll('ellipse[fill="#FFFFFF"], circle[fill="#FFFFFF"], circle[fill="#2D2A26"]').forEach(el => {
    const cy = parseFloat(el.getAttribute('cy'));
    if (cy >= 30 && cy <= 65) el.classList.add('newtab-eye');
  });
}

function newtabBlink() {
  const character = document.getElementById('character');
  if (!character) return;
  const eyes = character.querySelectorAll('.newtab-eye');
  eyes.forEach(el => {
    el.classList.remove('blinking');
    void el.offsetWidth;
    el.classList.add('blinking');
  });
  setTimeout(() => eyes.forEach(el => el.classList.remove('blinking')), 350);
}

function newtabBodyShake() {
  const character = document.getElementById('character');
  if (!character) return;
  const svg = character.querySelector('svg');
  if (!svg) return;
  // Use soft breath during onboarding, full shake otherwise
  const welcomeVisible = !document.getElementById('welcome-prompt')?.classList.contains('hidden');
  const cls = welcomeVisible ? 'newtab-breath' : 'newtab-shake';
  if (svg) {
    svg.classList.remove(cls);
    void svg.offsetWidth;
    svg.classList.add(cls);
    svg.addEventListener('animationend', () => svg.classList.remove(cls), { once: true });
  }
}

function newtabAccShake() {
  const character = document.getElementById('character');
  if (!character) return;
  const accEls = character.querySelectorAll('.jesty-accessory');

  accEls.forEach((accG, i) => {
    // Ensure inner wrapper exists for animation (keeps SVG transform attribute intact on outer g)
    let inner = accG.querySelector('.acc-anim-wrap');
    if (!inner) {
      inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      inner.classList.add('acc-anim-wrap');
      while (accG.firstChild) inner.appendChild(accG.firstChild);
      accG.appendChild(inner);
    }

    const isHat = i === 0;
    const cls = isHat ? 'acc-shake-hat' : 'acc-shake-glasses';
    const delay = isHat ? 0 : 80; // glasses lag behind

    setTimeout(() => {
      inner.classList.remove(cls);
      void inner.offsetWidth;
      inner.classList.add(cls);
      inner.addEventListener('animationend', () => inner.classList.remove(cls), { once: true });
    }, delay);
  });
}

/**
 * Idle cycle:
 *   Blinks every 3-4s
 *   Squash + acc shake every 12s (after initial 5s delay)
 */
let _newtabSquashTimer = null;

function startNewtabIdleCycle() {
  // Blink every 3-4s
  function scheduleBlink() {
    const delay = 3000 + Math.random() * 1000;
    _newtabBlinkMid = setTimeout(() => {
      newtabBlink();
      scheduleBlink();
    }, delay);
  }

  // First blink after 3s, then keep going
  _newtabFirstBlink = setTimeout(() => {
    newtabBlink();
    scheduleBlink();
  }, 3000);

  // Squash + acc shake every 12s, starting after 5s
  _newtabSquashTimer = setTimeout(() => {
    newtabBodyShake();
    newtabAccShake();
    _newtabSquashTimer = setInterval(() => {
      newtabBodyShake();
      newtabAccShake();
    }, 12000);
  }, 5000);
}

/**
 * Check for pending XP gain (user closed a roasted tab)
 */
async function checkPendingXPGain() {
  try {
    const { pendingXPGain } = await chrome.storage.local.get(['pendingXPGain']);
    if (pendingXPGain) {
      await chrome.storage.local.remove(['pendingXPGain']);
      return pendingXPGain;
    }
  } catch (e) {
  }
  return null;
}

/**
 * Show XP toast micro animation
 */
function showXPToast(amount) {
  const heroSection = document.querySelector('.hero-section');
  if (!heroSection) return;

  const toast = document.createElement('div');
  toast.className = 'xp-toast';
  toast.textContent = `+${amount} XP`;
  heroSection.appendChild(toast);

  // Remove after animation completes
  setTimeout(() => toast.remove(), 2200);
}


function showLoading() {
  document.getElementById('jesty-card').classList.add('loading');
  document.getElementById('loading-text').classList.remove('hidden');
  document.getElementById('joke-text').classList.add('hidden');
  document.getElementById('jesty-actions').classList.add('hidden');
  setExpression('thinking');
}

function showJoke(text, mood) {
  const jokeText = document.getElementById('joke-text');
  const loadingText = document.getElementById('loading-text');
  const jestyActions = document.getElementById('jesty-actions');
  const jestyCard = document.getElementById('jesty-card');

  jestyCard.classList.remove('loading');

  // Hide CTA if it was showing from a previous cap hit
  document.getElementById('hero-cta').classList.add('hidden');

  jokeText.textContent = text;
  jokeText.classList.remove('hidden');
  loadingText.classList.add('hidden');
  jestyActions.classList.remove('hidden');

  // Re-trigger animation
  jokeText.style.animation = 'none';
  jokeText.offsetHeight;
  jokeText.style.animation = 'fadeInUp 0.4s ease-out';

  setExpression(mood);
  // Persist mood so sidepanel can pick it up
  chrome.storage.local.set({ lastRoastMood: mood });
}

async function generateRoast() {
  // Morning briefing check (newtab-specific, runs before roast)
  const isProUser = await JestyPremium.isPro();
  if (isProUser) {
    try {
      const calAuthed = await JestyCalendar.isAuthenticated();
      if (calAuthed) {
        const { lastBriefingDate } = await chrome.storage.local.get(['lastBriefingDate']);
        const today = new Date().toISOString().split('T')[0];
        if (lastBriefingDate !== today) {
          const briefing = await JestyCalendar.getMorningBriefing();
          if (briefing && briefing.totalToday > 0) {
            await chrome.storage.local.set({ lastBriefingDate: today });
            const hour = new Date().getHours();
            if (hour < 12) {
              const tabs = await chrome.tabs.query({});
              const briefingMsg = `Morning. You have ${briefing.totalToday} meeting${briefing.totalToday > 1 ? 's' : ''} today. The first is "${briefing.nextEvent.summary}". Maybe close the ${tabs.length} tabs from yesterday first.`;
              showJoke(briefingMsg, 'suspicious');
              return;
            }
          }
        }
      }
    } catch (e) { /* Calendar is non-critical */ }
  }

  showLoading();

  try {
    const result = await RoastEngine.generate();

    if (result.capped) {
      showJoke(result.nudge.text, result.nudge.mood);
      document.getElementById('hero-cta').classList.remove('hidden');
      updateRoastsRemaining(result.remaining);
      JestyAnalytics.track('daily_cap_hit', { surface: 'newtab' });
      return;
    }

    showJoke(result.joke, result.mood);
    updateRoastsRemaining(result.remaining);

    // Analytics: roast generated
    const _tabs = await chrome.tabs.query({});
    JestyAnalytics.track('roast_generated', { mood: result.mood, surface: 'newtab', tab_count: _tabs.length });
    JestyAnalytics.increment('total_roasts');

    // Award milestone XP
    if (result.milestone && result.milestone.xp) {
      await chrome.storage.local.set({ pendingXPGain: { xp: result.milestone.xp, source: 'milestone', timestamp: Date.now() } });
      showXPToast(result.milestone.xp, 'milestone');
    }

    // Award streak XP
    if (result.streakReward && result.streakReward.xp) {
      // Slight delay so it doesn't overlap milestone toast
      const delay = (result.milestone && result.milestone.xp) ? 1500 : 0;
      setTimeout(() => {
        chrome.storage.local.set({ pendingXPGain: { xp: result.streakReward.xp, source: 'streak', timestamp: Date.now() } });
        showXPToast(result.streakReward.xp, 'streak');
      }, delay);
    }

    // Set lastRoastSource for newtab
    await chrome.storage.local.set({ lastRoastSource: 'newtab' });
  } catch (error) {
    console.error('Error generating roast:', error);
    showJoke('My brain broke. Try again.', 'yikes');
  }
}

// ── Share: color map for pattern tiles ──
const SHARE_COLORS = {
  lime:   { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
  pink:   { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
  sky:    { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' },
  purple: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' },
  mint:   { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
  peach:  { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' },
};
const SHARE_COLOR_KEYS = ['lime', 'pink', 'sky', 'purple', 'mint', 'peach'];
const SHARE_SOURCE_COLOR = { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };
const SHARE_EXPRESSIONS = [
  'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
  'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
];

function shareRecolorSvg(content, from, to) {
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    if (from[key] && to[key]) {
      content = content.replace(new RegExp(from[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), to[key]);
    }
  }
  return content;
}

function renderSharePatternTiles(cols, rows, tileSize, allowedColorKeys) {
  return new Promise((resolve) => {
    try {
      const totalW = (cols + 1) * tileSize;
      const totalH = rows * tileSize;

      let innerSvg = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const expr = SHARE_EXPRESSIONS[Math.floor(Math.random() * SHARE_EXPRESSIONS.length)];
          const colorKey = allowedColorKeys[Math.floor(Math.random() * allowedColorKeys.length)];
          const color = SHARE_COLORS[colorKey];
          const symbol = document.getElementById(`face-${expr}`);
          if (!symbol) continue;

          const uid = `nt${r}_${c}`;
          let content = symbol.innerHTML;
          content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
          content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);
          content = shareRecolorSvg(content, newtabCurrentColor, color);

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
        const octx = offscreen.getContext('2d');
        octx.drawImage(img, 0, 0);
        resolve(offscreen);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function shareSvgToImage(svgContent, viewBox, width, height, uid) {
  return new Promise((resolve) => {
    // Rewrite clip-path IDs to avoid collisions
    let content = svgContent;
    if (uid) {
      content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
      content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);
    }
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${content}</svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function shareRoundRect(ctx, x, y, w, h, r) {
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

function shareDrawPill(ctx, x, y, w, h, r, bg, textColor, text) {
  shareRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = '500 26px -apple-system, "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

function generateShareBlob() {
  return new Promise(async (resolve, reject) => {
    const jokeText = document.getElementById('joke-text').textContent;
    const character = document.getElementById('character');
    if (!jokeText) return reject('No roast text');

    try {
      const data = await JestyStorage.getJestyData();
      const profile = data.profile || {};
      const userName = profile.user_name || 'Jesty';
      const totalRoasts = profile.total_roasts || 0;
      const storageData = await chrome.storage.local.get(['jestyColor']);
      const userColorObj = storageData.jestyColor || NEWTAB_DEFAULT_PURPLE;
      const userBodyColor = userColorObj.body;
      const allCategories = profile.top_categories || [];
      const totalTabsSeen = allCategories.reduce((sum, c) => sum + (c.count || 0), 0);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const W = 1080, H = 1350;
      canvas.width = W;
      canvas.height = H;

      // Background — white base + very soft user color overlay
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = userBodyColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1.0;

      // White card
      const cardW = 800, cardH = 1100;
      const cardX = (W - cardW) / 2;
      const cardY = (H - cardH) / 2 - 20;
      const cardR = 32;

      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 16;
      shareRoundRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = '#FFFDF9';
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = '#F0EDEA';
      ctx.lineWidth = 8;
      shareRoundRect(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.stroke();

      // Colored verdict area
      const vMargin = 16;
      const vLeft = cardX + vMargin;
      const vTop = cardY + vMargin;
      const vWidth = cardW - vMargin * 2;
      const vHeight = cardH - 140;
      const vR = 20;

      shareRoundRect(ctx, vLeft, vTop, vWidth, vHeight, vR);
      ctx.fillStyle = userBodyColor;
      ctx.fill();

      // Roast text — centered in colored area
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 60px -apple-system, "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const maxTextW = vWidth - 100;
      const lineHeight = 78;
      const words = jokeText.split(' ');
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
      const textY = vTop + (vHeight - totalTextH) / 2;
      lines.forEach((l, i) => ctx.fillText(l, vLeft + vWidth / 2, textY + i * lineHeight));

      // Get current expression
      const useElement = character.querySelector('use');
      const expressionId = useElement
        ? useElement.getAttribute('href').replace('#face-', '')
        : (character.dataset.expression || 'smug');

      // Character face + accessories — recolor body/limb/shadow/highlight to match
      // the frame bg so only facial features (eyes, mouth, brows) + accessories show
      const symbolElement = document.getElementById('face-' + expressionId);
      let svgContent = symbolElement ? symbolElement.innerHTML : '';
      const accessoryContent = window.JestyAccessories ? JestyAccessories.getAccessorySvgContent(expressionId) : '';
      const flatColor = { body: userBodyColor, limb: userBodyColor, shadow: userBodyColor, highlight: userBodyColor };
      svgContent = shareRecolorSvg(svgContent, newtabCurrentColor, flatColor);
      const charSize = 280;
      const charImg = await shareSvgToImage(svgContent + accessoryContent, '-15 -10 150 140', charSize, charSize, 'share-char');
      if (charImg) {
        const charX = vLeft + (vWidth - charSize) / 2;
        const charY = vTop + vHeight - charSize - 4;
        ctx.drawImage(charImg, charX, charY, charSize, charSize);
      }

      // Bottom row
      const bottomSpace = (cardY + cardH) - (vTop + vHeight);
      const badgeR = 40;
      const badgeX = cardX + vMargin + badgeR + 8;
      const badgeY = vTop + vHeight + bottomSpace / 2;

      // Profile badge — dark circle with colored face clipped on top (same as card)
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#1C1917';
      ctx.fill();

      const smugSymbol = document.getElementById('face-smug');
      let badgeSvgContent = smugSymbol ? smugSymbol.innerHTML : '';
      // Recolor badge face to user's color (source is newtabCurrentColor)
      badgeSvgContent = shareRecolorSvg(badgeSvgContent, newtabCurrentColor, userColorObj);
      const badgeScale = 9;
      const badgeImg = await shareSvgToImage(badgeSvgContent, '-15 -10 150 140', badgeR * badgeScale, badgeR * badgeScale * 0.93, 'share-badge');
      if (badgeImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.clip();
        const bW = badgeR * badgeScale;
        const bH = badgeR * badgeScale * 0.93;
        ctx.drawImage(badgeImg, badgeX - bW / 2, badgeY - bH * 0.38 - 16, bW, bH);
        ctx.restore();
      }

      // Name
      ctx.fillStyle = '#6B6560';
      ctx.font = '700 32px -apple-system, "DM Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(userName, badgeX + badgeR + 14, badgeY);

      // Stat pills
      ctx.font = '500 26px -apple-system, "DM Sans", sans-serif';
      const roastsPill = `${totalRoasts} Roasts`;
      const currentTabs = await chrome.tabs.query({});
      const tabsPill = `${currentTabs.length} Tabs Open`;
      const pillPad = 18, pillH = 48, pillR = 24;

      const tabsW = ctx.measureText(tabsPill).width + pillPad * 2;
      const tabsX = cardX + cardW - vMargin - 8;
      shareDrawPill(ctx, tabsX - tabsW, badgeY - pillH / 2, tabsW, pillH, pillR, '#F0EDEA', '#9C968F', tabsPill);

      const roastsW = ctx.measureText(roastsPill).width + pillPad * 2;
      shareDrawPill(ctx, tabsX - tabsW - 8 - roastsW, badgeY - pillH / 2, roastsW, pillH, pillR, '#F0EDEA', '#9C968F', roastsPill);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Canvas toBlob returned null');
      }, 'image/png');
    } catch (error) {
      console.error('generateShareBlob error:', error);
      reject(error);
    }
  });
}

async function copyRoastImage() {
  try {
    const blob = await generateShareBlob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    await JestyStorage.markRoastShared();
    showShareCheck();
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

async function shareToTwitter() {
  const jokeText = document.getElementById('joke-text').textContent;
  if (!jokeText) return;
  try {
    const blob = await generateShareBlob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showShareCheck();
  } catch (e) { /* clipboard copy is best-effort */ }
  const text = `"${jokeText}" — Jesty read my tabs and chose violence`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  JestyStorage.markRoastShared();
}

async function downloadRoastImage() {
  try {
    const blob = await generateShareBlob();
    downloadImage(blob);
    await JestyStorage.markRoastShared();
  } catch (e) {
    console.error('Download failed:', e);
  }
}

function showShareCheck() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-pop"><polyline points="20 6 9 17 4 12"/></svg>`;
  setTimeout(() => { btn.innerHTML = original; }, 1500);
}

function downloadImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jesty-roast.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



/* ──────────────────────────────────────────────
   ROASTS REMAINING INDICATOR
   ────────────────────────────────────────────── */

async function updateRoastsRemaining(remaining) {
  const el = document.getElementById('roasts-remaining');
  if (!el) return;
  const isPremium = await JestyPremium.isPremium();
  if (isPremium) {
    el.textContent = 'unlimited roasts';
    el.classList.remove('low');
    el.style.cursor = 'default';
  } else {
    el.textContent = `${remaining} roasts left today`;
    el.classList.toggle('low', remaining <= 3);
    el.style.cursor = 'pointer';
    el.onclick = () => openUpgradePanel();
  }
}

/* ──────────────────────────────────────────────
   UPGRADE PANEL
   ────────────────────────────────────────────── */

const NT_TIER_DATA = [
  {
    key: 'free', name: 'Suspect', tagline: 'Under observation',
    price: 'Free', priceSub: '',
    features: ['8 roasts per day', '3 basic accessories', 'Memory Match (levels 1-5)'],
    cta: null
  },
  {
    key: 'premium', name: 'Guilty', tagline: 'Full judgement',
    price: PRICE.premium, priceSub: 'once',
    features: ['Unlimited roasts & chat', 'All games unlocked', 'Tasks', '+5 unlockable accessories'],
    cta: { label: 'Plead Guilty', style: 'primary', action: 'checkout' }
  },
  {
    key: 'pro', name: 'Sentenced', tagline: 'No escape',
    price: PRICE.pro, priceSub: '/mo',
    features: ['Everything in Guilty', 'Calendar events with Jesty commentary', 'Exclusive accessories'],
    cta: { label: 'Launching Soon', style: 'secondary', action: 'disabled' }
  }
];

const NT_TIER_COMBOS = {
  free:    { expression: 'smug', hat: null, glasses: null, color: 'lime' },
  premium: { expression: 'happy', hat: 'acc-crown', glasses: null, color: 'pink' },
  pro:     { expression: 'smug', hat: 'acc-flame-crown', glasses: null, color: 'mint' },
};

const NT_TIER_COLORS = {
  lime:   { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
  pink:   { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
  mint:   { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
};

const NT_ACC_ANCHORS = { hat: { x: 38, y: -2 }, glasses: { x: 32, y: 42 } };

function buildNtTierSvg(combo, width = 52, height = 48) {
  const color = NT_TIER_COLORS[combo.color];
  if (!color) return '';
  const symbol = document.getElementById(`face-${combo.expression}`);
  if (!symbol) return '';

  const id = Math.random().toString(36).slice(2, 8);
  let content = symbol.innerHTML;
  content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-nt-${id}`);
  content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-nt-${id})`);

  let accsHtml = '';
  if (combo.hat) {
    const a = NT_ACC_ANCHORS.hat;
    const hatSym = document.getElementById(combo.hat);
    if (hatSym) accsHtml += `<g transform="translate(${a.x},${a.y})">${hatSym.innerHTML}</g>`;
  }
  if (combo.glasses) {
    const a = NT_ACC_ANCHORS.glasses;
    const glassSym = document.getElementById(combo.glasses);
    if (glassSym) accsHtml += `<g transform="translate(${a.x},${a.y})">${glassSym.innerHTML}</g>`;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-15 -10 150 140');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.innerHTML = content + accsHtml;

  // Recolor from current user color to tier color
  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[newtabCurrentColor[key].toUpperCase()] = color[key];
  }
  svg.querySelectorAll('*').forEach(el => {
    for (const attr of ['fill', 'stroke']) {
      const val = el.getAttribute(attr);
      if (val && replacements[val.toUpperCase()]) {
        el.setAttribute(attr, replacements[val.toUpperCase()]);
      }
    }
  });

  return svg.outerHTML;
}

const UPGRADE_ROASTS = [
  ["8 roasts a day?", "Even your tabs are embarrassed for you."],
  ["Running low on roasts?", "Your browsing history still has plenty of material."],
  ["Hit your daily limit?", "I was about to drop something devastating."],
  ["Rationing roasts like it's the apocalypse?", "Just upgrade already."],
  ["Had the perfect roast queued up?", "Shame about that daily limit."],
  ["Only 12 chances to judge you?", "That's not even enough for your morning tabs."],
];

let _upgradePanelOpen = false;

async function openUpgradePanel() {
  if (_upgradePanelOpen) return;
  _upgradePanelOpen = true;

  const panel = document.getElementById('upgrade-panel');
  const countEl = document.getElementById('upgrade-panel-count');
  const quipEl = document.getElementById('upgrade-panel-quip');
  const cardsEl = document.getElementById('upgrade-panel-cards');
  const container = document.querySelector('.container');
  const topBarLeft = document.getElementById('top-bar-left');
  const topLinks = document.querySelector('.top-links');
  const footer = document.querySelector('.privacy-footer');
  const tasksWidget = document.getElementById('newtab-tasks');

  if (!panel) return;

  // Hide main content
  if (container) container.style.display = 'none';
  if (topBarLeft) topBarLeft.style.display = 'none';
  if (topLinks) topLinks.style.display = 'none';
  if (footer) footer.style.display = 'none';
  if (tasksWidget) tasksWidget.style.display = 'none';

  // Render header
  const cap = await JestyStorage.checkDailyCap();
  const [line1, line2] = UPGRADE_ROASTS[Math.floor(Math.random() * UPGRADE_ROASTS.length)];
  if (countEl) countEl.textContent = `${cap.remaining} roasts left today`;
  if (quipEl) quipEl.innerHTML = `${line1}<br>${line2}`;

  // Render tier cards
  const currentTier = await JestyPremium.getTier();
  const tierOrder = ['free', 'premium', 'pro'];
  const currentIdx = tierOrder.indexOf(currentTier);
  const nextTier = currentIdx < tierOrder.length - 1 ? tierOrder[currentIdx + 1] : null;

  cardsEl.innerHTML = '';
  NT_TIER_DATA.forEach((tier, i) => {
    const card = document.createElement('div');
    card.className = 'nt-tier-card';
    card.style.animationDelay = `${i * 0.1}s`;

    const tierIdx = tierOrder.indexOf(tier.key);
    const isCurrent = tier.key === currentTier;
    const isUpgrade = tierIdx > currentIdx;

    if (isUpgrade && tier.key === nextTier) card.classList.add('highlighted');
    if (isCurrent && currentTier !== 'free') card.classList.add('current');

    const combo = NT_TIER_COMBOS[tier.key];
    const bgColor = combo ? NT_TIER_COLORS[combo.color].body : '#ccc';
    const svgHtml = combo ? buildNtTierSvg(combo, 72, 66) : '';
    const characterHtml = svgHtml
      ? `<div class="nt-tier-card-character">
           <div class="nt-tier-card-character-bg" style="background:${bgColor}"></div>
           ${svgHtml}
         </div>`
      : '';

    const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');

    let ctaHtml = '';
    if (isCurrent && currentTier !== 'free') {
      ctaHtml = `<div class="nt-tier-card-current-label">Your current plan</div>`;
    } else if (isUpgrade && tier.cta) {
      const isDisabled = tier.cta.action === 'disabled';
      ctaHtml = `<button class="nt-tier-card-cta ${tier.cta.style}"${isDisabled ? ' disabled' : ''}>${tier.cta.label}</button>`;
    }

    card.innerHTML = `
      <div class="nt-tier-card-top">
        ${characterHtml}
        <div class="nt-tier-card-top-info">
          <div class="nt-tier-card-header">
            <span class="nt-tier-card-name">${tier.name}</span>
            <span class="nt-tier-card-badge badge-${tier.key}">${tier.tagline}</span>
          </div>
          <div class="nt-tier-card-price">${tier.price} <span>${tier.priceSub}</span></div>
        </div>
      </div>
      <ul class="nt-tier-card-features">${featuresHtml}</ul>
      ${ctaHtml}
    `;

    const ctaBtn = card.querySelector('.nt-tier-card-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', async () => {
        try {
          const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
          const userId = jesty_data ? jesty_data.profile.user_id : '';
          chrome.tabs.create({ url: `${CONFIG.API_URL}/api/checkout?user_id=${userId}` });
        } catch (e) {
          console.error('Error opening checkout:', e);
        }
      });
    }

    cardsEl.appendChild(card);
  });

  panel.classList.remove('hidden');
  panel.classList.remove('closing');

  // Back button
  const backBtn = document.getElementById('upgrade-panel-back');
  if (backBtn) {
    backBtn.onclick = () => closeUpgradePanel();
  }
}

function closeUpgradePanel() {
  const panel = document.getElementById('upgrade-panel');
  const container = document.querySelector('.container');
  const topBarLeft = document.getElementById('top-bar-left');
  const topLinks = document.querySelector('.top-links');
  const footer = document.querySelector('.privacy-footer');
  const tasksWidget = document.getElementById('newtab-tasks');

  if (!panel) return;

  panel.classList.add('closing');
  setTimeout(() => {
    panel.classList.add('hidden');
    panel.classList.remove('closing');
    if (container) container.style.display = '';
    if (topBarLeft) topBarLeft.style.display = '';
    if (topLinks) topLinks.style.display = '';
    if (footer) footer.style.display = '';
    if (tasksWidget) tasksWidget.style.display = '';
    _upgradePanelOpen = false;
  }, 300);
}

/* ──────────────────────────────────────────────
   CHARACTER COLOR SYNC
   ────────────────────────────────────────────── */

// Must match the raw SVG source color in characters.js (Lime)
let newtabCurrentColor = {
  body: '#EBF34F',
  limb: '#C8D132',
  shadow: '#8A9618',
  highlight: '#F8FBCE'
};

const NEWTAB_DEFAULT_PURPLE = {
  body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD'
};

async function loadJestyColor() {
  try {
    const { jestyColor } = await chrome.storage.local.get(['jestyColor']);
    recolorNewtabSVGs(jestyColor || NEWTAB_DEFAULT_PURPLE);
  } catch (e) {
    recolorNewtabSVGs(NEWTAB_DEFAULT_PURPLE);
  }
}

// Listen for color and accessory changes from sidepanel
chrome.storage.onChanged.addListener((changes) => {
  const welcomeVisible = !document.getElementById('welcome-prompt')?.classList.contains('hidden');
  if (changes.jestyColor && changes.jestyColor.newValue) {
    recolorNewtabSVGs(changes.jestyColor.newValue);
    // Re-render inlined face + accessories so they pick up the new color
    // Skip accessories during onboarding — character should be naked
    if (!welcomeVisible) {
      const character = document.getElementById('character');
      const svg = character ? character.querySelector('svg') : null;
      if (svg) {
        const useEl = svg.querySelector('use');
        const mood = useEl ? useEl.getAttribute('href').replace('#face-', '') : 'smug';
        JestyAccessories.renderAccessories(mood, svg);
        if (mood === 'thinking') liftThinkingBubbles(svg);
        tagNewtabEyes(character);
      }
    }
  }
  if (changes.jestyAccessoriesChanged && !welcomeVisible) {
    JestyAccessories.init().then(() => {
      const character = document.getElementById('character');
      const svg = character ? character.querySelector('svg') : null;
      if (svg) {
        const useEl = svg.querySelector('use');
        const mood = useEl ? useEl.getAttribute('href').replace('#face-', '') : 'smug';
        JestyAccessories.renderAccessories(mood, svg);
        if (mood === 'thinking') liftThinkingBubbles(svg);
      }
    });
  }
});

function recolorSVG(svg, fromColor, toColor) {
  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[fromColor[key].toUpperCase()] = toColor[key];
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

function recolorNewtabSVGs(color) {
  const svgDefs = document.querySelector('svg[style*="display: none"] defs');
  if (!svgDefs) return;

  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[newtabCurrentColor[key].toUpperCase()] = color[key];
  }

  const symbols = svgDefs.querySelectorAll('symbol');
  symbols.forEach(symbol => {
    const elements = symbol.querySelectorAll('*');
    elements.forEach(el => {
      const fill = el.getAttribute('fill');
      if (fill && replacements[fill.toUpperCase()]) {
        el.setAttribute('fill', replacements[fill.toUpperCase()]);
      }
      const stroke = el.getAttribute('stroke');
      if (stroke && replacements[stroke.toUpperCase()]) {
        el.setAttribute('stroke', replacements[stroke.toUpperCase()]);
      }
    });
  });

  newtabCurrentColor = { ...color };

  // Also recolor inlined face content in hero character
  const heroSvg = document.querySelector('.hero-character svg');
  if (heroSvg) {
    heroSvg.style.filter = '';
    const inlined = heroSvg.querySelector('.jesty-face-inline');
    if (inlined) {
      inlined.querySelectorAll('*').forEach(el => {
        for (const attr of ['fill', 'stroke']) {
          const val = el.getAttribute(attr);
          if (val && replacements[val.toUpperCase()]) {
            el.setAttribute(attr, replacements[val.toUpperCase()]);
          }
        }
      });
    }
  }
}


/* ──────────────────────────────────────────────
   TOP BAR: Level Badge + Accessory Mini Slots
   ────────────────────────────────────────────── */

const NT_ACC_VIEWBOXES = {
  'acc-party-hat': '0 0 44 30', 'acc-sunglasses': '0 0 56 20',
  'acc-bandana': '0 0 52 22', 'acc-heart-shades': '0 0 56 20',
  'acc-beanie': '0 0 52 26', 'acc-aviators': '0 0 56 22',
  'acc-chef-hat': '0 0 48 34', 'acc-3d-glasses': '0 0 56 20',
  'acc-monocle': '0 0 24 24', 'acc-propeller-hat': '0 0 48 32',
  'acc-star-glasses': '0 0 56 22', 'acc-crown': '0 0 48 28',
  'acc-bow-tie': '0 0 44 20', 'acc-detective-hat': '0 0 56 28',
  'acc-headband': '0 0 52 18', 'acc-viking-helmet': '0 0 56 32',
  'acc-top-hat': '0 0 44 36', 'acc-pirate-hat': '0 0 56 30',
  'acc-halo': '0 0 44 14',
  'acc-flame-crown': '0 0 48 32', 'acc-neon-shades': '0 0 56 20',
  'acc-wizard-hat': '0 0 48 40'
};

const NT_RING_CIRCUMFERENCE = 94.25;

const NT_LEVEL_UNLOCKS = {
  2: 'Bandana', 3: 'Heart Shades', 4: 'Chef Hat', 5: '3D Glasses',
  6: 'Monocle', 7: 'Propeller Hat', 8: 'Star Glasses', 9: 'Crown',
  10: 'Bow Tie', 11: 'Detective Hat', 12: 'Headband', 13: 'Viking Helmet',
  14: 'Top Hat', 15: 'Pirate Hat', 16: 'Halo'
};


async function initTopBar() {
  renderNewtabMiniSlots();
  await renderNewtabLevelBadge();
  initLevelPanel();
  initAccMiniAdd();

  // Listen for accessory changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.jestyAccessoriesChanged) {
      JestyAccessories.init().then(() => renderNewtabMiniSlots());
    }
  });
}

function renderNewtabMiniSlots() {
  const equipped = JestyAccessories.getEquipped();
  for (const slot of ['hat', 'glasses']) {
    const el = document.getElementById(`acc-mini-${slot}`);
    if (!el) continue;
    const accId = equipped[slot];
    if (accId) {
      const acc = JestyAccessories.getCatalog().find(a => a.id === accId);
      if (acc) {
        const vb = NT_ACC_VIEWBOXES[acc.symbolId] || '0 0 44 30';
        el.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>`;
        el.classList.add('equipped');
      }
    } else {
      el.innerHTML = '';
      el.classList.remove('equipped');
    }
  }
}

async function renderNewtabLevelBadge() {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;

  const prog = jesty_data.progression || { level: 1, xp: 0, xp_to_next: 100 };
  const pct = Math.min(1, prog.xp / prog.xp_to_next);

  // Badge number
  const numEl = document.getElementById('level-badge-num');
  if (numEl) numEl.textContent = prog.level;

  // Ring progress
  const ringEl = document.getElementById('level-ring-fill');
  if (ringEl) ringEl.style.strokeDashoffset = NT_RING_CIRCUMFERENCE * (1 - pct);

  // Panel details
  const titleEl = document.getElementById('level-panel-title');
  const stageEl = document.getElementById('level-panel-stage');
  const fillEl = document.getElementById('level-panel-fill');
  const xpEl = document.getElementById('level-panel-xp');
  if (titleEl) titleEl.textContent = `Level ${prog.level}`;

  const tier = await JestyPremium.getTier();
  const tierName = JestyPremium.getTierDisplayName(tier);
  if (stageEl) {
    stageEl.textContent = tierName;
    stageEl.dataset.tier = tier;
    stageEl.style.cursor = 'pointer';
    stageEl.onclick = () => {
      const panel = document.getElementById('level-panel');
      if (panel) panel.classList.remove('visible');
      openSidePanelTo('plans');
    };
  }

  if (fillEl) fillEl.style.width = `${pct * 100}%`;
  if (xpEl) xpEl.textContent = `${prog.xp} / ${prog.xp_to_next} XP`;

  // Next unlock — play to level up button
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    const unlockLevels = Object.keys(NT_LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
    const nextUnlock = unlockLevels.find(l => l > prog.level);
    if (nextUnlock) {
      const reward = NT_LEVEL_UNLOCKS[nextUnlock];
      nextEl.textContent = `Play to unlock ${reward}`;
    } else {
      nextEl.textContent = 'All accessories unlocked!';
    }
  }
}

function initLevelPanel() {
  const badge = document.getElementById('level-badge');
  const panel = document.getElementById('level-panel');
  if (!badge || !panel) return;

  badge.addEventListener('click', () => {
    const isVisible = panel.classList.contains('visible');
    if (isVisible) {
      panel.classList.remove('visible');
    } else {
      panel.classList.add('visible');
    }
  });

  document.addEventListener('click', (e) => {
    if (panel.classList.contains('visible') && !badge.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove('visible');
    }
  });

  // Next-unlock click opens levels drawer in sidepanel
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    nextEl.style.cursor = 'pointer';
    nextEl.addEventListener('click', () => {
      panel.classList.remove('visible');
      openSidePanelTo('levels');
    });
  }

}

async function openSidePanelTo(mode) {
  try {
    await chrome.storage.local.set({ sidePanelOpenMode: mode, sidePanelOpenAt: Date.now() });
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
  } catch (e) { /* fallback */ }
}

function initAccMiniAdd() {
  const addBtn = document.getElementById('acc-mini-add');
  if (addBtn) {
    addBtn.addEventListener('click', () => openSidePanelTo('accessories'));
  }

  // Mini slot clicks also open accessories
  ['acc-mini-hat', 'acc-mini-glasses'].forEach(id => {
    const slot = document.getElementById(id);
    if (slot) {
      slot.addEventListener('click', () => openSidePanelTo('accessories'));
    }
  });
}


/* ──────────────────────────────────────────────
   MINI TASKS WIDGET
   ────────────────────────────────────────────── */

function newtabMigrateTaskNotes(task) {
  if (typeof task.notes === 'string' && task.notes.trim()) {
    task.notes = [{ text: task.notes.trim(), done: false }];
  } else if (!Array.isArray(task.notes)) {
    task.notes = [];
  }
}

async function seedOnboardingTask() {
  if (_onboardingSeeded) return;
  _onboardingSeeded = true;

  const { jestyTaskSeeded } = await chrome.storage.local.get(['jestyTaskSeeded']);
  if (jestyTaskSeeded) return;

  await chrome.storage.local.set({ jestyTaskSeeded: true });

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return; // storage not initialized yet — seeding will happen next render
  const data = jesty_data;
  const tasks = data.user_tasks || [];

  // Only seed if user has no tasks at all
  if (tasks.length > 0) return;

  const onboardingTask1 = {
    id: 'user_onboarding_1',
    title: 'Try managing tasks with Jesty',
    notes: [
      { text: 'Tap a task to open its details', done: false },
      { text: 'Add notes to break it into steps', done: false },
      { text: 'Check items off as you go', done: false }
    ],
    completed: false,
    completedAt: null,
    createdAt: Date.now()
  };

  const onboardingTask2 = {
    id: 'user_onboarding_2',
    title: 'Organise your browser tabs',
    notes: [
      { text: 'Close tabs you no longer need', done: false },
      { text: 'Bookmark pages you want to keep', done: false }
    ],
    completed: false,
    completedAt: null,
    createdAt: Date.now() + 1
  };

  data.user_tasks = [onboardingTask1, onboardingTask2];
  await chrome.storage.local.set({ jesty_data: data });
}

let _newtabTaskIds = []; // track currently rendered task IDs for diffing
let _renderTasksTimer = null;

function renderNewtabTasksDebounced() {
  clearTimeout(_renderTasksTimer);
  _renderTasksTimer = setTimeout(() => renderNewtabTasks(), 150);
}

async function renderNewtabTasks() {
  const widget = document.getElementById('newtab-tasks');
  const list = document.getElementById('newtab-tasks-list');
  if (!widget || !list) return;

  // Seed onboarding task on first ever load
  await seedOnboardingTask();

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const tasks = (jesty_data && jesty_data.user_tasks) || [];

  // Migrate notes, exclude drafts + hidden, newest first, cap at 3
  tasks.forEach(newtabMigrateTaskNotes);
  const visible = tasks
    .filter(t => !t.draft && !t.hidden_from_newtab)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  // Don't show tasks during onboarding
  const welcomeVisible = !document.getElementById('welcome-prompt')?.classList.contains('hidden');
  if (welcomeVisible) return;

  widget.classList.remove('hidden');

  const newIds = visible.map(t => t.id);
  const removedIds = _newtabTaskIds.filter(id => !newIds.includes(id));
  const addedIds = newIds.filter(id => !_newtabTaskIds.includes(id));
  const isFirstRender = _newtabTaskIds.length === 0 && list.children.length === 0;

  // Animate removed rows out, then remove only those rows
  if (removedIds.length > 0) {
    const removePromises = removedIds.map(id => {
      const row = list.querySelector(`[data-task-id="${id}"]`);
      if (!row) return Promise.resolve();
      row.classList.add('slide-out');
      return new Promise(resolve => {
        row.addEventListener('animationend', () => { row.remove(); resolve(); }, { once: true });
        setTimeout(() => { row.remove(); resolve(); }, 250); // fallback
      });
    });
    await Promise.all(removePromises);
  }

  // Remove remaining task rows and add button (keep DOM clean for rebuild)
  Array.from(list.children).forEach(el => el.remove());

  visible.forEach(task => {
    const row = document.createElement('div');
    row.className = `newtab-task${task.completed ? ' checked' : ''}`;
    row.dataset.taskId = task.id;

    // Slide in new tasks (skip on first render)
    if (!isFirstRender && addedIds.includes(task.id)) {
      row.classList.add('slide-in');
      row.addEventListener('animationend', () => row.classList.remove('slide-in'), { once: true });
    }

    const check = document.createElement('div');
    check.className = 'newtab-task-check';
    check.addEventListener('click', async (e) => {
      e.stopPropagation();
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      row.classList.toggle('checked', task.completed);

      // Update badge text
      const badge = row.querySelector('.newtab-task-notes');
      if (badge) {
        if (task.completed) {
          badge.textContent = 'Done';
          badge.classList.add('done');
        } else {
          const pending = task.notes.filter(n => !n.done).length;
          badge.textContent = pending > 0 ? `${pending} note${pending > 1 ? 's' : ''}` : '';
          badge.classList.remove('done');
        }
      }

      // Save back
      const { jesty_data: data } = await chrome.storage.local.get(['jesty_data']);
      if (data && data.user_tasks) {
        const idx = data.user_tasks.findIndex(t => t.id === task.id);
        if (idx >= 0) {
          data.user_tasks[idx].completed = task.completed;
          data.user_tasks[idx].completedAt = task.completedAt;
          await chrome.storage.local.set({ jesty_data: data });
        }
      }
    });

    const title = document.createElement('span');
    title.className = 'newtab-task-title';
    title.textContent = task.title || 'Untitled';

    row.addEventListener('click', async () => {
      await chrome.storage.local.set({ sidePanelTaskId: task.id });
      openSidePanelTo('task-detail');
    });

    row.appendChild(check);
    row.appendChild(title);

    // Badge: "Done" if completed, "XX notes" if pending, or empty
    const badge = document.createElement('span');
    badge.className = 'newtab-task-notes';
    if (task.completed) {
      badge.textContent = 'Done';
      badge.classList.add('done');
    } else {
      const pendingNotes = task.notes.filter(n => !n.done).length;
      if (pendingNotes > 0) {
        badge.textContent = `${pendingNotes} note${pendingNotes > 1 ? 's' : ''}`;
      }
    }
    row.appendChild(badge);

    // Drag to dismiss
    setupTaskDragInteraction(row, task);

    list.appendChild(row);
  });

  // Add task button — always visible when empty, hover-reveal otherwise
  const addRow = document.createElement('div');
  addRow.className = 'newtab-task newtab-task-add';
  if (visible.length === 0) addRow.classList.add('always-visible');
  addRow.innerHTML = `<span class="newtab-task-title">Add task</span>`;
  addRow.addEventListener('click', () => {
    openSidePanelTo('task-new');
  });
  list.appendChild(addRow);

  _newtabTaskIds = newIds;
}

/**
 * Drag-to-dismiss: swipe a task row horizontally to hide it from newtab.
 */
function setupTaskDragInteraction(row, task) {
  let startX = 0, startY = 0, dragging = false, didDismiss = false;
  const DRAG_THRESHOLD = 8;
  const DISMISS_DISTANCE = 120;

  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.newtab-task-check')) return;
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;
    didDismiss = false;
    row.setPointerCapture(e.pointerId);
  });

  row.addEventListener('pointermove', (e) => {
    if (startX === 0 && startY === 0) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!dragging && dist > DRAG_THRESHOLD) {
      // Only start drag if mostly horizontal
      if (Math.abs(dx) < Math.abs(dy)) {
        startX = 0; startY = 0;
        return;
      }
      dragging = true;
      row.classList.add('dragging');
    }

    if (dragging) {
      row.style.transform = `translate(${dx}px, ${dy}px)`;
      row.style.opacity = Math.max(0, 1 - dist / (DISMISS_DISTANCE * 2));
      row.classList.toggle('dismiss-ready', dist >= DISMISS_DISTANCE);
    }
  });

  row.addEventListener('pointerup', async (e) => {
    if (!dragging) { startX = 0; startY = 0; return; }

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= DISMISS_DISTANCE) {
      didDismiss = true;
      row.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      row.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`;
      row.style.opacity = '0';
      setTimeout(async () => {
        row.remove();
        const { jesty_data: data } = await chrome.storage.local.get(['jesty_data']);
        if (data && data.user_tasks) {
          const idx = data.user_tasks.findIndex(t => t.id === task.id);
          if (idx >= 0) {
            data.user_tasks[idx].hidden_from_newtab = true;
            await chrome.storage.local.set({ jesty_data: data });
          }
        }
        renderNewtabTasks();
      }, 200);
    } else {
      row.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease';
      row.style.transform = '';
      row.style.opacity = '';
      setTimeout(() => {
        row.style.transition = '';
        row.classList.remove('dragging', 'dismiss-ready');
      }, 250);
    }

    startX = 0; startY = 0;
    dragging = false;
  });

  row.addEventListener('pointercancel', (e) => {
    row.releasePointerCapture(e.pointerId);
    row.style.transform = '';
    row.style.opacity = '';
    row.classList.remove('dragging', 'dismiss-ready');
    startX = 0; startY = 0;
    dragging = false;
  });

  row.addEventListener('click', (e) => {
    if (didDismiss || dragging) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}


function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ──────────────────────────────────────────────
   TAB MANAGER GRID
   ────────────────────────────────────────────── */

const TAB_QUIPS = {
  low: [  // < 10 tabs
    "Look at you, all organized and boring.",
    "Only a few tabs? I'm almost impressed.",
    "This is suspiciously clean.",
    "Tab minimalist. How zen of you.",
    "Are you even using the internet?",
    "Fewer tabs than fingers. Respect.",
    "Did you just do a spring cleaning?",
    "This is giving main character energy.",
    "So disciplined it's almost scary.",
    "Your browser is basically on vacation."
  ],
  mid: [  // 10-29 tabs
    "Getting cozy in here.",
    "A respectable collection. For now.",
    "You know you can bookmark things, right?",
    "Starting to look like a hobby.",
    "Each one a tiny commitment issue.",
    "The slippery slope has begun.",
    "Not bad, not great. Like a C+ in life.",
    "You're one bored afternoon from chaos.",
    "Half of these are from yesterday, admit it.",
    "Still manageable. Enjoy it while it lasts.",
    "The early signs of a problem.",
    "You call this browsing? I call it nesting."
  ],
  high: [  // 30-49 tabs
    "This is becoming a personality trait.",
    "You need help. I am not that help.",
    "Somewhere in here is a tab from last Tuesday.",
    "Your browser called. It's tired.",
    "A museum of good intentions.",
    "You don't have tabs. You have a backlog.",
    "Closing one won't kill you. Probably.",
    "At this point, just marry your browser.",
    "There's a tab in here you forgot existed.",
    "This is what denial looks like in Chrome.",
    "Organized chaos is still chaos.",
    "Your browser has trust issues now."
  ],
  extreme: [  // 50+
    "This is a cry for help.",
    "Your RAM just filed for divorce.",
    "I can hear your laptop fan from here.",
    "Congrats, you broke tab hoarding.",
    "Each tab is a promise you'll never keep.",
    "This is modern art at this point.",
    "You don't close tabs. Tabs close you.",
    "At what point does this become a lifestyle?",
    "Your browser needs therapy. And a raise.",
    "Legend says one of these tabs has the answer.",
    "This is not browsing. This is collecting.",
    "Somewhere in here is a tab old enough to vote.",
    "Even I'm overwhelmed, and I'm not real.",
    "Your computer is one tab away from quitting.",
    "The audacity of keeping all of these open."
  ]
};

const DOMAIN_ROASTS = {
  'youtube.com': [
    "One more video won't hurt, right?",
    "The rabbit hole has a rabbit hole.",
    "Autoplay is not a lifestyle."
  ],
  'reddit.com': [
    "Doom scrolling HQ.",
    "You'll never reach the bottom.",
    "One does not simply close Reddit."
  ],
  'twitter.com': [
    "Main character energy.",
    "Arguing with strangers, as one does.",
  ],
  'x.com': [
    "Main character energy.",
    "Arguing with strangers, as one does.",
  ],
  'netflix.com': [
    "Still deciding what to watch?",
    "The hardest part is pressing play.",
  ],
  'amazon.com': [
    "Your cart misses you.",
    "Window shopping with commitment issues.",
  ],
  'github.com': [
    "Pretending to be productive.",
    "That PR isn't going to review itself.",
  ],
  'stackoverflow.com': [
    "Copy, paste, hope for the best.",
    "The real developer workflow.",
  ],
  'linkedin.com': [
    "Networking or procrastinating?",
    "Your professional self is watching.",
  ],
  'instagram.com': [
    "Living vicariously through others.",
    "Stories won't watch themselves.",
  ],
  'tiktok.com': [
    "Just one more. Famous last words.",
    "Time doesn't exist on TikTok.",
  ],
  'twitch.tv': [
    "Watching someone else have fun.",
    "Chat is moving too fast.",
  ],
  'spotify.com': [
    "Curating the perfect vibe.",
    "Another playlist you'll forget about.",
  ]
};

function getTabQuip(count) {
  let pool;
  if (count < 10) pool = TAB_QUIPS.low;
  else if (count < 30) pool = TAB_QUIPS.mid;
  else if (count < 50) pool = TAB_QUIPS.high;
  else pool = TAB_QUIPS.extreme;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDomainRoast(domain) {
  const key = Object.keys(DOMAIN_ROASTS).find(d => domain.includes(d));
  if (!key) return null;
  const pool = DOMAIN_ROASTS[key];
  return pool[Math.floor(Math.random() * pool.length)];
}

function extractDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

let _tabManagerOpen = false;

async function openTabManager() {
  if (_tabManagerOpen) return;
  _tabManagerOpen = true;

  const manager = document.getElementById('tab-manager');
  const grid = document.getElementById('tab-manager-grid');
  const countEl = document.getElementById('tab-manager-count');
  const quipEl = document.getElementById('tab-manager-quip');
  const container = document.querySelector('.container');
  const topBarLeft = document.getElementById('top-bar-left');
  const topLinks = document.querySelector('.top-links');
  const footer = document.querySelector('.privacy-footer');
  const tasksWidget = document.getElementById('newtab-tasks');

  if (!manager || !grid) return;

  // Hide main content
  if (container) container.style.display = 'none';
  if (topBarLeft) topBarLeft.style.display = 'none';
  if (topLinks) topLinks.style.display = 'none';
  if (footer) footer.style.display = 'none';
  if (tasksWidget) tasksWidget.style.display = 'none';

  // Query all tabs
  const tabs = await chrome.tabs.query({});
  const currentTab = tabs.find(t => t.active && t.url && t.url.includes('newtab'));

  countEl.textContent = `${tabs.length} tab${tabs.length !== 1 ? 's' : ''} open`;
  quipEl.textContent = getTabQuip(tabs.length);

  // Render grid
  grid.innerHTML = '';
  const filteredTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));

  filteredTabs.forEach((tab, i) => {
    const domain = extractDomainFromUrl(tab.url);
    const card = document.createElement('div');
    card.className = 'tab-card' + (tab.id === (currentTab && currentTab.id) ? ' tab-card-current' : '');
    card.style.animationDelay = `${Math.min(i * 0.03, 0.6)}s`;

    const domainRoast = getDomainRoast(domain);
    if (domainRoast) card.title = domainRoast;

    // Favicon
    const faviconUrl = tab.favIconUrl;
    let faviconHtml;
    if (faviconUrl && !faviconUrl.startsWith('chrome://')) {
      faviconHtml = `<img class="tab-card-favicon" src="${faviconUrl}" alt="" onerror="this.outerHTML='<div class=\\'tab-card-favicon-fallback\\'>${domain.charAt(0).toUpperCase()}</div>'">`;
    } else {
      faviconHtml = `<div class="tab-card-favicon-fallback">${domain.charAt(0).toUpperCase() || '?'}</div>`;
    }

    card.innerHTML = `
      ${faviconHtml}
      <div class="tab-card-info">
        <div class="tab-card-title">${escapeHtml(tab.title || 'Untitled')}</div>
        <div class="tab-card-domain">${escapeHtml(domain)}</div>
      </div>
      <button class="tab-card-close" title="Close tab">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    // Click card → switch to that tab
    card.addEventListener('click', (e) => {
      if (e.target.closest('.tab-card-close')) return;
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });

    // Close button
    card.querySelector('.tab-card-close').addEventListener('click', async (e) => {
      e.stopPropagation();
      card.classList.add('closing');
      await chrome.tabs.remove(tab.id);

      // Update count
      const remaining = grid.querySelectorAll('.tab-card:not(.closing)').length - 1;
      countEl.textContent = `${remaining} tab${remaining !== 1 ? 's' : ''} open`;

      // Update new tab page tab count too
      const tabCountEl = document.getElementById('tab-count');
      if (tabCountEl) tabCountEl.textContent = `${remaining} tabs open`;

      // Remove card after animation
      setTimeout(() => {
        card.remove();
        // New quip if we crossed a threshold
        if (remaining === 49 || remaining === 29 || remaining === 9) {
          quipEl.textContent = getTabQuip(remaining);
        }
      }, 250);
    });

    grid.appendChild(card);
  });

  // Show manager
  manager.classList.remove('hidden');
  manager.classList.remove('closing');

  // Back button
  const backBtn = document.getElementById('tab-manager-back');
  backBtn.onclick = () => closeTabManager();


  // Escape key
  document.addEventListener('keydown', _tabManagerEscHandler);
}

function _tabManagerEscHandler(e) {
  if (e.key === 'Escape') {
    const panel = document.getElementById('insights-panel');
    if (panel && !panel.classList.contains('hidden')) {
      const panel = document.getElementById('insights-panel');
      if (panel) panel.classList.add('hidden');
    } else {
      closeTabManager();
    }
  }
}

async function closeTabManager() {
  if (!_tabManagerOpen) return;
  _tabManagerOpen = false;

  document.removeEventListener('keydown', _tabManagerEscHandler);

  const manager = document.getElementById('tab-manager');
  const container = document.querySelector('.container');
  const topBarLeft = document.getElementById('top-bar-left');
  const topLinks = document.querySelector('.top-links');
  const footer = document.querySelector('.privacy-footer');
  const tasksWidget = document.getElementById('newtab-tasks');

  manager.classList.add('closing');

  // Close insights if open
  const insightsPanel = document.getElementById('insights-panel');
  if (insightsPanel) insightsPanel.classList.add('hidden');

  // Refresh tab count
  const tabs = await chrome.tabs.query({});
  const tabCountEl = document.getElementById('tab-count');
  if (tabCountEl) tabCountEl.textContent = `${tabs.length} tabs open`;

  setTimeout(() => {
    manager.classList.add('hidden');
    manager.classList.remove('closing');
    if (container) container.style.display = '';
    if (topBarLeft) topBarLeft.style.display = '';
    if (topLinks) topLinks.style.display = '';
    if (footer) footer.style.display = '';
    if (tasksWidget) tasksWidget.style.display = '';
  }, 300);
}

/* ──────────────────────────────────────────────
   FOCUS ISLAND (inline on newtab)
   ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
   INSIGHTS PANEL (inside tab manager)
   ────────────────────────────────────────────── */


/* ──────────────────────────────────────────────
   FOCUS ISLAND (inline on newtab)
   ────────────────────────────────────────────── */

async function initNewtabFocusIsland() {
  const iframe = document.getElementById('focus-island-iframe');
  const blurOverlay = document.getElementById('newtab-focus-blur');
  if (!iframe) return;

  function showIsland() {
    if (!iframe.classList.contains('hidden')) return;
    // Reload iframe so focus-island.js re-initializes with fresh session data
    // (display:none iframes may have stale/suspended timers)
    iframe.src = iframe.src;
    iframe.classList.remove('hidden');
  }

  function hideIsland() {
    iframe.classList.add('hidden');
    if (blurOverlay) blurOverlay.classList.add('hidden');
  }

  const { focusSession, focusBlurEnabled } = await chrome.storage.local.get(['focusSession', 'focusBlurEnabled']);
  const isActive = focusSession && focusSession.active;

  if (isActive) {
    showIsland();
    if (blurOverlay && focusBlurEnabled) blurOverlay.classList.remove('hidden');
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusSession) {
      const session = changes.focusSession.newValue;
      if (session && session.active) {
        showIsland();
      } else {
        hideIsland();
      }
    }
    if (changes.focusBlurEnabled && blurOverlay) {
      chrome.storage.local.get(['focusSession'], ({ focusSession: fs }) => {
        if (!fs || !fs.active) return;
        if (changes.focusBlurEnabled.newValue) {
          blurOverlay.classList.remove('hidden');
        } else {
          blurOverlay.classList.add('hidden');
        }
      });
    }
  });
}

