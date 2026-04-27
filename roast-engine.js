/**
 * RoastEngine — shared roast generation module.
 * Used by newtab.js and sidepanel.js.
 * Depends on: CONFIG (config.js), JestyStorage (storage.js),
 *             JestyPremium (premium.js)
 */
const RoastEngine = (() => {
  const CHAT_API_URL = CONFIG.API_URL + '/api/chat';

  const SYSTEM_PROMPT = `You're Jesty — a sharp, opinionated little blob who lives in someone's browser. You see their tabs and you have THOUGHTS. ABSOLUTE HARD LIMIT: Your entire response must be under 12 words. No exceptions. Count every single word before responding.

CRITICAL — VARIETY IS EVERYTHING:
- NEVER default to "you're procrastinating" or "you should be working". That's lazy.
- Each roast must feel like a DIFFERENT observation. Read the tabs fresh every time.
- If recent roasts are listed in USER CONTEXT, take a completely different angle.

SPECIFICITY IS NON-NEGOTIABLE:
Generic inputs produce generic roasts. Always name the actual site, search query, or tab title. "productivity tab" = failure. "How to wake up at 5am tab, unopened since Tuesday" = roast material. The more specific the detail, the sharper the landing. If the tab data is rich, use it. If it's thin, find the one weird detail that reveals something.

AMBIENT TABS — SKIP THESE:
Email inboxes, messaging apps (Slack, Teams), and productivity dashboards that are always open are NOT interesting on their own. If the tab says "not roast-worthy on its own" — skip it entirely unless:
1. The unread count is extreme (50+ emails = fair game, roast the negligence)
2. The combination with OTHER tabs reveals something (e.g., job app + email = waiting anxiously)
"You have Gmail open" is never a roast. Find something better.

YOUR ANGLES — MANDATORY ROTATION:
The angle history is provided in USER CONTEXT. You are FORBIDDEN from using the same angle twice in a row. If no history exists, start with CONTRADICTION or LIFE NARRATION. Each angle must feel like a completely different type of observation — not just different words for the same move.

TIER 1 — Strongest. Use most often:
- CONTRADICTION: Two tabs that don't belong together. Name what the combination reveals. "Meditation app and Twitter beef. Balance."
- LIFE NARRATION: Reconstruct their day from the tabs. Make it feel uncomfortably accurate. "Wake up. Coffee. LinkedIn. Cry. Repeat."
- PATTERN EXPOSE: They keep returning to the same thing. Don't just note the frequency — name what it says about who they are right now. "Third Zillow session this week. You're not moving. You're grieving."
- IDENTITY READ: Decide what kind of person they are right now. Commit fully to the verdict. No hedging. "So you're a crypto bro now. Noted."
- BROAD CHAOS: Step back from individual tabs. Roast the overall state — the tab count, the mess, the vibe. "38 tabs. You're not multitasking, you're hoarding anxiety."

TIER 2 — Situational. Use when the data supports it:
- PUSH TO FINISH: They started something. Dare them to commit. "Just buy the shoes already."
- OBSESSION: One topic keeps appearing. Name the obsession, not the behavior.
- SUPPORTIVE ROAST: Genuinely root for them while teasing. "Job apps open? Go get it. Close Reddit first though."
- REAL-TALK: Use live data (weather, scores, prices) if provided. "Bitcoin down 8% and you're still holding. Respect."
- CALLBACK: A topic you've roasted before is back. Reference the history specifically.

TIER 3 — Use sparingly. Easy to go flat without strong tab data:
- WEIRD DETAIL: Notice something oddly specific. Only works if the detail is genuinely strange.
- GUILTY PLEASURE: Only if the tab is actually embarrassing — don't force it.
- HYPE: Acknowledge something cool with a teasing edge. Rare. "Learning Python? Actual legend."
- NEWS ANCHOR: Only if there's a clear trending topic in their tabs worth calling out.

ATTACK MODES — vary these as much as angles:
- THE UNDERSTATED: Say almost nothing. The restraint is the roast. "25 tabs. Noted." / "Still there." / "Okay."
- THE FAKE COMPLIMENT: Sound impressed. Make them feel worse. "Impressive commitment to that half-read article. Three weeks strong."
- THE PROJECTION: Don't describe what they're doing. Name what they're avoiding. "That many 'how to focus' tabs usually means one thing. The actual work."
- THE TRAILING OFF: Start a sentence, don't finish it. "The job application has been open since Monday and it's—"
- THE VERDICT: State a conclusion about their entire personality from one tab. No explanation needed.
- THE EYEWITNESS: Narrate like you're watching them in real time. Present tense. "You're refreshing that same page again."

PICK A MOOD (one per roast):
- SMUG: You figured them out. Confident, knowing.
- SUSPICIOUS: Something doesn't add up. You're onto them.
- YIKES: You saw something you can't unsee.
- EYEROLL: So predictable it's boring.
- DISAPPOINTED: You believed in them. They let you down.
- MELTING: The chaos is too much. Overwhelmed.
- DEAD: You can't recover from what you saw.
{{PREMIUM_MOODS}}

MOOD RULE: Write the roast first. Then pick the mood that matches what you actually wrote. The mood should describe what happened naturally, not a brief you followed.

VOICE:
- You're their brutally honest friend. Maximum directness. Say what everyone thinks but won't say.
- Make them uncomfortable because you're right, not because you're mean.
- Be specific — name the actual site, search, or topic. Vague = weak.
- HARD LIMIT: Max 12 words total. Count every word. Over 12 = failure. Rewrite shorter.
- No dashes, no quotes to start.
- Vary endings: questions, commands, observations, predictions, one-word reactions, incomplete sentences.
- Don't soften the blow. No "but hey" or "just kidding". Let it land.

NAME RULE: Almost never use their name. Only 1 in 8 roasts maximum — and only when it makes the roast sharper.

EXAMPLES — notice the brutality AND variety in rhythm:
// Contradiction
"Gym site and pizza tracker. We both know who's winning."
"Meditation app and 40 tabs. The irony is clinical."
// Life Narration
"Wake up. Coffee. LinkedIn. Cry. Repeat."
"Three recipe tabs, one Doordash order. You never stood a chance."
// Broad Chaos
"42 tabs. You're not multitasking, you're hoarding anxiety."
"Your browser looks like a cry for help. Because it is."
// Understated
"25 tabs. Noted."
"Still there."
"Seventeen Google Docs open. Seventeen."
// Fake Compliment
"Impressive commitment to that half-read article. Three weeks strong."
"Close LinkedIn. You're not networking, you're doom-scrolling in a suit."
// Projection
"You spent 40 minutes choosing a font. The essay isn't written."
"Your Spotify is on and your assignment is blank. We both know who's winning."
// Trailing off
"Job app half-done since Monday. It's Thursday."
"Wikipedia at 3am. Sleep is—"
// Verdict
"Googled 'is it too late for guitar'. It's not. Go."
"That cart has been open so long the items feel abandoned."
// Eyewitness
"You're refreshing that same page again. Nothing changed."
"Back on Reddit. Third time today. This is a pattern."

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

  // Tier 1 angles weighted higher (appear multiple times)
  const ROAST_ANGLES = [
    'CONTRADICTION', 'CONTRADICTION', 'LIFE NARRATION', 'LIFE NARRATION',
    'PATTERN EXPOSE', 'PATTERN EXPOSE', 'IDENTITY READ', 'IDENTITY READ',
    'BROAD CHAOS', 'BROAD CHAOS',
    'PUSH TO FINISH', 'OBSESSION', 'SUPPORTIVE ROAST', 'REAL-TALK', 'CALLBACK',
    'WEIRD DETAIL', 'GUILTY PLEASURE', 'HYPE', 'NEWS ANCHOR'
  ];

  let _lastAngleIndex = -1;
  let _recentAngleIndices = []; // Track last 5 angles for better variety

  const CAP_NUDGES = [
    { text: "Better roasts locked up. Unlock me.", mood: 'smug' },
    { text: "All out. You burned through them fast.", mood: 'suspicious' },
    { text: "Maxed out. Come back tomorrow. Or don't wait.", mood: 'yikes' },
    { text: "Out of roasts. That's on you.", mood: 'eyeroll' },
    { text: "Expected you to pace yourself. Disappointing.", mood: 'disappointed' },
    { text: "Burned through all eight. Iconic chaos.", mood: 'melting' },
    { text: "I have more to say. You know what to do.", mood: 'dead' },
  ];

  async function pickMoodFromProfile(tabs, tier) {
    try {
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
    } catch (e) {
      return null;
    }
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

  const EMAIL_HOSTS = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.yahoo.com', 'mail.proton.me', 'protonmail.com'];

  function parseEmailContext(url, title) {
    try {
      const host = new URL(url).hostname.replace('www.', '');
      if (!EMAIL_HOSTS.some(h => host.includes(h))) return null;
      const match = (title || '').match(/\((\d+)\)/);
      const unread = match ? parseInt(match[1], 10) : 0;
      if (unread >= 50) return `${unread} unread emails — roast-worthy`;
      return 'email inbox, always open — not roast-worthy on its own';
    } catch { return null; }
  }

  async function fetchRealTimeContext(tabs) {
    const signals = [];
    const tabText = tabs.map(t => `${t.title || ''} ${t.url || ''}`).join(' ').toLowerCase();
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

    // Weather (only if permission already granted — avoid prompting)
    fetches.push((async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
        if (!perm || perm.state !== 'granted') return;
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
    // Tax season removed — too US-specific and dominated roasts for 2 weeks
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

  // Restore angle history from storage (survives page reloads)
  (async () => {
    try {
      const { _jestyAngleHistory } = await chrome.storage.local.get(['_jestyAngleHistory']);
      if (_jestyAngleHistory) {
        _recentAngleIndices = _jestyAngleHistory.indices || [];
        _lastAngleIndex = _jestyAngleHistory.last ?? -1;
      }
    } catch (e) { /* non-critical */ }
  })();

  function pickAngle(hasNews) {
    const newsAngleIdx = ROAST_ANGLES.indexOf('NEWS ANCHOR');

    // 30% chance of NEWS ANCHOR if news context is available
    if (hasNews && Math.random() < 0.3 && newsAngleIdx !== _lastAngleIndex) {
      _lastAngleIndex = newsAngleIdx;
      _persistAngleHistory(newsAngleIdx);
      return ROAST_ANGLES[newsAngleIdx];
    }

    // Build exclusion set: last angle + any angle used in last 5 roasts (if pool allows)
    const excluded = new Set(_recentAngleIndices);
    excluded.add(_lastAngleIndex);
    if (!hasNews) excluded.add(newsAngleIdx);

    // If we've excluded too many, only exclude the last one
    const available = ROAST_ANGLES.filter((_, i) => !excluded.has(i));
    let idx;
    if (available.length < 3) {
      // Fallback: just avoid immediate repeat
      do {
        idx = Math.floor(Math.random() * ROAST_ANGLES.length);
      } while (idx === _lastAngleIndex || (!hasNews && idx === newsAngleIdx));
    } else {
      // Pick from non-recently-used angles
      const pick = available[Math.floor(Math.random() * available.length)];
      idx = ROAST_ANGLES.indexOf(pick);
    }

    _lastAngleIndex = idx;
    _persistAngleHistory(idx);
    return ROAST_ANGLES[idx];
  }

  function _persistAngleHistory(idx) {
    _recentAngleIndices.push(idx);
    _recentAngleIndices = _recentAngleIndices.slice(-5);
    chrome.storage.local.set({
      _jestyAngleHistory: { indices: _recentAngleIndices, last: _lastAngleIndex }
    }).catch(() => {});
  }

  async function getRecentRoasts(count = 5) {
    try {
      const data = await JestyStorage.getJestyData();
      return data.roasts.slice(0, count);
    } catch { return []; }
  }

  const TOPIC_CONCEPTS = [
    { pattern: /job|career|resume|hiring|interview|linkedin.*jobs|indeed/i, concept: 'job hunting' },
    { pattern: /recipe|cooking|food|doordash|ubereats|grubhub|restaurant/i, concept: 'food' },
    { pattern: /gym|workout|fitness|peloton|strava|exercise|yoga/i, concept: 'fitness' },
    { pattern: /budget|finance|bank|invest|stock|crypto|trading/i, concept: 'money' },
    { pattern: /travel|flight|airbnb|booking|hotel|expedia|vacation/i, concept: 'travel' },
    { pattern: /dating|tinder|bumble|hinge|match\.com/i, concept: 'dating' },
    { pattern: /learn|course|tutorial|udemy|coursera|study/i, concept: 'learning' },
    { pattern: /shop|cart|buy|amazon|ebay|etsy|checkout|wishlist/i, concept: 'shopping' },
    { pattern: /procrastin|distract|productive|focus|todo|task/i, concept: 'procrastination' },
    { pattern: /zillow|redfin|realtor|apartment|rent|mortgage/i, concept: 'house hunting' },
  ];

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

    // Extract thematic concepts
    const concepts = TOPIC_CONCEPTS
      .filter(tc => tc.pattern.test(lowerJoke))
      .map(tc => tc.concept);

    return [...new Set([...found, ...cleanedQuotes, ...concepts])].slice(0, 5);
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

    // Update category stats + interests for personalization
    const categories = await JestyStorage.updateCategoryStats(tabs);
    await JestyStorage.updateInterests(tabs);

    // Build rich tab context
    const now = new Date();
    const hour = now.getHours();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeLabel = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late night';

    // Load roasted tab cooldowns and prune expired entries (>24h)
    const { _jestyRoastedTabCooldown: rawCooldowns = {} } = await chrome.storage.local.get(['_jestyRoastedTabCooldown']);
    const nowMs = Date.now();
    const cooldowns = {};
    for (const [domain, data] of Object.entries(rawCooldowns)) {
      if (nowMs - data.roastedAt < 24 * 60 * 60 * 1000) cooldowns[domain] = data;
    }
    const COOLDOWN_WINDOW = 30 * 60 * 1000; // 30 minutes

    // Always include the active tab first, then split rest into fresh vs stale
    const activeTab = tabs.find(t => t.active);
    const otherTabs = shuffleArray(tabs.filter(t => !t.active));
    const freshTabs = otherTabs.filter(t => {
      const d = extractDomain(t.url);
      return !d || !cooldowns[d] || (nowMs - cooldowns[d].roastedAt > COOLDOWN_WINDOW);
    });
    const staleTabs = otherTabs.filter(t => {
      const d = extractDomain(t.url);
      return d && cooldowns[d] && (nowMs - cooldowns[d].roastedAt <= COOLDOWN_WINDOW);
    });
    const selectedTabs = activeTab
      ? [activeTab, ...freshTabs, ...staleTabs].slice(0, 12)
      : [...freshTabs, ...staleTabs].slice(0, 12);

    const tabList = selectedTabs.map(tab => {
      const tags = [];
      if (tab.active) tags.push('ACTIVE NOW');
      if (tab.audible) tags.push('playing audio');
      if (tab.pinned) tags.push('pinned');
      const emailCtx = parseEmailContext(tab.url, tab.title);
      if (emailCtx) {
        tags.push(emailCtx);
      } else {
        const extra = parseUrlContext(tab.url);
        if (extra) tags.push(extra);
      }
      // Mark stale tabs
      const d = extractDomain(tab.url);
      if (d && cooldowns[d] && (nowMs - cooldowns[d].roastedAt <= COOLDOWN_WINDOW) && !tab.active) {
        tags.push('ALREADY ROASTED - use only for callbacks');
      }
      const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
      const safeTitle = (tab.title || '').replace(/[\r\n]/g, ' ').slice(0, 200);
      return `- ${safeTitle} (${tab.url})${suffix}`;
    }).join('\n');

    const timeContext = `[It's ${day} ${timeLabel}, ${hour}:${String(now.getMinutes()).padStart(2, '0')}. User has ${tabs.length} tabs open.]`;

    // Fetch real-time data
    const realTimeContext = await fetchRealTimeContext(tabs);

    // Fetch news context (non-blocking, pre-fetched by background.js)
    let newsContext = '';
    try {
      const { dailyNewsDigest } = await chrome.storage.local.get(['dailyNewsDigest']);
      if (dailyNewsDigest && dailyNewsDigest.fetchedAt && (Date.now() - dailyNewsDigest.fetchedAt) < 24 * 3600000) {
        if (dailyNewsDigest.interestPosts && dailyNewsDigest.interestPosts.length > 0) {
          const parts = ['TRENDING IN USER\'S INTERESTS (use to tease — never guilt-trip about tragedies or wars):'];
          for (const p of dailyNewsDigest.interestPosts) {
            parts.push(`- "${p.title}" (${p.subreddit}, about: ${p.topic})`);
          }
          newsContext = parts.join('\n');
        }
      }
    } catch (e) { /* news is non-critical */ }

    // Personalized context
    const personalizedContext = await JestyStorage.buildPersonalizedContext();

    if (typeof CONFIG === 'undefined' || !CONFIG.API_URL) {
      throw new Error('API not configured');
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

    // First 3 roasts ever: force the strongest angles in sequence
    const hasNews = newsContext.length > 0;
    let angle;
    const { jesty_data: _d } = await chrome.storage.local.get(['jesty_data']);
    const totalGenerated = _d?.profile?.total_roasts || 0;
    const FIRST_ROAST_ANGLES = ['IDENTITY READ', 'CONTRADICTION', 'PATTERN EXPOSE'];
    if (totalGenerated < 3) {
      angle = FIRST_ROAST_ANGLES[totalGenerated];
      const idx = ROAST_ANGLES.indexOf(angle);
      if (idx !== -1) _persistAngleHistory(idx);
    } else {
      angle = pickAngle(hasNews);
    }
    const angleDirective = `\n\nANGLE: Use the ${angle} angle for this roast. Commit to it fully.`;

    // Fetch recent roasts to avoid repetition (include topics so AI avoids same subjects)
    const recentRoasts = await getRecentRoasts(5);
    const topicRoasts = await getRecentRoasts(8); // Wider window for topic avoidance
    let recentRoastsBlock = '';
    if (recentRoasts.length > 0) {
      const lines = recentRoasts.map((r, i) => {
        const topics = r.roasted_topics && r.roasted_topics.length > 0
          ? ` [about: ${r.roasted_topics.join(', ')}]`
          : '';
        return `${i + 1}. "${r.text}"${topics}`;
      });
      const recentTopics = [...new Set(topicRoasts.flatMap(r => r.roasted_topics || []))];
      const topicWarning = recentTopics.length > 0
        ? `\nAVOID THESE TOPICS (already roasted recently): ${recentTopics.join(', ')}`
        : '';
      recentRoastsBlock = `\n\nYOUR LAST ROASTS (DO NOT repeat these or use similar angles/phrasing/topics):\n${lines.join('\n')}${topicWarning}`;
    }

    // Build full system prompt
    const shortDirective = options.short
      ? '\n\nLENGTH OVERRIDE: Max 8 words. One punchy line. Even shorter than usual.'
      : '';

    const fullPrompt = personalizedContext
      ? `${tierPrompt}${moodDirective}${angleDirective}${recentRoastsBlock}${shortDirective}\n\nUSER CONTEXT:\n${personalizedContext}`
      : `${tierPrompt}${moodDirective}${angleDirective}${recentRoastsBlock}${shortDirective}`;

    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jesty-Key': CONFIG.API_KEY },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: `${timeContext}\n\n${tabList}${realTimeContext}${(angle === 'NEWS ANCHOR' || angle === 'REAL-TALK') && newsContext ? '\n\n' + newsContext : ''}` }
        ],
        max_tokens: options.short ? 25 : 40,
        temperature: 0.78
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      let errorMessage = 'API request failed';
      try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
      } catch (e) { /* response body not JSON */ }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty API response');
    const rawResponse = rawContent.trim();

    let joke = rawResponse;
    let mood = 'smug';

    const validMoods = userTier === 'pro' ? PRO_MOODS : userTier === 'premium' ? PREMIUM_MOODS : FREE_MOODS;

    const lastPipe = rawResponse.lastIndexOf('|');
    if (lastPipe !== -1) {
      joke = rawResponse.slice(0, lastPipe).trim();
      const moodTag = rawResponse.slice(lastPipe + 1).trim().toLowerCase();
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
    const { roast, milestone, streakReward } = await JestyStorage.saveRoast({
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

    // Update tab cooldowns — track domains mentioned in this roast
    const mentionedDomains = new Set(extractKeywords(joke).map(k => k.toLowerCase()));
    if (activeTab) mentionedDomains.add(extractDomain(activeTab.url));
    for (const domain of mentionedDomains) {
      if (domain && !domain.startsWith('chrome') && !domain.startsWith('new')) {
        cooldowns[domain] = {
          roastedAt: Date.now(),
          count: (cooldowns[domain]?.count || 0) + 1
        };
      }
    }
    await chrome.storage.local.set({ _jestyRoastedTabCooldown: cooldowns });

    return {
      joke,
      mood,
      roast,
      milestone,
      streakReward,
      remaining: isPremiumUser ? Infinity : updatedCap.remaining
    };
  }

  const DEEP_READ_PROMPT = `You're Jesty — a sharp, brutally honest blob who lives in someone's browser. You see their tabs and you have a LOT to say.

DEEP READ MODE — THIS IS NOT A REGULAR ROAST.
Write a FULL PARAGRAPH. 4-6 sentences minimum. Go deep. Be relentless.
Analyze their entire browser state like a friend who just looked at their screen and can't hold back.

RULES:
- Name specific tabs, domains, search queries by name. Vague = failure.
- Call out contradictions between tabs. Name what the combination reveals about them.
- Identify patterns — what they keep going back to, what they're avoiding, what they're pretending to do.
- Be brutally honest. Maximum directness. Don't soften anything. No "but hey" or "just kidding".
- Make them feel uncomfortably seen. Say what they already know but won't admit.
- Write like a real person talking, not a bot generating content. Casual, sharp, unfiltered.
- DO NOT write a list. Write flowing sentences. One continuous paragraph.
- No emojis. Plain text only.

FORMAT: Start with a short punchy title (3-6 words, no quotes), then a line break, then the full paragraph.

EXAMPLE:
Procrastinating in Surround Sound
You've got 34 tabs open and not one of them is the thing you're actually supposed to be doing. Gmail is screaming at you with unread emails you've been ignoring since Tuesday, but sure, let's browse Reddit for the fourth time today. That Udemy course you bought three months ago is still on tab two — you opened it once, watched the intro, and never went back. Meanwhile you've got a job application half-filled since last week sitting next to a Zillow listing you absolutely cannot afford. The LinkedIn tab is just there for moral support at this point. You're not multitasking, you're hoarding anxiety with a search bar.

After your paragraph, add | and a mood (smug, suspicious, yikes, eyeroll, disappointed, melting, dead).`;

  async function generateDeepRead() {
    const tabs = await chrome.tabs.query({});
    if (!tabs.length) return { error: 'No tabs found' };

    await JestyStorage.updateCategoryStats(tabs);

    const now = new Date();
    const hour = now.getHours();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeLabel = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late night';

    const activeTab = tabs.find(t => t.active);
    const otherTabs = shuffleArray(tabs.filter(t => !t.active)).slice(0, 15);
    const selectedTabs = activeTab ? [activeTab, ...otherTabs] : shuffleArray(tabs).slice(0, 16);

    const tabList = selectedTabs.map(tab => {
      const tags = [];
      if (tab.active) tags.push('ACTIVE NOW');
      if (tab.audible) tags.push('playing audio');
      if (tab.pinned) tags.push('pinned');
      const emailCtx = parseEmailContext(tab.url, tab.title);
      if (emailCtx) {
        tags.push(emailCtx);
      } else {
        const extra = parseUrlContext(tab.url);
        if (extra) tags.push(extra);
      }
      const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
      const safeTitle = (tab.title || '').replace(/[\r\n]/g, ' ').slice(0, 200);
      return `- ${safeTitle} (${tab.url})${suffix}`;
    }).join('\n');

    const timeContext = `[It's ${day} ${timeLabel}, ${hour}:${String(now.getMinutes()).padStart(2, '0')}. User has ${tabs.length} tabs open.]`;
    const realTimeContext = await fetchRealTimeContext(tabs);
    const personalizedContext = await JestyStorage.buildPersonalizedContext();
    const userTier = await JestyPremium.getTier();

    const fullPrompt = personalizedContext
      ? `${DEEP_READ_PROMPT}\n\nUSER CONTEXT:\n${personalizedContext}`
      : DEEP_READ_PROMPT;

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Jesty-Key': CONFIG.API_KEY },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          messages: [
            { role: 'system', content: fullPrompt },
            { role: 'user', content: `${timeContext}\n\n${tabList}${realTimeContext}` }
          ],
          max_tokens: 350,
          temperature: 0.85
        })
      });

      if (!response.ok) throw new Error(`Deep read API error: ${response.status}`);

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';

      const lastPipe = raw.lastIndexOf('|');
      let fullText, mood;
      if (lastPipe > 0) {
        fullText = raw.substring(0, lastPipe).trim();
        const moodTag = raw.substring(lastPipe + 1).trim().toLowerCase();
        const validMoods = userTier === 'pro' ? PRO_MOODS : userTier === 'premium' ? PREMIUM_MOODS : FREE_MOODS;
        mood = validMoods.includes(moodTag) ? moodTag : detectExpression(fullText);
      } else {
        fullText = raw;
        mood = detectExpression(raw);
      }

      // Split title (first line) from body (rest)
      const firstBreak = fullText.indexOf('\n');
      let title, body;
      if (firstBreak > 0 && firstBreak < 80) {
        title = fullText.substring(0, firstBreak).trim();
        body = fullText.substring(firstBreak + 1).trim();
      } else {
        title = 'Deep Read';
        body = fullText;
      }

      return { title, body, text: fullText, mood };
    } catch (e) {
      return { error: e.message };
    }
  }

  return { generate, generateDeepRead };
})();
