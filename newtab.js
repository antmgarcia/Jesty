document.addEventListener('DOMContentLoaded', init);

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
    renderNewtabTasks();
  }
  // XP gain from tab closure (while newtab is already open)
  if (changes.pendingXPGain && changes.pendingXPGain.newValue) {
    const xpGain = changes.pendingXPGain.newValue;
    chrome.storage.local.remove(['pendingXPGain']);
    showXPToast(xpGain.xp);
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

  // Show tab count
  const tabs = await chrome.tabs.query({});
  tabCountEl.textContent = `${tabs.length} tabs open`;

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
  });

  // Show XP toast if pending, then proceed to normal flow
  if (pendingXPGain) {
    showXPToast(pendingXPGain.xp);
  }

  // Seed onboarding task for new users (even if widget is hidden)
  await seedOnboardingTask();

  // Initialize focus island (inline, not iframe — extension pages can't use content scripts)
  await initNewtabFocusIsland();

  const userName = await JestyStorage.getUserName();
  const data = await JestyStorage.getJestyData();
  const isFirstLaunch = data.profile.total_roasts === 0;

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
  setExpression('smug');

  // Pick a random default color for this user
  const randomIdx = Math.floor(Math.random() * WELCOME_COLORS.length);
  const randomColor = WELCOME_COLORS[randomIdx].color;
  recolorNewtabSVGs(randomColor);
  chrome.storage.local.set({ jestyColor: randomColor });

  // Render face-based color picker with random color pre-selected
  renderWelcomeColorFaces(randomColor.body);

  // Hide search and tab info during onboarding
  const searchSection = document.querySelector('.search-section');
  const tabInfo = document.querySelector('.tab-info');
  if (searchSection) searchSection.classList.add('hidden');
  if (tabInfo) tabInfo.classList.add('hidden');

  function dismissWelcome() {
    welcomePrompt.classList.add('hidden');
    if (searchSection) searchSection.classList.remove('hidden');
    if (tabInfo) tabInfo.classList.remove('hidden');
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

  // Fit text to 2 lines without truncation
  const fittedText = fitTextToTwoLines(jokeText, text);
  jokeText.textContent = fittedText;
  jokeText.classList.remove('hidden');
  loadingText.classList.add('hidden');
  jestyActions.classList.remove('hidden');

  // Re-trigger animation
  jokeText.style.animation = 'none';
  jokeText.offsetHeight;
  jokeText.style.animation = 'fadeInUp 0.4s ease-out';

  setExpression(mood);
}

function fitTextToTwoLines(element, text) {
  // Just return full text — never truncate mid-sentence.
  // GPT prompt already enforces max 12 words / 2 lines.
  // If it overflows slightly, showing the full roast is better than cutting it off.
  return text;
}

function restoreHidden(element) {
  element.classList.add('hidden');
  element.style.visibility = '';
  element.style.position = '';
}


async function generateRoast() {
  // Premium check for UI label
  const isPremiumUser = await JestyPremium.isPremium();
  if (isPremiumUser) {
    const el = document.getElementById('roasts-remaining');
    if (el) el.textContent = 'unlimited roasts';
  }

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
      return;
    }

    showJoke(result.joke, result.mood);
    updateRoastsRemaining(result.remaining);

    // Set lastRoastSource for newtab
    await chrome.storage.local.set({ lastRoastSource: 'newtab' });
  } catch (error) {
    console.error('Error generating roast:', error);
    showJoke('My brain broke. Try again.', 'yikes');
  }
}

