/**
 * Jesty Focus Time Module
 * Manages focus sessions: start/end, session history, end-of-session roast.
 * The floating island is handled by focus-content.js (content script) + focus-island.js (iframe).
 * The sidepanel integration happens in sidepanel.js via the live comment area.
 *
 * Depends on: CONFIG (config.js), JestyStorage (storage.js), generateUUID (storage.js)
 */
const JestyFocusTime = (() => {
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  const MAX_SESSIONS = 5;

  /* ──────────────────────────────────────────────
     SESSION LIFECYCLE
     ────────────────────────────────────────────── */

  async function startSession() {
    const session = {
      id: generateUUID(),
      active: true,
      startedAt: Date.now(),
      endedAt: null,
      liveMessagesEnabled: true,
      tabSwitches: [],
      distractionCount: 0,
      currentStreakStart: Date.now(),
      longestStreakSeconds: 0,
      islandState: 'neutral',
      lastCategory: null,
      endRoast: null,
      endRoastMood: null,
      pendingEnd: false
    };

    await chrome.storage.local.set({ focusSession: session });
    return session;
  }

  async function endSession() {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    if (!focusSession || !focusSession.active) return null;

    const endedSession = {
      ...focusSession,
      active: false,
      endedAt: Date.now(),
      pendingEnd: false
    };

    await chrome.storage.local.set({ focusSession: endedSession });
    await saveCompletedSession(endedSession);
    return endedSession;
  }

  async function isActive() {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    return !!(focusSession && focusSession.active);
  }

  async function getSession() {
    const { focusSession } = await chrome.storage.local.get(['focusSession']);
    return focusSession;
  }

  /* ──────────────────────────────────────────────
     SESSION HISTORY
     ────────────────────────────────────────────── */

  async function saveCompletedSession(session) {
    const durationSeconds = Math.floor((session.endedAt - session.startedAt) / 1000);

    // Compute category breakdown from tab switches
    const categoryBreakdown = { Work: 0, Distraction: 0, Neutral: 0 };
    const switches = session.tabSwitches || [];
    for (let i = 0; i < switches.length; i++) {
      const curr = switches[i];
      const nextTs = i < switches.length - 1 ? switches[i + 1].timestamp : session.endedAt;
      const gap = Math.floor((nextTs - curr.timestamp) / 1000);
      categoryBreakdown[curr.category] = (categoryBreakdown[curr.category] || 0) + gap;
    }

    const completed = {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds,
      distractionCount: session.distractionCount || 0,
      longestStreakSeconds: session.longestStreakSeconds || 0,
      categoryBreakdown,
      endRoast: null,
      endRoastMood: null
    };

    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return;
    if (!jesty_data.focus_sessions) jesty_data.focus_sessions = [];
    jesty_data.focus_sessions.unshift(completed);
    jesty_data.focus_sessions = jesty_data.focus_sessions.slice(0, MAX_SESSIONS);
    await chrome.storage.local.set({ jesty_data });
  }

  /* ──────────────────────────────────────────────
     END-OF-SESSION ROAST
     ────────────────────────────────────────────── */

  async function generateEndRoast(session) {
    try {
      const apiKey = typeof CONFIG !== 'undefined' ? CONFIG.OPENAI_API_KEY : null;
      if (!apiKey) return null;

      const durationMins = Math.floor((session.endedAt - session.startedAt) / 60000);
      const d = session.distractionCount || 0;

      // Get unique distraction domains
      const distractionDomains = [...new Set(
        (session.tabSwitches || [])
          .filter(e => e.category === 'Distraction')
          .map(e => e.domain)
          .filter(Boolean)
      )].slice(0, 5);

      const context = [
        `Focus session: ${durationMins} minute${durationMins !== 1 ? 's' : ''}.`,
        `${d} distraction${d !== 1 ? 's' : ''}.`,
        distractionDomains.length ? `Distraction sites: ${distractionDomains.join(', ')}.` : '',
        d === 0 ? 'Zero distractions — actually impressive.' : '',
        d >= 5 ? 'Heavy distraction pattern.' : '',
        durationMins < 10 ? 'Very short session.' : '',
        durationMins > 60 ? 'Long session.' : ''
      ].filter(Boolean).join(' ');

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You're Jesty — a snarky blob who just watched someone's focus session. Roast their performance in one punchy line. Max 15 words. Be specific about what they did. No emojis. End with | and a mood tag (smug, disappointed, impressed, eyeroll, suspicious, dead, yikes).`
            },
            { role: 'user', content: context }
          ],
          max_tokens: 40,
          temperature: 0.9
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const raw = data.choices[0].message.content.trim();

      let roastText = raw;
      let mood = 'smug';
      if (raw.includes('|')) {
        const parts = raw.split('|');
        roastText = parts[0].trim();
        mood = parts[1].trim().toLowerCase();
      }
      // Remove surrounding quotes if present
      roastText = roastText.replace(/^["']+|["']+$/g, '');

      // Update history entry with roast
      const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
      if (jesty_data && jesty_data.focus_sessions && jesty_data.focus_sessions.length > 0) {
        const entry = jesty_data.focus_sessions.find(s => s.id === session.id);
        if (entry) {
          entry.endRoast = roastText;
          entry.endRoastMood = mood;
          await chrome.storage.local.set({ jesty_data });
        }
      }

      return { text: roastText, mood };
    } catch (e) {
      console.error('Jesty: Focus roast generation failed:', e);
      return null;
    }
  }

  /* ──────────────────────────────────────────────
     UTILITIES
     ────────────────────────────────────────────── */

  function formatTime(totalSeconds) {
    if (totalSeconds >= 3600) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ──────────────────────────────────────────────
     INIT
     ────────────────────────────────────────────── */

  async function init() {
    // Check for stale session (started more than 8 hours ago)
    const { focusSession } = await chrome.storage.local.get(['focusSession']);

    if (focusSession && focusSession.active) {
      const staleThreshold = 8 * 60 * 60 * 1000;
      if (Date.now() - focusSession.startedAt > staleThreshold) {
        const ended = { ...focusSession, active: false, endedAt: Date.now(), pendingEnd: false };
        await chrome.storage.local.set({ focusSession: ended });
        await saveCompletedSession(ended);
      }
    }

    return !!(focusSession && focusSession.active);
  }

  return { init, startSession, endSession, isActive, getSession, formatTime, generateEndRoast };
})();

if (typeof window !== 'undefined') {
  window.JestyFocusTime = JestyFocusTime;
}
