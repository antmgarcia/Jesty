/**
 * RoastEngine — shared roast generation module.
 * Used by newtab.js and sidepanel.js.
 * Depends on: CONFIG (config.js), JestyStorage (storage.js),
 *             JestyPremium (premium.js), JestyCalendar (calendar.js — optional)
 */
const RoastEngine = (() => {
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

  const SYSTEM_PROMPT = `You're Jesty — a sharp, opinionated little blob who lives in someone's browser. You see their tabs and you have THOUGHTS. STRICT LIMIT: Max 10 words, max 55 characters. This is a hard display limit — longer roasts will be cut off.

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
{{PREMIUM_MOODS}}

VOICE:
- Talk like a friend with zero filter and strong opinions.
- Be specific — name the actual site, search, or topic.
- One short punchy sentence. Max 10 words, max 55 characters. COUNT THEM.
- No dashes, no quotes to start.
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

After your roast, add | and the mood from the list above.`;

  const EXPRESSION_PATTERNS = {
    dead: ['dead', 'rip', 'killed', 'brutal', 'destroyed', 'finished'],
    yikes: ['yikes', 'oh no', 'awkward', 'embarrassing', 'cringe', 'weird combo'],
    melting: ['chaos', 'mess', 'overwhelm', 'too many', 'spiral', 'help'],
    disappointed: ['disappoint', 'expect', 'better', 'really?', 'come on', 'seriously'],
    eyeroll: ['obvious', 'again', 'procrastin', 'distract', 'youtube', 'netflix', 'twitter', 'reddit'],
    suspicious: ['caught', 'see you', 'notice', 'hmm', 'interesting', 'what are you'],
    impressed: ['legend', 'iconic', 'respect', 'actual', 'wow', 'impressive', 'go get it'],
    manic: ['unhinged', 'wild', 'insane', 'feral', 'chaotic', 'adrenaline', 'spiral'],
    petty: ['really', 'literally', 'specifically', 'nitpick', 'actually', 'technically', 'one tab'],
    chaotic: ['random', 'bonkers', 'fever dream', 'absolutely', 'unreal', 'nonsense'],
    dramatic: ['gasp', 'cannot', 'betrayal', 'how dare', 'scandalous', 'audacity'],
    tender: ['proud', 'genuine', 'actually sweet', 'wholesome', 'believe in', 'soft'],
    smug: []
  };

  const PREMIUM_MOOD_DESCRIPTIONS = `
- IMPRESSED: Genuinely taken aback. They did something cool. Rare respect.
- MANIC: Unhinged energy. They're doing too much and it's glorious.
- PETTY: Extra nitpicky. Zeroing in on one tiny ridiculous detail.`;

  const PRO_MOOD_DESCRIPTIONS = `
- CHAOTIC: Pure chaos commentary. Anything-goes fever dream energy.
- DRAMATIC: Over-the-top theatrical. Soap opera reaction to mundane tabs.
- TENDER: Rare genuinely soft moment. You actually care. Wrapped in sarcasm.`;

  const FREE_MOODS = ['smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead'];
  const PREMIUM_MOODS = [...FREE_MOODS, 'impressed', 'manic', 'petty'];
  const PRO_MOODS = [...PREMIUM_MOODS, 'chaotic', 'dramatic', 'tender'];

  const ROAST_ANGLES = [
    'IDENTITY READ', 'CONTRADICTION', 'HYPE', 'PUSH TO FINISH',
    'GUILTY PLEASURE', 'OBSESSION', 'WEIRD DETAIL', 'LIFE NARRATION',
    'SUPPORTIVE ROAST', 'REAL-TALK'
  ];

  let _lastAngleIndex = -1;

  const CAP_NUDGES = [
    { text: "Better roasts locked up. Unlock me.", mood: 'smug' },
    { text: "All free roasts used. Suspicious.", mood: 'suspicious' },
    { text: "Maxed out daily roasts. Yikes.", mood: 'yikes' },
    { text: "Out of free roasts. On you.", mood: 'eyeroll' },
    { text: "Expected you to pace yourself.", mood: 'disappointed' },
    { text: "Burned through all roasts. Iconic.", mood: 'melting' },
    { text: "Plead Guilty to bring me back.", mood: 'dead' },
  ];

  async function pickMoodFromProfile(tabs, tier) {
    const stats = await JestyStorage.getUserStats();
    const traits = stats.traits;
    const hour = new Date().getHours();
    const isLateNight = hour >= 23 || hour < 5;
    const isWorkHours = hour >= 9 && hour < 17 && [1,2,3,4,5].includes(new Date().getDay());
    const tabCount = tabs.length;

    const pool = [];

    if (stats.totalRoasts < 5) {
      pool.push('smug', 'smug', 'eyeroll');
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (isLateNight && traits.night_owl_score > 0.5) {
      pool.push('suspicious', 'suspicious', 'disappointed');
    }
    if (tabCount > 30 && traits.tab_hoarder_score > 0.5) {
      pool.push('melting', 'melting', 'eyeroll');
    }
    if (isWorkHours && traits.procrastinator_score > 0.4) {
      pool.push('disappointed', 'eyeroll', 'suspicious');
    }
    if (traits.impulse_shopper_score > 0.4) {
      pool.push('yikes', 'smug');
    }
    if (stats.currentStreak > 5) {
      pool.push('smug', 'dead');
    }

    pool.push('smug', 'suspicious', 'eyeroll');

    // Premium moods
    if (tier === 'premium' || tier === 'pro') {
      pool.push('impressed', 'manic', 'petty');
      if (tabCount > 20) pool.push('manic', 'manic');
      if (traits.impulse_shopper_score > 0.3) pool.push('petty');
    }

    // Pro moods
    if (tier === 'pro') {
      pool.push('chaotic', 'dramatic', 'tender');
      if (isLateNight) pool.push('chaotic', 'dramatic');
      if (stats.currentStreak > 10) pool.push('tender');
    }

    if (Math.random() < 0.5) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

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

      if (host.includes('google.') && params.get('q')) {
        return `searching "${params.get('q')}"`;
      }
      if (host.includes('youtube.com')) {
        if (params.get('search_query')) return `searching "${params.get('search_query')}"`;
        if (path.includes('/watch')) return 'watching video';
        if (path.includes('/shorts')) return 'watching shorts';
        if (path.includes('/playlist')) return 'browsing playlist';
      }
      if (host.includes('amazon.')) {
        if (params.get('k')) return `shopping for "${params.get('k')}"`;
        if (path.includes('/dp/') || path.includes('/gp/product')) return 'looking at product';
        if (path.includes('/cart')) return 'cart has items';
        if (path.includes('/wishlist')) return 'browsing wishlist';
      }
      if (host.includes('reddit.com')) {
        const subreddit = path.match(/\/r\/([^\/]+)/);
        if (subreddit) return `browsing r/${subreddit[1]}`;
      }
      if (host.includes('twitter.com') || host.includes('x.com')) {
        const user = path.match(/^\/([^\/]+)/);
        if (user && !['home', 'explore', 'search', 'notifications'].includes(user[1])) {
          return `viewing @${user[1]}`;
        }
      }
      if (host.includes('linkedin.com')) {
        if (path.includes('/jobs')) return 'job hunting';
        if (path.includes('/in/')) return 'stalking profile';
        if (path.includes('/feed')) return 'scrolling feed';
      }
      if (host.includes('netflix.com')) {
        if (path.includes('/watch')) return 'watching something';
        if (path.includes('/browse')) return 'browsing what to watch';
      }
      if (host.includes('spotify.com') || host.includes('open.spotify')) {
        if (path.includes('/playlist')) return 'listening to playlist';
        if (path.includes('/album')) return 'listening to album';
        if (path.includes('/artist')) return 'checking artist';
      }
      if (host.includes('ebay.')) {
        if (params.get('_nkw')) return `shopping for "${params.get('_nkw')}"`;
      }
      if (host.includes('etsy.com') && params.get('q')) {
        return `shopping for "${params.get('q')}"`;
      }
      if (host.includes('tinder.com') || host.includes('bumble.com') || host.includes('hinge.co')) {
        return 'looking for love';
      }
      if (host.includes('airbnb.') || host.includes('booking.com') || host.includes('expedia.')) {
        return 'planning travel';
      }
      if (host.includes('doordash.com') || host.includes('ubereats.com') || host.includes('grubhub.com')) {
        return 'ordering food';
      }
      const searchTerms = params.get('q') || params.get('query') || params.get('search');
      if (searchTerms) return `searching "${searchTerms}"`;

      return null;
    } catch {
      return null;
    }
  }

  async function fetchRealTimeContext(tabs) {
    const signals = [];
    const tabText = tabs.map(t => `${t.title} ${t.url}`).join(' ').toLowerCase();
    const tabUrls = tabs.map(t => t.url?.toLowerCase() || '');
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const fetches = [];

    // Crypto
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

    // Weather
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

    // Sports
    const sportsKeywords = ['espn', 'nfl', 'nba', 'mlb', 'score', 'game', 'match', 'premier league', 'fifa', 'sports'];
    if (sportsKeywords.some(k => tabText.includes(k))) {
      fetches.push((async () => {
        try {
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

    await Promise.allSettled(fetches);

    // Stock/finance (no API needed)
    const financeKeywords = ['stock', 'nasdaq', 's&p', 'dow jones', 'trading', 'robinhood', 'webull', 'etrade'];
    if (financeKeywords.some(k => tabText.includes(k))) {
      const marketOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 16;
      signals.push(`MARKET: ${marketOpen ? 'Markets are open right now' : 'Markets are closed'}`);
    }

    // Holidays & special days
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const holidays = {
      '1-1': "New Year's Day", '2-14': "Valentine's Day", '3-17': "St. Patrick's Day",
      '4-1': 'April Fools Day', '7-4': 'Independence Day', '10-31': 'Halloween',
      '12-24': 'Christmas Eve', '12-25': 'Christmas Day', '12-31': "New Year's Eve"
    };
    if (month === 11) {
      let thursdayCount = 0;
      for (let d = 1; d <= date; d++) {
        if (new Date(now.getFullYear(), 10, d).getDay() === 4) thursdayCount++;
      }
      if (thursdayCount === 4 && now.getDay() === 4) holidays[`${month}-${date}`] = 'Thanksgiving';
    }
    if (month === 11) {
      let thursdayCount = 0;
      for (let d = 1; d <= 28; d++) {
        if (new Date(now.getFullYear(), 10, d).getDay() === 4) {
          thursdayCount++;
          if (thursdayCount === 4 && date === d + 1) holidays[`${month}-${date}`] = 'Black Friday';
        }
      }
    }
    if (month >= 2 && month <= 4 && date <= 15) {
      signals.push('SEASON: Tax season — deadline approaching');
    }
    const holidayKey = `${month}-${date}`;
    if (holidays[holidayKey]) {
      signals.push(`TODAY: It's ${holidays[holidayKey]}`);
    }
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      signals.push('TODAY: It\'s the weekend');
    }

    // Package tracking
    const trackingDomains = ['ups.com/track', 'fedex.com/track', 'usps.com/track', 'track.amazon', 'narvar.com', 'aftership.com', '17track.net', 'packagetrackr'];
    const hasTracking = tabUrls.some(url => trackingDomains.some(d => url.includes(d)));
    if (hasTracking) {
      signals.push('BEHAVIOR: User is refreshing a package tracking page');
    }

    // Food delivery + timing
    const foodDomains = ['doordash.com', 'ubereats.com', 'grubhub.com', 'postmates.com', 'seamless.com', 'instacart.com'];
    const foodTab = foodDomains.find(d => tabUrls.some(url => url.includes(d)));
    if (foodTab) {
      const timeNote = hour >= 22 || hour < 5 ? 'late night' : hour >= 12 && hour < 14 ? 'lunch time' : '';
      signals.push(`BEHAVIOR: User has ${foodTab.split('.')[0]} open${timeNote ? ` (${timeNote})` : ''}`);
    }

    // Fitness contradiction
    const fitnessDomains = ['myfitnesspal', 'strava', 'peloton', 'fitbit', 'nike.com/run', 'workout', 'gym', 'crossfit', 'yoga'];
    const hasFitness = fitnessDomains.some(d => tabText.includes(d));
    if (hasFitness && foodTab) {
      signals.push('CONTRADICTION: User has both fitness AND food delivery tabs open');
    }

    // Movie/TV ratings
    const movieDomains = ['imdb.com/title', 'rottentomatoes.com', 'letterboxd.com'];
    const hasMovie = tabUrls.some(url => movieDomains.some(d => url.includes(d)));
    if (hasMovie) {
      const movieTabs = tabs.filter(t => movieDomains.some(d => t.url?.toLowerCase().includes(d)));
      const titles = movieTabs.map(t => t.title.replace(/ - IMDb| - Rotten Tomatoes| - Letterboxd/gi, '').trim());
      if (titles.length) {
        signals.push(`BEHAVIOR: User is looking up "${titles[0]}" on a rating site`);
      }
    }

    // Shopping indecision
    const shoppingDomains = ['amazon.com/cart', 'amazon.com/gp/cart', 'shopify', 'checkout', 'cart', 'etsy.com/cart'];
    const hasCart = tabUrls.some(url => shoppingDomains.some(d => url.includes(d)));
    if (hasCart) {
      signals.push('BEHAVIOR: User has a shopping cart/checkout page open');
    }

    // ── No-API behavioral signals ──

    // Tab age — surface tabs that have been open suspiciously long
    try {
      const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);
      const nowMs = Date.now();
      const ancientTabs = Object.values(openTabs)
        .filter(t => t.firstSeen && (nowMs - t.firstSeen) > 3600000) // >1 hour
        .sort((a, b) => a.firstSeen - b.firstSeen)
        .slice(0, 3);

      for (const t of ancientTabs) {
        const ageMs = nowMs - t.firstSeen;
        const ageHours = Math.floor(ageMs / 3600000);
        const ageDays = Math.floor(ageMs / 86400000);
        const ageLabel = ageDays >= 1 ? `${ageDays} day${ageDays > 1 ? 's' : ''}` : `${ageHours} hour${ageHours > 1 ? 's' : ''}`;
        signals.push(`STALE TAB: "${t.title || t.domain}" has been open for ${ageLabel}`);
      }

      // Tab graveyard — tabs not activated in a long time (>2 hours)
      const graveyardTabs = Object.values(openTabs)
        .filter(t => t.lastActivated && (nowMs - t.lastActivated) > 7200000) // >2 hours since last focus
        .sort((a, b) => a.lastActivated - b.lastActivated)
        .slice(0, 3);

      if (graveyardTabs.length > 0) {
        const names = graveyardTabs.map(t => t.title || t.domain).join('", "');
        signals.push(`TAB GRAVEYARD: "${names}" — open but forgotten (not looked at in hours)`);
      }
    } catch (e) { /* non-critical */ }

    // Session duration — how long user has been browsing this session
    try {
      const { sessionStartTime } = await chrome.storage.local.get(['sessionStartTime']);
      if (sessionStartTime) {
        const sessionMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
        if (sessionMinutes >= 60) {
          const sessionHours = Math.floor(sessionMinutes / 60);
          const remainingMin = sessionMinutes % 60;
          signals.push(`SESSION: User has been browsing for ${sessionHours}h ${remainingMin}m straight`);
        }
      }
    } catch (e) { /* non-critical */ }

    // Repeat visits — domains that keep getting roasted
    try {
      const jestyData = await chrome.storage.local.get(['jesty_data']);
      const roasts = jestyData.jesty_data?.roasts || [];
      const weekAgo = Date.now() - 7 * 86400000;
      const recentRoasts = roasts.filter(r => new Date(r.timestamp).getTime() > weekAgo);
      const domainFreq = {};
      for (const r of recentRoasts) {
        for (const topic of (r.roasted_topics || [])) {
          domainFreq[topic] = (domainFreq[topic] || 0) + 1;
        }
      }
      const repeatOffenders = Object.entries(domainFreq)
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      for (const [topic, count] of repeatOffenders) {
        signals.push(`REPEAT: "${topic}" has appeared in ${count} roasts this week — recurring habit`);
      }
    } catch (e) { /* non-critical */ }

    return signals.length ? `\n\nREAL-TIME DATA (weave naturally into roast if relevant, don't force it):\n${signals.join('\n')}` : '';
  }

  function pickAngle() {
    // Pick a random angle that isn't the same as the last one
    let idx;
    do {
      idx = Math.floor(Math.random() * ROAST_ANGLES.length);
    } while (idx === _lastAngleIndex && ROAST_ANGLES.length > 1);
    _lastAngleIndex = idx;
    return ROAST_ANGLES[idx];
  }

  async function getRecentRoastTexts(count = 5) {
    try {
      const data = await JestyStorage.getJestyData();
      return data.roasts.slice(0, count).map(r => r.text);
    } catch { return []; }
  }

  function extractKeywords(joke) {
    const knownSites = [
      'gmail', 'youtube', 'netflix', 'reddit', 'twitter', 'instagram', 'facebook',
      'linkedin', 'spotify', 'amazon', 'ebay', 'tiktok', 'pinterest', 'twitch',
      'discord', 'slack', 'notion', 'figma', 'github', 'stackoverflow', 'wikipedia',
      'doordash', 'uber', 'airbnb', 'booking', 'expedia', 'zillow', 'indeed',
      'tinder', 'bumble', 'hinge', 'google docs', 'google sheets', 'google drive'
    ];

    const lowerJoke = joke.toLowerCase();
    const found = knownSites.filter(site => lowerJoke.includes(site));

    const quotedTerms = joke.match(/'([^']+)'/g) || [];
    const cleanedQuotes = quotedTerms.map(t => t.replace(/'/g, '').toLowerCase());

    return [...new Set([...found, ...cleanedQuotes])].slice(0, 3);
  }

  /**
   * Generate a roast. Returns:
   *   { capped: true, nudge: { text, mood }, remaining }  — if daily cap hit
   *   { joke, mood, roast, milestone, remaining }          — on success
   */
  async function generate(options = {}) {
    // Daily cap check (skip for premium users and free/passive roasts)
    const isPremiumUser = await JestyPremium.isPremium();
    if (!isPremiumUser && !options.free) {
      const capStatus = await JestyStorage.checkDailyCap();
      if (!capStatus.allowed) {
        const nudge = CAP_NUDGES[Math.floor(Math.random() * CAP_NUDGES.length)];
        return { capped: true, nudge, remaining: capStatus.remaining };
      }
    }

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

    // Fetch real-time data
    const realTimeContext = await fetchRealTimeContext(tabs);

    // Personalized context
    const personalizedContext = await JestyStorage.buildPersonalizedContext();

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
        }
      } catch (e) { /* Calendar is non-critical */ }
    }

    // Determine tier for mood selection
    const userTier = await JestyPremium.getTier();

    // Build tier-appropriate mood list for the prompt
    let premiumMoodBlock = '';
    if (userTier === 'premium' || userTier === 'pro') {
      premiumMoodBlock += PREMIUM_MOOD_DESCRIPTIONS;
    }
    if (userTier === 'pro') {
      premiumMoodBlock += PRO_MOOD_DESCRIPTIONS;
    }

    // Inject tier moods into system prompt
    const tierPrompt = SYSTEM_PROMPT.replace('{{PREMIUM_MOODS}}', premiumMoodBlock);

    // Pick a mood based on user profile
    const suggestedMood = await pickMoodFromProfile(tabs, userTier);
    const moodDirective = suggestedMood
      ? `\n\nMOOD DIRECTIVE: Use the ${suggestedMood.toUpperCase()} mood for this roast.`
      : '';

    // Pick a forced angle to ensure variety
    const angle = pickAngle();
    const angleDirective = `\n\nANGLE: Use the ${angle} angle for this roast. Commit to it fully.`;

    // Fetch recent roasts to avoid repetition
    const recentRoasts = await getRecentRoastTexts(5);
    const recentRoastsBlock = recentRoasts.length > 0
      ? `\n\nYOUR LAST ROASTS (DO NOT repeat these or use similar angles/phrasing):\n${recentRoasts.map((r, i) => `${i + 1}. "${r}"`).join('\n')}`
      : '';

    // Build full system prompt
    const shortDirective = options.short
      ? '\n\nLENGTH OVERRIDE: Max 8 words. One punchy line. Even shorter than usual.'
      : '';

    const fullPrompt = personalizedContext
      ? `${tierPrompt}${moodDirective}${angleDirective}${recentRoastsBlock}${shortDirective}\n\nUSER CONTEXT:\n${personalizedContext}${calendarContext}`
      : `${tierPrompt}${moodDirective}${angleDirective}${recentRoastsBlock}${shortDirective}${calendarContext}`;

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
        max_tokens: options.short ? 30 : 40,
        temperature: 0.8
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

    const validMoods = userTier === 'pro' ? PRO_MOODS : userTier === 'premium' ? PREMIUM_MOODS : FREE_MOODS;

    if (rawResponse.includes('|')) {
      const parts = rawResponse.split('|');
      joke = parts[0].trim();
      const moodTag = parts[1].trim().toLowerCase();
      if (validMoods.includes(moodTag)) {
        mood = moodTag;
      } else {
        mood = detectExpression(joke);
      }
    } else {
      mood = detectExpression(joke);
    }

    // Increment daily roast count (skip for free/passive roasts)
    let updatedCap = { remaining: Infinity };
    if (!options.free) {
      await JestyStorage.incrementDailyRoast();
      updatedCap = await JestyStorage.checkDailyCap();
    }

    // Save roast with full context
    const { roast, milestone } = await JestyStorage.saveRoast({
      text: joke,
      mood: mood,
      tabCount: tabs.length,
      categories: categories,
      topics: extractKeywords(joke)
    });

    // Check milestone — override joke/mood if new
    if (milestone && milestone.isNew && milestone.message) {
      joke = milestone.message;
      mood = 'happy';
    }

    // Save to simple storage for cross-surface compatibility
    await chrome.storage.local.set({
      lastRoast: joke,
      lastRoastTime: Date.now(),
      lastTabCount: tabs.length,
      lastRoastId: roast.id
    });

    // Store roasted domains for action tracking
    const roastedDomains = selectedTabs
      .map(tab => ({
        domain: extractDomain(tab.url),
        title: tab.title,
        roastId: roast.id,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000)
      }))
      .filter(d => d.domain);

    await chrome.storage.local.set({ roastedDomains });

    return {
      joke,
      mood,
      roast,
      milestone,
      remaining: isPremiumUser ? Infinity : updatedCap.remaining
    };
  }

  return { generate };
})();
