/**
 * Jesty Theme — Light / Dark.
 * Light uses warm off-white (#FAF8F5). Dark uses near-black (#18181B).
 * Applies light tokens synchronously to prevent flash of white on load.
 */
const JestyTheme = (() => {
  'use strict';

  const LIGHT = {
    'bg':               '#FAF8F5', 'bg-secondary':      '#F0EDEA', 'bg-tertiary':       '#F5F3F0',
    'text':             '#1C1917', 'text-secondary':     '#6B6560', 'text-muted':        '#9C968F', 'text-faint': '#CCC7C2',
    'border':           '#DDD9D5', 'border-hover':       '#CCC7C2', 'border-strong':     '#1C1917',
    'btn-bg':           '#1C1917', 'btn-text':           '#FAF8F5', 'btn-hover':         '#292524',
    'btn-disabled-bg':  '#DDD9D5', 'btn-disabled-text':  '#9C968F',
    'bubble-bot-bg':    '#F0EDEA', 'bubble-bot-text':    '#1C1917',
    'bubble-user-bg':   '#1C1917', 'bubble-user-text':   '#FAF8F5',
    'typing-dot':       '#CCC7C2',
    'overlay-a': 0.45, 'shadow-a': 0.10, 'shadow-md-a': 0.14,
  };

  const DARK = {
    'bg':               '#18181B', 'bg-secondary':      '#27272A', 'bg-tertiary':       '#1F1F23',
    'text':             '#F4F4F5', 'text-secondary':     '#A1A1AA', 'text-muted':        '#71717A', 'text-faint': '#52525B',
    'border':           '#3F3F46', 'border-hover':       '#52525B', 'border-strong':     '#F4F4F5',
    'btn-bg':           '#F4F4F5', 'btn-text':           '#18181B', 'btn-hover':         '#E4E4E7',
    'btn-disabled-bg':  '#3F3F46', 'btn-disabled-text':  '#71717A',
    'bubble-bot-bg':    '#27272A', 'bubble-bot-text':    '#F4F4F5',
    'bubble-user-bg':   '#F4F4F5', 'bubble-user-text':   '#18181B',
    'typing-dot':       '#52525B',
    'overlay-a': 0.60, 'shadow-a': 0.30, 'shadow-md-a': 0.40,
  };

  function apply(tokens, phase) {
    const root = document.documentElement;
    root.setAttribute('data-theme-phase', phase);
    for (const key of Object.keys(tokens)) {
      if (key.endsWith('-a')) continue;
      root.style.setProperty(`--jesty-${key}`, tokens[key]);
    }
    root.style.setProperty('--jesty-overlay', `rgba(0,0,0,${tokens['overlay-a'].toFixed(2)})`);
    root.style.setProperty('--jesty-shadow', `rgba(0,0,0,${tokens['shadow-a'].toFixed(2)})`);
    root.style.setProperty('--jesty-shadow-md', `rgba(0,0,0,${tokens['shadow-md-a'].toFixed(2)})`);
  }

  // Apply light immediately (synchronous) to prevent white flash
  apply(LIGHT, 'light');

  function update() {
    chrome.storage.local.get(['jestyThemePreference'], (result) => {
      const pref = result.jestyThemePreference || 'light';
      if (pref === 'dark') {
        apply(DARK, 'dark');
      } else {
        apply(LIGHT, 'light');
      }
    });
  }

  function init() {
    update();
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.jestyThemePreference) update();
    });
  }

  return { init, update };
})();
