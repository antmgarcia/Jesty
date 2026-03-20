/**
 * Jesty Storage Module
 * Handles all persistent data for personalization
 */

const SCHEMA_VERSION = "1.3";
const MAX_ROASTS = 100;
const MAX_CONVERSATIONS = 50;
const MAX_DAILY_REPORTS = 7;
const MAX_FOCUS_SESSIONS = 50;
const MAX_RECORDS = 50;

/** Local date string (YYYY-MM-DD) for daily cap resets at user's midnight */
function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Schema migration chain
 * Each migration upgrades data from one version to the next.
 */
const MIGRATIONS = {
  "1.0_to_1.1": (data) => {
    // P1.4: Daily cap tracking
    if (!data.settings.daily_cap) data.settings.daily_cap = 8;
    if (data.settings.roasts_today === undefined) data.settings.roasts_today = 0;
    if (!data.settings.roast_cap_date) data.settings.roast_cap_date = null;

    // P1.6: Shame score tracking
    if (data.profile.last_shame_score === undefined) data.profile.last_shame_score = 0;

    // P2.4: Chat daily cap
    if (data.settings.chats_today === undefined) data.settings.chats_today = 0;
    if (!data.settings.chat_cap_date) data.settings.chat_cap_date = null;

    data.version = "1.1";
    return data;
  },
  "1.1_to_1.2": (data) => {
    // P2.8: Progression / Tamagotchi
    if (!data.progression) {
      data.progression = { level: 1, xp: 0, xp_to_next: 100, total_xp: 0 };
    }

    // P2.9: Records
    if (!data.records) {
      data.records = { wall_of_shame: [], hall_of_fame: [] };
    }

    // P2.10: Daily reports
    if (!data.daily_reports) {
      data.daily_reports = [];
    }

    // P3.1: Subscription fields
    if (!data.settings.subscription_tier) data.settings.subscription_tier = null;
    if (!data.settings.subscription_status) data.settings.subscription_status = null;
    if (!data.settings.subscription_id) data.settings.subscription_id = null;
    if (!data.settings.subscription_expires) data.settings.subscription_expires = null;

    data.version = "1.2";
    return data;
  },
  "1.2_to_1.3": (data) => {
    // Focus Time: session history
    if (!data.focus_sessions) data.focus_sessions = [];

    data.version = "1.3";
    return data;
  }
};

/**
 * Run migrations if stored version < current version
 */
function migrateData(data) {
  const versions = ["1.0", "1.1", "1.2", "1.3"];
  let currentIdx = versions.indexOf(data.version || "1.0");
  const targetIdx = versions.indexOf(SCHEMA_VERSION);

  if (currentIdx === -1) currentIdx = 0;

  while (currentIdx < targetIdx) {
    const from = versions[currentIdx];
    const to = versions[currentIdx + 1];
    const key = `${from}_to_${to}`;
    if (MIGRATIONS[key]) {
      data = MIGRATIONS[key](data);
    }
    currentIdx++;
  }

  data.version = SCHEMA_VERSION;
  return data;
}

// Action followed celebration messages
const ACTION_MESSAGES = {
  first: [
    "Wait, you actually listened? I'm shocked. And proud. Mostly shocked.",
    "You closed it! I didn't think you had it in you.",
    "First time following advice? Mark your calendar."
  ],
  streak_3: [
    "Three in a row? Who are you and what did you do with my user?",
    "A hat trick of obedience. Impressive.",
    "Three tabs closed on command. You're trainable after all."
  ],
  streak_7: [
    "A whole week of listening? I'm getting emotional.",
    "Seven straight. You're basically my pet now.",
    "Week streak! Your browser thanks you."
  ],
  milestone_10: [
    "10 tabs closed on my orders. You've earned a salute.",
    "Double digits! You're officially reformed.",
    "10 down. Only about 40 more to go for that tab bankruptcy."
  ],
  milestone_25: [
    "25 suggestions followed. You deserve a trophy. Or therapy.",
    "Quarter century of obedience. You're my favorite minion.",
    "25! At this point, I should be paying you."
  ],
  generic: [
    "You closed {domain}? Bold. I approve.",
    "Gone! {domain} didn't deserve you anyway.",
    "{domain} has left the chat. Finally.",
    "One less distraction. You're welcome.",
    "Closed it! Your future self thanks you.",
    "Look at you, taking my advice. This is new.",
    "{domain}? Gone. Productivity? Maybe incoming."
  ]
};

