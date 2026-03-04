/**
 * Jesty Background Service Worker
 * Monitors tab closures to detect when users follow Jesty's suggestions
 */

const ACTION_TRACKING_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Open welcome tab on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({});
  }
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const { roastedDomains, openTabs } = await chrome.storage.local.get(['roastedDomains', 'openTabs']);

    if (!openTabs || !roastedDomains || roastedDomains.length === 0) return;

    const closedTab = openTabs[tabId];
    if (!closedTab) return;

    // Check if this domain was recently roasted
    const now = Date.now();
    const match = roastedDomains.find(rd => rd.domain === closedTab.domain && now < rd.expiresAt);

    if (match) {
      await createPendingXPGain(closedTab, match);
    }

    // Remove from open tabs cache
    delete openTabs[tabId];
    await chrome.storage.local.set({ openTabs });

  } catch (e) {
    console.error('Jesty: Error processing tab removal:', e);
  }
});

// Update open tabs cache when tabs are created
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (!tab.url || tab.url.startsWith('chrome://')) return;

    const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);

    openTabs[tab.id] = {
      tabId: tab.id,
      domain: extractDomain(tab.url),
      url: tab.url,
      title: tab.title || '',
      firstSeen: Date.now(),
      lastActivated: null
    };

    await chrome.storage.local.set({ openTabs });
  } catch (e) {
    console.error('Jesty: Error tracking new tab:', e);
  }
});

// Update tab info when URL changes + detect Stripe success
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  try {
    if (changeInfo.url.startsWith('chrome://')) return;

    // Detect Stripe payment success URL
    if (changeInfo.url.includes('/success') && changeInfo.url.includes('session_id=')) {
      await handlePaymentSuccess(changeInfo.url);
    }

    const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);

    const existing = openTabs[tabId];
    openTabs[tabId] = {
      tabId: tabId,
      domain: extractDomain(changeInfo.url),
      url: changeInfo.url,
      title: tab.title || '',
      firstSeen: existing?.firstSeen || Date.now(),
      lastActivated: existing?.lastActivated || null
    };

    await chrome.storage.local.set({ openTabs });
  } catch (e) {
    console.error('Jesty: Error updating tab:', e);
  }
});

// Track tab activations for staleness detection + focus session tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);
    if (openTabs[activeInfo.tabId]) {
      openTabs[activeInfo.tabId].lastActivated = Date.now();
      await chrome.storage.local.set({ openTabs });
    }
  } catch (e) { /* non-critical */ }

  // Focus Time: track tab switch during active session
  await trackFocusTabSwitch(activeInfo.tabId);
});

// Clean up expired roasted domains periodically
chrome.alarms.create('cleanupExpired', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupExpired') {
    await cleanupExpiredData();
  } else if (alarm.name === 'dailyReportCheck') {
    await checkDailyReport();
  } else if (alarm.name === 'subscriptionCheck') {
    await checkSubscriptionStatus();
  }
});

/**
 * Award XP for closing a roasted tab
 */
