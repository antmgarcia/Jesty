/**
 * Jesty Analytics — Lightweight Mixpanel tracking via HTTP API
 * No SDK needed. Events sent via fetch to /track endpoint.
 *
 * Usage:
 *   JestyAnalytics.track('roast_generated', { mood: 'smug', tab_count: 34 });
 *   JestyAnalytics.identify({ tier: 'premium', color: 'purple' });
 */
const JestyAnalytics = (() => {
  'use strict';

  const TOKEN = '9372bdb0c2e5017717594f05d904c6c8';
  const TRACK_URL = 'https://api.mixpanel.com/track';
  const ENGAGE_URL = 'https://api.mixpanel.com/engage';

  let _distinctId = null;
  let _superProps = {};

  // Get or create a persistent distinct_id
  async function getDistinctId() {
    if (_distinctId) return _distinctId;
    try {
      const data = await chrome.storage.local.get(['jesty_data', 'jestyAnalyticsId']);
      // Prefer existing analytics ID, then user_id from profile, then generate one
      if (data.jestyAnalyticsId) {
        _distinctId = data.jestyAnalyticsId;
      } else if (data.jesty_data?.profile?.user_id) {
        _distinctId = String(data.jesty_data.profile.user_id);
        await chrome.storage.local.set({ jestyAnalyticsId: _distinctId });
      } else {
        _distinctId = 'jesty_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await chrome.storage.local.set({ jestyAnalyticsId: _distinctId });
      }
    } catch {
      _distinctId = 'jesty_anon_' + Math.random().toString(36).slice(2, 8);
    }
    return _distinctId;
  }

  // Set properties that attach to every event
  function setSuperProperties(props) {
    Object.assign(_superProps, props);
  }

  // Track an event
  async function track(event, properties = {}) {
    try {
      const distinctId = await getDistinctId();
      const payload = [{
        event,
        properties: {
          token: TOKEN,
          distinct_id: distinctId,
          time: Math.floor(Date.now() / 1000),
          $insert_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ..._superProps,
          ...properties
        }
      }];

      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
        body: JSON.stringify(payload)
      }).catch(() => {}); // Fire and forget
    } catch {
      // Analytics should never break the app
    }
  }

  // Set user profile properties
  async function identify(properties = {}) {
    try {
      const distinctId = await getDistinctId();
      const payload = [{
        $token: TOKEN,
        $distinct_id: distinctId,
        $set: properties
      }];

      fetch(ENGAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {}
  }

  // Increment a numeric profile property
  async function increment(property, value = 1) {
    try {
      const distinctId = await getDistinctId();
      const payload = [{
        $token: TOKEN,
        $distinct_id: distinctId,
        $add: { [property]: value }
      }];

      fetch(ENGAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {}
  }

  return { track, identify, increment, setSuperProperties, getDistinctId };
})();