// Milestone celebration messages
const MILESTONE_MESSAGES = {
  25: [
    "25 roasts and you're still here. Glutton for punishment, huh?",
    "Quarter-century of judgment. You're officially a regular.",
    "25 times I've seen your tabs. We're basically dating now."
  ],
  60: [
    "60 roasts deep. At this point, I know your secrets.",
    "60 tabs of chaos witnessed. I should charge therapy rates.",
    "Roast 60. Your browser history has no more mysteries."
  ],
  100: [
    "Triple digits! 100 roasts and zero self-improvement. Iconic.",
    "Century club! You've been judged more than a reality show.",
    "100 roasts. I've seen you at your worst. And your worster."
  ],
  500: [
    "500?! I know you better than your search history knows you.",
    "Half a thousand roasts. You're not a user, you're family.",
    "500 burns survived. You should put this on your resume."
  ],
  1000: [
    "1000. LEGEND. You've been roasted more than coffee beans.",
    "A thousand roasts. At this point, I should pay you rent.",
    "1000 tabs judged. You're officially my longest relationship."
  ]
};

/**
 * Get a random milestone message
 */
function getMilestoneMessage(milestone) {
  const messages = MILESTONE_MESSAGES[milestone];
  if (!messages) return null;
  return messages[Math.floor(Math.random() * messages.length)];
}

// Tab category mappings
const TAB_CATEGORIES = {
  social_media: [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'reddit.com', 'tiktok.com', 'threads.net',
    'mastodon', 'bluesky'
  ],
  streaming: [
    'netflix.com', 'youtube.com', 'twitch.tv', 'hulu.com',
    'disneyplus.com', 'spotify.com', 'primevideo', 'hbomax',
    'peacock', 'crunchyroll'
  ],
  shopping: [
    'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com',
    'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress',
    'wish.com', 'shein.com'
  ],
  work: [
    'slack.com', 'notion.so', 'asana.com', 'trello.com',
    'monday.com', 'figma.com', 'github.com', 'gitlab.com',
    'jira', 'confluence', 'basecamp', 'linear.app'
  ],
  productivity: [
    'docs.google.com', 'sheets.google.com', 'calendar.google.com',
    'mail.google.com', 'outlook.com', 'drive.google.com',
    'dropbox.com', 'evernote.com'
  ],
  dating: [
    'tinder.com', 'bumble.com', 'hinge.co', 'match.com',
    'okcupid.com', 'plenty', 'grindr', 'her.app'
  ],
  food_delivery: [
    'doordash.com', 'ubereats.com', 'grubhub.com', 'postmates.com',
    'seamless.com', 'caviar', 'instacart.com'
  ],
  travel: [
    'airbnb.com', 'booking.com', 'expedia.com', 'kayak.com',
    'tripadvisor', 'hotels.com', 'vrbo.com', 'skyscanner'
  ],
  news: [
    'cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost',
    'theguardian', 'reuters.com', 'apnews.com'
  ],
  finance: [
    'robinhood.com', 'coinbase.com', 'mint.com', 'chase.com',
    'bankofamerica', 'venmo.com', 'paypal.com', 'binance'
  ],
  learning: [
    'coursera.org', 'udemy.com', 'duolingo.com', 'khanacademy',
    'skillshare', 'linkedin.com/learning', 'edx.org'
  ],
  gaming: [
    'steampowered', 'playstation.com', 'xbox.com',
    'epicgames', 'itch.io', 'roblox.com', 'discord.com'
  ],
  ai: [
    'chat.openai', 'claude.ai', 'bard.google', 'midjourney',
    'perplexity.ai', 'poe.com', 'huggingface'
  ]
};

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get the default data structure
 */
function getDefaultData() {
  return {
    version: SCHEMA_VERSION,
    profile: {
      user_id: generateUUID(),
      created_at: new Date().toISOString(),
      total_roasts: 0,
      total_shares: 0,
      total_conversations: 0,
      patterns: {
        active_hours: [],
        active_days: [],
        avg_tabs_open: 0,
        peak_tabs: 0
      },
      top_categories: [],
      interests: [],
      traits: {
        procrastinator_score: 0,
        night_owl_score: 0,
        impulse_shopper_score: 0,
        tab_hoarder_score: 0
      },
      user_name: null,
      last_shame_score: 0,
      updated_at: new Date().toISOString()
    },
    roasts: [],
    conversations: [],
    milestones: {
      roasts: {
        first_roast: null,
        roast_25: null,
        roast_60: null,
        roast_100: null,
        roast_500: null,
        roast_1000: null
      },
      first_share: null,
      first_conversation: null,
      first_support: null,
      streaks: {
        current_daily_streak: 0,
        longest_daily_streak: 0,
        last_active_date: null,
        claimed_streak_rewards: []
      },
      achievements: {
        night_owl: false,
        tab_hoarder: false,
        comeback_king: false,
        glutton: false,
        sharer: false
      },
      actions: {
        total_actions_followed: 0,
        first_action_followed: null,
        action_streak: 0,
        longest_action_streak: 0,
        last_action_date: null
      }
    },
    settings: {
      roast_intensity: "medium",
      favorite_topics: [],
      off_limits: [],
      daily_roast_reminder: false,
      is_premium: false,
      premium_since: null,
      daily_cap: 8,
      roasts_today: 0,
      roast_cap_date: null,
      chats_today: 0,
      chat_cap_date: null,
      subscription_tier: null,
      subscription_status: null,
      subscription_id: null,
      subscription_expires: null
    },
    progression: {
      level: 1,
      xp: 0,
      xp_to_next: 100,
      total_xp: 0
    },
    records: {
      wall_of_shame: [],
      hall_of_fame: []
    },
    daily_reports: [],
    focus_sessions: [],
    user_tasks: []
  };
}

