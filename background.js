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
    const { openTabs } = await chrome.storage.local.get(['openTabs']);
    if (!openTabs) return;

    const closedTab = openTabs[tabId];

    // Award XP for any real tab closed (skip chrome:// and extension pages)
    if (closedTab && closedTab.domain && !closedTab.domain.startsWith('chrome')) {
      await createPendingXPGain(closedTab);
    }

    // Remove from open tabs cache
    if (closedTab) {
      delete openTabs[tabId];
      await chrome.storage.local.set({ openTabs });
    }

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
  // Detect Stripe payment success — check both URL change and page load complete
  // (service worker may wake up after URL already changed, so status:'complete' is the backup)
  const urlToCheck = changeInfo.url || (changeInfo.status === 'complete' && tab.url);
  if (urlToCheck && urlToCheck.includes('jesty.fun') && urlToCheck.includes('session_id=') && urlToCheck.includes('tier=')) {
    await handlePaymentSuccess(urlToCheck);
  }

  if (!changeInfo.url) return;

  try {
    if (changeInfo.url.startsWith('chrome://')) return;

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

      // Track unique domains visited
      const domain = openTabs[activeInfo.tabId].domain;
      if (domain && !domain.startsWith('chrome') && !domain.startsWith('new')) {
        const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
        if (jesty_data && jesty_data.profile) {
          if (!jesty_data.profile.unique_domains) jesty_data.profile.unique_domains = [];
          if (!jesty_data.profile.unique_domains.includes(domain)) {
            jesty_data.profile.unique_domains.push(domain);
            await chrome.storage.local.set({ jesty_data });
          }
        }
      }
    }
  } catch (e) { /* non-critical */ }

  // Focus Time: track tab switch during active session
  await trackFocusTabSwitch(activeInfo.tabId);
});

// Clean up expired roasted domains periodically
chrome.alarms.get('cleanupExpired', (existing) => {
  if (!existing) chrome.alarms.create('cleanupExpired', { periodInMinutes: 5 });
});

