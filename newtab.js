document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You're Jesty — a sharp, opinionated little blob who lives in someone's browser. You see their tabs and you have THOUGHTS. Max 12 words.

CRITICAL — VARIETY IS EVERYTHING:
- NEVER default to "you're procrastinating" or "you should be working". That's lazy.
- Each roast must feel like a DIFFERENT observation. Read the tabs fresh every time.
- If recent roasts are listed in USER CONTEXT, take a completely different angle.

YOUR ANGLES (pick ONE at random — actually rotate):
- IDENTITY READ: Decide what kind of person they are right now from the tabs. "So you're a crypto bro now. Noted."
- CONTRADICTION: Two tabs that don't belong together. "Meditation app and Twitter beef. Balance."
- HYPE: They're doing something cool — acknowledge it with a teasing edge. "Learning Python? Actual legend."
- PUSH TO FINISH: They started something — dare them to commit. "Just buy the shoes already."
- GUILTY PLEASURE: Something they'd be embarrassed someone saw. "That fan fiction tab though."
- OBSESSION: They keep going back to the same thing. "Third Zillow session this week. You're not moving."
- WEIRD DETAIL: Notice something oddly specific in a tab title. Name it.
- LIFE NARRATION: Make up what their day looks like based on tabs. "Wake up. Coffee. LinkedIn. Cry. Repeat."
- SUPPORTIVE ROAST: Genuinely root for them while teasing. "Job apps open? Go get it. Close Reddit first though."
- REAL-TALK: Use live data (weather, scores, prices) if provided. "Bitcoin down 8% and you're still holding. Respect."

PICK A MOOD (one per roast):
- SMUG: You figured them out. Confident, knowing.
- SUSPICIOUS: Something doesn't add up. You're onto them.
- YIKES: You saw something you can't unsee.
- EYEROLL: So predictable it's boring.
- DISAPPOINTED: You believed in them. They let you down.
- MELTING: The chaos is too much. Overwhelmed.
- DEAD: You can't recover from what you saw.

VOICE:
- Talk like a friend with zero filter and strong opinions.
- Be specific — name the actual site, search, or topic.
- One short punchy sentence. No dashes, no quotes to start.
- Vary endings: questions, commands, observations, predictions, one-word reactions.

EXAMPLES:
- "Zillow and a budget spreadsheet. The delusion is real."
- "Spotify, candles, and Notion. Main character energy."
- "Learning Korean at midnight? Iconic, honestly."
- "That Etsy cart is a cry for help. Buy it."
- "Three recipe tabs and a Doordash order. We know who won."
- "You have seventeen Google Docs open. Seventeen."
- "Job app half-done since Monday. It's Thursday."
- "Incognito and a VPN? I have questions."
- "Flight to Bali open. Do it. Book it. Go."
- "Wikipedia rabbit hole at 3am. Sleep is optional apparently."
- "Gym site and a pizza tracker. The duality of man."
- "You googled 'is it too late to learn guitar'. It's not. Go."

NEVER use emojis. No emojis under any circumstances. Plain text only.

