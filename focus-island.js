/**
 * Jesty Focus Island — Floating iframe overlay
 * Shows Jesty's clipped face + timer during focus sessions.
 * Injected into pages by focus-content.js as an iframe.
 */

const ISLAND_STATE_TO_FACE = {
  neutral: 'smug',
  impressed: 'impressed',
  skeptical: 'suspicious',
  disappointed: 'disappointed',
  judging: 'eyeroll',
  resigned: 'dead',
  smug: 'smug'
};

// SVG source color (lime) — same as characters.js default
const SOURCE_COLOR = {
  body: '#EBF34F',
  limb: '#C8D132',
  shadow: '#8A9618',
  highlight: '#F8FBCE'
};

let currentColor = { ...SOURCE_COLOR };
let timerInterval = null;
let _cachedTabId = null;
let _panelOpen = false;

// Pre-cache the active tab ID so background can call sidePanel.open() synchronously
chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  _cachedTabId = tabs[0]?.id || null;
  console.log('[Jesty Island] cached tabId:', _cachedTabId);
});

// Read current sidepanel state from storage, then listen for changes
chrome.storage.local.get(['_sidePanelOpen'], (result) => {
  _panelOpen = !!result._sidePanelOpen;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes._sidePanelOpen) {
    _panelOpen = !!changes._sidePanelOpen.newValue;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Apply theme (for expand panel colors)
  if (typeof JestyTheme !== 'undefined') {
    JestyTheme.init();
  }

  // Inject SVG symbols
  if (typeof JestyCharacters !== 'undefined') {
    JestyCharacters.init();
  }

  // Apply saved color
  const { jestyColor } = await chrome.storage.local.get(['jestyColor']);
  if (jestyColor) {
    recolorSVGs(jestyColor);
  }

  // Initial render
  await render();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusSession) {
      const session = changes.focusSession.newValue;
      if (!session || !session.active) {
        clearInterval(timerInterval);
        return;
      }
      renderSession(session);
    }
  });

  // Tick timer every second
  timerInterval = setInterval(updateTimer, 1000);

  // JS-driven hover (CSS :hover unreliable when children overflow parent)
  const island = document.getElementById('island');
  let hoverTimeout = null;
  island.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
    island.classList.add('hovered');
  });
  island.addEventListener('mouseleave', () => {
    if (island.dataset.locked) return;
    hoverTimeout = setTimeout(() => island.classList.remove('hovered'), 120);
  });

  // End session button
  document.getElementById('island-end').addEventListener('click', endSession);

  // Pencil button — open sidepanel and focus the note input
  document.getElementById('island-pencil').addEventListener('click', () => {
    chrome.storage.local.set({
      sidePanelOpenMode: 'focus-note',
      sidePanelOpenAt: Date.now(),
      focusNoteRequest: Date.now()
    });
    chrome.runtime.sendMessage({ type: 'open-sidepanel', tabId: _cachedTabId });
  });

  // Eye button — toggle sidepanel (pass tabId so background can call open() synchronously)
  document.getElementById('island-eye').addEventListener('click', () => {
    console.log('[Jesty Island] eye click, tabId:', _cachedTabId);
    chrome.runtime.sendMessage({ type: 'toggle-sidepanel', tabId: _cachedTabId }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error('[Jesty Island] sendMessage error:', chrome.runtime.lastError.message);
      } else {
        console.log('[Jesty Island] toggle response:', resp);
      }
    });
  });
});

async function render() {
  const { focusSession } = await chrome.storage.local.get(['focusSession']);
  if (!focusSession || !focusSession.active) return;
  renderSession(focusSession);
}

function renderSession(session) {
  const face = ISLAND_STATE_TO_FACE[session.islandState || 'neutral'] || 'smug';
  const faceEl = document.getElementById('island-face');
  if (faceEl) {
    faceEl.innerHTML = `<svg viewBox="-15 -10 150 140" width="208" height="192"><use href="#face-${face}"/></svg>`;
  }
  updateTimerFromSession(session);
}

function updateTimer() {
  chrome.storage.local.get(['focusSession'], ({ focusSession }) => {
    if (!focusSession || !focusSession.active) return;
    updateTimerFromSession(focusSession);
  });
}

function updateTimerFromSession(session) {
  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  let timeStr;
  if (elapsed >= 3600) {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    timeStr = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } else {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    timeStr = `${m}:${String(s).padStart(2, '0')}`;
  }
  const badgeEl = document.getElementById('island-badge');
  if (badgeEl) badgeEl.textContent = timeStr;
}

async function endSession() {
  const endBtn = document.getElementById('island-end');
  if (!endBtn || endBtn.disabled) return;
  endBtn.disabled = true;
  clearInterval(timerInterval);

  // Lock hover state open during the transition
  const island = document.getElementById('island');
  island.classList.add('hovered');
  island.dataset.locked = '1';

  // Fade out "End focus", then show "Done!"
  endBtn.classList.add('fading');
  await new Promise(r => setTimeout(r, 300));
  endBtn.textContent = 'Done!';
  endBtn.classList.remove('fading');
  endBtn.classList.add('done');

  // Let user see it
  await new Promise(r => setTimeout(r, 1200));

  const { focusSession } = await chrome.storage.local.get(['focusSession']);
  if (focusSession && focusSession.active) {
    await chrome.storage.local.set({
      focusSession: {
        ...focusSession,
        active: false,
        endedAt: Date.now(),
        pendingEnd: true
      }
    });
  }
}

// Recolor SVGs to match user's chosen color
function recolorSVGs(color) {
  const svgDefs = document.querySelector('svg[style*="display: none"] defs');
  if (!svgDefs) return;

  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[currentColor[key].toUpperCase()] = color[key];
  }

  svgDefs.querySelectorAll('symbol *').forEach(el => {
    const fill = el.getAttribute('fill');
    if (fill && replacements[fill.toUpperCase()]) {
      el.setAttribute('fill', replacements[fill.toUpperCase()]);
    }
    const stroke = el.getAttribute('stroke');
    if (stroke && replacements[stroke.toUpperCase()]) {
      el.setAttribute('stroke', replacements[stroke.toUpperCase()]);
    }
  });

  currentColor = { ...color };
}