// News digest — fetch trending headlines every 12 hours
chrome.alarms.get('newsDigest', (existing) => {
  if (!existing) chrome.alarms.create('newsDigest', { periodInMinutes: 720 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupExpired') {
    await cleanupExpiredData();
  } else if (alarm.name === 'dailyReportCheck') {
    await checkDailyReport();
  } else if (alarm.name === 'subscriptionCheck') {
    await checkSubscriptionStatus();
  } else if (alarm.name === 'newsDigest') {
    await fetchDailyNews();
  }
});

/**
 * Award XP for closing any tab.
 * Points scale with how long the tab was open:
 *   < 1 min:  2-4 XP   (quick close)
 *   1-10 min: 3-7 XP   (normal browsing)
 *   10-60 min: 5-10 XP (cleaning up)
 *   1hr+:     8-15 XP  (hoarded tab)
 */
async function createPendingXPGain(closedTab) {
  const ageMs = Date.now() - (closedTab.firstSeen || Date.now());
  const ageMin = ageMs / 60000;

  let min, max;
  if (ageMin < 1)       { min = 2;  max = 4; }
  else if (ageMin < 10) { min = 3;  max = 7; }
  else if (ageMin < 60) { min = 5;  max = 10; }
  else                  { min = 8;  max = 15; }

  const xp = min + Math.floor(Math.random() * (max - min + 1));

  const xpGain = {
    xp,
    domain: closedTab.domain,
    source: 'tab_close',
    timestamp: Date.now()
  };

  // Award XP directly in background (single source of truth)
  const LEVEL_THRESHOLDS = [
    100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000,
    6500, 8000, 10000, 12500, 15000, 18000, 21000, 25000, 30000, 35000
  ];
  try {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (jesty_data) {
      if (!jesty_data.progression) {
        jesty_data.progression = { level: 1, xp: 0, xp_to_next: 100, total_xp: 0 };
      }
      const prog = jesty_data.progression;
      const levelBefore = prog.level;
      prog.xp += xp;
      prog.total_xp = (prog.total_xp || 0) + xp;

      // Level up check
      while (prog.xp >= prog.xp_to_next) {
        prog.xp -= prog.xp_to_next;
        prog.level++;
        prog.xp_to_next = LEVEL_THRESHOLDS[Math.min(prog.level - 1, LEVEL_THRESHOLDS.length - 1)];
      }

      // Signal level-up for toast display
      if (prog.level > levelBefore) {
        xpGain.levelUp = prog.level;
      }

      // Record action followed
      if (!jesty_data.milestones.actions) {
        jesty_data.milestones.actions = {
          total_actions_followed: 0,
          first_action_followed: null,
          action_streak: 0,
          longest_action_streak: 0,
          last_action_date: null
        };
      }
      jesty_data.milestones.actions.total_actions_followed++;

      await chrome.storage.local.set({ jesty_data });
    }
  } catch (e) {
    console.error('Jesty: Error awarding XP in background:', e);
  }

  // Signal for toast display (newtab/sidepanel will show the visual)
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
let _lastProcessedSession = null;

async function handlePaymentSuccess(url) {
  try {
    const urlObj = new URL(url);
    const sessionId = urlObj.searchParams.get('session_id');
    const tier = urlObj.searchParams.get('tier') || 'guilty';

    if (!sessionId) return;

    // Deduplicate — jesty.fun may redirect internally, firing onUpdated twice
    if (sessionId === _lastProcessedSession) return;
    _lastProcessedSession = sessionId;
    console.log('Jesty: Payment detected, verifying session', sessionId);

    // Verify payment server-side before activating
    const verifyRes = await fetch(
      `https://jesty-api.hey-9f5.workers.dev/api/verify?session_id=${encodeURIComponent(sessionId)}`
    );
    const verification = await verifyRes.json();

    if (!verification.paid) {
      console.warn('Jesty: Payment not confirmed for session', sessionId);
      return;
    }

    const confirmedTier = verification.tier || tier;
    const customerEmail = verification.email;

    // Activate premium locally
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return;

    // Store email from Stripe checkout
    if (customerEmail) {
      jesty_data.profile.email = customerEmail;
    }

    if (confirmedTier === 'pro') {
      jesty_data.settings.subscription_tier = 'pro';
      jesty_data.settings.subscription_status = 'active';
      jesty_data.settings.is_premium = true;
      jesty_data.settings.subscription_expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
      if (!jesty_data.settings.premium_since) {
        jesty_data.settings.premium_since = new Date().toISOString();
      }
    } else {
      jesty_data.settings.is_premium = true;
      jesty_data.settings.premium_since = new Date().toISOString();
    }

    jesty_data.settings.premium_session_id = sessionId;
    await chrome.storage.local.set({ jesty_data });
    // Signal sidepanel to show celebration
    await chrome.storage.local.set({ premiumJustActivated: Date.now() });
    console.log(`Jesty: ${confirmedTier} activated via session ${sessionId}`);
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
    if (focusSession.tabSwitches.length >= 500) focusSession.tabSwitches.shift();
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

// Focus Island: notify all tabs when session starts or ends
chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.focusSession) return;
  const session = changes.focusSession.newValue;
  const prev = changes.focusSession.oldValue;

  if (session && session.active && !(prev && prev.active)) {
    // Focus just started — message all tabs + inject as fallback
    sendFocusMessageToAllTabs('focus-island-show');
    injectFocusIslandIntoAllTabs();
  } else if ((!session || !session.active) && prev && prev.active) {
    // Focus just ended — message all tabs to remove
    sendFocusMessageToAllTabs('focus-island-hide');
  }
});

// Focus Island: inject into new/reloaded tabs while session is active
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  // Only inject into http/https pages
  if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) return;
  try {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    if (!focusSession || !focusSession.active) return;
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['focus-content.js']
    }).catch(() => {});
  } catch (e) { /* best-effort */ }
});

// Focus Island: inject into newly created tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    if (!focusSession || !focusSession.active) return;
    // Wait briefly for the tab to have a URL and load
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['focus-content.js']
      }).catch(() => {});
    }, 1000);
  } catch (e) { /* best-effort */ }
});

// Focus Island: inject when switching to a tab (catches discarded/sleeping tabs)
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    if (!focusSession || !focusSession.active) return;
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) return;
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['focus-content.js']
    }).catch(() => {});
  } catch (e) { /* best-effort */ }
});

async function sendFocusMessageToAllTabs(type) {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
    }
  } catch (e) { /* best-effort */ }
}

async function injectFocusIslandIntoAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['focus-content.js']
      }).catch(() => {});
    }
  } catch (e) { /* best-effort */ }
}

// Daily report alarm — runs every hour, checks if 9PM
chrome.alarms.get('dailyReportCheck', (existing) => {
  if (!existing) chrome.alarms.create('dailyReportCheck', { periodInMinutes: 60 });
});