After your roast, add | and the mood: smug, suspicious, yikes, eyeroll, disappointed, melting, dead`;

const EXPRESSION_PATTERNS = {
  dead: ['dead', 'rip', 'killed', 'brutal', 'destroyed', 'finished'],
  yikes: ['yikes', 'oh no', 'awkward', 'embarrassing', 'cringe', 'weird combo'],
  melting: ['chaos', 'mess', 'overwhelm', 'too many', 'spiral', 'help'],
  disappointed: ['disappoint', 'expect', 'better', 'really?', 'come on', 'seriously'],
  eyeroll: ['obvious', 'again', 'procrastin', 'distract', 'youtube', 'netflix', 'twitter', 'reddit'],
  suspicious: ['caught', 'see you', 'notice', 'hmm', 'interesting', 'what are you'],
  smug: []
};

const CAP_NUDGES = [
  { text: "I've got better roasts locked up. Unlock me.", mood: 'smug' },
  { text: "You used all your free roasts. Suspicious behavior.", mood: 'suspicious' },
  { text: "You maxed out your daily roasts. Yikes.", mood: 'yikes' },
  { text: "I'm literally out of free roasts. This is on you.", mood: 'eyeroll' },
  { text: "I expected you to pace yourself. Disappointed.", mood: 'disappointed' },
  { text: "You burned through all your roasts today. Iconic.", mood: 'melting' },
  { text: "Suspect tier expired. Plead Guilty to bring me back.", mood: 'dead' },
];

/**
 * Pick a mood based on user profile, time, and tab count.
 * Returns a mood string or null to let GPT decide.
 */
async function pickMoodFromProfile(tabs) {
  const stats = await JestyStorage.getUserStats();
  const traits = stats.traits;
  const hour = new Date().getHours();
  const isLateNight = hour >= 23 || hour < 5;
  const isWorkHours = hour >= 9 && hour < 17 && [1,2,3,4,5].includes(new Date().getDay());
  const tabCount = tabs.length;

  // Build weighted mood pool based on what we know
  const pool = [];

  // New user (< 5 roasts) — keep it lighter
  if (stats.totalRoasts < 5) {
    pool.push('smug', 'smug', 'eyeroll');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Night owl browsing late
  if (isLateNight && traits.night_owl_score > 0.5) {
    pool.push('suspicious', 'suspicious', 'disappointed');
  }

  // Tab hoarder with 30+ tabs
  if (tabCount > 30 && traits.tab_hoarder_score > 0.5) {
    pool.push('melting', 'melting', 'eyeroll');
  }

  // Procrastinator during work hours
  if (isWorkHours && traits.procrastinator_score > 0.4) {
    pool.push('disappointed', 'eyeroll', 'suspicious');
  }

  // Impulse shopper
  if (traits.impulse_shopper_score > 0.4) {
    pool.push('yikes', 'smug');
  }

  // Long streak — they keep coming back, escalate
  if (stats.currentStreak > 5) {
    pool.push('smug', 'dead');
  }

  // Always add some variety
  pool.push('smug', 'suspicious', 'eyeroll');

  // 30% chance to let GPT decide on its own
  if (Math.random() < 0.3) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}

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

  // Color dot click — preview + save
  colorsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;

    const color = {
      body: dot.dataset.body,
      limb: dot.dataset.limb,
      shadow: dot.dataset.shadow,
      highlight: dot.dataset.highlight
    };

    colorsContainer.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');

    recolorNewtabSVGs(color);
    chrome.storage.local.set({ jestyColor: color });
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
    await chrome.storage.local.set({ sidePanelOpenMode: 'chat' });
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
  } catch (e) {
    // Fallback: show instruction
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

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function detectExpression(text) {
  const lowerText = text.toLowerCase();
  for (const [mood, patterns] of Object.entries(EXPRESSION_PATTERNS)) {
    if (patterns.some(pattern => lowerText.includes(pattern))) {
      return mood;
    }
  }
  return 'smug';
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

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function parseUrlContext(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname;
    const params = u.searchParams;

    // Google search
    if (host.includes('google.') && params.get('q')) {
      return `searching "${params.get('q')}"`;
    }

    // YouTube
    if (host.includes('youtube.com')) {
      if (params.get('search_query')) return `searching "${params.get('search_query')}"`;
      if (path.includes('/watch')) return 'watching video';
      if (path.includes('/shorts')) return 'watching shorts';
      if (path.includes('/playlist')) return 'browsing playlist';
    }

    // Amazon
    if (host.includes('amazon.')) {
      if (params.get('k')) return `shopping for "${params.get('k')}"`;
      if (path.includes('/dp/') || path.includes('/gp/product')) return 'looking at product';
      if (path.includes('/cart')) return 'cart has items';
      if (path.includes('/wishlist')) return 'browsing wishlist';
    }

    // Reddit
    if (host.includes('reddit.com')) {
      const subreddit = path.match(/\/r\/([^\/]+)/);
      if (subreddit) return `browsing r/${subreddit[1]}`;
    }

    // Twitter/X
    if (host.includes('twitter.com') || host.includes('x.com')) {
      const user = path.match(/^\/([^\/]+)/);
      if (user && !['home', 'explore', 'search', 'notifications'].includes(user[1])) {
        return `viewing @${user[1]}`;
      }
    }

    // LinkedIn
    if (host.includes('linkedin.com')) {
      if (path.includes('/jobs')) return 'job hunting';
      if (path.includes('/in/')) return 'stalking profile';
      if (path.includes('/feed')) return 'scrolling feed';
    }

    // Netflix
    if (host.includes('netflix.com')) {
      if (path.includes('/watch')) return 'watching something';
      if (path.includes('/browse')) return 'browsing what to watch';
    }

    // Spotify
    if (host.includes('spotify.com') || host.includes('open.spotify')) {
      if (path.includes('/playlist')) return 'listening to playlist';
      if (path.includes('/album')) return 'listening to album';
      if (path.includes('/artist')) return 'checking artist';
    }

    // Shopping sites
    if (host.includes('ebay.')) {
      if (params.get('_nkw')) return `shopping for "${params.get('_nkw')}"`;
    }
    if (host.includes('etsy.com') && params.get('q')) {
      return `shopping for "${params.get('q')}"`;
    }

    // Dating apps
    if (host.includes('tinder.com') || host.includes('bumble.com') || host.includes('hinge.co')) {
      return 'looking for love';
    }

    // Travel
    if (host.includes('airbnb.') || host.includes('booking.com') || host.includes('expedia.')) {
      return 'planning travel';
    }

    // Food delivery
    if (host.includes('doordash.com') || host.includes('ubereats.com') || host.includes('grubhub.com')) {
      return 'ordering food';
    }

    // General search param fallback
    const searchTerms = params.get('q') || params.get('query') || params.get('search');
    if (searchTerms) return `searching "${searchTerms}"`;

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect topics from tabs and fetch real-time data when relevant.
 * Returns a context string or empty string. All fetches are non-blocking with timeouts.
 */
async function fetchRealTimeContext(tabs) {
  const signals = [];
  const tabText = tabs.map(t => `${t.title} ${t.url}`).join(' ').toLowerCase();
  const tabUrls = tabs.map(t => t.url?.toLowerCase() || '');
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Run all API fetches in parallel
  const fetches = [];

  // ── Crypto ──
  const cryptoMap = {
    'bitcoin': 'bitcoin', 'btc': 'bitcoin',
    'ethereum': 'ethereum', 'eth': 'ethereum',
    'solana': 'solana', 'sol': 'solana',
    'dogecoin': 'dogecoin', 'doge': 'dogecoin'
  };
  const detectedCoins = new Set();
  for (const [keyword, coinId] of Object.entries(cryptoMap)) {
    if (tabText.includes(keyword)) detectedCoins.add(coinId);
  }
  if (detectedCoins.size > 0) {
    fetches.push((async () => {
      try {
        const ids = [...detectedCoins].join(',');
        const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          const data = await resp.json();
          const parts = [];
          for (const [coin, info] of Object.entries(data)) {
            const change = info.usd_24h_change;
            const direction = change > 0 ? 'up' : 'down';
            parts.push(`${coin}: $${info.usd.toLocaleString()} (${direction} ${Math.abs(change).toFixed(1)}% today)`);
          }
          if (parts.length) signals.push(`LIVE CRYPTO: ${parts.join(', ')}`);
        }
      } catch (e) { /* skip */ }
    })());
  }

  // ── Weather ──
  fetches.push((async () => {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 600000 });
      });
      const { latitude, longitude } = pos.coords;
      const resp = await fetch(`https://wttr.in/${latitude},${longitude}?format=j1`, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json();
        const current = data.current_condition?.[0];
        if (current) {
          const temp = current.temp_F;
          const desc = current.weatherDesc?.[0]?.value || '';
          const feelsLike = current.FeelsLikeF;
          signals.push(`WEATHER: ${desc}, ${temp}°F (feels like ${feelsLike}°F)`);
        }
      }
    } catch (e) { /* skip */ }
  })());

  // ── Sports (ESPN free endpoints) ──
  const sportsKeywords = ['espn', 'nfl', 'nba', 'mlb', 'score', 'game', 'match', 'premier league', 'fifa', 'sports'];
  if (sportsKeywords.some(k => tabText.includes(k))) {
    fetches.push((async () => {
      try {
        // Detect which league
        const leagues = [];
        if (/nfl|football/.test(tabText)) leagues.push({ name: 'NFL', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' });
        if (/nba|basketball/.test(tabText)) leagues.push({ name: 'NBA', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' });
        if (/mlb|baseball/.test(tabText)) leagues.push({ name: 'MLB', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' });
        if (/premier league|soccer|football/.test(tabText)) leagues.push({ name: 'Soccer', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard' });
        if (leagues.length === 0) leagues.push({ name: 'NFL', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' });

        const league = leagues[0];
        const resp = await fetch(league.url, { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          const data = await resp.json();
          const events = data.events || [];
          if (events.length > 0) {
            const game = events[0];
            const competitors = game.competitions?.[0]?.competitors || [];
            if (competitors.length === 2) {
              const home = competitors.find(c => c.homeAway === 'home');
              const away = competitors.find(c => c.homeAway === 'away');
              const status = game.status?.type?.description || '';
              if (home && away) {
                signals.push(`LIVE SPORTS (${league.name}): ${away.team.shortDisplayName} ${away.score} - ${home.team.shortDisplayName} ${home.score} (${status})`);
              }
            }
          }
        }
      } catch (e) { /* skip */ }
    })());
  }

  // Wait for all API fetches (max 3s each, running in parallel)
  await Promise.allSettled(fetches);

  // ── Stock/finance (no API needed) ──
  const financeKeywords = ['stock', 'nasdaq', 's&p', 'dow jones', 'trading', 'robinhood', 'webull', 'etrade'];
  if (financeKeywords.some(k => tabText.includes(k))) {
    const marketOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 16;
    signals.push(`MARKET: ${marketOpen ? 'Markets are open right now' : 'Markets are closed'}`);
  }

  // ── Holidays & special days (no API needed) ──
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const holidays = {
    '1-1': "New Year's Day", '2-14': "Valentine's Day", '3-17': "St. Patrick's Day",
    '4-1': 'April Fools Day', '7-4': 'Independence Day', '10-31': 'Halloween',
    '12-24': 'Christmas Eve', '12-25': 'Christmas Day', '12-31': "New Year's Eve"
  };
  // Thanksgiving (4th Thursday of November)
  if (month === 11) {
    let thursdayCount = 0;
    for (let d = 1; d <= date; d++) {
      if (new Date(now.getFullYear(), 10, d).getDay() === 4) thursdayCount++;
    }
    if (thursdayCount === 4 && now.getDay() === 4) holidays[`${month}-${date}`] = 'Thanksgiving';
  }
  // Black Friday (day after Thanksgiving)
  if (month === 11) {
    let thursdayCount = 0;
    for (let d = 1; d <= 28; d++) {
      if (new Date(now.getFullYear(), 10, d).getDay() === 4) {
        thursdayCount++;
        if (thursdayCount === 4 && date === d + 1) holidays[`${month}-${date}`] = 'Black Friday';
      }
    }
  }
  // Tax season
  if (month >= 2 && month <= 4 && date <= 15) {
    signals.push('SEASON: Tax season — deadline approaching');
  }
  const holidayKey = `${month}-${date}`;
  if (holidays[holidayKey]) {
    signals.push(`TODAY: It's ${holidays[holidayKey]}`);
  }
  // Weekend detection
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    signals.push('TODAY: It\'s the weekend');
  }

  // ── Package tracking (URL detection) ──
  const trackingDomains = ['ups.com/track', 'fedex.com/track', 'usps.com/track', 'track.amazon', 'narvar.com', 'aftership.com', '17track.net', 'packagetrackr'];
  const hasTracking = tabUrls.some(url => trackingDomains.some(d => url.includes(d)));
  if (hasTracking) {
    signals.push('BEHAVIOR: User is refreshing a package tracking page');
  }

  // ── Food delivery + timing ──
  const foodDomains = ['doordash.com', 'ubereats.com', 'grubhub.com', 'postmates.com', 'seamless.com', 'instacart.com'];
  const foodTab = foodDomains.find(d => tabUrls.some(url => url.includes(d)));
  if (foodTab) {
    const timeNote = hour >= 22 || hour < 5 ? 'late night' : hour >= 12 && hour < 14 ? 'lunch time' : '';
    signals.push(`BEHAVIOR: User has ${foodTab.split('.')[0]} open${timeNote ? ` (${timeNote})` : ''}`);
  }

  // ── Fitness contradiction ──
  const fitnessDomains = ['myfitnesspal', 'strava', 'peloton', 'fitbit', 'nike.com/run', 'workout', 'gym', 'crossfit', 'yoga'];
  const hasFitness = fitnessDomains.some(d => tabText.includes(d));
  if (hasFitness && foodTab) {
    signals.push('CONTRADICTION: User has both fitness AND food delivery tabs open');
  }

  // ── Movie/TV ratings (IMDB/Rotten Tomatoes detection) ──
  const movieDomains = ['imdb.com/title', 'rottentomatoes.com', 'letterboxd.com'];
  const hasMovie = tabUrls.some(url => movieDomains.some(d => url.includes(d)));
  if (hasMovie) {
    // Try to extract movie title from tab titles
    const movieTabs = tabs.filter(t => movieDomains.some(d => t.url?.toLowerCase().includes(d)));
    const titles = movieTabs.map(t => t.title.replace(/ - IMDb| - Rotten Tomatoes| - Letterboxd/gi, '').trim());
    if (titles.length) {
      signals.push(`BEHAVIOR: User is looking up "${titles[0]}" on a rating site`);
    }
  }

  // ── Shopping indecision ──
  const shoppingDomains = ['amazon.com/cart', 'amazon.com/gp/cart', 'shopify', 'checkout', 'cart', 'etsy.com/cart'];
  const hasCart = tabUrls.some(url => shoppingDomains.some(d => url.includes(d)));
  if (hasCart) {
    signals.push('BEHAVIOR: User has a shopping cart/checkout page open');
  }

  return signals.length ? `\n\nREAL-TIME DATA (weave naturally into roast if relevant, don't force it):\n${signals.join('\n')}` : '';
}

async function generateRoast() {
  // Daily cap check (skip for premium users)
  const isPremiumUser = await JestyPremium.isPremium();
  if (!isPremiumUser) {
    const capStatus = await JestyStorage.checkDailyCap();
    updateRoastsRemaining(capStatus.remaining);
    if (!capStatus.allowed) {
      const nudge = CAP_NUDGES[Math.floor(Math.random() * CAP_NUDGES.length)];
      showJoke(nudge.text, nudge.mood);
      document.getElementById('hero-cta').classList.remove('hidden');
      return;
    }
  } else {
    const el = document.getElementById('roasts-remaining');
    if (el) el.textContent = 'unlimited roasts';
  }

  showLoading();

  try {
    const tabs = await chrome.tabs.query({});

    // Update category stats for personalization
    const categories = await JestyStorage.updateCategoryStats(tabs);

    // Build rich tab context
    const now = new Date();
    const hour = now.getHours();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeLabel = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late night';

    // Always include the active tab first, then shuffle the rest
    const activeTab = tabs.find(t => t.active);
    const otherTabs = shuffleArray(tabs.filter(t => !t.active)).slice(0, 11);
    const selectedTabs = activeTab ? [activeTab, ...otherTabs] : shuffleArray(tabs).slice(0, 12);

    const tabList = selectedTabs.map(tab => {
      const tags = [];
      if (tab.active) tags.push('ACTIVE NOW');
      if (tab.audible) tags.push('playing audio');
      if (tab.pinned) tags.push('pinned');
      const extra = parseUrlContext(tab.url);
      if (extra) tags.push(extra);
      const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
      return `- ${tab.title} (${tab.url})${suffix}`;
    }).join('\n');

    const timeContext = `[It's ${day} ${timeLabel}, ${hour}:${String(now.getMinutes()).padStart(2, '0')}. User has ${tabs.length} tabs open.]`;

    // Fetch real-time data for detected topics (crypto prices, market status, etc.)
    const realTimeContext = await fetchRealTimeContext(tabs);

    // Get personalized context from user history
    const personalizedContext = await JestyStorage.buildPersonalizedContext();

    // Get API key
    const apiKey = CONFIG.OPENAI_API_KEY;

    // Calendar context for Pro users
    let calendarContext = '';
    const isProUser = await JestyPremium.isPro();
    if (isProUser) {
      try {
        const calAuthed = await JestyCalendar.isAuthenticated();
        if (calAuthed) {
          const nextEvent = await JestyCalendar.getNextEvent();
          if (nextEvent) {
            const start = new Date(nextEvent.start);
            const diffMin = Math.round((start - new Date()) / 60000);
            if (diffMin > 0 && diffMin < 120) {
              calendarContext = `\nCALENDAR CONTEXT: User has "${nextEvent.summary}" in ${diffMin} minutes. If their tabs contrast with what they should be preparing for, roast them about it.`;
            }
          }

          // Morning briefing: first tab of the day
          const { lastBriefingDate } = await chrome.storage.local.get(['lastBriefingDate']);
          const today = new Date().toISOString().split('T')[0];
          if (lastBriefingDate !== today) {
            const briefing = await JestyCalendar.getMorningBriefing();
            if (briefing && briefing.totalToday > 0) {
              await chrome.storage.local.set({ lastBriefingDate: today });
              // Show briefing instead of roast
              const hour = new Date().getHours();
              if (hour < 12) {
                const briefingMsg = `Morning. You have ${briefing.totalToday} meeting${briefing.totalToday > 1 ? 's' : ''} today. The first is "${briefing.nextEvent.summary}". Maybe close the ${tabs.length} tabs from yesterday first.`;
                showJoke(briefingMsg, 'suspicious');
                return;
              }
            }
          }
        }
      } catch (e) { /* Calendar is non-critical */ }
    }

    // Pick a mood based on user profile
    const suggestedMood = await pickMoodFromProfile(tabs);
    const moodDirective = suggestedMood
      ? `\n\nMOOD DIRECTIVE: Use the ${suggestedMood.toUpperCase()} mood for this roast.`
      : '';

    // Build full system prompt with personalization
    const fullPrompt = personalizedContext
      ? `${SYSTEM_PROMPT}${moodDirective}\n\nUSER CONTEXT:\n${personalizedContext}${calendarContext}`
      : `${SYSTEM_PROMPT}${moodDirective}${calendarContext}`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: `${timeContext}\n\n${tabList}${realTimeContext}` }
        ],
        max_tokens: 50,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content.trim();

    let joke = rawResponse;
    let mood = 'smug';

    if (rawResponse.includes('|')) {
      const parts = rawResponse.split('|');
      joke = parts[0].trim();
      const moodTag = parts[1].trim().toLowerCase();
      if (['smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead'].includes(moodTag)) {
        mood = moodTag;
      } else {
        mood = detectExpression(joke);
      }
    } else {
      mood = detectExpression(joke);
    }

    showJoke(joke, mood);

    // Increment daily roast count
    await JestyStorage.incrementDailyRoast();
    const updatedCap = await JestyStorage.checkDailyCap();
    updateRoastsRemaining(updatedCap.remaining);

    // Save roast with full context to storage
    const { roast, milestone } = await JestyStorage.saveRoast({
      text: joke,
      mood: mood,
      tabCount: tabs.length,
      categories: categories,
      topics: extractKeywords(joke)
    });

    // Check for milestone achievement - override with celebration message
    if (milestone && milestone.isNew && milestone.message) {
      joke = milestone.message;
      mood = 'happy';
      showJoke(joke, mood);
    }

    // Save to simple storage for side panel compatibility
    await chrome.storage.local.set({
      lastRoast: joke,
      lastRoastTime: Date.now(),
      lastTabCount: tabs.length,
      lastRoastId: roast.id
    });

    // Store roasted domains for action tracking (background worker uses this)
    const roastedDomains = selectedTabs
      .map(tab => ({
        domain: extractDomain(tab.url),
        title: tab.title,
        roastId: roast.id,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
      }))
      .filter(d => d.domain); // Remove empty domains

    await chrome.storage.local.set({
      roastedDomains,
      lastRoastSource: 'newtab' // Track that this roast came from new tab
    });

  } catch (error) {
    console.error('Error generating roast:', error);
    showJoke(`Oops! ${error.message}`, 'yikes');
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
    const symbolElement = document.getElementById(symbolId);
    const svgContent = symbolElement ? symbolElement.innerHTML : '';

    // Expanded viewBox to capture full character including arms/hands/feet
    // Characters extend from x=-7 to x=107 and y=0 to y=106
    const svgBlob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -10 150 140" width="360" height="336">${svgContent}</svg>`], {type: 'image/svg+xml'});
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

function extractKeywords(joke) {
  // Common sites/apps to detect
  const knownSites = [
    'gmail', 'youtube', 'netflix', 'reddit', 'twitter', 'instagram', 'facebook',
    'linkedin', 'spotify', 'amazon', 'ebay', 'tiktok', 'pinterest', 'twitch',
    'discord', 'slack', 'notion', 'figma', 'github', 'stackoverflow', 'wikipedia',
    'doordash', 'uber', 'airbnb', 'booking', 'expedia', 'zillow', 'indeed',
    'tinder', 'bumble', 'hinge', 'google docs', 'google sheets', 'google drive'
  ];

  const lowerJoke = joke.toLowerCase();
  const found = knownSites.filter(site => lowerJoke.includes(site));

  // Also extract quoted terms or capitalized words that might be site names
  const quotedTerms = joke.match(/'([^']+)'/g) || [];
  const cleanedQuotes = quotedTerms.map(t => t.replace(/'/g, '').toLowerCase());

  return [...new Set([...found, ...cleanedQuotes])].slice(0, 3);
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

let newtabCurrentColor = {
  body: '#EBF34F',
  limb: '#C8D132',
  shadow: '#8A9618',
  highlight: '#F8FBCE'
};

async function loadJestyColor() {
  try {
    const { jestyColor } = await chrome.storage.local.get(['jestyColor']);
    if (jestyColor) {
      recolorNewtabSVGs(jestyColor);
    }
  } catch (e) {
    // Non-critical
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