/**
 * Initialize storage (called on install)
 */
async function initializeStorage() {
  const existing = await chrome.storage.local.get(['jesty_data']);
  if (!existing.jesty_data) {
    const defaultData = getDefaultData();
    await chrome.storage.local.set({ jesty_data: defaultData });
    return defaultData;
  }

  // Run migrations if schema version is outdated
  let data = existing.jesty_data;
  let dirty = false;

  if (data.version !== SCHEMA_VERSION) {
    data = migrateData(data);
    dirty = true;
  }

  // Ensure user_name field exists (for existing users before this feature)
  if (data.profile.user_name === undefined) {
    data.profile.user_name = null;
    dirty = true;
  }

  // Ensure interests array exists (for existing users before this feature)
  if (!data.profile.interests) {
    data.profile.interests = [];
    dirty = true;
  }

  if (dirty) {
    await chrome.storage.local.set({ jesty_data: data });
  }

  return data;
}

/**
 * Get all Jesty data
 */
async function getJestyData() {
  const result = await chrome.storage.local.get(['jesty_data']);
  if (!result.jesty_data) {
    return await initializeStorage();
  }
  return result.jesty_data;
}

/**
 * Save all Jesty data
 */
async function saveJestyData(data) {
  // Cap unbounded arrays
  if (data.daily_reports && data.daily_reports.length > MAX_DAILY_REPORTS) {
    data.daily_reports = data.daily_reports.slice(-MAX_DAILY_REPORTS);
  }
  if (data.focus_sessions && data.focus_sessions.length > MAX_FOCUS_SESSIONS) {
    data.focus_sessions = data.focus_sessions.slice(0, MAX_FOCUS_SESSIONS);
  }
  if (data.records) {
    if (data.records.wall_of_shame && data.records.wall_of_shame.length > MAX_RECORDS) {
      data.records.wall_of_shame = data.records.wall_of_shame.slice(-MAX_RECORDS);
    }
    if (data.records.hall_of_fame && data.records.hall_of_fame.length > MAX_RECORDS) {
      data.records.hall_of_fame = data.records.hall_of_fame.slice(-MAX_RECORDS);
    }
  }
  await chrome.storage.local.set({ jesty_data: data });
}

/**
 * Categorize a URL
 */
function categorizeUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [category, domains] of Object.entries(TAB_CATEGORIES)) {
      if (domains.some(domain => hostname.includes(domain))) {
        return category;
      }
    }
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * Categorize multiple tabs
 */
function categorizeTabs(tabs) {
  const categories = {};
  for (const tab of tabs) {
    const cat = categorizeUrl(tab.url);
    categories[cat] = (categories[cat] || 0) + 1;
  }
  return categories;
}

/**
 * Get time of day label
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get day of week
 */
function getDayOfWeek() {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
}

/**
 * Save a roast
 */
async function saveRoast(roastData) {
  const data = await getJestyData();
  const now = new Date();

  const roast = {
    id: generateUUID(),
    timestamp: now.toISOString(),
    text: roastData.text,
    mood: roastData.mood,
    context: {
      tab_count: roastData.tabCount || 0,
      categories_present: roastData.categories || [],
      time_of_day: getTimeOfDay(),
      day_of_week: getDayOfWeek()
    },
    roasted_topics: roastData.topics || [],
    was_shared: false,
    was_refreshed: false,
    triggered_conversation: false
  };

  // Add to beginning, keep max
  data.roasts.unshift(roast);
  data.roasts = data.roasts.slice(0, MAX_ROASTS);

  // Update profile
  data.profile.total_roasts++;

  // Check for first roast milestone
  if (!data.milestones.roasts.first_roast) {
    data.milestones.roasts.first_roast = now.toISOString();
  }

  // Update streak
  const streakReward = await updateStreak(data, now);

  // Apply streak XP reward to progression
  if (streakReward && streakReward.xp) {
    data.progression.xp += streakReward.xp;
    data.progression.total_xp += streakReward.xp;
  }

  // Update patterns
  await updatePatterns(data, roastData.tabCount || 0);

  await saveJestyData(data);

  // Check milestones after save
  const milestone = await checkMilestones();

  return { roast, milestone, streakReward };
}

