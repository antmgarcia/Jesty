/**
 * Jesty Calendar Module
 * Integrates with Google Calendar via chrome.identity OAuth 2.0.
 * Pro tier only.
 */
const JestyCalendar = (() => {
  const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
  const CACHE_KEY = 'jestyCalendarCache';
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Authenticate and get OAuth token
   * Returns token string or null on failure
   */
  async function authenticate() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          console.error('Calendar auth failed:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });
  }

  /**
   * Check if calendar is authenticated (non-interactive)
   */
  async function isAuthenticated() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        resolve(!!token && !chrome.runtime.lastError);
      });
    });
  }

  /**
   * Revoke calendar access
   */
  async function disconnect() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            // Also revoke the token with Google
            fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Get upcoming events (next N events)
   * Uses chrome.storage.session for caching (wiped on browser close)
   */
  async function getUpcomingEvents(count = 5) {
    // Check cache first
    try {
      const cached = await chrome.storage.session.get([CACHE_KEY]);
      if (cached[CACHE_KEY] && (Date.now() - cached[CACHE_KEY].fetchedAt < CACHE_DURATION)) {
        return cached[CACHE_KEY].events;
      }
    } catch { /* session storage may not be available */ }

    const token = await authenticate();
    if (!token) return [];

    try {
      const now = new Date().toISOString();
      const url = `${CALENDAR_API}/calendars/primary/events?maxResults=${count}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, remove and retry once
          await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
          return getUpcomingEvents(count);
        }
        return [];
      }

      const data = await response.json();
      const events = (data.items || []).map(event => ({
        id: event.id,
        summary: event.summary || 'Untitled Event',
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location || null,
        description: event.description ? event.description.substring(0, 100) : null
      }));

      // Cache in session storage
      try {
        await chrome.storage.session.set({
          [CACHE_KEY]: { events, fetchedAt: Date.now() }
        });
      } catch { /* non-critical */ }

      return events;
    } catch (e) {
      console.error('Calendar fetch error:', e);
      return [];
    }
  }

  /**
   * Get the next upcoming event
   */
  async function getNextEvent() {
    const events = await getUpcomingEvents(1);
    return events.length > 0 ? events[0] : null;
  }

  /**
   * Format events for inclusion in roast/chat prompts
   */
  function formatEventsForPrompt(events) {
    if (!events || events.length === 0) return '';

    return events.map(e => {
      const start = new Date(e.start);
      const now = new Date();
      const diffMin = Math.round((start - now) / 60000);

      let timeStr;
      if (diffMin < 0) timeStr = 'happening now';
      else if (diffMin < 60) timeStr = `in ${diffMin} minutes`;
      else if (diffMin < 1440) timeStr = `in ${Math.round(diffMin / 60)} hours`;
      else timeStr = `tomorrow`;

      return `- "${e.summary}" ${timeStr}`;
    }).join('\n');
  }

  /**
   * Get a morning briefing summary
   */
  async function getMorningBriefing() {
    const events = await getUpcomingEvents(5);
    if (events.length === 0) return null;

    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(e => e.start.startsWith(today));

    return {
      totalToday: todayEvents.length,
      events: todayEvents,
      nextEvent: events[0],
      formatted: formatEventsForPrompt(todayEvents)
    };
  }

  return {
    authenticate,
    isAuthenticated,
    disconnect,
    getUpcomingEvents,
    getNextEvent,
    formatEventsForPrompt,
    getMorningBriefing
  };
})();

if (typeof window !== 'undefined') {
  window.JestyCalendar = JestyCalendar;
}