async function createPendingXPGain(closedTab, match) {
  // Random XP between 5-15
  const xp = 5 + Math.floor(Math.random() * 11);

  const xpGain = {
    xp,
    domain: closedTab.domain,
    timestamp: Date.now()
  };

  // Store XP gain (sidepanel/newtab will pick this up via storage listener)
  await chrome.storage.local.set({ pendingXPGain: xpGain });
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

/**
 * Clean up expired tracking data
 */
async function cleanupExpiredData() {
  try {
    const { roastedDomains } = await chrome.storage.local.get(['roastedDomains']);

    if (!roastedDomains) return;

    const now = Date.now();
    const validDomains = roastedDomains.filter(rd => now < rd.expiresAt);

    if (validDomains.length !== roastedDomains.length) {
      await chrome.storage.local.set({ roastedDomains: validDomains });
    }
  } catch (e) {
    console.error('Jesty: Error cleaning up expired data:', e);
  }
}

/**
 * Handle Stripe payment success URL detection
 */
async function handlePaymentSuccess(url) {
  try {
    const urlObj = new URL(url);
    const sessionId = urlObj.searchParams.get('session_id');
    const tier = urlObj.searchParams.get('tier') || 'premium';

    if (!sessionId) return;

    // Activate premium locally
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return;

    if (tier === 'pro') {
      jesty_data.settings.subscription_tier = 'pro';
      jesty_data.settings.subscription_status = 'active';
      jesty_data.settings.is_premium = true;
      if (!jesty_data.settings.premium_since) {
        jesty_data.settings.premium_since = new Date().toISOString();
      }
    } else {
      jesty_data.settings.is_premium = true;
      jesty_data.settings.premium_since = new Date().toISOString();
    }

    jesty_data.settings.premium_session_id = sessionId;
    await chrome.storage.local.set({ jesty_data });
    console.log(`Jesty: ${tier} activated via session ${sessionId}`);
  } catch (e) {
    console.error('Jesty: Error handling payment success:', e);
  }
}

/* ──────────────────────────────────────────────
   FOCUS TIME — Event-driven tab tracking
   ────────────────────────────────────────────── */

// Site classification: maps storage.js TAB_CATEGORIES to Focus Time categories
// (Duplicated here because service worker can't import from storage.js)
const FOCUS_WORK_DOMAINS = [
  'slack.com', 'notion.so', 'asana.com', 'trello.com', 'monday.com',
  'figma.com', 'github.com', 'gitlab.com', 'jira', 'confluence',
  'basecamp', 'linear.app',
  'docs.google.com', 'sheets.google.com', 'calendar.google.com',
  'mail.google.com', 'outlook.com', 'drive.google.com',
  'dropbox.com', 'evernote.com',
  'coursera.org', 'udemy.com', 'duolingo.com', 'khanacademy',
  'skillshare', 'linkedin.com/learning', 'edx.org',
  'chat.openai', 'claude.ai', 'bard.google', 'midjourney',
  'perplexity.ai', 'poe.com', 'huggingface'
];

const FOCUS_DISTRACTION_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com',
  'tiktok.com', 'threads.net', 'mastodon', 'bluesky',
  'youtube.com', 'twitch.tv', 'netflix.com', 'hulu.com',
  'disneyplus.com', 'spotify.com', 'primevideo', 'hbomax',
  'peacock', 'crunchyroll',
  'steampowered', 'playstation.com', 'xbox.com', 'epicgames',
  'itch.io', 'roblox.com', 'discord.com',
  'tinder.com', 'bumble.com', 'hinge.co', 'match.com',
  'okcupid.com', 'grindr', 'her.app',
  'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com',
  'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress',
  'wish.com', 'shein.com'
];

function getFocusCategory(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (FOCUS_WORK_DOMAINS.some(d => hostname.includes(d))) return 'Work';
    if (FOCUS_DISTRACTION_DOMAINS.some(d => hostname.includes(d))) return 'Distraction';
    return 'Neutral';
  } catch {
    return 'Neutral';
  }
}

function computeIslandState(session) {
  const d = session.distractionCount || 0;
  const now = Date.now();
  const streakSeconds = session.currentStreakStart
    ? (now - session.currentStreakStart) / 1000
    : 0;

  if (d >= 5) return 'resigned';
  if (d >= 3) return 'judging';
  if (d === 2) return 'disappointed';
  if (d === 1) return 'skeptical';
  if (d === 0 && streakSeconds >= 300) return 'impressed';
  return 'neutral';
}

async function trackFocusTabSwitch(tabId) {
  try {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    if (!focusSession || !focusSession.active) return;

    const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);
    const tab = openTabs[tabId];
    if (!tab || !tab.url) return;

    const category = getFocusCategory(tab.url);
    const now = Date.now();

    const event = {
      timestamp: now,
      domain: tab.domain || extractDomain(tab.url),
      category
    };

    if (!focusSession.tabSwitches) focusSession.tabSwitches = [];
    focusSession.tabSwitches.push(event);

    // Update distraction count + streak
    if (category === 'Distraction') {
      focusSession.distractionCount = (focusSession.distractionCount || 0) + 1;
      focusSession.currentStreakStart = null; // Reset streak
    } else if (category === 'Work') {
      // Start or continue streak
      if (!focusSession.currentStreakStart) {
        focusSession.currentStreakStart = now;
      }
      // Check if current streak is the longest
      if (focusSession.currentStreakStart) {
        const streakSec = (now - focusSession.currentStreakStart) / 1000;
        if (streakSec > (focusSession.longestStreakSeconds || 0)) {
          focusSession.longestStreakSeconds = Math.floor(streakSec);
        }
      }
    }

    // Update island expression state
    focusSession.islandState = computeIslandState(focusSession);
    focusSession.lastCategory = category;

    await chrome.storage.local.set({ focusSession });
  } catch (e) {
    // Fail silently for focus tracking
  }
}

