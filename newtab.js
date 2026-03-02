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
  }
});

async function init() {
  // Inject shared SVG symbols (faces + accessories)
  JestyCharacters.init();

  // Initialize storage
  await JestyStorage.initializeStorage();

  // Load saved character color
  await loadJestyColor();

  // Initialize accessories
  await JestyAccessories.init();

  // Check for pending action celebration (user closed a roasted tab)
  const pendingCelebration = await checkPendingCelebration();

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

  // Share button
  const shareBtn = document.getElementById('share-btn');
  shareBtn.addEventListener('click', shareRoast);

  // Show celebration if pending, otherwise check for name prompt or auto-roast
  if (pendingCelebration) {
    showActionCelebration(pendingCelebration);
  } else {
    const userName = await JestyStorage.getUserName();
    const data = await JestyStorage.getJestyData();
    const isFirstLaunch = data.profile.total_roasts === 0;

    if (!userName && isFirstLaunch) {
      showWelcomePrompt();
    } else {
      generateRoast();
    }
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

  // Render face-based color picker
  renderWelcomeColorFaces(NEWTAB_DEFAULT_PURPLE.body);

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
  character.innerHTML = `<svg viewBox="-15 -10 150 140"><use href="#face-${mood}"/></svg>`;
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
 * Check for pending action celebration (user closed a roasted tab)
 * Only shows celebrations that originated from new tab roasts
 */
async function checkPendingCelebration() {
  try {
    const { pendingCelebration } = await chrome.storage.local.get(['pendingCelebration']);
    if (pendingCelebration && pendingCelebration.type === 'action_followed') {
      // Only show here if it came from a new tab roast (not chat)
      if (pendingCelebration.source === 'chat') {
        // Let the sidepanel handle this one
        return null;
      }
      // Clear it so it doesn't show again
      await chrome.storage.local.remove(['pendingCelebration']);
      return pendingCelebration;
    }
  } catch (e) {
  }
  return null;
}

/**
 * Show action celebration when user follows a suggestion
 */
function showActionCelebration(celebration) {
  showJoke(celebration.message, celebration.mood || 'happy');

  // Add celebration animation
  const character = document.getElementById('character');
  character.classList.add('celebrating');

  // Show "You listened!" badge
  const heroSection = document.querySelector('.hero-section');
  const badge = document.createElement('div');
  badge.className = 'action-badge';
  badge.textContent = 'You listened!';
  heroSection.appendChild(badge);

  // Fade out after 5 seconds, then remove
  setTimeout(() => {
    badge.classList.add('fade-out');
  }, 5000);

  setTimeout(() => {
    badge.remove();
    character.classList.remove('celebrating');
  }, 5500);

  // Record the action in storage for stats
  JestyStorage.recordActionFollowed(celebration.domain);
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

async function shareRoast() {
  const jokeText = document.getElementById('joke-text').textContent;
  const character = document.getElementById('character');

  if (!jokeText) return;

  // Get tab count from when the roast was generated
  const storage = await chrome.storage.local.get(['lastTabCount']);
  const tabCount = storage.lastTabCount || 0;

  try {
    // Create canvas for shareable image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Image dimensions (Instagram story friendly)
    canvas.width = 1080;
    canvas.height = 1350;

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get the actual SVG content from the symbol definition
    const useElement = character.querySelector('use');
    const symbolId = useElement.getAttribute('href').replace('#', '');
    const expressionId = symbolId.replace('face-', '');
    const symbolElement = document.getElementById(symbolId);
    const svgContent = symbolElement ? symbolElement.innerHTML : '';

    // Include equipped accessories
    const accessoryContent = window.JestyAccessories ? JestyAccessories.getAccessorySvgContent(expressionId) : '';

    // Expanded viewBox to capture full character including arms/hands/feet
    // Characters extend from x=-7 to x=107 and y=0 to y=106
    const svgBlob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -10 150 140" width="360" height="336">${svgContent}${accessoryContent}</svg>`], {type: 'image/svg+xml'});
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = async () => {
      // Draw character centered
      const charX = (canvas.width - 360) / 2;
      const charY = 280;
      ctx.drawImage(img, charX, charY, 360, 345);

      // Draw quote text
      ctx.fillStyle = '#2D2A26';
      ctx.font = 'bold 52px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Word wrap the text
      const maxWidth = 900;
      const lineHeight = 70;
      const words = jokeText.split(' ');
      let line = '';
      let lines = [];

      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          lines.push(line.trim());
          line = word + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      // Draw lines
      const textY = 700;
      lines.forEach((l, i) => {
        ctx.fillText(l, canvas.width / 2, textY + (i * lineHeight));
      });

      // Draw tab count below quote
      if (tabCount > 0) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 32px "DM Sans", sans-serif';
        const tabCountY = textY + (lines.length * lineHeight) + 60;
        ctx.fillText(`Based on ${tabCount} open tabs`, canvas.width / 2, tabCountY);
      }

      // Draw branding
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '500 28px "DM Sans", sans-serif';
      ctx.fillText('Jesty', canvas.width / 2, 1250);

      // Small decorative line
      ctx.strokeStyle = '#F5F9A8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(440, 1230);
      ctx.lineTo(640, 1230);
      ctx.stroke();

      URL.revokeObjectURL(svgUrl);

      // Convert to blob and share
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'jesty-roast.png', { type: 'image/png' });

        // Track the share
        await JestyStorage.markRoastShared();

        // Try native share first
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file]
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadImage(blob);
            }
          }
        } else {
          // Fallback: download image
          downloadImage(blob);
        }
      }, 'image/png');
    };

    img.src = svgUrl;
  } catch (error) {
    console.error('Error sharing:', error);
  }
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

  // Also update the drop-shadow color on the hero character
  const heroSvg = document.querySelector('.hero-character svg');
  if (heroSvg) {
    heroSvg.style.filter = `drop-shadow(0 4px 12px ${color.body}4D)`;
  }
}