/**
 * Mark last roast as shared
 */
async function markRoastShared() {
  const data = await getJestyData();
  if (data.roasts.length > 0) {
    data.roasts[0].was_shared = true;
    data.profile.total_shares++;

    // First share milestone
    if (!data.milestones.first_share) {
      data.milestones.first_share = new Date().toISOString();
    }

    // Sharer achievement (10 shares)
    if (data.profile.total_shares >= 10) {
      data.milestones.achievements.sharer = true;
    }

    await saveJestyData(data);
  }
}

/**
 * Mark last roast as refreshed
 */
async function markRoastRefreshed() {
  const data = await getJestyData();
  if (data.roasts.length > 0) {
    data.roasts[0].was_refreshed = true;
    await saveJestyData(data);
  }
}

/**
 * Update daily streak
 */
const STREAK_XP_REWARDS = [
  { streak: 3, xp: 30 },
  { streak: 7, xp: 75 },
  { streak: 14, xp: 150 },
  { streak: 30, xp: 350 },
  { streak: 60, xp: 750 },
  { streak: 100, xp: 1500 }
];

async function updateStreak(data, now) {
  const today = getLocalDate();
  const lastActive = data.milestones.streaks.last_active_date;
  let streakReward = null;

  if (!lastActive) {
    // First day
    data.milestones.streaks.current_daily_streak = 1;
    data.milestones.streaks.longest_daily_streak = 1;
  } else if (lastActive === today) {
    // Same day, no change
  } else {
    // Compare local date strings to get day difference
    const lastParts = lastActive.split('-').map(Number);
    const todayParts = today.split('-').map(Number);
    const lastMs = new Date(lastParts[0], lastParts[1] - 1, lastParts[2]).getTime();
    const todayMs = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]).getTime();
    const diffDays = Math.round((todayMs - lastMs) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      data.milestones.streaks.current_daily_streak++;
      if (data.milestones.streaks.current_daily_streak > data.milestones.streaks.longest_daily_streak) {
        data.milestones.streaks.longest_daily_streak = data.milestones.streaks.current_daily_streak;
      }

      // Check streak XP reward
      const current = data.milestones.streaks.current_daily_streak;
      const claimed = data.milestones.streaks.claimed_streak_rewards || [];
      for (const { streak, xp } of STREAK_XP_REWARDS) {
        if (current >= streak && !claimed.includes(streak)) {
          claimed.push(streak);
          data.milestones.streaks.claimed_streak_rewards = claimed;
          streakReward = { streak, xp };
          break;
        }
      }
    } else {
      // Streak broken
      data.milestones.streaks.current_daily_streak = 1;
    }
  }

  data.milestones.streaks.last_active_date = today;
  return streakReward;
}

/**
 * Update usage patterns
 */
async function updatePatterns(data, tabCount) {
  const hour = new Date().getHours();
  const day = getDayOfWeek();

  // Update active hours (keep unique, last 20)
  if (!data.profile.patterns.active_hours.includes(hour)) {
    data.profile.patterns.active_hours.push(hour);
    data.profile.patterns.active_hours = data.profile.patterns.active_hours.slice(-20);
  }

  // Update active days
  if (!data.profile.patterns.active_days.includes(day)) {
    data.profile.patterns.active_days.push(day);
  }

  // Update tab stats
  const avgTabs = data.profile.patterns.avg_tabs_open;
  const totalRoasts = data.profile.total_roasts;
  data.profile.patterns.avg_tabs_open = Math.round(
    (avgTabs * (totalRoasts - 1) + tabCount) / totalRoasts
  );

  if (tabCount > data.profile.patterns.peak_tabs) {
    data.profile.patterns.peak_tabs = tabCount;
  }

  // Tab hoarder achievement (50+ tabs)
  if (tabCount >= 50) {
    data.milestones.achievements.tab_hoarder = true;
  }

  // Night owl check (after midnight, 10 times)
  if (hour >= 0 && hour < 5) {
    // Count night roasts
    const nightRoasts = data.roasts.filter(r => {
      const h = new Date(r.timestamp).getHours();
      return h >= 0 && h < 5;
    }).length;
    if (nightRoasts >= 10) {
      data.milestones.achievements.night_owl = true;
    }
  }

  // Update trait scores
  updateTraitScores(data);

  data.profile.updated_at = new Date().toISOString();
}

/**
 * Update category stats from tabs
 */
