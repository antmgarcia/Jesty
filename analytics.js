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
  const TRACK_URL = 'https://api-eu.mixpanel.com/track';
  const ENGAGE_URL = 'https://api-eu.mixpanel.com/engage';
  const DEBUG = false;

  let _distinctId = null;
  let _superProps = {};

  function log(...args) {
    if (DEBUG) console.log('[JestyAnalytics]', ...args);
  }

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
      log('distinct_id:', _distinctId);
    } catch (e) {
      _distinctId = 'jesty_anon_' + Math.random().toString(36).slice(2, 8);
      log('fallback distinct_id:', _distinctId, e);
    }
    return _distinctId;
  }

  // Set properties that attach to every event
  function setSuperProperties(props) {
    Object.assign(_superProps, props);
  }

  // Send to Mixpanel via base64-encoded data param (legacy /track format — most reliable)
  async function _send(url, payload) {
    const encoded = btoa(JSON.stringify(payload));
    const body = 'data=' + encodeURIComponent(encoded);
    const resp = await fetch(url + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const text = await resp.text();
    return text;
  }

  // Track an event
  async function track(event, properties = {}) {
    try {
      const distinctId = await getDistinctId();
      const payload = {
        event,
        properties: {
          token: TOKEN,
          distinct_id: distinctId,
          time: Math.floor(Date.now() / 1000),
          $insert_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ..._superProps,
          ...properties
        }
      };

      log('track:', event, properties);
      _send(TRACK_URL, payload).then(r => {
        log('track response:', r, r === '1' ? '✓' : '✗ FAILED');
      }).catch(e => {
        log('track error:', e.message);
      });
    } catch (e) {
      log('track exception:', e.message);
    }
  }

  // Set user profile properties
  async function identify(properties = {}) {
    try {
      const distinctId = await getDistinctId();
      const payload = {
        $token: TOKEN,
        $distinct_id: distinctId,
        $set: properties
      };

      log('identify:', properties);
      _send(ENGAGE_URL, payload).then(r => {
        log('identify response:', r, r === '1' ? '✓' : '✗ FAILED');
      }).catch(e => {
        log('identify error:', e.message);
      });
    } catch (e) {
      log('identify exception:', e.message);
    }
  }

  // Increment a numeric profile property
  async function increment(property, value = 1) {
    try {
      const distinctId = await getDistinctId();
      const payload = {
        $token: TOKEN,
        $distinct_id: distinctId,
        $add: { [property]: value }
      };

      log('increment:', property, value);
      _send(ENGAGE_URL, payload).then(r => {
        log('increment response:', r, r === '1' ? '✓' : '✗ FAILED');
      }).catch(e => {
        log('increment error:', e.message);
      });
    } catch (e) {
      log('increment exception:', e.message);
    }
  }

  return { track, identify, increment, setSuperProperties, getDistinctId };
})();
