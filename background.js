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
      await createPendingCelebration(closedTab, match);
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
      title: tab.title || ''
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

    openTabs[tabId] = {
      tabId: tabId,
      domain: extractDomain(changeInfo.url),
      url: changeInfo.url,
      title: tab.title || ''
    };

    await chrome.storage.local.set({ openTabs });
  } catch (e) {
    console.error('Jesty: Error updating tab:', e);
  }
});

// Clean up expired roasted domains periodically
chrome.alarms.create('cleanupExpired', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupExpired') {
    await cleanupExpiredData();
  } else if (alarm.name === 'focusModeCheck') {
    await checkFocusMode();
  } else if (alarm.name === 'dailyReportCheck') {
    await checkDailyReport();
  } else if (alarm.name === 'subscriptionCheck') {
    await checkSubscriptionStatus();
  }
});

/**
 * Create and show celebration immediately
 */
async function createPendingCelebration(closedTab, match) {
  // Check if there's already a pending celebration
  const { pendingCelebration } = await chrome.storage.local.get(['pendingCelebration']);
  if (pendingCelebration) return; // Don't overwrite existing celebration

  // Generate celebration message
  const message = getCelebrationMessage(closedTab.domain);

  const celebration = {
    type: 'action_followed',
    message: message.text,
    mood: message.mood,
    domain: closedTab.domain,
    timestamp: Date.now()
  };

  // Store celebration (sidepanel will pick this up via storage listener if open)
  await chrome.storage.local.set({ pendingCelebration: celebration });
}

/**
 * Get a celebration message for the closed domain
 */
function getCelebrationMessage(domain) {
  const messages = [
    { text: `You closed ${domain}? I'm genuinely impressed. And suspicious.`, mood: 'suspicious' },
    { text: `Gone! ${domain} didn't deserve you anyway.`, mood: 'smug' },
    { text: `Wait, you actually listened? Mark your calendar.`, mood: 'suspicious' },
    { text: `${domain} has left the chat. Finally.`, mood: 'smug' },
    { text: `One less distraction. Your focus thanks you.`, mood: 'happy' },
    { text: `You did it! Closed ${domain}. I knew you had it in you. Maybe.`, mood: 'happy' },
    { text: `Look at you, taking my advice. This is new.`, mood: 'suspicious' },
    { text: `${domain}? Gone. Productivity? Maybe incoming.`, mood: 'smug' }
  ];

  return messages[Math.floor(Math.random() * messages.length)];
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
   FOCUS MODE
   ────────────────────────────────────────────── */

// Focus mode check runs every 10 seconds via alarm
chrome.alarms.create('focusModeCheck', { periodInMinutes: 1 / 6 }); // ~10s

// Daily report alarm — runs every hour, checks if 9PM
chrome.alarms.create('dailyReportCheck', { periodInMinutes: 60 });

// Subscription status check — once daily
chrome.alarms.create('subscriptionCheck', { periodInMinutes: 1440 });

// Tab category mapping (subset for distraction detection)
const DISTRACTION_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com',
  'tiktok.com', 'youtube.com', 'twitch.tv', 'netflix.com', 'hulu.com',
  'disneyplus.com', 'tinder.com', 'bumble.com', 'discord.com',
  'amazon.com', 'ebay.com', 'etsy.com'
];

function isDistracting(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return DISTRACTION_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

async function checkFocusMode() {
  try {
    const { focusMode } = await chrome.storage.local.get(['focusMode']);
    if (!focusMode || !focusMode.active) return;

    const now = Date.now();
    const elapsed = (now - focusMode.startedAt) / 1000; // seconds

    // Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const distracted = activeTab && activeTab.url ? isDistracting(activeTab.url) : false;

    let newState = focusMode.state;
    let productiveSeconds = focusMode.productiveSeconds || 0;
    let distractionCount = focusMode.distractionCount || 0;

    if (distracted) {
      distractionCount++;
      newState = 'excited'; // Jesty gets excited (alarmed) when you're distracted
      productiveSeconds = 0; // Reset productive timer
    } else {
      productiveSeconds += 10;

      // State machine: watching → bored (180s) → sleepy (300s) → sleeping (600s)
      if (productiveSeconds >= 600) newState = 'sleeping';
      else if (productiveSeconds >= 300) newState = 'sleepy';
      else if (productiveSeconds >= 180) newState = 'bored';
      else newState = 'watching';
    }

    const updatedFocusMode = {
      ...focusMode,
      state: newState,
      productiveSeconds,
      distractionCount,
      lastCheckAt: now,
      elapsed
    };

    await chrome.storage.local.set({ focusMode: updatedFocusMode });
  } catch (e) {
    // Fail silently for focus mode checks
  }
}

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
    const openTabs = {};

    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        openTabs[tab.id] = {
          tabId: tab.id,
          domain: extractDomain(tab.url),
          url: tab.url,
          title: tab.title || ''
        };
      }
    }

    await chrome.storage.local.set({ openTabs });
  } catch (e) {
    console.error('Jesty: Error initializing open tabs:', e);
  }
}

// Initialize on service worker start
initializeOpenTabs();

// Open side panel when toolbar icon is clicked (replacing popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error('Jesty: setPanelBehavior error:', e));