async function updateCategoryStats(tabs) {
  const data = await getJestyData();
  const categories = categorizeTabs(tabs);

  // Merge with existing top categories
  const existing = {};
  for (const cat of data.profile.top_categories) {
    existing[cat.category] = cat.count;
  }

  for (const [cat, count] of Object.entries(categories)) {
    existing[cat] = (existing[cat] || 0) + count;
  }

  // Convert back to sorted array
  data.profile.top_categories = Object.entries(existing)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  await saveJestyData(data);

  return Object.keys(categories);
}

/**
 * Calculate trait scores based on behavior
 */
function updateTraitScores(data) {
  const roasts = data.roasts;
  if (roasts.length < 5) return; // Need enough data

  // Procrastinator: social/streaming during work hours
  const workHourRoasts = roasts.filter(r => {
    const h = new Date(r.timestamp).getHours();
    return h >= 9 && h <= 17;
  });
  const procrastRoasts = workHourRoasts.filter(r =>
    r.context.categories_present.some(c => ['social_media', 'streaming', 'gaming'].includes(c))
  );
  data.profile.traits.procrastinator_score = workHourRoasts.length > 0
    ? Math.min(1, procrastRoasts.length / workHourRoasts.length)
    : 0;

  // Night owl: activity after midnight
  const nightRoasts = roasts.filter(r => {
    const h = new Date(r.timestamp).getHours();
    return h >= 0 && h < 5;
  });
  data.profile.traits.night_owl_score = Math.min(1, nightRoasts.length / 10);

  // Impulse shopper: shopping category frequency
  const shoppingRoasts = roasts.filter(r =>
    r.context.categories_present.includes('shopping')
  );
  data.profile.traits.impulse_shopper_score = Math.min(1, shoppingRoasts.length / roasts.length * 2);

  // Tab hoarder: based on avg tabs
  data.profile.traits.tab_hoarder_score = Math.min(1, data.profile.patterns.avg_tabs_open / 40);
}

/**
 * Extract topics from tab titles/URLs and update user interests.
 * Called on every roast — lightweight keyword extraction, no API calls.
 */
const INTEREST_KEYWORDS = {
  // Sports — teams & leagues
  football: {
    keywords: ['arsenal', 'chelsea', 'liverpool', 'man united', 'manchester united', 'man city', 'manchester city', 'tottenham', 'spurs', 'barcelona', 'real madrid', 'bayern', 'juventus', 'psg', 'inter milan', 'ac milan', 'dortmund', 'atletico'],
    category: 'football'
  },
  nfl: {
    keywords: ['chiefs', 'eagles', 'cowboys', '49ers', 'ravens', 'bills', 'dolphins', 'packers', 'lions', 'bengals', 'jets', 'patriots', 'steelers', 'raiders', 'broncos', 'chargers', 'seahawks', 'rams', 'bears', 'vikings', 'saints', 'falcons', 'buccaneers', 'panthers', 'texans', 'colts', 'titans', 'jaguars', 'browns', 'commanders', 'giants', 'cardinals'],
    category: 'nfl'
  },
  nba: {
    keywords: ['lakers', 'celtics', 'warriors', 'bucks', 'nuggets', 'heat', 'sixers', '76ers', 'knicks', 'nets', 'suns', 'mavericks', 'clippers', 'thunder', 'timberwolves', 'cavaliers', 'grizzlies', 'pelicans', 'raptors', 'spurs nba', 'rockets', 'bulls', 'hawks', 'blazers', 'jazz', 'kings', 'pistons', 'pacers', 'hornets', 'magic', 'wizards'],
    category: 'nba'
  },
  // Tech
  programming: {
    keywords: ['react', 'angular', 'vue', 'svelte', 'nextjs', 'next.js', 'typescript', 'javascript', 'python', 'rust lang', 'golang', 'swift ui', 'flutter', 'tailwind', 'nodejs', 'node.js', 'django', 'laravel', 'ruby on rails'],
    category: 'programming'
  },
  ai_ml: {
    keywords: ['chatgpt', 'openai', 'claude', 'anthropic', 'midjourney', 'stable diffusion', 'hugging face', 'llama', 'gemini ai', 'copilot'],
    category: 'ai'
  },
  // Finance
  crypto: {
    keywords: ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'binance', 'coinbase', 'defi', 'nft', 'blockchain', 'crypto'],
    category: 'crypto'
  },
  stocks: {
    keywords: ['nasdaq', 'dow jones', 's&p 500', 'wall street', 'stock market', 'robinhood', 'webull', 'etrade', 'fidelity investments', 'vanguard'],
    category: 'stocks'
  },
  // Entertainment
  gaming: {
    keywords: ['playstation', 'xbox', 'nintendo', 'steam', 'fortnite', 'minecraft', 'valorant', 'league of legends', 'apex legends', 'call of duty', 'gta', 'elden ring', 'zelda', 'baldurs gate', 'cyberpunk', 'diablo', 'overwatch', 'destiny', 'roblox'],
    category: 'gaming'
  },
  anime: {
    keywords: ['crunchyroll', 'myanimelist', 'one piece', 'naruto', 'demon slayer', 'jujutsu kaisen', 'attack on titan', 'dragon ball', 'hunter x hunter', 'my hero academia', 'anime'],
    category: 'anime'
  },
  music: {
    keywords: ['spotify', 'soundcloud', 'bandcamp', 'genius lyrics', 'pitchfork', 'billboard', 'rolling stone music'],
    category: 'music'
  },
  // Lifestyle
  fitness: {
    keywords: ['workout', 'gym', 'crossfit', 'peloton', 'strava', 'myfitnesspal', 'bodybuilding', 'running', 'marathon', 'yoga'],
    category: 'fitness'
  },
  fashion: {
    keywords: ['zara', 'h&m', 'uniqlo', 'asos', 'nike', 'adidas', 'new balance', 'jordan', 'sneakers', 'grailed', 'depop', 'poshmark', 'farfetch', 'ssense'],
    category: 'fashion'
  },
  food: {
    keywords: ['recipe', 'cooking', 'michelin', 'yelp', 'opentable', 'allrecipes', 'bon appetit', 'food network', 'serious eats'],
    category: 'food'
  },
  travel: {
    keywords: ['airbnb', 'booking.com', 'expedia', 'kayak', 'tripadvisor', 'skyscanner', 'google flights', 'lonely planet', 'nomadlist'],
    category: 'travel'
  },
  // Learning
  learning: {
    keywords: ['coursera', 'udemy', 'khan academy', 'edx', 'skillshare', 'leetcode', 'hackerrank', 'codecademy', 'duolingo', 'brilliant'],
    category: 'learning'
  }
};