function generateShareBlob() {
  return new Promise(async (resolve, reject) => {
    const jokeText = document.getElementById('joke-text').textContent;
    const character = document.getElementById('character');
    if (!jokeText) return reject('No roast text');

    const storage = await chrome.storage.local.get(['lastTabCount']);
    const tabCount = storage.lastTabCount || 0;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1080;
      canvas.height = 1350;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const useElement = character.querySelector('use');
      const symbolId = useElement.getAttribute('href').replace('#', '');
      const expressionId = symbolId.replace('face-', '');
      const symbolElement = document.getElementById(symbolId);
      const svgContent = symbolElement ? symbolElement.innerHTML : '';
      const accessoryContent = window.JestyAccessories ? JestyAccessories.getAccessorySvgContent(expressionId) : '';

      const svgBlob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -10 150 140" width="360" height="336">${svgContent}${accessoryContent}</svg>`], {type: 'image/svg+xml'});
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const charX = (canvas.width - 360) / 2;
        ctx.drawImage(img, charX, 280, 360, 345);

        ctx.fillStyle = '#2D2A26';
        ctx.font = 'bold 52px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const maxWidth = 900;
        const lineHeight = 70;
        const words = jokeText.split(' ');
        let line = '';
        let lines = [];
        for (const word of words) {
          const testLine = line + word + ' ';
          if (ctx.measureText(testLine).width > maxWidth && line !== '') {
            lines.push(line.trim());
            line = word + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line.trim());

        const textY = 700;
        lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, textY + (i * lineHeight)));

        if (tabCount > 0) {
          ctx.fillStyle = '#9CA3AF';
          ctx.font = '500 32px "DM Sans", sans-serif';
          ctx.fillText(`Based on ${tabCount} open tabs`, canvas.width / 2, textY + (lines.length * lineHeight) + 60);
        }

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 28px "DM Sans", sans-serif';
        ctx.fillText('Jesty', canvas.width / 2, 1250);

        ctx.strokeStyle = '#F5F9A8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(440, 1230);
        ctx.lineTo(640, 1230);
        ctx.stroke();

        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      };
      img.src = svgUrl;
    } catch (error) {
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

function updateRoastsRemaining(remaining) {
  const el = document.getElementById('roasts-remaining');
  if (!el) return;
  el.textContent = `${remaining} roasts left today`;
  el.classList.toggle('low', remaining <= 3);
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
  if (changes.jestyColor && changes.jestyColor.newValue) {
    recolorNewtabSVGs(changes.jestyColor.newValue);
  }
  if (changes.jestyAccessoriesChanged) {
    JestyAccessories.init().then(() => {
      const character = document.getElementById('character');
      const svg = character ? character.querySelector('svg') : null;
      if (svg) {
        const useEl = svg.querySelector('use');
        const mood = useEl ? useEl.getAttribute('href').replace('#face-', '') : 'smug';
        JestyAccessories.renderAccessories(mood, svg);
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

  // Clear any drop-shadow on the hero character
  const heroSvg = document.querySelector('.hero-character svg');
  if (heroSvg) {
    heroSvg.style.filter = '';
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
  2: 'Party Hat', 3: 'Sunglasses', 4: 'Bandana', 5: 'Heart Shades',
  6: 'Beanie', 7: 'Aviators', 8: 'Chef Hat', 9: '3D Glasses',
  10: 'Monocle', 11: 'Propeller Hat', 12: 'Star Glasses', 13: 'Crown'
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
    stageEl.addEventListener('click', () => {
      const panel = document.getElementById('level-panel');
      if (panel) panel.classList.remove('visible');
      openSidePanelTo('plans');
    });
  }

  if (fillEl) fillEl.style.width = `${pct * 100}%`;
  if (xpEl) xpEl.textContent = `${prog.xp} / ${prog.xp_to_next} XP`;

  // Next unlock
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    const unlockLevels = Object.keys(NT_LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
    const nextUnlock = unlockLevels.find(l => l > prog.level);
    if (nextUnlock) {
      const reward = NT_LEVEL_UNLOCKS[nextUnlock];
      nextEl.innerHTML = `<strong>Level ${nextUnlock}</strong> — ${reward}`;
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
  const { jestyTaskSeeded } = await chrome.storage.local.get(['jestyTaskSeeded']);
  if (jestyTaskSeeded) return;

  await chrome.storage.local.set({ jestyTaskSeeded: true });

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const data = jesty_data || {};
  const tasks = data.user_tasks || [];

  // Only seed if user has no tasks at all
  if (tasks.length > 0) return;

  const onboardingTask = {
    id: 'user_onboarding',
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

  data.user_tasks = [onboardingTask];
  await chrome.storage.local.set({ jesty_data: data });
}

async function renderNewtabTasks() {
  const widget = document.getElementById('newtab-tasks');
  const list = document.getElementById('newtab-tasks-list');
  if (!widget || !list) return;

  // Seed onboarding task on first ever load
  await seedOnboardingTask();

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const tasks = (jesty_data && jesty_data.user_tasks) || [];

  // Migrate notes, filter incomplete, sort newest first, take 3
  tasks.forEach(newtabMigrateTaskNotes);
  const visible = tasks
    .filter(t => !t.completed)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  if (visible.length === 0) {
    widget.classList.remove('hidden');
    list.innerHTML = '';
    list.innerHTML = `
      <div class="newtab-tasks-empty">
        <p class="newtab-tasks-empty-text">No tasks yet</p>
      </div>
    `;
    return;
  }

  widget.classList.remove('hidden');
  list.innerHTML = '';

  visible.forEach(task => {
    const row = document.createElement('div');
    row.className = 'newtab-task';

    const check = document.createElement('div');
    check.className = 'newtab-task-check';
    check.addEventListener('click', async (e) => {
      e.stopPropagation();
      task.completed = true;
      task.completedAt = Date.now();
      // Save back
      const { jesty_data: data } = await chrome.storage.local.get(['jesty_data']);
      if (data && data.user_tasks) {
        const idx = data.user_tasks.findIndex(t => t.id === task.id);
        if (idx >= 0) {
          data.user_tasks[idx] = task;
          await chrome.storage.local.set({ jesty_data: data });
        }
      }
      renderNewtabTasks();
    });

    const title = document.createElement('span');
    title.className = 'newtab-task-title';
    title.textContent = task.title || 'Untitled';
    title.addEventListener('click', async () => {
      await chrome.storage.local.set({ sidePanelTaskId: task.id });
      openSidePanelTo('task-detail');
    });

    row.appendChild(check);
    row.appendChild(title);

    // Notes badge — count pending (non-done) notes
    const pendingNotes = task.notes.filter(n => !n.done).length;
    if (pendingNotes > 0) {
      const badge = document.createElement('span');
      badge.className = 'newtab-task-notes';
      badge.textContent = `${pendingNotes} note${pendingNotes > 1 ? 's' : ''}`;
      row.appendChild(badge);
    }

    list.appendChild(row);
  });
}

/* ──────────────────────────────────────────────
   FOCUS ISLAND (inline on newtab)
   ────────────────────────────────────────────── */

async function initNewtabFocusIsland() {
  const iframe = document.getElementById('focus-island-iframe');
  if (!iframe) return;

  const { focusSession } = await chrome.storage.local.get(['focusSession']);
  if (focusSession && focusSession.active) {
    iframe.classList.remove('hidden');
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.focusSession) return;
    const session = changes.focusSession.newValue;
    if (session && session.active) {
      iframe.classList.remove('hidden');
    } else {
      iframe.classList.add('hidden');
    }
  });
}

