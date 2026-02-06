/**
 * Jesty Background Service Worker
 * Monitors tab closures to detect when users follow Jesty's suggestions
 */

const ACTION_TRACKING_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Listen for tab removals
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const { roastedDomains, openTabs } = await chrome.storage.local.get(['roastedDomains', 'openTabs']);

    if (!openTabs || !roastedDomains) return;

    const closedTab = openTabs[tabId];
    if (!closedTab) return;

    // Check if this domain was recently roasted
    const now = Date.now();
    const match = roastedDomains.find(rd =>
      rd.domain === closedTab.domain &&
      now < rd.expiresAt
    );

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

// Update tab info when URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  try {
    if (changeInfo.url.startsWith('chrome://')) return;

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
  }
});

/**
 * Create a pending celebration for the next new tab load
 */
async function createPendingCelebration(closedTab, match) {
  // Check if there's already a pending celebration
  const { pendingCelebration } = await chrome.storage.local.get(['pendingCelebration']);
  if (pendingCelebration) return; // Don't overwrite existing celebration

  // Generate celebration message
  const message = getCelebrationMessage(closedTab.domain);

  await chrome.storage.local.set({
    pendingCelebration: {
      type: 'action_followed',
      message: message.text,
      mood: message.mood,
      domain: closedTab.domain,
      timestamp: Date.now()
    }
  });

  console.log('Jesty: Pending celebration created for closing', closedTab.domain);
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
      console.log('Jesty: Cleaned up expired roasted domains');
    }
  } catch (e) {
    console.error('Jesty: Error cleaning up expired data:', e);
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
    console.log('Jesty: Initialized open tabs tracking');
  } catch (e) {
    console.error('Jesty: Error initializing open tabs:', e);
  }
}

// Initialize on service worker start
initializeOpenTabs();