function extractInterestsFromTabs(tabs) {
  const found = {};

  for (const tab of tabs) {
    const text = `${tab.title || ''} ${tab.url || ''}`.toLowerCase();

    for (const [group, { keywords, category }] of Object.entries(INTEREST_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          const topic = kw;
          if (!found[topic]) {
            found[topic] = { topic, category, count: 0 };
          }
          found[topic].count++;
          break; // One match per group per tab is enough
        }
      }
    }
  }

  return Object.values(found);
}

async function updateInterests(tabs) {
  const data = await getJestyData();
  if (!data.profile.interests) data.profile.interests = [];

  const detected = extractInterestsFromTabs(tabs);
  if (detected.length === 0) return;

  const now = Date.now();
  const existing = {};
  for (const i of data.profile.interests) {
    existing[i.topic] = i;
  }

  for (const d of detected) {
    if (existing[d.topic]) {
      existing[d.topic].count += d.count;
      existing[d.topic].lastSeen = now;
      existing[d.topic].sessions++;
    } else {
      existing[d.topic] = {
        topic: d.topic,
        category: d.category,
        count: d.count,
        sessions: 1,
        firstSeen: now,
        lastSeen: now
      };
    }
  }

  // Keep top 30 by count, decay old ones
  data.profile.interests = Object.values(existing)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  await saveJestyData(data);
}

/**
 * Check for new milestones
 */
async function checkMilestones() {
  const data = await getJestyData();
  const count = data.profile.total_roasts;

  const thresholds = [
    { count: 25, key: 'roast_25', xp: 50 },
    { count: 60, key: 'roast_60', xp: 100 },
    { count: 100, key: 'roast_100', xp: 200 },
    { count: 500, key: 'roast_500', xp: 500 },
    { count: 1000, key: 'roast_1000', xp: 1000 }
  ];

  for (const { count: threshold, key, xp } of thresholds) {
    if (count >= threshold && !data.milestones.roasts[key]) {
      data.milestones.roasts[key] = new Date().toISOString();
      await saveJestyData(data);
      return {
        milestone: threshold,
        isNew: true,
        message: getMilestoneMessage(threshold),
        xp: xp
      };
    }
  }

  return null;
}

/**
 * Start a new conversation
 */
async function startConversation(triggerRoastId) {
  const data = await getJestyData();

  const conversation = {
    id: generateUUID(),
    started_at: new Date().toISOString(),
    ended_at: null,
    trigger_roast_id: triggerRoastId,
    messages: [],
    message_count: 0,
    user_sentiment: null,
    jesty_won: null
  };

  data.conversations.unshift(conversation);
  data.conversations = data.conversations.slice(0, MAX_CONVERSATIONS);
  data.profile.total_conversations++;

  // First conversation milestone
  if (!data.milestones.first_conversation) {
    data.milestones.first_conversation = new Date().toISOString();
  }

  // Mark the triggering roast
  const triggerRoast = data.roasts.find(r => r.id === triggerRoastId);
  if (triggerRoast) {
    triggerRoast.triggered_conversation = true;
  }

  await saveJestyData(data);
  return conversation;
}