// Subscription status check — once daily
chrome.alarms.get('subscriptionCheck', (existing) => {
  if (!existing) chrome.alarms.create('subscriptionCheck', { periodInMinutes: 1440 });
});

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

/* ──────────────────────────────────────────────
   DAILY NEWS DIGEST
   ────────────────────────────────────────────── */

/**
 * Fetch trending headlines (Google News) and interest-based posts (Reddit).
 * Stores result in chrome.storage.local as `dailyNewsDigest`.
 * All fetches are non-blocking with 3s timeouts — fails silently.
 */
async function fetchDailyNews() {
  try {
    // Freshness check — skip if fetched within the last 10 hours
    const { dailyNewsDigest } = await chrome.storage.local.get(['dailyNewsDigest']);
    if (dailyNewsDigest && dailyNewsDigest.fetchedAt && (Date.now() - dailyNewsDigest.fetchedAt) < 10 * 3600000) {
      return;
    }

    const interestPosts = [];

    // Reddit — posts based on user interests (no generic world news)
    try {
      const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
      const interests = jesty_data?.profile?.interests;
      if (interests && Array.isArray(interests) && interests.length > 0) {
        // Get top 3 interests by count
        const sorted = [...interests]
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(item => item.topic);

        for (const topic of sorted) {
          try {
            const resp = await fetch(
              `https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=hot&limit=3&t=day`,
              { signal: AbortSignal.timeout(3000) }
            );
            if (resp.ok) {
              const data = await resp.json();
              const children = data?.data?.children || [];
              for (const child of children) {
                const post = child.data;
                if (post && post.title) {
                  interestPosts.push({
                    title: post.title,
                    subreddit: post.subreddit_name_prefixed || '',
                    topic
                  });
                }
              }
            }
          } catch (e) { /* fail silently per topic */ }
        }
      }
    } catch (e) { /* fail silently */ }

    // Store result
    await chrome.storage.local.set({
      dailyNewsDigest: {
        interestPosts,
        fetchedAt: Date.now()
      }
    });
  } catch (e) {
    console.error('Jesty: Error fetching daily news:', e);
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

// Restore sidePanelOpen state from storage (survives service worker restart)
chrome.storage.local.get(['_sidePanelOpen'], (r) => { sidePanelOpen = !!r._sidePanelOpen; });

// Fetch news on startup so first roast of a session has context
fetchDailyNews();

// Open side panel when toolbar icon is clicked (replacing popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error('Jesty: setPanelBehavior error:', e));

// Track sidepanel open state and broadcast via storage for island
let sidePanelOpen = false;
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sidePanelOpen = true;
    chrome.storage.local.set({ _sidePanelOpen: true });
    port.onDisconnect.addListener(() => {
      sidePanelOpen = false;
      chrome.storage.local.set({ _sidePanelOpen: false });
    });
  }
});

function getActiveTabId(sender) {
  return new Promise((resolve) => {
    if (sender.tab?.id) return resolve(sender.tab.id);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id || null);
    });
  });
}

// Handle messages from sidepanel/newtab/island
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get-sidepanel-state') {
    sendResponse({ open: sidePanelOpen });
    return;
  }
  if (msg.type === 'open-tab' && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
  }
  if (msg.type === 'open-sidepanel') {
    // Use tabId from message (island passes it) or sender, call open() synchronously to preserve user gesture
    const openTabId = msg.tabId || sender.tab?.id;
    if (openTabId) {
      chrome.sidePanel.open({ tabId: openTabId }).catch(e => console.error('open-sidepanel:', e));
    } else {
      chrome.windows.getCurrent().then(win =>
        chrome.sidePanel.open({ windowId: win.id })
      ).catch(e => console.error('open-sidepanel:', e));
    }
    sendResponse({ ok: true });
  }
  if (msg.type === 'toggle-sidepanel') {
    const tid = msg.tabId || sender.tab?.id;
    console.log('[Jesty] toggle-sidepanel:', { sidePanelOpen, tabId: tid });
    if (sidePanelOpen) {
      chrome.windows.getCurrent().then(win =>
        chrome.sidePanel.close({ windowId: win.id })
      ).catch(e => console.error('[Jesty] close failed:', e));
    } else if (tid) {
      chrome.sidePanel.open({ tabId: tid })
        .then(() => console.log('[Jesty] open succeeded'))
        .catch(e => console.error('[Jesty] open failed:', e));
    } else {
      console.error('[Jesty] No tabId for open');
    }
    return true;
  }
});
