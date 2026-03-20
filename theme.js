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
    // Accent — XP / gold
    'accent-xp':        '#EAB308', 'accent-xp-hover':   '#CA9A06',
    'accent-xp-bg':     'rgba(234,179,8,0.10)', 'accent-xp-bg-strong': 'rgba(234,179,8,0.18)',
    // Accent — selected / equipped
    'selected-border':  '#FACC15', 'selected-bg':       '#FEFCE8',
    // Tier badges
    'tier-free-bg':     '#FEF9C3', 'tier-free-text':    '#A16207',
    'tier-premium-bg':  '#EDE9FE', 'tier-premium-text': '#6D28D9',
    'tier-pro-bg':      '#D1FAE5', 'tier-pro-text':     '#065F46',
    // Drawer shadow (tinted)
    'overlay-a': 0.45, 'shadow-a': 0.10, 'shadow-md-a': 0.14,
    'drawer-shadow-rgb': '28,25,23', 'drawer-shadow-a': 0.18,
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
    // Accent — XP / gold
    'accent-xp':        '#FBBF24', 'accent-xp-hover':   '#F59E0B',
    'accent-xp-bg':     'rgba(251,191,36,0.12)', 'accent-xp-bg-strong': 'rgba(251,191,36,0.22)',
    // Accent — selected / equipped
    'selected-border':  '#FBBF24', 'selected-bg':       'rgba(251,191,36,0.12)',
    // Tier badges
    'tier-free-bg':     'rgba(234,179,8,0.15)', 'tier-free-text':    '#FBBF24',
    'tier-premium-bg':  'rgba(167,139,250,0.15)', 'tier-premium-text': '#C4B5FD',
    'tier-pro-bg':      'rgba(52,211,153,0.15)', 'tier-pro-text':     '#6EE7B7',
    // Drawer shadow (tinted)
    'overlay-a': 0.60, 'shadow-a': 0.30, 'shadow-md-a': 0.40,
    'drawer-shadow-rgb': '0,0,0', 'drawer-shadow-a': 0.55,
  };

  function apply(tokens, phase) {
    const root = document.documentElement;
    root.setAttribute('data-theme-phase', phase);
    for (const key of Object.keys(tokens)) {
      if (key.endsWith('-a') || key === 'drawer-shadow-rgb') continue;
      root.style.setProperty(`--jesty-${key}`, tokens[key]);
    }
    root.style.setProperty('--jesty-overlay', `rgba(0,0,0,${tokens['overlay-a'].toFixed(2)})`);
    root.style.setProperty('--jesty-shadow', `rgba(0,0,0,${tokens['shadow-a'].toFixed(2)})`);
    root.style.setProperty('--jesty-shadow-md', `rgba(0,0,0,${tokens['shadow-md-a'].toFixed(2)})`);
    root.style.setProperty('--jesty-drawer-shadow-rgb', tokens['drawer-shadow-rgb']);
    root.style.setProperty('--jesty-drawer-shadow-a', tokens['drawer-shadow-a'].toFixed(2));
  }

  // Apply light immediately (synchronous) to prevent white flash
  apply(LIGHT, 'light');

  function update() {
    chrome.storage.local.get(['jestyThemePreference'], (result) => {
      const pref = result.jestyThemePreference;
      if (pref === 'dark') {
        apply(DARK, 'dark');
      } else if (pref === 'light') {
        apply(LIGHT, 'light');
      } else {
        // No explicit preference — follow system theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        apply(prefersDark ? DARK : LIGHT, prefersDark ? 'dark' : 'light');
      }
    });
  }

  function init() {
    update();
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.jestyThemePreference) update();
    });

    // React to OS theme changes when no explicit preference is set
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      chrome.storage.local.get(['jestyThemePreference'], (result) => {
        if (!result.jestyThemePreference) update();
      });
    });
  }

  return { init, update };
})();