/**
 * Add message to conversation
 */
async function addMessage(conversationId, role, content) {
  const data = await getJestyData();
  const conv = data.conversations.find(c => c.id === conversationId);

  if (conv) {
    conv.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    conv.message_count++;
    conv.ended_at = new Date().toISOString();
    await saveJestyData(data);
  }

  return conv;
}

/**
 * Get the current conversation or null
 */
async function getCurrentConversation() {
  const data = await getJestyData();
  if (data.conversations.length === 0) return null;

  const latest = data.conversations[0];
  // Consider conversation "current" if less than 30 min old
  const age = Date.now() - new Date(latest.ended_at || latest.started_at).getTime();
  if (age < 30 * 60 * 1000) {
    return latest;
  }
  return null;
}

/**
 * Get recent roast topics to avoid
 */
async function getRecentTopics(count = 5) {
  const data = await getJestyData();
  const topics = data.roasts
    .slice(0, count)
    .flatMap(r => r.roasted_topics);
  return [...new Set(topics)];
}

/**
 * Get the last roast
 */
async function getLastRoast() {
  const data = await getJestyData();
  return data.roasts[0] || null;
}

/**
 * Get the user's stored name (or null)
 */
async function getUserName() {
  const data = await getJestyData();
  return data.profile.user_name || null;
}

/**
 * Manually set the user's name (overrides auto-detection)
 */
async function setUserName(name) {
  const data = await getJestyData();
  data.profile.user_name = name || null;
  await saveJestyData(data);
}

/**
 * Build personalized context for API
 */
async function buildPersonalizedContext() {
  const data = await getJestyData();
  const context = [];

  // User's name
  if (data.profile.user_name) {
    context.push(`User's name is ${data.profile.user_name}.`);
  }

  // User patterns
  if (data.profile.traits.night_owl_score > 0.7) {
    context.push("User often browses late at night - you can reference this");
  }
  if (data.profile.traits.tab_hoarder_score > 0.8) {
    context.push("User is a chronic tab hoarder - they usually have 30+ tabs");
  }
  if (data.profile.traits.procrastinator_score > 0.6) {
    context.push("User tends to procrastinate with social media during work hours");
  }
  if (data.profile.traits.impulse_shopper_score > 0.5) {
    context.push("User frequently has shopping tabs open");
  }

  // Streak info
  const streak = data.milestones.streaks.current_daily_streak;
  if (streak > 3) {
    context.push(`User has been roasted ${streak} days in a row`);
  }

  // Recent topics to avoid
  const recentTopics = await getRecentTopics(5);
  if (recentTopics.length > 0) {
    context.push(`Recently roasted (AVOID THESE): ${recentTopics.join(', ')}`);
  }

  // Top category
  const topCat = data.profile.top_categories[0];
  if (topCat && topCat.count > 10) {
    context.push(`User's most common browsing: ${topCat.category}`);
  }

  // Confirmed interests (seen across 3+ sessions)
  const interests = (data.profile.interests || []).filter(i => i.sessions >= 3);
  if (interests.length > 0) {
    const top5 = interests.slice(0, 5).map(i => `${i.topic} (${i.category})`);
    context.push(`User's known interests/obsessions: ${top5.join(', ')}. Use these to make roasts personal — reference specific teams, tools, or topics they keep coming back to.`);
  }

  // Milestones
  const totalRoasts = data.profile.total_roasts;
  if ([25, 60, 100, 500, 1000].includes(totalRoasts)) {
    context.push(`MILESTONE: This is roast #${totalRoasts}! Make it special and acknowledge this achievement.`);
  }

  return context.join('\n');
}

/**
 * Get user stats for display
 */
async function getUserStats() {
  const data = await getJestyData();
  return {
    totalRoasts: data.profile.total_roasts,
    totalShares: data.profile.total_shares,
    currentStreak: data.milestones.streaks.current_daily_streak,
    longestStreak: data.milestones.streaks.longest_daily_streak,
    avgTabs: data.profile.patterns.avg_tabs_open,
    peakTabs: data.profile.patterns.peak_tabs,
    achievements: data.milestones.achievements,
    traits: data.profile.traits
  };
}

/**
 * Record that user followed a suggestion (closed a roasted tab)
 */
