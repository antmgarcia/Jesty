/**
 * Jesty Storage Module
 * Handles all persistent data for personalization
 */

const SCHEMA_VERSION = "1.0";
const MAX_ROASTS = 100;
const MAX_CONVERSATIONS = 50;

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
    'linkedin.com', 'reddit.com', 'tiktok.com', 'threads.net',
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
    'twitch.tv', 'steampowered', 'playstation.com', 'xbox.com',
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
      traits: {
        procrastinator_score: 0,
        night_owl_score: 0,
        impulse_shopper_score: 0,
        tab_hoarder_score: 0
      },
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
        last_active_date: null
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
      premium_since: null
    }
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
    console.log('Jesty storage initialized');
    return defaultData;
  }
  return existing.jesty_data;
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
  await updateStreak(data, now);

  // Update patterns
  await updatePatterns(data, roastData.tabCount || 0);

  await saveJestyData(data);

  // Check milestones after save
  const milestone = await checkMilestones();

  return { roast, milestone };
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
async function updateStreak(data, now) {
  const today = now.toISOString().split('T')[0];
  const lastActive = data.milestones.streaks.last_active_date;

  if (!lastActive) {
    // First day
    data.milestones.streaks.current_daily_streak = 1;
    data.milestones.streaks.longest_daily_streak = 1;
  } else if (lastActive === today) {
    // Same day, no change
  } else {
    const lastDate = new Date(lastActive);
    const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      data.milestones.streaks.current_daily_streak++;
      if (data.milestones.streaks.current_daily_streak > data.milestones.streaks.longest_daily_streak) {
        data.milestones.streaks.longest_daily_streak = data.milestones.streaks.current_daily_streak;
      }
    } else {
      // Streak broken
      data.milestones.streaks.current_daily_streak = 1;
    }
  }

  data.milestones.streaks.last_active_date = today;
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
 * Check for new milestones
 */
async function checkMilestones() {
  const data = await getJestyData();
  const count = data.profile.total_roasts;

  const thresholds = [
    { count: 25, key: 'roast_25' },
    { count: 60, key: 'roast_60' },
    { count: 100, key: 'roast_100' },
    { count: 500, key: 'roast_500' },
    { count: 1000, key: 'roast_1000' }
  ];

  for (const { count: threshold, key } of thresholds) {
    if (count >= threshold && !data.milestones.roasts[key]) {
      data.milestones.roasts[key] = new Date().toISOString();
      await saveJestyData(data);
      return {
        milestone: threshold,
        isNew: true,
        message: getMilestoneMessage(threshold)
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
 * Build personalized context for API
 */
async function buildPersonalizedContext() {
  const data = await getJestyData();
  const context = [];

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
    saveRoast,
    markRoastShared,
    markRoastRefreshed,
    updateCategoryStats,
    startConversation,
    addMessage,
    getCurrentConversation,
    getRecentTopics,
    getLastRoast,
    buildPersonalizedContext,
    getUserStats,
    checkMilestones,
    getMilestoneMessage,
    recordActionFollowed,
    getActionCelebrationMessage,
    clearAllData,
    categorizeUrl,
    categorizeTabs
  };
}