// Daily report alarm — runs every hour, checks if 9PM
chrome.alarms.create('dailyReportCheck', { periodInMinutes: 60 });

// Subscription status check — once daily
chrome.alarms.create('subscriptionCheck', { periodInMinutes: 1440 });

/* ──────────────────────────────────────────────
   DAILY ROAST REPORT
   ────────────────────────────────────────────── */

async function checkDailyReport() {
  try {
    const hour = new Date().getHours();
    if (hour !== 21) return; // Only at 9 PM

    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data || !jesty_data.settings.is_premium) return;

    // Check if we already generated a report today
    const today = new Date().toISOString().split('T')[0];
    if (!jesty_data.daily_reports) jesty_data.daily_reports = [];
    if (jesty_data.daily_reports.length > 0 && jesty_data.daily_reports[0].date === today) return;

    // Compile today's stats
    const todayRoasts = jesty_data.roasts.filter(r =>
      r.timestamp.startsWith(today)
    );

    const stats = {
      roasts_given: todayRoasts.length,
      categories: [...new Set(todayRoasts.flatMap(r => r.context.categories_present))],
      moods: [...new Set(todayRoasts.map(r => r.mood))],
      shares: todayRoasts.filter(r => r.was_shared).length,
      calendar_events: null
    };

    // Include calendar data for Pro users
    if (jesty_data.settings.subscription_tier === 'pro') {
      try {
        // Read cached calendar events from session storage
        const cached = await chrome.storage.session.get(['jestyCalendarCache']);
        if (cached.jestyCalendarCache && cached.jestyCalendarCache.events) {
          const todayStart = new Date(today).getTime();
          const todayEnd = todayStart + 86400000;
          const todayCalEvents = cached.jestyCalendarCache.events.filter(e => {
            const t = new Date(e.start).getTime();
            return t >= todayStart && t < todayEnd;
          });
          stats.calendar_events = todayCalEvents.map(e => e.summary);
        }
      } catch { /* calendar data is non-critical */ }
    }

    // Store pending report for generation (sidepanel will generate via API)
    await chrome.storage.local.set({
      pendingDailyReport: {
        date: today,
        stats,
        generatedAt: null
      }
    });
  } catch (e) {
    console.error('Jesty: Error checking daily report:', e);
  }
}

/**
 * Check subscription status — degrade if expired
 */
async function checkSubscriptionStatus() {
  try {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data || !jesty_data.settings.subscription_tier) return;

    if (jesty_data.settings.subscription_expires) {
      const expires = new Date(jesty_data.settings.subscription_expires).getTime();
      if (Date.now() > expires) {
        jesty_data.settings.subscription_status = 'expired';
        jesty_data.settings.subscription_tier = null;
        // Keep is_premium if they had a one-time purchase
        await chrome.storage.local.set({ jesty_data });
        console.log('Jesty: Subscription expired, degraded to premium/free');
      }
    }
  } catch (e) {
    console.error('Jesty: Error checking subscription:', e);
  }
}

/**
 * Initialize: snapshot all current tabs
 */
async function initializeOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();

    // Preserve existing firstSeen timestamps if available
    const { openTabs: existingTabs = {} } = await chrome.storage.local.get(['openTabs']);
    const openTabs = {};

    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        const existing = existingTabs[tab.id];
        openTabs[tab.id] = {
          tabId: tab.id,
          domain: extractDomain(tab.url),
          url: tab.url,
          title: tab.title || '',
          firstSeen: existing?.firstSeen || now,
          lastActivated: existing?.lastActivated || (tab.active ? now : null)
        };
      }
    }

    await chrome.storage.local.set({ openTabs, sessionStartTime: now });
  } catch (e) {
    console.error('Jesty: Error initializing open tabs:', e);
  }
}

// Initialize on service worker start
initializeOpenTabs();

// Open side panel when toolbar icon is clicked (replacing popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error('Jesty: setPanelBehavior error:', e));