async function recordActionFollowed(domain) {
  const data = await getJestyData();
  const now = new Date();

  // Initialize if needed (for existing users)
  if (!data.milestones.actions) {
    data.milestones.actions = {
      total_actions_followed: 0,
      first_action_followed: null,
      action_streak: 0,
      longest_action_streak: 0,
      last_action_date: null
    };
  }

  const actions = data.milestones.actions;
  actions.total_actions_followed++;

  // Track first action
  if (!actions.first_action_followed) {
    actions.first_action_followed = now.toISOString();
  }

  // Update streak
  const today = now.toISOString().split('T')[0];
  if (actions.last_action_date === today) {
    // Same day, just increment total
  } else {
    // New day, check if consecutive
    const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
    actions.action_streak = (actions.last_action_date === yesterday)
      ? actions.action_streak + 1
      : 1;
  }

  if (actions.action_streak > actions.longest_action_streak) {
    actions.longest_action_streak = actions.action_streak;
  }
  actions.last_action_date = today;

  await saveJestyData(data);

  // Get celebration message
  const message = getActionCelebrationMessage(actions, domain);

  return { actions, message };
}

/**
 * Get appropriate celebration message based on action milestones
 */
function getActionCelebrationMessage(actions, domain) {
  const total = actions.total_actions_followed;
  const streak = actions.action_streak;

  let messages;
  let mood = 'happy';

  if (total === 1) {
    messages = ACTION_MESSAGES.first;
    mood = 'suspicious';
  } else if (streak === 3) {
    messages = ACTION_MESSAGES.streak_3;
    mood = 'smug';
  } else if (streak === 7) {
    messages = ACTION_MESSAGES.streak_7;
    mood = 'happy';
  } else if (total === 10) {
    messages = ACTION_MESSAGES.milestone_10;
    mood = 'happy';
  } else if (total === 25) {
    messages = ACTION_MESSAGES.milestone_25;
    mood = 'happy';
  } else {
    messages = ACTION_MESSAGES.generic;
    mood = 'smug';
  }

  let message = messages[Math.floor(Math.random() * messages.length)];
  message = message.replace('{domain}', domain);

  return { text: message, mood };
}

/**
 * Check daily cap. Resets at user's local midnight.
 * Returns { allowed: boolean, remaining: number }
 */
async function checkDailyCap() {
  const data = await getJestyData();
  const today = getLocalDate();

  // Ensure daily_cap matches tier (8 for free, unlimited for premium)
  const freeCap = 8;
  if (!data.settings.is_premium) {
    data.settings.daily_cap = freeCap;
  }
  if (!data.settings.daily_cap || data.settings.daily_cap < 1) {
    data.settings.daily_cap = freeCap;
  }

  // Reset if new day (or if date was never set)
  if (data.settings.roast_cap_date !== today) {
    data.settings.roasts_today = 0;
    data.settings.roast_cap_date = today;
    await saveJestyData(data);
  }

  // Guard against corrupted values
  if (typeof data.settings.roasts_today !== 'number' || data.settings.roasts_today < 0) {
    data.settings.roasts_today = 0;
    await saveJestyData(data);
  }

  const remaining = data.settings.daily_cap - data.settings.roasts_today;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining)
  };
}

/**
 * Increment daily roast count
 */
async function incrementDailyRoast() {
  const data = await getJestyData();
  const today = getLocalDate();

  if (data.settings.roast_cap_date !== today) {
    data.settings.roasts_today = 0;
    data.settings.roast_cap_date = today;
  }

  data.settings.roasts_today++;
  await saveJestyData(data);
}

/**
 * Force-reset daily cap (for testing / debugging)
 */
async function resetDailyCap() {
  const data = await getJestyData();
  data.settings.roasts_today = 0;
  data.settings.roast_cap_date = getLocalDate();
  await saveJestyData(data);
}

/**
 * Check chat cap per conversation (8 messages for free, unlimited for premium).
 * Returns { allowed: boolean, remaining: number, messageCount: number }
 */
async function checkChatCap(conversationId) {
  const data = await getJestyData();
  const conv = data.conversations.find(c => c.id === conversationId);
  const count = conv ? conv.message_count : 0;
  const cap = data.settings.is_premium ? Infinity : 8;
  const remaining = cap - count;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    messageCount: count
  };
}

/**
 * Clear all data (for testing/reset)
 */
async function clearAllData() {
  await chrome.storage.local.remove(['jesty_data']);
  return await initializeStorage();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.JestyStorage = {
    initializeStorage,
    getJestyData,
    saveJestyData,
    saveRoast,
    markRoastShared,
    markRoastRefreshed,
    updateCategoryStats,
    updateInterests,
    startConversation,
    addMessage,
    getCurrentConversation,
    getRecentTopics,
    getLastRoast,
    buildPersonalizedContext,
    getUserStats,
    getUserName,
    setUserName,
    checkMilestones,
    getMilestoneMessage,
    recordActionFollowed,
    getActionCelebrationMessage,
    checkDailyCap,
    incrementDailyRoast,
    resetDailyCap,
    checkChatCap,
    clearAllData,
    categorizeUrl,
    categorizeTabs
  };
}
