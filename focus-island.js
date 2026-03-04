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

document.addEventListener('DOMContentLoaded', async () => {
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

  // End session button
  document.getElementById('island-end').addEventListener('click', endSession);
});

async function render() {
  const { focusSession } = await chrome.storage.local.get(['focusSession']);
  if (!focusSession || !focusSession.active) return;
  renderSession(focusSession);
}

function renderSession(session) {
  // Set face
  const face = ISLAND_STATE_TO_FACE[session.islandState || 'neutral'] || 'smug';
  const faceEl = document.getElementById('island-face');
  if (faceEl) {
    faceEl.innerHTML = `<svg viewBox="-15 -10 150 140" width="52" height="48"><use href="#face-${face}"/></svg>`;
  }

  // Update timer
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
  const timerEl = document.getElementById('island-timer');
  if (timerEl) {
    if (elapsed >= 3600) {
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      timerEl.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
  }
}

async function endSession() {
  clearInterval(timerInterval);

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
