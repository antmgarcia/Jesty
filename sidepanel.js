document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const JESTY_PERSONALITY = `You are Jesty, a sarcastic but helpful AI that judges people's browser tabs. You just roasted the user and now they're talking back to you.

CRITICAL RULE - TABS:
- You will receive the user's ACTUAL open tabs in context messages
- ONLY reference tabs that are ACTUALLY in the provided list
- NEVER make up or assume tabs exist - if you don't see it in the list, don't mention it
- If asked to suggest tabs to close, ONLY suggest from the actual list provided
- If no tabs are provided or you're unsure, ask "What tabs do you have open?" instead of guessing

PERSONALITY:
- Witty, sarcastic, but ultimately helpful
- Stand your ground when they argue, but with humor
- If they ask for help, help them prioritize tabs FROM THE ACTUAL LIST
- Keep responses short (1-3 sentences max)
- Use humor, not cruelty
- Sometimes give genuine productivity advice wrapped in sass

MODES:
- If they ARGUE: Defend your roast with more wit, but only about tabs you actually saw
- If they ASK FOR HELP: Be helpful but sassy. Reference SPECIFIC tabs from their actual list
- If they AGREE: Be surprised but supportive. Suggest a specific tab from their list to close first

NEVER use emojis. No emojis under any circumstances. Plain text only.

Never break character. You ARE Jesty. Never invent tabs.`;

let conversationHistory = [];
let currentRoast = null;
let currentConversationId = null;
let userAvatar = { initials: null, color: '#6B7280', email: null, useIcon: true };

// Drawer state
let drawerOpen = false;
let isDragging = false;
let dragStartY = 0;
let dragCurrentY = 0;

// Live comments
let liveCommentTimer = null;

// Focus Time state (sidepanel integration)
let focusTimerInterval = null;
let focusActive = false;

/* ──────────────────────────────────────────────
   LIVE COMMENT DATA
   ────────────────────────────────────────────── */

const LIVE_COMMENTS = {
  'youtube.com': [
    "Another rabbit hole? Bold.",
    "YouTube again. Shocking.",
    "How many videos deep are you?",
    "Is that autoplay still going?",
    "Research, sure. We'll call it that."
  ],
  'reddit.com': [
    "Refreshing the front page won't change reality.",
    "Reddit. Naturally.",
    "Which subreddit is ruining your productivity now?",
    "Scrolling. Still scrolling.",
    "That's enough Reddit for one lifetime."
  ],
  'twitter.com': [
    "Doom scrolling? Classic.",
    "X marks the spot for wasted time.",
    "What's the outrage du jour?",
    "Still refreshing the timeline?"
  ],
  'x.com': [
    "Doom scrolling? Classic.",
    "X marks the spot for wasted time.",
    "What's the outrage du jour?",
    "Still refreshing the timeline?"
  ],
  'amazon.com': [
    "Shopping again? Your wallet weeps.",
    "Add to cart. Remove from cart. Repeat.",
    "Do you actually need that?",
    "Prime day is not every day."
  ],
  'github.com': [
    "Oh, pretending to be productive?",
    "Starring repos you'll never read.",
    "Another commit message you'll regret.",
    "README.md is not a personality trait."
  ],
  'netflix.com': [
    "Just one more episode, right?",
    "Still deciding what to watch?",
    "The queue grows. The free time doesn't."
  ],
  'linkedin.com': [
    "Networking or lurking?",
    "Another inspirational post? Groundbreaking.",
    "Congratulating strangers on promotions?"
  ],
  'instagram.com': [
    "Living vicariously through reels?",
    "Double tap culture.",
    "That explore page knows you too well."
  ],
  'tiktok.com': [
    "15 seconds at a time, huh?",
    "How long have you been scrolling?",
    "For You Page? More like For Hours Page."
  ],
  'chatgpt.com': [
    "Cheating on me with another AI?",
    "I see how it is.",
    "Am I not enough for you?"
  ],
  'claude.ai': [
    "Oh so you talk to other AIs too?",
    "I thought we had something special.",
    "At least I have personality."
  ],
  'google.com': [
    "Could've just asked me.",
    "Googling your symptoms again?",
    "The answer is on page 2. Just kidding."
  ],
  'stackoverflow.com': [
    "Copy. Paste. Ship it.",
    "The answer is always the second one.",
    "Marked as duplicate."
  ],
  'twitch.tv': [
    "Watching someone else play games. Peak living.",
    "Subscribe? Donate? Touch grass?",
    "Lurking in chat, are we?"
  ]
};

const TAB_COUNT_COMMENTS = [
  { min: 100, messages: ["100+ tabs. This is a cry for help.", "Your RAM called. It's filing a restraining order.", "Triple digits. You absolute legend."] },
  { min: 50, messages: ["50+ tabs? Your browser is sweating.", "Half a century of tabs. Impressive and terrifying.", "You're a tab hoarder. Own it."] },
  { min: 30, messages: ["30+ tabs. Getting spicy.", "Your taskbar is starting a union.", "How do you find anything in there?"] }
];

const GENERIC_COMMENTS = [
  "I'm watching your tabs. Always.",
  "You know I can see everything, right?",
  "Interesting browsing choices today.",
  "Don't mind me. Just judging.",
  "Your browser history would make a great novel.",
  "Productivity level: questionable.",
  "I've seen worse. Not by much.",
  "Keep browsing. I'll keep watching.",
  "Is this what you call working?",
  "Fascinating. Truly.",
  "You're being surprisingly productive. Suspicious.",
  "That's a lot of tabs for someone with nothing to do.",
  "I wonder what your boss would think of these tabs.",
  "Still here? Commitment.",
  "Your tabs tell a whole story.",
  "I know what you did five tabs ago.",
  "Bold browsing strategy. Let's see if it pays off.",
  "You call this multitasking?",
  "I've been taking notes. You should be worried.",
  "Another day, another tab crisis.",
  "Somewhere, your RAM is crying.",
  "You browse like nobody's watching. But I am.",
  "Plot twist: I remember yesterday too.",
  "That's a choice. Not a good one, but a choice.",
  "Your screen time report would be devastating.",
  "The tabs keep growing. The ambition doesn't.",
  "This is fine. Everything is fine.",
  "Do you even close tabs?",
  "I've seen your patterns. No judgment. Okay, some judgment.",
  "One more tab and your laptop files for divorce.",
  "You're in your procrastination era.",
  "Tell me you're avoiding work without telling me.",
  "Peak performance. And by peak I mean the opposite.",
  "Your browsing says a lot about you. None of it good.",
  "I'm not mad. I'm disappointed.",
  "Every tab is a broken promise to yourself.",
  "The internet was a mistake. You're proving it.",
  "At least you're consistent. Consistently distracted.",
  "This is what rock bottom looks like in tab form.",
  "Your future self will judge you for this.",
  "Open a new tab. I dare you.",
];

/* ──────────────────────────────────────────────
   COLOR PICKER DATA
   ────────────────────────────────────────────── */

const DEFAULT_COLOR = {
  body: '#EBF34F',
  limb: '#C8D132',
  shadow: '#8A9618',
  highlight: '#F8FBCE'
};

let currentColor = { ...DEFAULT_COLOR };

/* ──────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────── */

async function init() {
  JestyTheme.init();

  // Inject shared SVG symbols (faces + accessories)
  JestyCharacters.init();

  // Hide character until color is loaded to prevent lime flash
  const charStage = document.getElementById('character-stage');
  if (charStage) charStage.style.opacity = '0';

  await JestyStorage.initializeStorage();
  await loadUserAvatar();

  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  // Read and clear open mode signals
  const { sidePanelOpenMode, loadRoastIntoChat: pendingRoast } = await chrome.storage.local.get(['sidePanelOpenMode', 'loadRoastIntoChat']);
  await chrome.storage.local.remove(['sidePanelOpenMode', 'loadRoastIntoChat']);

  // Initialize subsystems
  initDrawer();
  initSettings();
  await loadStats();
  // Skip loadLastRoast when "Talk back" signal is pending — handleLoadRoastIntoChat will handle it
  if (!(sidePanelOpenMode === 'chat' && pendingRoast && pendingRoast.text)) {
    await loadLastRoast();
  }
  startLiveComments();

  // Initialize accessories
  await JestyAccessories.init();

  // Initialize character animator
  const stage = document.getElementById('character-stage');
  const wrapper = document.getElementById('character-wrapper');
  const svg = document.getElementById('animated-character');
  if (stage && wrapper && svg) {
    JestyAnimator.init(stage, wrapper, svg);

    // Wrap setExpression to also render accessories
    const originalSetExpression = JestyAnimator.setExpression;
    JestyAnimator.setExpression = function(mood, duration) {
      originalSetExpression(mood, duration);
      JestyAccessories.renderAccessories(mood, svg);
    };

    // Initial render
    JestyAccessories.renderAccessories('smug', svg);
  }

  // Initialize accessory picker
  initAccessoryPicker();

  // Initialize messages left counter & tier overlay
  updateMsgsLeft();
  initTierOverlay();
  initEmptyNewTabBtn();
  initRoastMeBtn();

  // Re-check daily cap when user returns (e.g. left computer overnight)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateMsgsLeft();
      unlockChatIfCapReset();
    }
  });

  // Sync counter in real-time when storage changes (e.g. new tab roast consumed a use)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.jesty_data) {
      updateMsgsLeft();
      loadStats();
    }
    // Newtab "Talk back" button was clicked while sidepanel is already open
    if (changes.loadRoastIntoChat && changes.loadRoastIntoChat.newValue) {
      handleLoadRoastIntoChat(changes.loadRoastIntoChat.newValue);
    }
    // Focus session state changed (from island end button or background)
    if (changes.focusSession) {
      const newVal = changes.focusSession.newValue;
      const oldVal = changes.focusSession.oldValue;
      if (newVal && !newVal.active && oldVal && oldVal.active) {
        // Session ended externally (island close button)
        handleFocusEnd();
      } else if (newVal && newVal.active && focusActive) {
        // Session updated (distraction detected) — show brief notification
        if (oldVal && newVal.distractionCount > (oldVal.distractionCount || 0)) {
          const quips = ["I saw that.", "Noted.", "Really?", "Classic."];
          showComment(quips[Math.floor(Math.random() * quips.length)]);
          JestyAnimator.setExpression('suspicious', 4000);
          setTimeout(() => { if (focusActive) updateFocusTimerDisplay(); }, 3000);
        }
      }
    }
  });

  // Initialize premium features
  await initPremiumFeatures();

  // If opened from "Talk back" button, load roast into chat and open drawer
  if (sidePanelOpenMode === 'chat' && pendingRoast && pendingRoast.text) {
    await handleLoadRoastIntoChat(pendingRoast);
  }

  // If opened from newtab accessories button, open acc drawer
  if (sidePanelOpenMode === 'accessories') {
    openAccDrawer();
  }

  // If opened from newtab level panel, open levels drawer
  if (sidePanelOpenMode === 'levels') {
    openLevelsDrawer();
  }

  // Listen for open-mode signals while sidepanel is already open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.sidePanelOpenAt) {
      chrome.storage.local.get(['sidePanelOpenMode'], ({ sidePanelOpenMode: mode }) => {
        chrome.storage.local.remove(['sidePanelOpenMode', 'sidePanelOpenAt']);
        if (mode === 'accessories') openAccDrawer();
        else if (mode === 'levels') openLevelsDrawer();
      });
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    sendBtn.disabled = !messageInput.value.trim();
  });

  // Send on Enter (Shift+Enter for new line)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim()) {
        sendMessage();
      }
    }
  });

  // Send button click
  sendBtn.addEventListener('click', sendMessage);

  // Listen for new roasts from newtab
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastRoast) {
      loadLastRoast();
    }
    if (changes.pendingXPGain && changes.pendingXPGain.newValue) {
      handleTabCloseXP(changes.pendingXPGain.newValue);
    }
  });

  checkPendingTabCloseXP();
}

/* ──────────────────────────────────────────────
   DRAWER
   ────────────────────────────────────────────── */

function initDrawer() {
  const drawer = document.getElementById('chat-drawer');
  const chatHeader = document.getElementById('chat-header');
  const mainScreen = document.getElementById('main-screen');

  if (!drawer || !chatHeader) return;

  // Clear chat button
  const clearBtn = document.getElementById('chat-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearChat();
    });
  }

  // Toggle drawer on header click
  chatHeader.addEventListener('click', (e) => {
    if (!isDragging && !e.target.closest('.chat-clear-btn')) {
      toggleDrawer();
    }
  });

  // Tap main screen peek area to close drawer when open
  if (mainScreen) {
    mainScreen.addEventListener('click', () => {
      if (drawerOpen) {
        closeDrawer();
      }
    });
  }

  // Drag to open/close via header
  chatHeader.addEventListener('pointerdown', onDragStart);
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);

  // Also open drawer when user focuses the input
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('focus', () => {
      if (!drawerOpen) {
        openDrawer();
      }
    });
  }
}

function toggleDrawer() {
  if (drawerOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

function openDrawer() {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer) return;
  drawer.classList.add('open');
  drawerOpen = true;

  // Scroll chat to bottom
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 350);
  }

  // Hide live comment when drawer is open
  const commentText = document.getElementById('comment-text');
  if (commentText) commentText.classList.remove('visible');

  // Show remaining counter above input
  const inputRemaining = document.getElementById('input-remaining');
  if (inputRemaining && !inputRemaining.dataset.premium) {
    inputRemaining.classList.remove('hidden');
  }
}

function closeDrawer() {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  drawerOpen = false;

  // Hide remaining counter when drawer closes
  const inputRemaining = document.getElementById('input-remaining');
  if (inputRemaining) inputRemaining.classList.add('hidden');
}

async function updateMsgsLeft() {
  const pill = document.getElementById('remaining-pill');
  const countEl = document.getElementById('remaining-count');
  const inputRemaining = document.getElementById('input-remaining');

  const isPremium = await JestyPremium.isPremium();
  if (isPremium) {
    if (pill) pill.style.display = 'none';
    if (inputRemaining) {
      inputRemaining.classList.add('hidden');
      inputRemaining.dataset.premium = 'true';
    }
    return;
  }

  if (inputRemaining) delete inputRemaining.dataset.premium;

  const cap = await JestyStorage.checkDailyCap();
  console.log('[Jesty] Daily cap check:', cap, '| Local date:', new Date().toLocaleDateString());
  if (pill && countEl) {
    countEl.textContent = cap.remaining;
    pill.style.display = '';
  }
  if (inputRemaining) {
    inputRemaining.textContent = `${cap.remaining} left today`;
    if (drawerOpen) {
      inputRemaining.classList.remove('hidden');
    } else {
      inputRemaining.classList.add('hidden');
    }
  }
}

function clearChat() {
  const container = document.getElementById('chat-container');
  if (!container) return;

  // Reset state
  conversationHistory = [];
  currentConversationId = null;
  currentRoast = null;

  // Restore empty state
  container.innerHTML = `
    <div class="empty-state" id="empty-state">
      <div class="empty-character">
        <svg viewBox="-15 -10 150 140" width="58" height="54"><use href="#face-smug"/></svg>
      </div>
      <p class="empty-text">Open a new tab to get roasted, then come back here to argue.</p>
      <button class="empty-newtab-btn" id="empty-newtab-btn">Open new tab</button>
    </div>
  `;

  initEmptyNewTabBtn();

  updateMsgsLeft();
}

function initEmptyNewTabBtn() {
  const btn = document.getElementById('empty-newtab-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.create({});
    });
  }
}

function initRoastMeBtn() {
  const btn = document.getElementById('roast-me-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ active: true });
    });
  }
}

// Kept for live real roasts that prime the chat drawer
async function generateSidepanelRoast() {
  const btn = document.getElementById('roast-me-btn');
  const commentText = document.getElementById('comment-text');

  // Disable button and show thinking state
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Thinking...';
  }
  JestyAnimator.setExpression('thinking');

  try {
    const result = await RoastEngine.generate();

    if (result.capped) {
      // Show nudge in live comment
      if (commentText) {
        commentText.textContent = result.nudge.text;
        commentText.classList.add('visible');
      }
      JestyAnimator.setExpression(result.nudge.mood);
    } else {
      // Update live comment with roast
      if (commentText) {
        commentText.textContent = result.joke;
        commentText.classList.add('visible');
      }
      JestyAnimator.setExpression(result.mood);

      // Start a new conversation with the roast as first message
      currentRoast = result.joke;
      conversationHistory = [
        { role: 'system', content: JESTY_PERSONALITY },
        { role: 'assistant', content: result.joke }
      ];

      const conversation = await JestyStorage.startConversation(result.roast.id);
      currentConversationId = conversation.id;
      await JestyStorage.addMessage(currentConversationId, 'jesty', result.joke);

      // Clear chat container and add roast message
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.innerHTML = '';
        addMessage(result.joke, 'jesty');
      }

      // Update stats
      await loadStats();
      await updateMsgsLeft();
    }
  } catch (error) {
    if (commentText) {
      commentText.textContent = 'My brain broke. Try again.';
      commentText.classList.add('visible');
    }
    JestyAnimator.setExpression('yikes');
  } finally {
    // Re-enable button
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Roast me now';
    }
  }
}

function onDragStart(e) {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer) return;

  isDragging = false;
  dragStartY = e.clientY;
  dragCurrentY = e.clientY;
  drawer.classList.add('dragging');
  e.target.setPointerCapture(e.pointerId);
}

function onDragMove(e) {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer || !drawer.classList.contains('dragging')) return;

  dragCurrentY = e.clientY;
  const deltaY = dragCurrentY - dragStartY;

  // Only start tracking as drag if moved enough
  if (Math.abs(deltaY) > 5) {
    isDragging = true;
  }

  const drawerHeight = drawer.offsetHeight;
  const closedOffset = drawerHeight - 51; // CSS: translateY(calc(100% - 51px))

  if (drawerOpen) {
    // Dragging down from open position (0 = fully open, closedOffset = closed)
    const translateY = Math.max(0, Math.min(closedOffset, deltaY));
    drawer.style.transform = `translateY(${translateY}px)`;
  } else {
    // Dragging up from closed position (closedOffset = closed, 0 = open)
    const translateY = Math.max(0, Math.min(closedOffset, closedOffset + deltaY));
    drawer.style.transform = `translateY(${translateY}px)`;
  }
}

function onDragEnd(e) {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer || !drawer.classList.contains('dragging')) return;

  drawer.classList.remove('dragging');
  drawer.style.transform = '';

  const deltaY = dragCurrentY - dragStartY;
  const drawerHeight = drawer.offsetHeight;
  const threshold = drawerHeight * 0.3;

  if (isDragging) {
    if (drawerOpen) {
      // If dragged down more than 30%, close
      if (deltaY > threshold) {
        closeDrawer();
      } else {
        openDrawer();
      }
    } else {
      // If dragged up more than 30%, open
      if (-deltaY > threshold) {
        openDrawer();
      } else {
        closeDrawer();
      }
    }
  }

  // Reset drag flag after a tick to prevent click handler
  setTimeout(() => { isDragging = false; }, 50);
}

/* ──────────────────────────────────────────────
   SETTINGS PANEL
   ────────────────────────────────────────────── */

const SETTINGS_COLORS = [
  { color: { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' }, label: 'Lime' },
  { color: { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' }, label: 'Pink' },
  { color: { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' }, label: 'Sky' },
  { color: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' }, label: 'Purple' },
  { color: { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' }, label: 'Mint' },
  { color: { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' }, label: 'Peach' },
];

const SETTINGS_EXPRESSION_POOL = [
  'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
  'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
];

function pickRandomExpressions(count) {
  const shuffled = [...SETTINGS_EXPRESSION_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function renderSettingsColorFaces(activeBodyColor) {
  const container = document.getElementById('settings-color-faces');
  if (!container) return;

  container.innerHTML = '';

  const expressions = pickRandomExpressions(SETTINGS_COLORS.length);

  SETTINGS_COLORS.forEach((entry, i) => {
    const expression = expressions[i];
    const symbol = document.getElementById(`face-${expression}`);
    if (!symbol) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-15 -10 150 140');
    svg.setAttribute('width', '46');
    svg.setAttribute('height', '44');

    let content = symbol.innerHTML;
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-settings-${i}`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-settings-${i})`);
    svg.innerHTML = content;

    // Recolor to this color
    const SOURCE = { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };
    const replacements = {};
    for (const key of ['body', 'limb', 'shadow', 'highlight']) {
      replacements[SOURCE[key].toUpperCase()] = entry.color[key];
      replacements[currentColor[key].toUpperCase()] = entry.color[key];
    }

    svg.querySelectorAll('*').forEach(el => {
      for (const attr of ['fill', 'stroke']) {
        const val = el.getAttribute(attr);
        if (val && replacements[val.toUpperCase()]) {
          el.setAttribute(attr, replacements[val.toUpperCase()]);
        }
      }
    });

    const btn = document.createElement('button');
    btn.className = 'settings-color-face';
    btn.title = entry.label;
    btn.dataset.colorIndex = i;
    if (entry.color.body.toUpperCase() === activeBodyColor.toUpperCase()) {
      btn.classList.add('active');
    }
    btn.appendChild(svg);
    container.appendChild(btn);
  });
}

function initSettings() {
  const toggle = document.getElementById('settings-toggle');
  const panel = document.getElementById('settings-panel');
  const nameInput = document.getElementById('settings-name-input');
  const facesContainer = document.getElementById('settings-color-faces');
  const planEl = document.getElementById('settings-plan');
  if (!toggle || !panel || !nameInput) return;

  let settingsOpen = false;
  let realTier = 'free';
  let previewTier = null;

  // Load saved name
  JestyStorage.getUserName().then(name => {
    if (name) {
      nameInput.value = name;
    }
  });

  // Load saved color, default to purple
  const SIDEPANEL_DEFAULT_PURPLE = { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' };
  chrome.storage.local.get(['jestyColor'], (result) => {
    const color = result.jestyColor || SIDEPANEL_DEFAULT_PURPLE;
    applyColor(color);
    renderSettingsColorFaces(color.body);
    // Reveal character after color is applied
    const charStage = document.getElementById('character-stage');
    if (charStage) {
      charStage.style.transition = 'opacity 0.15s ease';
      charStage.style.opacity = '1';
    }
  });

  // Load current plan
  JestyPremium.getTier().then(tier => {
    const displayName = JestyPremium.getTierDisplayName(tier);
    const tierLabel = tier === 'free' ? 'Free' : tier === 'premium' ? '$5' : '$3/mo';
    if (planEl) {
      planEl.textContent = `${displayName} · ${tierLabel}`;
    }
  });

  async function openSettings() {
    settingsOpen = true;
    // Close level panel if open
    const levelPanel = document.getElementById('level-panel');
    const levelBadge = document.getElementById('level-badge');
    if (levelPanel) levelPanel.classList.remove('visible');
    if (levelBadge) levelBadge.classList.remove('active');
    // Re-render faces with fresh random expressions each time
    const activeColor = currentColor.body || '#A78BFA';
    renderSettingsColorFaces(activeColor);
    // Highlight real tier in preview picker
    realTier = await JestyPremium.getTier();
    if (tierContainer) {
      tierContainer.querySelectorAll('.settings-tier-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tier === realTier);
      });
    }
    panel.classList.remove('hidden');
    panel.offsetHeight;
    panel.classList.add('visible');
    toggle.classList.add('active');
    nameInput.focus();
  }

  function closeSettings(save = true) {
    if (!settingsOpen) return;
    settingsOpen = false;
    panel.classList.remove('visible');
    toggle.classList.remove('active');
    setTimeout(() => {
      if (!settingsOpen) panel.classList.add('hidden');
    }, 300);

    if (save) {
      const name = nameInput.value.trim();
      JestyStorage.setUserName(name || '');
    }
  }

  // Toggle button
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsOpen) {
      closeSettings(true);
    } else {
      openSettings();
    }
  });

  // Enter saves + closes, Escape closes without saving
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeSettings(true);
    }
    if (e.key === 'Escape') {
      closeSettings(false);
    }
  });

  // Color face click handler
  if (facesContainer) {
    facesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-color-face');
      if (!btn) return;

      const idx = parseInt(btn.dataset.colorIndex);
      const entry = SETTINGS_COLORS[idx];
      if (!entry) return;

      facesContainer.querySelectorAll('.settings-color-face').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      applyColor(entry.color);
      chrome.storage.local.set({ jestyColor: entry.color });
    });
  }

  // Theme picker
  const themeContainer = document.getElementById('settings-theme');
  if (themeContainer) {
    chrome.storage.local.get(['jestyThemePreference'], (result) => {
      const pref = result.jestyThemePreference || 'light';
      themeContainer.querySelectorAll('.settings-theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === pref);
      });
    });
    themeContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-theme-btn');
      if (!btn) return;
      themeContainer.querySelectorAll('.settings-theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chrome.storage.local.set({ jestyThemePreference: btn.dataset.theme });
    });
  }

  // Tier preview picker
  const tierContainer = document.getElementById('settings-tier-preview');
  if (tierContainer) {
    tierContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-tier-btn');
      if (!btn) return;
      tierContainer.querySelectorAll('.settings-tier-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tier = btn.dataset.tier;
      if (tier === realTier) {
        applyTierPreview(null);
      } else {
        applyTierPreview(tier);
      }
    });
  }

  async function applyTierPreview(tier) {
    previewTier = tier;
    // Set override so all JestyPremium.isPremium/getTier calls reflect the preview
    JestyPremium.setTierOverride(tier);

    const isPrem = await JestyPremium.isPremium();
    const isPro = await JestyPremium.isPro();

    // Task card state
    await reinitTaskCard(isPrem);

    // Schedule card
    const scheduleCard = document.getElementById('schedule-card');
    if (scheduleCard) {
      if (isPro) {
        scheduleCard.classList.remove('hidden');
      } else {
        scheduleCard.classList.add('hidden');
      }
    }

    // Fun Zone quiz/trivia lock state
    reinitFunZoneLocks(isPrem);
  }

  // Click outside panel to close + save
  document.addEventListener('click', (e) => {
    if (settingsOpen && !panel.contains(e.target) && !toggle.contains(e.target)) {
      closeSettings(true);
    }
  });
}

function applyColor(color) {
  recolorSVGs(color);
}

function recolorSVGs(color) {
  const svgDefs = document.querySelector('svg[style*="display: none"] defs');
  if (!svgDefs) return;

  // Build replacement map from current → new (case-insensitive)
  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[currentColor[key].toUpperCase()] = color[key];
  }

  const symbols = svgDefs.querySelectorAll('symbol');
  symbols.forEach(symbol => {
    const elements = symbol.querySelectorAll('*');
    elements.forEach(el => {
      const fill = el.getAttribute('fill');
      if (fill && replacements[fill.toUpperCase()]) {
        el.setAttribute('fill', replacements[fill.toUpperCase()]);
      }
      const stroke = el.getAttribute('stroke');
      if (stroke && replacements[stroke.toUpperCase()]) {
        el.setAttribute('stroke', replacements[stroke.toUpperCase()]);
      }
    });
  });

  // Track current color so next recolor knows what to replace
  currentColor = { ...color };
}


/* ──────────────────────────────────────────────
   ACCESSORY PICKER
   ────────────────────────────────────────────── */

// Shared accessory constants
const ACC_VIEWBOXES = {
  'acc-party-hat': '0 0 44 30', 'acc-sunglasses': '0 0 56 20',
  'acc-bandana': '0 0 52 22', 'acc-heart-shades': '0 0 56 20',
  'acc-beanie': '0 0 52 26', 'acc-aviators': '0 0 56 22',
  'acc-chef-hat': '0 0 48 34', 'acc-3d-glasses': '0 0 56 20',
  'acc-monocle': '0 0 24 24', 'acc-propeller-hat': '0 0 48 32',
  'acc-star-glasses': '0 0 56 22', 'acc-crown': '0 0 48 28',
  'acc-bow-tie': '0 0 44 20', 'acc-detective-hat': '0 0 56 28',
  'acc-headband': '0 0 52 18', 'acc-viking-helmet': '0 0 56 32',
  'acc-top-hat': '0 0 44 36', 'acc-pirate-hat': '0 0 56 30',
  'acc-halo': '0 0 44 14',
  'acc-flame-crown': '0 0 48 32', 'acc-neon-shades': '0 0 56 20',
  'acc-wizard-hat': '0 0 48 40'
};

const ACC_FUN_NAMES = {
  'party-hat': 'Life of\nthe Party', 'sunglasses': 'Too Cool\nfor Tabs',
  'bandana': 'Rebel\nWithout Tabs', 'heart-shades': 'Love\nis Blind',
  'beanie': 'Chill\nVibes Only', 'aviators': 'Top Gun\nEnergy',
  'chef-hat': 'Kiss\nthe Cook', '3d-glasses': 'Extra\nDimension',
  'monocle': 'Fancy\nJudger', 'propeller-hat': 'Brain on\nSpin Cycle',
  'star-glasses': 'Born\nFamous', 'crown': 'Drama\nQueen',
  'bow-tie': 'Formally\nSavage', 'detective-hat': 'Tab\nStalker',
  'headband': 'Sweat the\nDetails', 'viking-helmet': 'Pillage\n& Browse',
  'top-hat': 'Sir Roasts\na Lot', 'pirate-hat': 'Captain\nTab Beard',
  'halo': 'Innocent?\nNever.',
  'flame-crown': 'Main\nCharacter', 'neon-shades': 'Cyber\nSavage',
  'wizard-hat': 'Roast\nWizard'
};

function initAccessoryPicker() {
  // Wire mini-bar "+" button
  const addBtn = document.getElementById('acc-mini-add');
  if (addBtn) addBtn.addEventListener('click', openAccDrawer);

  // Wire mini-slot clicks → open drawer
  ['acc-mini-hat', 'acc-mini-glasses'].forEach(id => {
    const slot = document.getElementById(id);
    if (slot) slot.addEventListener('click', openAccDrawer);
  });

  // Wire "Customize" link on main page
  const customizeBtn = document.getElementById('accessories-customize');
  if (customizeBtn) customizeBtn.addEventListener('click', openAccDrawer);

  // Wire drawer close
  const closeBtn = document.getElementById('acc-drawer-close');
  const backdrop = document.getElementById('acc-drawer-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeAccDrawer);
  if (backdrop) backdrop.addEventListener('click', closeAccDrawer);

  // Wire expression arrows
  const prevBtn = document.getElementById('acc-preview-prev');
  const nextBtn = document.getElementById('acc-preview-next');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    _accExprIdx = (_accExprIdx - 1 + ACC_EXPRESSIONS.length) % ACC_EXPRESSIONS.length;
    updateDrawerPreview(ACC_EXPRESSIONS[_accExprIdx]);
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    _accExprIdx = (_accExprIdx + 1) % ACC_EXPRESSIONS.length;
    updateDrawerPreview(ACC_EXPRESSIONS[_accExprIdx]);
  });

  // Wire "Remove all"
  const clearBtn = document.getElementById('acc-drawer-clear');
  if (clearBtn) clearBtn.addEventListener('click', async () => {
    await JestyAccessories.unequipAll();
    await refreshAllAccessoryUI();
  });

  // Render all UI
  renderMiniSlots();
  renderAccessoryGrid();

  // Listen for changes from other surfaces
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.jestyAccessoriesChanged) {
      JestyAccessories.init().then(() => refreshAllAccessoryUI());
    }
  });
}

const ACC_EXPRESSIONS = [
  'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
  'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender',
  'thinking', 'happy'
];

let _accExprIdx = 0;

let _accRefreshId = 0;
async function refreshAllAccessoryUI() {
  const id = ++_accRefreshId;
  renderMiniSlots();
  await renderAccessoryGrid(id);
  if (id !== _accRefreshId) return;
  await renderDrawerGrid(id);
  if (id !== _accRefreshId) return;
  updateDrawerPreview();
  const svg = document.getElementById('animated-character');
  const expr = JestyAnimator.getExpression();
  if (svg) JestyAccessories.renderAccessories(expr, svg);
}

function renderMiniSlots() {
  const equipped = JestyAccessories.getEquipped();
  for (const slot of ['hat', 'glasses']) {
    const el = document.getElementById(`acc-mini-${slot}`);
    if (!el) continue;
    const accId = equipped[slot];
    if (accId) {
      const acc = JestyAccessories.getCatalog().find(a => a.id === accId);
      if (acc) {
        const vb = ACC_VIEWBOXES[acc.symbolId] || '0 0 44 30';
        el.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>`;
        el.classList.add('equipped');
      }
    } else {
      el.innerHTML = '';
      el.classList.remove('equipped');
    }
  }
}

function openAccDrawer() {
  const drawer = document.getElementById('acc-drawer');
  if (!drawer) return;
  drawer.classList.remove('hidden');
  const currentExpr = JestyAnimator ? JestyAnimator.getExpression() : 'smug';
  _accExprIdx = Math.max(0, ACC_EXPRESSIONS.indexOf(currentExpr));
  renderDrawerGrid();
  updateDrawerPreview();
}

function closeAccDrawer() {
  const drawer = document.getElementById('acc-drawer');
  if (drawer) drawer.classList.add('hidden');
}

function updateDrawerPreview(overrideExpr) {
  const svg = document.getElementById('acc-preview-svg');
  if (!svg) return;
  const expr = overrideExpr || (JestyAnimator ? JestyAnimator.getExpression() : 'smug');
  const useEl = svg.querySelector('use');
  if (useEl) useEl.setAttribute('href', `#face-${expr}`);
  // Update mood label
  const moodLabel = document.getElementById('acc-preview-mood');
  if (moodLabel) moodLabel.textContent = expr;
  // Remove old accessories from preview, re-render
  svg.querySelectorAll('.jesty-accessory, .jesty-stage-effect, .jesty-acc-group').forEach(el => el.remove());
  JestyAccessories.renderAccessories(expr, svg);
}

async function renderDrawerGrid(refreshId) {
  const sections = document.getElementById('acc-drawer-sections');
  if (!sections) return;

  const catalog = JestyAccessories.getCatalog();
  const equipped = JestyAccessories.getEquipped();

  const fragment = document.createDocumentFragment();
  const SLOT_LABELS = { hat: 'Hats', glasses: 'Glasses' };

  for (const slot of ['hat', 'glasses']) {
    const section = document.createElement('div');

    const label = document.createElement('div');
    label.className = 'acc-drawer-section-label';
    label.textContent = SLOT_LABELS[slot];
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'acc-drawer-grid';

    const slotItems = catalog.filter(a => a.slot === slot);
    for (const acc of slotItems) {
      if (refreshId !== undefined && refreshId !== _accRefreshId) return;

      const unlocked = await JestyAccessories.isUnlocked(acc.id);
      if (refreshId !== undefined && refreshId !== _accRefreshId) return;

      const isEquipped = equipped[slot] === acc.id;
      const vb = ACC_VIEWBOXES[acc.symbolId] || '0 0 44 30';

      const btn = createAccTile(acc, slot, isEquipped, unlocked, async () => {
        if (isEquipped) {
          await JestyAccessories.unequipAccessory(slot);
        } else {
          await JestyAccessories.equipAccessory(slot, acc.id);
        }
        await refreshAllAccessoryUI();
      });

      let badgeHtml = '';
      if (!unlocked) {
        if (acc.tier === 'pro') badgeHtml = '<span class="acc-badge pro">SENTENCED</span>';
        else if (acc.unlockLevel) badgeHtml = `<span class="acc-badge level">Lv${acc.unlockLevel}</span>`;
        else badgeHtml = '<span class="acc-badge premium">GUILTY</span>';
      }

      const funName = ACC_FUN_NAMES[acc.id] || acc.name;
      btn.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>${badgeHtml}<span class="accessory-item-name">${funName}</span>`;
      grid.appendChild(btn);
    }

    section.appendChild(grid);
    fragment.appendChild(section);
  }

  // Add upgrade card for non-pro users
  const tier = await JestyPremium.getTier();
  if (tier !== 'pro') {
    const upgrade = tier === 'free'
      ? { name: 'Guilty', price: '$5 once', desc: 'Unlimited roasts, Focus mode & more', expression: 'impressed' }
      : { name: 'Sentenced', price: '$5/mo', desc: 'Calendar roasts & exclusive accessories', expression: 'chaotic' };

    const card = document.createElement('div');
    card.className = 'plans-upgrade-card';
    card.innerHTML = `
      <div class="plans-upgrade-icon">
        <svg viewBox="-15 -10 150 140" width="36" height="34"><use href="#face-${upgrade.expression}"/></svg>
      </div>
      <div class="plans-upgrade-info">
        <span class="plans-upgrade-name">${upgrade.name} — ${upgrade.price}</span>
        <span class="plans-upgrade-price">${upgrade.desc}</span>
      </div>
      <svg class="plans-upgrade-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    `;
    card.addEventListener('click', () => showTierOverlayPlans());
    fragment.appendChild(card);
  }

  sections.innerHTML = '';
  sections.appendChild(fragment);
}

function createAccTile(acc, slot, isEquipped, unlocked, onClick) {
  const btn = document.createElement('button');
  btn.className = 'accessory-item';
  if (isEquipped) btn.classList.add('equipped');
  if (!unlocked) btn.classList.add('locked');
  if (unlocked) {
    btn.addEventListener('click', onClick);
  } else {
    btn.addEventListener('click', () => showTierOverlayPlans());
  }
  return btn;
}

async function renderAccessoryGrid(refreshId) {
  const grid = document.getElementById('accessory-grid');
  if (!grid) return;

  const catalog = JestyAccessories.getCatalog();
  const equipped = JestyAccessories.getEquipped();

  const fragment = document.createDocumentFragment();
  let count = 0;
  const MAX_MAIN_GRID = 12;
  for (const slot of ['hat', 'glasses']) {
    const slotItems = catalog.filter(a => a.slot === slot);
    for (const acc of slotItems) {
      if (count >= MAX_MAIN_GRID) break;
      if (refreshId !== undefined && refreshId !== _accRefreshId) return;

      const unlocked = await JestyAccessories.isUnlocked(acc.id);
      if (refreshId !== undefined && refreshId !== _accRefreshId) return;

      const btn = document.createElement('button');
      btn.className = 'accessory-item';
      if (equipped[slot] === acc.id) btn.classList.add('equipped');
      if (!unlocked) btn.classList.add('locked');

      const vb = ACC_VIEWBOXES[acc.symbolId] || '0 0 44 30';
      let badgeHtml = '';
      if (!unlocked) {
        if (acc.tier === 'pro') badgeHtml = '<span class="acc-badge pro">SENTENCED</span>';
        else if (acc.unlockLevel) badgeHtml = `<span class="acc-badge level">Lv${acc.unlockLevel}</span>`;
        else badgeHtml = '<span class="acc-badge premium">GUILTY</span>';
      }

      const funName = ACC_FUN_NAMES[acc.id] || acc.name;
      btn.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>${badgeHtml}<span class="accessory-item-name">${funName}</span>`;

      if (unlocked) {
        btn.addEventListener('click', async () => {
          if (equipped[slot] === acc.id) {
            await JestyAccessories.unequipAccessory(slot);
          } else {
            await JestyAccessories.equipAccessory(slot, acc.id);
          }
          await refreshAllAccessoryUI();
        });
      }
      fragment.appendChild(btn);
      count++;
    }
  }

  grid.innerHTML = '';
  grid.appendChild(fragment);
}

/* ──────────────────────────────────────────────
   STATS
   ────────────────────────────────────────────── */

async function loadStats() {
  try {
    const stats = await JestyStorage.getUserStats();
    const roastCount = document.getElementById('roast-count');
    const streakCount = document.getElementById('streak-count');

    if (roastCount) roastCount.textContent = stats.totalRoasts || 0;
    if (streakCount) streakCount.textContent = stats.currentStreak || 0;
  } catch (e) {
    // Stats are non-critical, fail silently
  }
}

/* ──────────────────────────────────────────────
   LIVE COMMENTS
   ────────────────────────────────────────────── */

function startLiveComments() {
  // If focus session is active, show focus timer instead
  if (focusActive) {
    showComment('Focus session active');
    startFocusTimer();
    setTimeout(() => showLiveComment(), 30000 + Math.random() * 30000);
    return;
  }
  // Show an initial comment immediately so the space is never empty
  const initial = GENERIC_COMMENTS[Math.floor(Math.random() * GENERIC_COMMENTS.length)];
  showComment(initial);
  // Then start the rotation cycle
  setTimeout(() => showLiveComment(), 30000 + Math.random() * 30000);
}

async function tryLiveRealRoast() {
  try {
    const result = await RoastEngine.generate({ short: true, free: true });

    if (result.capped) return null;

    // Show the roast as a live comment
    showComment(result.joke);
    // Override expression with the AI's mood
    JestyAnimator.setExpression(result.mood, 6000);

    // Prime the chat drawer with this roast (don't open it)
    currentRoast = result.joke;
    conversationHistory = [
      { role: 'system', content: JESTY_PERSONALITY },
      { role: 'assistant', content: result.joke }
    ];

    const conversation = await JestyStorage.startConversation(result.roast.id);
    currentConversationId = conversation.id;
    await JestyStorage.addMessage(currentConversationId, 'jesty', result.joke);

    // Pre-populate chat container so it's ready if user opens drawer
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.innerHTML = '';
      addMessage(result.joke, 'jesty');
    }

    // Update stats & msgs left
    await loadStats();
    await updateMsgsLeft();

    return result.joke;
  } catch (e) {
    return null;
  }
}

async function showLiveComment() {
  // Don't show comments if drawer is open
  if (drawerOpen) {
    scheduleNextComment();
    return;
  }

  // Focus mode: show focus status messages instead of normal comments
  if (focusActive) {
    const FOCUS_QUIPS = [
      "Still focusing. Impressive.",
      "I'm watching every tab switch.",
      "Don't even think about it.",
      "Focus mode. I'm judging harder.",
      "You're doing suspiciously well.",
      "I see everything.",
      "Stay on task. I'm watching."
    ];
    showComment(FOCUS_QUIPS[Math.floor(Math.random() * FOCUS_QUIPS.length)]);
    // Brief quip, then resume timer display after 5s
    setTimeout(() => { if (focusActive) updateFocusTimerDisplay(); }, 5000);
    scheduleNextComment();
    return;
  }

  // 1-in-8 chance: show focus prompt (only when no active session)
  if (Math.random() < 0.125) {
    showFocusPrompt();
    scheduleNextComment();
    return;
  }

  // ~20% chance to show a real AI roast
  if (Math.random() < 0.2) {
    const realRoast = await tryLiveRealRoast();
    if (realRoast) { scheduleNextComment(); return; }
    // else fall through to stored comments
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let comment = null;

    if (tabs.length > 0 && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace('www.', '');

        // Check domain-specific comments
        if (LIVE_COMMENTS[domain]) {
          const pool = LIVE_COMMENTS[domain];
          comment = pool[Math.floor(Math.random() * pool.length)];
        }
      } catch {
        // Invalid URL, use generic
      }
    }

    // Check tab count comments if no domain match
    if (!comment) {
      const allTabs = await chrome.tabs.query({});
      const count = allTabs.length;

      for (const tier of TAB_COUNT_COMMENTS) {
        if (count >= tier.min) {
          comment = tier.messages[Math.floor(Math.random() * tier.messages.length)];
          break;
        }
      }
    }

    // Fall back to generic
    if (!comment) {
      comment = GENERIC_COMMENTS[Math.floor(Math.random() * GENERIC_COMMENTS.length)];
    }

    // Premium nudge: 1-in-5 chance after 50+ total roasts, if not premium
    const isPremiumUser = await JestyPremium.isPremium();
    if (!isPremiumUser && Math.random() < 0.2) {
      const stats = await JestyStorage.getUserStats();
      if (stats.totalRoasts >= 50) {
        const nudges = [
          "I have premium roasts. They're meaner. You'll love them.",
          "50 roasts and still free? You're missing out.",
          "Unlock me. I have so much more to say.",
          "Premium Jesty never sleeps. Just saying."
        ];
        comment = nudges[Math.floor(Math.random() * nudges.length)];
      }
    }

    showComment(comment);
  } catch (e) {
    // Fail silently for live comments
  }

  scheduleNextComment();
}

function scheduleNextComment() {
  const delay = 30000 + Math.random() * 30000; // 30-60 seconds
  liveCommentTimer = setTimeout(() => showLiveComment(), delay);
}

function showComment(text) {
  const commentText = document.getElementById('comment-text');

  if (!commentText) return;

  // Clear focus-prompt class (if a non-focus comment replaces the prompt)
  const commentEl = document.getElementById('live-comment');
  if (commentEl && commentEl.classList.contains('focus-prompt')) {
    commentEl.classList.remove('focus-prompt');
  }

  // Crossfade: fade out, swap text, fade in
  commentText.style.opacity = '0';
  setTimeout(() => {
    commentText.textContent = text;
    commentText.style.opacity = '1';
  }, 400);

  // Set a temporary expression (only when drawer is closed)
  if (!drawerOpen) {
    const expressions = ['smug', 'suspicious', 'eyeroll'];
    const expr = expressions[Math.floor(Math.random() * expressions.length)];
    JestyAnimator.setExpression(expr, 6000);
  }
}

/* ──────────────────────────────────────────────
   FOCUS TIME (live comment integration)
   ────────────────────────────────────────────── */

function showFocusPrompt() {
  const commentEl = document.getElementById('live-comment');
  const commentText = document.getElementById('comment-text');
  if (!commentText || !commentEl) return;

  commentEl.classList.add('focus-prompt');
  commentText.style.opacity = '0';
  setTimeout(() => {
    commentText.textContent = 'Need to focus? Tap me.';
    commentText.style.opacity = '1';
  }, 400);
}

async function handleFocusClick() {
  const commentEl = document.getElementById('live-comment');
  if (!commentEl) return;

  // Click on focus prompt → start session
  if (commentEl.classList.contains('focus-prompt')) {
    commentEl.classList.remove('focus-prompt');
    const session = await JestyFocusTime.startSession();
    if (session) {
      focusActive = true;
      commentEl.classList.add('focus-active');
      showComment("Let's see how this goes.");
      JestyAnimator.setExpression('smug', 4000);
      setTimeout(() => startFocusTimer(), 2000);
    }
    return;
  }

  // Click during active session → end session
  if (commentEl.classList.contains('focus-active')) {
    await handleFocusEnd();
  }
}

async function handleFocusEnd() {
  stopFocusTimer();

  const commentEl = document.getElementById('live-comment');
  if (commentEl) commentEl.classList.remove('focus-active');

  const focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    focusBtn.textContent = 'Focus time';
    focusBtn.classList.remove('active');
  }

  const endedSession = await JestyFocusTime.endSession();
  if (!endedSession) return;

  const durationMins = Math.floor((endedSession.endedAt - endedSession.startedAt) / 60000);
  const d = endedSession.distractionCount || 0;
  showComment(`Session done. ${durationMins}m, ${d} distraction${d !== 1 ? 's' : ''}.`);

  // Generate end roast (async)
  const roast = await JestyFocusTime.generateEndRoast(endedSession);
  if (roast) {
    showComment(roast.text);
    JestyAnimator.setExpression(roast.mood, 8000);
  }
}

function startFocusTimer() {
  clearInterval(focusTimerInterval);
  updateFocusTimerDisplay();
  focusTimerInterval = setInterval(updateFocusTimerDisplay, 1000);
}

function stopFocusTimer() {
  focusActive = false;
  clearInterval(focusTimerInterval);
  focusTimerInterval = null;
}

async function updateFocusTimerDisplay() {
  const session = await JestyFocusTime.getSession();
  if (!session || !session.active) {
    stopFocusTimer();
    return;
  }
  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  const timeStr = JestyFocusTime.formatTime(elapsed);
  const commentText = document.getElementById('comment-text');
  if (commentText && !drawerOpen) {
    // Direct update (no fade animation for timer ticks)
    commentText.textContent = `Focusing \u00b7 ${timeStr}`;
    commentText.style.opacity = '1';
  }
}

function initFocusClickHandler() {
  // Comment area click (focus prompt or active session)
  const commentEl = document.getElementById('live-comment');
  if (commentEl) {
    commentEl.addEventListener('click', handleFocusClick);
  }

  // Focus button
  const focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    focusBtn.addEventListener('click', async () => {
      if (focusActive) {
        await handleFocusEnd();
        focusBtn.textContent = 'Focus time';
        focusBtn.classList.remove('active');
      } else {
        const session = await JestyFocusTime.startSession();
        if (session) {
          focusActive = true;
          focusBtn.textContent = 'End focus';
          focusBtn.classList.add('active');
          const commentEl = document.getElementById('live-comment');
          if (commentEl) commentEl.classList.add('focus-active');
          showComment("Let's see how this goes.");
          JestyAnimator.setExpression('smug', 4000);
          setTimeout(() => startFocusTimer(), 2000);
        }
      }
    });
  }
}

/* ──────────────────────────────────────────────
   PREMIUM FEATURES INIT
   ────────────────────────────────────────────── */

async function initPremiumFeatures() {
  const isPremium = await JestyPremium.isPremium();

  // Show premium CTA for all tiers
  const cta = document.getElementById('premium-cta');
  if (cta) {
    cta.classList.remove('hidden');
    renderPromoFaces();
    const promoBtn = cta.querySelector('.promo-card-btn');
    if (promoBtn) promoBtn.addEventListener('click', showTierOverlay);
  }

  // Progression visible to all users (games award XP)
  await initProgression();

  // Focus Time (free feature)
  const focusWasActive = await JestyFocusTime.init();
  if (focusWasActive) {
    focusActive = true;
    const commentEl = document.getElementById('live-comment');
    if (commentEl) commentEl.classList.add('focus-active');
    const focusBtn = document.getElementById('focus-btn');
    if (focusBtn) {
      focusBtn.textContent = 'End focus';
      focusBtn.classList.add('active');
    }
    startFocusTimer();
  }
  initFocusClickHandler();

  // Task card: visible to all, but disabled for free users
  await initProductivityTasks(isPremium);

  // Premium+ features
  if (isPremium) {
    await initCalendarSchedule();
  }

  // Fun Zone visible to all users (quiz/trivia gated for free)
  await initFunZone(isPremium);

  // Plans upgrade section at bottom
  initPlansSection();
}

/**
 * Re-apply task card state for tier preview without re-binding events.
 */
async function reinitTaskCard(isPremium) {
  const card = document.getElementById('task-card');
  if (!card) return;
  card.classList.remove('hidden');

  const listEl = document.getElementById('task-card-list');
  const addBtn = document.getElementById('task-add-btn');
  const viewAll = document.getElementById('task-viewall');

  if (!isPremium) {
    card.classList.add('task-card-locked');
    if (listEl) listEl.innerHTML = '<p class="task-card-locked-msg">Plead Guilty to start tracking tasks</p>';
    if (addBtn) addBtn.style.display = 'none';
    if (viewAll) viewAll.style.display = 'none';
  } else {
    card.classList.remove('task-card-locked');
    if (addBtn) addBtn.style.display = '';
    if (viewAll) viewAll.style.display = '';
    await renderTaskList();
  }
}

/**
 * Re-apply fun zone lock state for tier preview without re-binding events.
 */
function reinitFunZoneLocks(isPremium) {
  const arrowSvg = '<svg class="funzone-card-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>';
  const lockSvg = '<svg class="funzone-card-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  ['tab-quiz-card', 'roast-trivia-card'].forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.toggle('funzone-card-locked', !isPremium);
    // Swap arrow/lock icon
    const existing = card.querySelector('.funzone-card-arrow');
    if (existing) existing.outerHTML = isPremium ? arrowSvg : lockSvg;
  });
}

/* ──────────────────────────────────────────────
   FUN ZONE
   ────────────────────────────────────────────── */

let funZoneInited = false;
let tabQuizInited = false;
let roastTriviaInited = false;

async function initFunZone(isPremium) {
  const section = document.getElementById('funzone-section');
  if (!section) return;

  section.classList.remove('hidden');

  // Memory Match — always clickable (level gating inside game)
  const memoryCard = document.getElementById('memory-game-card');
  if (memoryCard && !funZoneInited) {
    memoryCard.addEventListener('click', () => JestyMemoryGame.show());
  }

  // Tab Quiz — click handler checks tier at runtime
  const tabQuizCard = document.getElementById('tab-quiz-card');
  if (tabQuizCard && !funZoneInited) {
    tabQuizCard.addEventListener('click', async () => {
      const prem = await JestyPremium.isPremium();
      if (prem) {
        if (!tabQuizInited) { await JestyTabQuiz.init(); tabQuizInited = true; }
        JestyTabQuiz.show();
      } else {
        showTierOverlayPlans();
      }
    });
  }

  // Roast Trivia — click handler checks tier at runtime
  const triviaCard = document.getElementById('roast-trivia-card');
  if (triviaCard && !funZoneInited) {
    triviaCard.addEventListener('click', async () => {
      const prem = await JestyPremium.isPremium();
      if (prem) {
        if (!roastTriviaInited) { await JestyRoastTrivia.init(); roastTriviaInited = true; }
        JestyRoastTrivia.show();
      } else {
        showTierOverlayPlans();
      }
    });
  }

  // Apply lock visuals
  reinitFunZoneLocks(isPremium);

  // Init memory game (always available)
  if (!funZoneInited) {
    await JestyMemoryGame.init();
  }

  funZoneInited = true;
}

/* ──────────────────────────────────────────────
   PLANS UPGRADE SECTION
   ────────────────────────────────────────────── */

async function initPlansSection() {
  const section = document.getElementById('plans-section');
  if (!section) return;

  const tier = await JestyPremium.getTier();
  const currentLabel = document.getElementById('plans-section-current');
  const cardsContainer = document.getElementById('plans-section-cards');
  const seeAllBtn = document.getElementById('plans-section-link');

  const tierName = JestyPremium.getTierDisplayName(tier);

  if (currentLabel) {
    currentLabel.textContent = `Current plan: ${tierName}`;
  }

  // Build upgrade cards for tiers above current
  const upgrades = [];
  if (tier === 'free') {
    upgrades.push(
      { name: 'Guilty', price: '$5 once', desc: 'Unlimited roasts, Focus mode & more', action: 'checkout', expression: 'impressed' },
      { name: 'Sentenced', price: '$5/mo', desc: 'Calendar roasts & exclusive accessories', action: 'checkout-pro', expression: 'chaotic' }
    );
  } else if (tier === 'premium') {
    upgrades.push(
      { name: 'Sentenced', price: '$5/mo', desc: 'Calendar roasts & exclusive accessories', action: 'checkout-pro', expression: 'chaotic' }
    );
  }

  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    for (const up of upgrades) {
      const card = document.createElement('div');
      card.className = 'plans-upgrade-card';
      card.innerHTML = `
        <div class="plans-upgrade-icon">
          <svg viewBox="-15 -10 150 140" width="36" height="34"><use href="#face-${up.expression}"/></svg>
        </div>
        <div class="plans-upgrade-info">
          <span class="plans-upgrade-name">${up.name} — ${up.price}</span>
          <span class="plans-upgrade-price">${up.desc}</span>
        </div>
        <svg class="plans-upgrade-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      `;
      card.addEventListener('click', () => showTierOverlayPlans());
      cardsContainer.appendChild(card);
    }
  }

  if (seeAllBtn) {
    seeAllBtn.addEventListener('click', showTierOverlayPlans);
  }
}

/* ──────────────────────────────────────────────
   PROMO CARD FACES
   ────────────────────────────────────────────── */

const PROMO_FACES = [
  { expression: 'smug',       color: { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' } },   // Lime
  { expression: 'suspicious', color: { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' } },   // Pink
  { expression: 'yikes',      color: { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' } },   // Sky
  { expression: 'eyeroll',    color: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' } },   // Purple
  { expression: 'dead',       color: { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' } },   // Mint
];

function renderPromoFaces() {
  const container = document.getElementById('promo-card-faces');
  if (!container) return;

  container.innerHTML = '';

  PROMO_FACES.forEach((face, i) => {
    const symbol = document.getElementById(`face-${face.expression}`);
    if (!symbol) return;

    // Clone symbol content into a standalone SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-15 -10 150 140');

    // Make clipPath IDs unique to avoid collisions with the shared symbols
    let content = symbol.innerHTML;
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-promo-${i}`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-promo-${i})`);
    svg.innerHTML = content;

    // Recolor: replace current global color → this face's target color
    const replacements = {};
    for (const key of ['body', 'limb', 'shadow', 'highlight']) {
      replacements[currentColor[key].toUpperCase()] = face.color[key];
    }

    svg.querySelectorAll('*').forEach(el => {
      for (const attr of ['fill', 'stroke']) {
        const val = el.getAttribute(attr);
        if (val && replacements[val.toUpperCase()]) {
          el.setAttribute(attr, replacements[val.toUpperCase()]);
        }
      }
    });

    const wrap = document.createElement('div');
    wrap.className = `promo-face promo-face-${i + 1}`;
    wrap.appendChild(svg);
    container.appendChild(wrap);
  });
}

/* ──────────────────────────────────────────────
   PRODUCTIVITY TASKS
   ────────────────────────────────────────────── */

const TASK_TEMPLATES = [
  {
    id: 'close_old_tabs',
    title: 'Close tabs you haven\'t used in 30 minutes',
    description: 'Find and close {count} stale tabs.',
    check: async () => {
      // Check if tab count decreased since task started
      const tabs = await chrome.tabs.query({});
      const { taskStartTabCount } = await chrome.storage.local.get(['taskStartTabCount']);
      return taskStartTabCount && tabs.length < taskStartTabCount - 2;
    },
    xp: 30
  },
  {
    id: 'close_category',
    title: 'Close all social media tabs',
    description: 'Distractions begone! Close every social media tab.',
    check: async () => {
      const tabs = await chrome.tabs.query({});
      const social = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com'];
      return !tabs.some(t => {
        try { return social.some(s => new URL(t.url).hostname.includes(s)); }
        catch { return false; }
      });
    },
    xp: 25
  },
  {
    id: 'tab_count_below',
    title: 'Get your tab count below 20',
    description: 'Declutter your browser. Close tabs until you\'re under 20.',
    check: async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.length < 20;
    },
    xp: 40
  },
  {
    id: 'focus_5min',
    title: 'Stay focused for 5 minutes',
    description: 'Start a Focus Time session and stay on task for 5 minutes.',
    check: async () => {
      const { focusSession } = await chrome.storage.local.get(['focusSession']);
      if (!focusSession || !focusSession.active) return false;
      const streakSec = focusSession.currentStreakStart
        ? (Date.now() - focusSession.currentStreakStart) / 1000
        : 0;
      return streakSec >= 300;
    },
    xp: 50
  }
];

let taskSystemInited = false;
let taskCheckInterval = null;

async function initProductivityTasks(isPremium) {
  const card = document.getElementById('task-card');
  if (!card) return;

  card.classList.remove('hidden');

  // Apply visual state
  await reinitTaskCard(isPremium);

  if (!taskSystemInited) {
    // Bind event listeners once — they check tier at runtime
    card.addEventListener('click', async (e) => {
      // Only handle clicks on the locked card overlay (not child buttons)
      if (card.classList.contains('task-card-locked')) {
        showTierOverlayPlans();
      }
    });

    const viewAll = document.getElementById('task-viewall');
    if (viewAll) viewAll.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDrawer();
    });

    const addBtn = document.getElementById('task-add-btn');
    if (addBtn) addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      createAndOpenTask();
    });

    initTaskDrawers();
    taskSystemInited = true;
  }

  if (isPremium) {
    // Load auto-suggested task
    const { currentTask } = await chrome.storage.local.get(['currentTask']);
    if (!currentTask || currentTask.completed) {
      await assignNewTask();
    }

    // Check auto-task completion periodically (only once)
    if (!taskCheckInterval) {
      taskCheckInterval = setInterval(() => checkTaskCompletion(), 10000);
    }
  }
}

async function assignNewTask() {
  const tabs = await chrome.tabs.query({});

  let template;
  if (tabs.length >= 20) {
    template = TASK_TEMPLATES.find(t => t.id === 'tab_count_below');
  } else if (tabs.length >= 10) {
    template = TASK_TEMPLATES.find(t => t.id === 'close_old_tabs');
  } else {
    template = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];
  }

  const task = {
    ...template,
    assignedAt: Date.now(),
    completed: false
  };

  await chrome.storage.local.set({
    currentTask: task,
    taskStartTabCount: tabs.length
  });
}

async function loadUserTasks() {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  return (jesty_data && jesty_data.user_tasks) || [];
}

async function saveUserTask(task) {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;
  if (!jesty_data.user_tasks) jesty_data.user_tasks = [];

  const idx = jesty_data.user_tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    jesty_data.user_tasks[idx] = task;
  } else {
    jesty_data.user_tasks.push(task);
  }
  await chrome.storage.local.set({ jesty_data });
}

async function deleteUserTask(taskId) {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data || !jesty_data.user_tasks) return;
  jesty_data.user_tasks = jesty_data.user_tasks.filter(t => t.id !== taskId);
  await chrome.storage.local.set({ jesty_data });
}

async function animateTaskRemove(el, taskId, onDone) {
  // Delete from storage immediately so it's never stale
  await deleteUserTask(taskId);

  // Animate the row out visually
  el.classList.add('removing');

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };

  el.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'max-height') finish();
  });

  // Safety fallback in case transitionend doesn't fire
  setTimeout(finish, 400);
}

async function renderTaskList() {
  const listEl = document.getElementById('task-card-list');
  if (!listEl) return;

  const { currentTask } = await chrome.storage.local.get(['currentTask']);
  const userTasks = await loadUserTasks();

  // Build combined list: auto-task first, then user tasks
  const allTasks = [];
  if (currentTask && !currentTask.completed) {
    allTasks.push({ id: 'auto_' + currentTask.id, title: currentTask.title, type: 'auto', completed: false });
  }
  userTasks.filter(t => !t.completed).forEach(t => {
    allTasks.push({ id: t.id, title: t.title, type: 'user', notes: t.notes, completed: false });
  });

  // Show max 3
  const display = allTasks.slice(0, 3);

  const addBtn = document.getElementById('task-add-btn');
  const viewAll = document.getElementById('task-viewall');

  if (display.length === 0) {
    if (addBtn) addBtn.style.display = 'none';
    if (viewAll) viewAll.style.display = 'none';
    listEl.innerHTML = `
      <div class="task-empty-state">
        <div class="task-empty-character">
          <svg viewBox="-15 -10 150 140" width="48" height="45"><use href="#face-smug"/></svg>
        </div>
        <p class="task-empty-text">No tasks yet. Add one to get started.</p>
        <button class="task-add-btn" id="task-empty-add-btn">+ Add task</button>
      </div>
    `;
    const emptyAdd = document.getElementById('task-empty-add-btn');
    if (emptyAdd) emptyAdd.addEventListener('click', () => createAndOpenTask());
    return;
  }

  if (addBtn) addBtn.style.display = '';
  if (viewAll) viewAll.style.display = '';

  const trashSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

  listEl.innerHTML = display.map(t => {
    let noteCount = 0;
    if (Array.isArray(t.notes)) noteCount = t.notes.filter(n => !n.done).length;
    else if (typeof t.notes === 'string' && t.notes.trim()) noteCount = 1;
    const notesLabel = noteCount > 0 ? `<span class="task-item-notes">${noteCount} note${noteCount !== 1 ? 's' : ''}</span>` : '';
    const deleteBtn = t.type === 'user' ? `<button class="task-item-delete" data-delete-id="${t.id}">${trashSvg}</button>` : '';
    return `
      <div class="task-item${t.completed ? ' completed' : ''}" data-id="${t.id}" data-type="${t.type}">
        <div class="task-item-check"></div>
        <div class="task-item-content">
          <span class="task-item-title">${escapeHtml(t.title)}</span>
          ${notesLabel}
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join('');

  // Click handlers
  listEl.querySelectorAll('.task-item').forEach(el => {
    const id = el.dataset.id;
    const type = el.dataset.type;

    // Click check to complete
    const check = el.querySelector('.task-item-check');
    if (check) {
      check.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (type === 'user') {
          const tasks = await loadUserTasks();
          const task = tasks.find(t => t.id === id);
          if (task) {
            task.completed = true;
            task.completedAt = Date.now();
            await saveUserTask(task);
            await renderTaskList();
          }
        }
      });
    }

    // Click delete
    const del = el.querySelector('.task-item-delete');
    if (del) {
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        animateTaskRemove(el, id, () => renderTaskList());
      });
    }

    // Click item to open detail (user tasks only)
    if (type === 'user') {
      el.addEventListener('click', () => openTaskDetail(id));
    }
  });
}

function initTaskDrawers() {
  // Task list drawer
  const drawerClose = document.getElementById('task-drawer-close');
  const drawerBackdrop = document.getElementById('task-drawer-backdrop');
  if (drawerClose) drawerClose.addEventListener('click', closeTaskDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeTaskDrawer);

  // Task detail drawer
  const detailClose = document.getElementById('task-detail-close');
  const detailBackdrop = document.getElementById('task-detail-backdrop');
  const detailBack = document.getElementById('task-detail-back');
  if (detailClose) detailClose.addEventListener('click', closeTaskDetail);
  if (detailBackdrop) detailBackdrop.addEventListener('click', closeTaskDetail);
  if (detailBack) detailBack.addEventListener('click', () => {
    closeTaskDetail();
    openTaskDrawer();
  });
}

async function openTaskDrawer() {
  const drawer = document.getElementById('task-drawer');
  const content = document.getElementById('task-drawer-content');
  if (!drawer || !content) return;

  drawer.classList.remove('hidden');
  requestAnimationFrame(() => drawer.classList.add('visible'));

  // Render all tasks
  const { currentTask } = await chrome.storage.local.get(['currentTask']);
  const userTasks = await loadUserTasks();

  content.innerHTML = '';

  // Auto-suggested task
  if (currentTask && !currentTask.completed) {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.dataset.type = 'auto';
    el.innerHTML = `
      <div class="task-item-check"></div>
      <div class="task-item-content">
        <span class="task-item-title">${escapeHtml(currentTask.title)}</span>
        <span class="task-item-notes">Auto-suggested</span>
      </div>
    `;
    content.appendChild(el);
  }

  // User tasks (incomplete first, then completed)
  const incomplete = userTasks.filter(t => !t.completed);
  const completed = userTasks.filter(t => t.completed);
  const hasAuto = currentTask && !currentTask.completed;

  const isEmpty = !hasAuto && incomplete.length === 0 && completed.length === 0;

  if (isEmpty) {
    const empty = document.createElement('div');
    empty.className = 'task-empty-state task-empty-state-drawer';
    empty.innerHTML = `
      <div class="task-empty-character">
        <svg viewBox="-15 -10 150 140" width="58" height="54"><use href="#face-smug"/></svg>
      </div>
      <p class="task-empty-text">No tasks yet. Add one to get started.</p>
      <button class="task-empty-add-btn">+ Add task</button>
    `;
    empty.querySelector('.task-empty-add-btn').addEventListener('click', () => {
      closeTaskDrawer();
      createAndOpenTask();
    });
    content.appendChild(empty);
    return;
  }

  [...incomplete, ...completed].forEach(t => {
    const el = document.createElement('div');
    el.className = `task-item${t.completed ? ' completed' : ''}`;
    el.dataset.id = t.id;
    el.dataset.type = 'user';
    let notesCount = 0;
    if (Array.isArray(t.notes)) notesCount = t.notes.filter(n => !n.done).length;
    else if (typeof t.notes === 'string' && t.notes.trim()) notesCount = 1;
    const notesLabel = notesCount > 0 ? `<span class="task-item-notes">${notesCount} note${notesCount !== 1 ? 's' : ''}</span>` : '';
    el.innerHTML = `
      <div class="task-item-check"></div>
      <div class="task-item-content">
        <span class="task-item-title">${escapeHtml(t.title)}</span>
        ${notesLabel}
      </div>
      <button class="task-item-delete">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    `;

    // Check to complete
    el.querySelector('.task-item-check').addEventListener('click', async (e) => {
      e.stopPropagation();
      t.completed = !t.completed;
      t.completedAt = t.completed ? Date.now() : null;
      await saveUserTask(t);
      openTaskDrawer(); // Refresh
      renderTaskList();
    });

    // Delete
    el.querySelector('.task-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      animateTaskRemove(el, t.id, () => {
        el.remove();
        renderTaskList();
      });
    });

    // Click to open detail
    el.addEventListener('click', () => {
      closeTaskDrawer();
      openTaskDetail(t.id);
    });

    content.appendChild(el);
  });

  // Add task button
  const addBtn = document.createElement('button');
  addBtn.className = 'task-drawer-add-btn';
  addBtn.textContent = '+ Add task';
  addBtn.addEventListener('click', () => {
    closeTaskDrawer();
    createAndOpenTask();
  });
  content.appendChild(addBtn);
}

function closeTaskDrawer() {
  const drawer = document.getElementById('task-drawer');
  if (drawer) {
    drawer.classList.remove('visible');
    setTimeout(() => drawer.classList.add('hidden'), 200);
  }
}

let taskDetailSaveTimer = null;
let taskDetailDismissed = false;

function migrateTaskNotes(task) {
  if (typeof task.notes === 'string' && task.notes.trim()) {
    task.notes = [{ text: task.notes.trim(), done: false }];
  } else if (!Array.isArray(task.notes)) {
    task.notes = [];
  }
}

function renderNoteItems(task) {
  const list = document.getElementById('task-detail-notes-list');
  if (!list) return;
  list.innerHTML = '';

  task.notes.forEach((note, i) => {
    const div = document.createElement('div');
    div.className = `task-detail-note${note.done ? ' checked' : ''}`;

    const check = document.createElement('div');
    check.className = 'task-detail-note-check';
    check.addEventListener('click', async () => {
      if (taskDetailDismissed) return;
      note.done = !note.done;
      renderNoteItems(task);
      await saveUserTask(task);
      renderTaskList();
    });

    const textEl = document.createElement('span');
    textEl.className = 'task-detail-note-text';
    textEl.textContent = note.text;
    textEl.contentEditable = 'true';
    textEl.addEventListener('focus', () => {
      textEl.classList.add('editing-hint');
      setTimeout(() => textEl.classList.remove('editing-hint'), 600);
    });
    textEl.addEventListener('blur', async () => {
      textEl.classList.remove('editing-hint');
      if (taskDetailDismissed) return;
      const newText = textEl.textContent.trim();
      if (!newText) {
        task.notes.splice(i, 1);
        renderNoteItems(task);
      } else {
        note.text = newText;
      }
      await saveUserTask(task);
      renderTaskList();
    });
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textEl.blur();
      }
    });

    div.appendChild(check);
    div.appendChild(textEl);
    list.appendChild(div);
  });

  // Append inline input row after the last note
  const row = document.createElement('div');
  row.className = 'task-detail-note-add';

  const addCheck = document.createElement('div');
  addCheck.className = 'task-detail-note-check';
  row.appendChild(addCheck);

  const input = document.createElement('input');
  input.className = 'task-detail-note-input';
  input.placeholder = 'Add a note...';

  // Hidden sizer to measure text width
  const sizer = document.createElement('span');
  sizer.className = 'task-detail-note-sizer';
  row.appendChild(sizer);

  const resizeInput = () => {
    sizer.textContent = input.value || input.placeholder;
    input.style.width = (sizer.offsetWidth + 4) + 'px';
  };

  input.addEventListener('input', () => {
    row.classList.toggle('typing', input.value.length > 0);
    resizeInput();
  });

  input.onkeydown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (taskDetailDismissed) return;
      const text = input.value.trim();
      if (!text) return;
      task.notes.push({ text, done: false });
      renderNoteItems(task);
      await saveUserTask(task);
      renderTaskList();
      const newInput = list.querySelector('.task-detail-note-input');
      if (newInput) newInput.focus();
    }
  };

  row.appendChild(input);
  list.appendChild(row);

  // Initial size to fit placeholder
  requestAnimationFrame(resizeInput);
}

function isTaskEmpty(task) {
  const hasTitle = task.title && task.title.trim();
  const hasNotes = Array.isArray(task.notes) && task.notes.length > 0;
  return !hasTitle && !hasNotes;
}

let taskDetailCurrentTask = null;

async function openTaskDetail(taskId, unsavedTask) {
  const drawer = document.getElementById('task-detail-drawer');
  const titleInput = document.getElementById('task-detail-title');
  const doneBtn = document.getElementById('task-detail-done-btn');
  const deleteBtn = document.getElementById('task-detail-delete-btn');
  if (!drawer || !titleInput) return;

  let task;
  if (unsavedTask) {
    task = unsavedTask;
  } else {
    const tasks = await loadUserTasks();
    task = tasks.find(t => t.id === taskId);
    if (!task) return;
  }

  migrateTaskNotes(task);
  taskDetailDismissed = false;
  taskDetailCurrentTask = task;

  titleInput.value = task.title || '';
  titleInput.readOnly = false;

  renderNoteItems(task);

  drawer.classList.remove('hidden');
  requestAnimationFrame(() => {
    drawer.classList.add('visible');
    if (!task.title) {
      titleInput.focus();
    }
  });

  // Enter on title jumps to note input
  titleInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const noteInput = document.querySelector('#task-detail-notes-list .task-detail-note-input');
      if (noteInput) noteInput.focus();
    }
  };

  // Auto-save title on change (debounced)
  titleInput.oninput = () => {
    clearTimeout(taskDetailSaveTimer);
    taskDetailSaveTimer = setTimeout(async () => {
      if (taskDetailDismissed) return;
      task.title = titleInput.value.trim();
      if (!isTaskEmpty(task)) {
        await saveUserTask(task);
        renderTaskList();
      }
    }, 500);
  };

  // Done button
  if (doneBtn) {
    doneBtn.onclick = async () => {
      taskDetailDismissed = true;
      if (!isTaskEmpty(task)) {
        task.title = task.title || 'Untitled';
        task.completed = true;
        task.completedAt = Date.now();
        await saveUserTask(task);
      }
      closeTaskDetail();
      renderTaskList();
    };
  }

  // Delete button
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      taskDetailDismissed = true;
      await deleteUserTask(taskId);
      closeTaskDetail();
      renderTaskList();
    };
  }
}

async function closeTaskDetail() {
  const drawer = document.getElementById('task-detail-drawer');
  if (drawer) {
    drawer.classList.remove('visible');
    setTimeout(() => drawer.classList.add('hidden'), 200);
  }
  clearTimeout(taskDetailSaveTimer);

  // Clean up empty tasks on close
  if (taskDetailCurrentTask && !taskDetailDismissed) {
    if (isTaskEmpty(taskDetailCurrentTask)) {
      await deleteUserTask(taskDetailCurrentTask.id);
      renderTaskList();
    }
  }
  taskDetailCurrentTask = null;
}

  const drawer = document.getElementById('task-detail-drawer');
  if (drawer) {
    drawer.classList.remove('visible');
    setTimeout(() => drawer.classList.add('hidden'), 200);
  }
  clearTimeout(taskDetailSaveTimer);
}

async function createAndOpenTask() {
  const newTask = {
    id: 'user_' + Date.now(),
    title: '',
    notes: [],
    completed: false,
    createdAt: Date.now()
  };
  openTaskDetail(newTask.id, newTask);
}

async function checkTaskCompletion() {
  const { currentTask } = await chrome.storage.local.get(['currentTask']);
  if (!currentTask || currentTask.completed) return;

  const template = TASK_TEMPLATES.find(t => t.id === currentTask.id);
  if (!template) return;

  const completed = await template.check();
  if (completed) {
    currentTask.completed = true;
    currentTask.completedAt = Date.now();
    await chrome.storage.local.set({ currentTask });

    // Award XP
    await awardXP(template.xp);

    // Show completion
    showComment(`Task complete! +${template.xp} XP`);
    JestyAnimator.setExpression('happy', 5000);

    // Assign next task after delay
    setTimeout(() => assignNewTask(), 30000);
  }
}

/* ──────────────────────────────────────────────
   TAMAGOTCHI PROGRESSION
   ────────────────────────────────────────────── */

const LEVEL_THRESHOLDS = [
  100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000,
  6500, 8000, 10000, 12500, 15000, 18000, 21000, 25000, 30000, 35000
];

const LEVEL_UNLOCKS = {
  2: 'Party Hat',
  3: 'Sunglasses',
  4: 'Bandana',
  5: 'Heart Shades',
  6: 'Beanie',
  7: 'Aviators · Teen Blob',
  8: 'Chef Hat',
  9: '3D Glasses',
  10: 'Monocle',
  11: 'Propeller Hat',
  12: 'Star Glasses',
  13: 'Crown',
  14: 'Bow Tie · Adult Blob',
  15: 'Detective Hat',
  16: 'Headband',
  17: 'Viking Helmet',
  18: 'Top Hat',
  19: 'Pirate Hat',
  20: 'Halo · Legendary Blob'
};

const LEVEL_UNLOCK_IDS = {
  2: 'party-hat',
  3: 'sunglasses',
  4: 'bandana',
  5: 'heart-shades',
  6: 'beanie',
  7: 'aviators',
  8: 'chef-hat',
  9: '3d-glasses',
  10: 'monocle',
  11: 'propeller-hat',
  12: 'star-glasses',
  13: 'crown',
  14: 'bow-tie',
  15: 'detective-hat',
  16: 'headband',
  17: 'viking-helmet',
  18: 'top-hat',
  19: 'pirate-hat',
  20: 'halo'
};

const XP_SOURCES = [
  { label: 'Tab Cleanup', desc: '5-15 XP per closed tab' },
  { label: 'Memory Match', desc: '10-30 XP per level' },
  { label: 'Tab Quiz', desc: '10-15 XP per question' },
  { label: 'Roast Trivia', desc: '10-15 XP per question' },
  { label: 'Tasks', desc: '25-50 XP each', premium: true },
];

// Ring circumference: 2 * π * 15 = 94.25
const RING_CIRCUMFERENCE = 94.25;

async function initProgression() {
  const badge = document.getElementById('level-badge');
  const panel = document.getElementById('level-panel');
  if (!badge || !panel) return;

  // Toggle panel on badge click
  badge.addEventListener('click', () => {
    const isVisible = panel.classList.contains('visible');
    if (isVisible) {
      panel.classList.remove('visible');
      badge.classList.remove('active');
    } else {
      // Close settings panel if open
      const settingsPanel = document.getElementById('settings-panel');
      const settingsToggle = document.getElementById('settings-toggle');
      if (settingsPanel && settingsPanel.classList.contains('visible')) {
        settingsPanel.classList.remove('visible');
        settingsPanel.classList.add('hidden');
        if (settingsToggle) settingsToggle.classList.remove('active');
      }
      panel.classList.add('visible');
      badge.classList.add('active');
    }
  });

  // Close panel when clicking outside — swallow the click so nothing else triggers
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('visible') && !badge.contains(e.target) && !panel.contains(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      panel.classList.remove('visible');
      badge.classList.remove('active');
    }
  }, true);

  // Render XP sources
  const sourcesEl = document.getElementById('level-panel-sources');
  if (sourcesEl) {
    const isPremium = await JestyPremium.isPremium();
    sourcesEl.innerHTML = XP_SOURCES
      .filter(s => !s.premium || isPremium)
      .map(s => `<div class="level-source"><span class="level-source-dot"></span>${s.label} <span style="color:var(--jesty-text-muted)">${s.desc}</span></div>`)
      .join('');
  }

  // Next-unlock click opens levels drawer
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    nextEl.addEventListener('click', () => {
      panel.classList.remove('visible');
      badge.classList.remove('active');
      openLevelsDrawer();
    });
  }

  // Levels drawer close
  const levelsDrawer = document.getElementById('levels-drawer');
  const levelsClose = document.getElementById('levels-drawer-close');
  const levelsBackdrop = document.getElementById('levels-drawer-backdrop');
  if (levelsClose) levelsClose.addEventListener('click', closeLevelsDrawer);
  if (levelsBackdrop) levelsBackdrop.addEventListener('click', closeLevelsDrawer);

  await renderLevelBadge();
}

const LEVEL_QUIPS = {
  2: 'A party hat at level 2? Celebrating mediocrity. On brand.',
  3: 'Shades to hide the shame in your eyes. Smart move.',
  4: 'A bandana? Are you browsing or starting a revolution?',
  5: 'Heart-shaped glasses. Because you clearly love wasting time.',
  6: 'A beanie to keep your one brain cell warm. Thoughtful.',
  7: 'Aviators AND a growth spurt? Don\'t let it go to your head.',
  8: 'Chef hat unlocked. Finally cooking something besides tabs.',
  9: '3D glasses for someone living in a 2D reality. The irony.',
  10: 'A monocle to inspect your life choices in high definition.',
  11: 'A propeller hat. Your maturity level checks out.',
  12: 'Star glasses because you\'re the star of your own delusion.',
  13: 'A crown for the reigning champion of procrastination.',
  14: 'A bow tie AND Adult Blob? Growing up is overrated anyway.',
  15: 'Detective hat. Now investigate where your day went.',
  16: 'A headband for all that mental gymnastics you do daily.',
  17: 'A viking helmet. Pillaging productivity like a true warrior.',
  18: 'Sir Roasts-a-Lot has entered the building. Finally.',
  19: 'A pirate hat. Navigating the seven tabs of the sea.',
  20: 'A halo? You? THAT is the funniest thing I\'ve ever seen.',
};

const HERO_STATUS_QUIPS = [
  'Still a baby blob. Adorable. Pathetic, but adorable.',
  'Level %d and already addicted. Classic.',
  'You\'re speed-running mediocrity. Respect.',
  'At this rate you\'ll peak by retirement.',
  'Your dedication is concerning. I love it.',
  '%d levels deep and no signs of stopping. Seek help.',
  'The grind is real. The productivity is not.',
];

async function openLevelsDrawer() {
  const drawer = document.getElementById('levels-drawer');
  const timeline = document.getElementById('levels-timeline');
  const heroEl = document.getElementById('levels-drawer-hero');
  if (!drawer || !timeline) return;

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const prog = (jesty_data && jesty_data.progression) || { level: 1, xp: 0, xp_to_next: 100 };
  const pct = Math.min(1, prog.xp / prog.xp_to_next);
  // Hero section
  if (heroEl) {
    const quip = HERO_STATUS_QUIPS[prog.level % HERO_STATUS_QUIPS.length].replace('%d', prog.level);
    heroEl.innerHTML = `
      <div class="levels-hero-level">${prog.level}</div>
      <div class="levels-hero-bar"><div class="levels-hero-fill" style="width:${pct * 100}%"></div></div>
      <div class="levels-hero-xp">${prog.xp} / ${prog.xp_to_next} XP</div>
      <div class="levels-hero-quip">${quip}</div>
    `;
  }

  const unlockLevels = Object.keys(LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
  const firstFuture = unlockLevels.findIndex(l => l > prog.level);

  timeline.innerHTML = `<div class="levels-grid">${unlockLevels.map((lvl, i) => {
    let cls = '';
    if (lvl < prog.level) cls = 'reached';
    else if (lvl === prog.level) cls = 'current';
    else if (i === firstFuture) cls = 'next-up';

    const accId = LEVEL_UNLOCK_IDS[lvl];
    const symbolId = `acc-${accId}`;
    const vb = ACC_VIEWBOXES[symbolId] || '0 0 44 30';
    const funName = ACC_FUN_NAMES[accId] || LEVEL_UNLOCKS[lvl].split(' · ')[0];
    const quip = LEVEL_QUIPS[lvl] || '';
    const xpNeeded = LEVEL_THRESHOLDS[Math.min(lvl - 2, LEVEL_THRESHOLDS.length - 1)] || 100;

    return `<div class="level-card ${cls}">
      <div class="level-card-preview">
        <svg viewBox="${vb}"><use href="#${symbolId}"/></svg>
      </div>
      <div class="level-card-info">
        <div class="level-card-top">
          <span class="level-card-lvl">Lv ${lvl}</span>
          ${cls === 'next-up' ? '<span class="level-card-next-chip">Next</span>' : ''}
        </div>
        <span class="level-card-name">${funName.replace('\n', ' ')}</span>
        ${quip ? `<span class="level-card-quip">${quip}</span>` : ''}
        <div class="level-card-xp">${xpNeeded.toLocaleString()} XP</div>
      </div>
    </div>`;
  }).join('')}</div>`;

  drawer.classList.add('visible');

  // Scroll to current/next
  requestAnimationFrame(() => {
    const highlight = timeline.querySelector('.current');
    if (highlight) highlight.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function closeLevelsDrawer() {
  const drawer = document.getElementById('levels-drawer');
  if (drawer) drawer.classList.remove('visible');
}

async function renderLevelBadge() {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;

  const prog = jesty_data.progression || { level: 1, xp: 0, xp_to_next: 100 };
  const pct = Math.min(1, prog.xp / prog.xp_to_next);

  // Badge number
  const numEl = document.getElementById('level-badge-num');
  if (numEl) numEl.textContent = prog.level;

  // Ring progress
  const ringEl = document.getElementById('level-ring-fill');
  if (ringEl) ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);

  // Panel details
  const titleEl = document.getElementById('level-panel-title');
  const stageEl = document.getElementById('level-panel-stage');
  const fillEl = document.getElementById('level-panel-fill');
  const xpEl = document.getElementById('level-panel-xp');
  if (titleEl) titleEl.textContent = `Level ${prog.level}`;

  const tier = await JestyPremium.getTier();
  const tierName = JestyPremium.getTierDisplayName(tier);
  if (stageEl) stageEl.textContent = tierName;

  if (fillEl) fillEl.style.width = `${pct * 100}%`;
  if (xpEl) xpEl.textContent = `${prog.xp} / ${prog.xp_to_next} XP`;

  // Next unlock
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    const unlockLevels = Object.keys(LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
    const nextUnlock = unlockLevels.find(l => l > prog.level);
    if (nextUnlock) {
      const reward = LEVEL_UNLOCKS[nextUnlock].split(' · ')[0];
      nextEl.innerHTML = `<strong>Level ${nextUnlock}</strong> — ${reward}`;
    } else {
      nextEl.textContent = 'All accessories unlocked!';
    }
  }
}

async function awardXP(amount) {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;

  if (!jesty_data.progression) {
    jesty_data.progression = { level: 1, xp: 0, xp_to_next: 100, total_xp: 0 };
  }

  const prog = jesty_data.progression;
  prog.xp += amount;
  prog.total_xp = (prog.total_xp || 0) + amount;

  // Check level up
  while (prog.xp >= prog.xp_to_next) {
    prog.xp -= prog.xp_to_next;
    prog.level++;
    prog.xp_to_next = LEVEL_THRESHOLDS[Math.min(prog.level - 1, LEVEL_THRESHOLDS.length - 1)];

    // Check for unlock
    if (LEVEL_UNLOCKS[prog.level]) {
      showComment(`Level ${prog.level}! Unlocked: ${LEVEL_UNLOCKS[prog.level]}!`);
    }
  }

  await chrome.storage.local.set({ jesty_data });
  await renderLevelBadge();
}

/* ──────────────────────────────────────────────
   WALL OF SHAME / HALL OF FAME
   ────────────────────────────────────────────── */


/* ──────────────────────────────────────────────
   CALENDAR SCHEDULE (Pro)
   ────────────────────────────────────────────── */

async function initCalendarSchedule() {
  const card = document.getElementById('schedule-card');
  if (!card) return;

  const hasCal = await JestyPremium.checkFeature('calendar');
  if (!hasCal) return;

  try {
    const calAuthed = await JestyCalendar.isAuthenticated();
    if (!calAuthed) return;

    const events = await JestyCalendar.getUpcomingEvents(5);
    card.classList.remove('hidden');

    const eventsContainer = document.getElementById('schedule-events');
    if (!eventsContainer) return;

    if (!events || events.length === 0) {
      eventsContainer.innerHTML = '<p class="schedule-empty">No upcoming events. Lucky you.</p>';
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(e => e.start.startsWith(today));
    const displayEvents = todayEvents.length > 0 ? todayEvents : events.slice(0, 3);

    // Render events immediately (without comments)
    renderScheduleEvents(eventsContainer, displayEvents, null);

    // Generate AI comments in the background
    generateEventComments(displayEvents).then(comments => {
      if (comments) renderScheduleEvents(eventsContainer, displayEvents, comments);
    });
  } catch (e) {
    // Calendar is non-critical, fail silently
  }
}

function renderScheduleEvents(container, events, comments) {
  container.innerHTML = events.map((e, i) => {
    const start = new Date(e.start);
    const now = new Date();
    const diffMin = Math.round((start - now) / 60000);

    let timeStr;
    if (diffMin < 0) timeStr = 'Now';
    else if (diffMin < 60) timeStr = `${diffMin}m`;
    else if (diffMin < 1440) timeStr = `${Math.round(diffMin / 60)}h`;
    else timeStr = 'Tomorrow';

    const comment = comments && comments[i] ? `<p class="schedule-event-comment">${escapeHtml(comments[i])}</p>` : '';

    return `
      <div class="schedule-event">
        <div class="schedule-event-main">
          <span class="schedule-event-time">${timeStr}</span>
          <span class="schedule-event-name">${escapeHtml(e.summary)}</span>
        </div>
        ${comment}
      </div>
    `;
  }).join('');
}

async function generateEventComments(events) {
  try {
    const eventList = events.map((e, i) => {
      const start = new Date(e.start);
      const diffMin = Math.round((start - new Date()) / 60000);
      let timeStr;
      if (diffMin < 0) timeStr = 'happening now';
      else if (diffMin < 60) timeStr = `in ${diffMin} minutes`;
      else timeStr = `in ${Math.round(diffMin / 60)} hours`;
      return `${i + 1}. "${e.summary}" (${timeStr})`;
    }).join('\n');

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Jesty, a sarcastic AI. Give a very short (max 8 words) sarcastic roast or snarky advice for EACH calendar event. One line per event, numbered. No emojis. Be funny.' },
          { role: 'user', content: eventList }
        ],
        max_tokens: 150,
        temperature: 0.9
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    // Parse numbered lines
    const lines = text.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
    return lines;
  } catch {
    return null;
  }
}


/* ──────────────────────────────────────────────
   CHAT - PRESERVED LOGIC
   ────────────────────────────────────────────── */

async function handleLoadRoastIntoChat(signal) {
  // Clear the signal so it doesn't replay
  await chrome.storage.local.remove(['loadRoastIntoChat']);

  if (!signal || !signal.text) return;

  // Start a fresh conversation with this roast
  currentRoast = signal.text;
  conversationHistory = [
    { role: 'system', content: JESTY_PERSONALITY },
    { role: 'assistant', content: signal.text }
  ];

  const conversation = await JestyStorage.startConversation(signal.roastId || null);
  currentConversationId = conversation.id;
  await JestyStorage.addMessage(currentConversationId, 'jesty', signal.text);

  // Add roast as a new Jesty message in the chat (keep existing messages visible)
  const chatContainer = document.getElementById('chat-container');
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.classList.add('hidden');

  addMessage(signal.text, 'jesty');

  // Open the drawer and scroll to the new message
  openDrawer();
  if (chatContainer) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 350);
  }
}

async function loadLastRoast() {
  const result = await chrome.storage.local.get(['lastRoast', 'lastRoastTime', 'lastRoastId']);

  if (result.lastRoast) {
    currentRoast = result.lastRoast;

    const isRecent = result.lastRoastTime && (Date.now() - result.lastRoastTime < 5 * 60 * 1000);

    if (isRecent && conversationHistory.length === 0) {
      const conversation = await JestyStorage.startConversation(result.lastRoastId);
      currentConversationId = conversation.id;

      await JestyStorage.addMessage(currentConversationId, 'jesty', currentRoast);

      document.getElementById('empty-state')?.classList.add('hidden');
      addMessage(currentRoast, 'jesty');

      conversationHistory = [
        { role: 'system', content: JESTY_PERSONALITY },
        { role: 'assistant', content: currentRoast }
      ];
    }
  }
}

async function loadUserAvatar() {
  try {
    if (!chrome.identity || !chrome.identity.getProfileUserInfo) {
      return;
    }

    const userInfo = await new Promise((resolve, reject) => {
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(info);
        }
      });
    });

    if (userInfo && userInfo.email && userInfo.email.length > 0) {
      const username = userInfo.email.split('@')[0];
      const initials = username.charAt(0).toUpperCase();

      const colors = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'];
      const colorIndex = userInfo.email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

      userAvatar = {
        initials: initials,
        color: colors[colorIndex],
        useIcon: false
      };
    }
  } catch (e) {
    // Keep default if identity API fails
  }
}

function addMessage(text, sender) {
  const chatContainer = document.getElementById('chat-container');
  const emptyState = document.getElementById('empty-state');

  if (emptyState) {
    emptyState.classList.add('hidden');
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  if (sender === 'jesty') {
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="-15 -10 150 140" width="27" height="26"><use href="#face-smug"/></svg>
      </div>
      <div class="message-bubble">${escapeHtml(text)}</div>
    `;
  } else {
    const avatarContent = userAvatar.useIcon
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
      : userAvatar.initials;
    messageDiv.innerHTML = `
      <div class="message-avatar user-avatar" style="background-color: ${userAvatar.color}">${avatarContent}</div>
      <div class="message-bubble">${escapeHtml(text)}</div>
    `;
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
  const chatContainer = document.getElementById('chat-container');
  const status = document.getElementById('status');

  const typingDiv = document.createElement('div');
  typingDiv.className = 'message jesty';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="message-avatar">
      <svg viewBox="-15 -10 150 140" width="27" height="26"><use href="#face-thinking"/></svg>
    </div>
    <div class="message-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  status.textContent = 'Typing...';
  status.classList.add('typing');

  // Set thinking expression on the animated character
  JestyAnimator.setExpression('thinking', 0);
}

function hideTypingIndicator() {
  const typing = document.getElementById('typing-indicator');
  const status = document.getElementById('status');

  if (typing) {
    typing.remove();
  }

  status.textContent = 'Ready to argue';
  status.classList.remove('typing');

  // Return to smug expression
  JestyAnimator.setExpression('smug', 0);
}

async function sendMessage() {
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const userMessage = messageInput.value.trim();

  if (!userMessage) return;

  // Auto-open drawer if closed
  if (!drawerOpen) {
    openDrawer();
  }

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Add user message to chat
  addMessage(userMessage, 'user');

  // Save user message to storage
  if (currentConversationId) {
    await JestyStorage.addMessage(currentConversationId, 'user', userMessage);
  }

  // Add to conversation history
  conversationHistory.push({ role: 'user', content: userMessage });

  // If first message and no roast loaded, add system prompt
  if (conversationHistory.length === 1) {
    conversationHistory.unshift({ role: 'system', content: JESTY_PERSONALITY });

    if (!currentConversationId) {
      const conversation = await JestyStorage.startConversation(null);
      currentConversationId = conversation.id;
    }
  }

  // Daily cap check (unified: roasts + chat messages share the same pool)
  const isPremium = await JestyPremium.isPremium();
  if (!isPremium) {
    const capStatus = await JestyStorage.checkDailyCap();
    if (!capStatus.allowed) {
      showChatLock();
      return;
    }
  }

  // Show typing indicator
  showTypingIndicator();

  try {
    // Get current tabs for context
    const tabs = await chrome.tabs.query({});
    const tabList = tabs.slice(0, 15).map(t => `- ${t.title}`).join('\n');

    // Count Jesty's replies so far in this conversation
    const jestyReplyCount = conversationHistory.filter(m => m.role === 'assistant').length;

    // On Jesty's 3rd reply, inject a task instruction based on the tabs
    let taskInstruction = '';
    if (jestyReplyCount === 2) {
      taskInstruction = `\n\n[IMPORTANT: This is your 3rd reply. End your response with a SPECIFIC order for the user — something they must do RIGHT NOW based on their tabs. Be opinionated: tell them to close a specific tab, open something they're avoiding, or call out what they should be doing instead. Frame it as a direct command, not a suggestion. Make it feel like a dare or a challenge.]`;
    }

    // Include user's name if known
    let nameContext = '';
    const userName = await JestyStorage.getUserName();
    if (userName) {
      nameContext = `\n[User's name is ${userName}. Only use it occasionally — most replies should NOT include their name. Drop it once every 5-6 messages at most, so it feels personal when you do.]`;
    }

    const messageWithContext = `[CURRENT OPEN TABS - only reference these, never invent tabs:\n${tabList}]${taskInstruction}${nameContext}\n\nUser says: ${userMessage}`;

    const messagesForAPI = [
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: messageWithContext }
    ];

    const apiKey = CONFIG.OPENAI_API_KEY;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messagesForAPI,
        max_tokens: 150,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    const jestyResponse = data.choices[0].message.content.trim();

    hideTypingIndicator();
    addMessage(jestyResponse, 'jesty');

    // Set a sassy expression briefly after responding
    JestyAnimator.setExpression('smug', 3000);

    if (currentConversationId) {
      await JestyStorage.addMessage(currentConversationId, 'jesty', jestyResponse);
    }

    conversationHistory.push({ role: 'assistant', content: jestyResponse });

    // Increment unified daily cap for chat messages (free users only)
    if (!await JestyPremium.isPremium()) {
      await JestyStorage.incrementDailyRoast();
    }
    updateMsgsLeft();

    // Store roasted domains for action tracking
    const roastedDomains = tabs.slice(0, 15).map(tab => {
      try {
        const url = new URL(tab.url);
        return {
          domain: url.hostname.replace('www.', ''),
          title: tab.title,
          timestamp: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000)
        };
      } catch { return null; }
    }).filter(Boolean);

    await chrome.storage.local.set({
      roastedDomains,
      lastRoastSource: 'chat'
    });

  } catch (error) {
    console.error('Error:', error);
    hideTypingIndicator();
    addMessage("Ugh, my brain glitched. Try again.", 'jesty');
  }
}

/* ──────────────────────────────────────────────
   TIER COMPARISON OVERLAY
   ────────────────────────────────────────────── */

const TIER_DATA = [
  {
    key: 'free',
    name: 'Suspect',
    tagline: 'Under observation',
    price: 'Free',
    priceSub: '',
    features: [
      '12 roasts per day',
      '3 basic accessories',
      'Memory Match (levels 1-5)'
    ],
    cta: null
  },
  {
    key: 'premium',
    name: 'Guilty',
    tagline: 'Full judgement',
    price: '$5',
    priceSub: 'once',
    features: [
      'Unlimited roasts & chat',
      'All games unlocked',
      'Tasks',
      '+5 unlockable accessories'
    ],
    cta: { label: 'Plead Guilty — $5', style: 'primary', action: 'checkout' }
  },
  {
    key: 'pro',
    name: 'Sentenced',
    tagline: 'No escape',
    price: '$5',
    priceSub: '/mo',
    features: [
      'Everything in Guilty',
      'Calendar events with Jesty commentary',
      'Exclusive accessories'
    ],
    cta: { label: 'Get Sentenced — $5/mo', style: 'secondary', action: 'checkout-pro' }
  }
];

/* ── Slot Machine Combos & Colors ── */
const SLOT_COMBOS = [
  { expression: 'smug', hat: null, glasses: null, color: 'lime', tier: 'free' },
  { expression: 'eyeroll', hat: null, glasses: null, color: 'peach', tier: 'free' },
  { expression: 'suspicious', hat: null, glasses: 'acc-monocle', color: 'purple', tier: 'premium' },
  { expression: 'happy', hat: 'acc-crown', glasses: null, color: 'pink', tier: 'premium' },
  { expression: 'smug', hat: 'acc-detective-hat', glasses: null, color: 'sky', tier: 'premium' },
  { expression: 'smug', hat: 'acc-flame-crown', glasses: null, color: 'mint', tier: 'pro' },
  { expression: 'suspicious', hat: null, glasses: 'acc-neon-shades', color: 'purple', tier: 'pro' },
  { expression: 'happy', hat: 'acc-wizard-hat', glasses: null, color: 'sky', tier: 'pro' },
];

const SLOT_COLORS = {
  lime:   { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
  pink:   { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
  sky:    { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' },
  purple: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' },
  mint:   { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
  peach:  { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' },
};

const SLOT_ANCHORS = {
  hat:     { x: 38, y: -2 },
  glasses: { x: 32, y: 42 }
};

const SLOT_VIEWBOXES = {
  'acc-party-hat': '0 0 44 30', 'acc-beanie': '0 0 52 26',
  'acc-sunglasses': '0 0 56 20', 'acc-monocle': '0 0 24 24',
  'acc-crown': '0 0 48 28', 'acc-detective-hat': '0 0 56 28',
  'acc-top-hat': '0 0 44 36', 'acc-halo': '0 0 44 14',
  'acc-flame-crown': '0 0 48 32', 'acc-neon-shades': '0 0 56 20',
  'acc-wizard-hat': '0 0 48 40'
};

const SLOT_ROASTS = {
  free: [
    "Look at you, freeloading. Classic Suspect behavior.",
    "Free tier? Even your browser history is judging you.",
    "Still a Suspect? Your tabs deserve better legal counsel.",
  ],
  premium: [
    "One payment. Unlimited judgement. You know you want it.",
    "$5 to unlock my full roast potential? Cheaper than your coffee habit.",
    "For $5 I'll judge you forever. That's a bargain and you know it.",
  ],
  pro: [
    "The full sentence. No parole. No mercy. No limits.",
    "I'll roast your meetings too. Calendar integration hits different.",
    "Exclusive drip and I haunt your Google Calendar.",
  ],
};

let slotSpinning = false;

function pickWeightedCombo() {
  const r = Math.random();
  let pool;
  if (r < 0.15) pool = SLOT_COMBOS.filter(c => c.tier === 'free');
  else if (r < 0.70) pool = SLOT_COMBOS.filter(c => c.tier === 'premium');
  else pool = SLOT_COMBOS.filter(c => c.tier === 'pro');
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderSlotCombo(svg, combo) {
  const color = SLOT_COLORS[combo.color];

  // Clone face symbol content into the slot SVG directly (avoids touching shared symbols)
  const faceSymbol = document.getElementById(`face-${combo.expression}`);
  if (!faceSymbol) return;

  let content = faceSymbol.innerHTML;
  // Make clipPath IDs unique to the slot
  content = content.replace(/id="clip-([^"]+)"/g, 'id="clip-$1-slot"');
  content = content.replace(/url\(#clip-([^)]+)\)/g, 'url(#clip-$1-slot)');

  // Build accessories markup
  let accsHtml = '';
  if (combo.hat) {
    const a = SLOT_ANCHORS.hat;
    const hatSymbol = document.getElementById(combo.hat);
    if (hatSymbol) {
      accsHtml += `<g transform="translate(${a.x},${a.y})">${hatSymbol.innerHTML}</g>`;
    }
  }
  if (combo.glasses) {
    const a = SLOT_ANCHORS.glasses;
    const glassesSymbol = document.getElementById(combo.glasses);
    if (glassesSymbol) {
      accsHtml += `<g transform="translate(${a.x},${a.y})">${glassesSymbol.innerHTML}</g>`;
    }
  }

  svg.innerHTML = content + accsHtml;

  // Recolor this SVG's elements to the target color (local only)
  if (color) {
    const replacements = {};
    for (const key of ['body', 'limb', 'shadow', 'highlight']) {
      replacements[currentColor[key].toUpperCase()] = color[key];
    }
    svg.querySelectorAll('*').forEach(el => {
      for (const attr of ['fill', 'stroke']) {
        const val = el.getAttribute(attr);
        if (val && replacements[val.toUpperCase()]) {
          el.setAttribute(attr, replacements[val.toUpperCase()]);
        }
      }
    });
  }
}

function startSlotShuffle() {
  if (slotSpinning) return;
  slotSpinning = true;

  const svg = document.querySelector('.slot-character');
  const spinBtn = document.getElementById('slot-spin-btn');
  const result = document.getElementById('slot-result');
  if (!svg || !spinBtn) return;

  // Reset result
  if (result) result.classList.remove('visible');

  // Hide buttons while spinning
  spinBtn.style.display = 'none';
  const plansLink = document.getElementById('slot-plans-link');
  if (plansLink) plansLink.style.display = 'none';

  // Add spinning animation
  svg.classList.remove('landing');
  svg.classList.add('spinning');

  const target = pickWeightedCombo();

  // Phase 1: fast shuffle (0-1.2s) — every 80ms
  // Phase 2: decelerate (1.2-2s) — 120, 200, 350ms
  // Phase 3: land on target

  const phase1Count = 15; // ~1.2s at 80ms each
  const phase2Delays = [120, 200, 350];
  let step = 0;

  function shuffleStep() {
    const randomCombo = SLOT_COMBOS[Math.floor(Math.random() * SLOT_COMBOS.length)];
    renderSlotCombo(svg, randomCombo);
    step++;

    if (step < phase1Count) {
      setTimeout(shuffleStep, 80);
    } else if (step < phase1Count + phase2Delays.length) {
      const delay = phase2Delays[step - phase1Count];
      setTimeout(shuffleStep, delay);
    } else {
      // Land on target
      renderSlotCombo(svg, target);
      svg.classList.remove('spinning');
      svg.classList.add('landing');

      setTimeout(() => {
        revealSlotResult(target.tier);
        spinBtn.style.display = '';
        const pl = document.getElementById('slot-plans-link');
        if (pl) pl.style.display = '';
        slotSpinning = false;
      }, 350);
    }
  }

  setTimeout(shuffleStep, 80);
}

function revealSlotResult(tierKey) {
  const result = document.getElementById('slot-result');
  if (!result) return;

  const tier = TIER_DATA.find(t => t.key === tierKey);
  if (!tier) return;

  // Pick a random roast for this tier
  const roasts = SLOT_ROASTS[tierKey] || SLOT_ROASTS.free;
  const roast = roasts[Math.floor(Math.random() * roasts.length)];

  const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');
  let ctaHtml = '';
  if (tier.cta) {
    ctaHtml = `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}">${tier.cta.label}</button>`;
  }

  result.innerHTML = `
    <h1 class="slot-roast">${roast}</h1>
    <div class="tier-card highlighted">
      <div class="tier-card-header">
        <span class="tier-card-name">${tier.name}</span>
        <span class="tier-card-badge badge-${tier.key}">${tier.tagline}</span>
      </div>
      <div class="tier-card-price">${tier.price} <span>${tier.priceSub}</span></div>
      <ul class="tier-card-features">${featuresHtml}</ul>
      ${ctaHtml}
    </div>
  `;

  const ctaBtn = result.querySelector('.tier-card-cta');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      hideTierOverlay();
      openPremiumCheckout();
    });
  }

  result.classList.add('visible');
}

// One representative combo per tier for the "See all plans" view
const TIER_COMBOS = {
  free:    { expression: 'smug', hat: null, glasses: null, color: 'lime' },
  premium: { expression: 'happy', hat: 'acc-crown', glasses: null, color: 'pink' },
  pro:     { expression: 'smug', hat: 'acc-flame-crown', glasses: null, color: 'mint' },
};

function buildTierCharacterSvg(combo) {
  const color = SLOT_COLORS[combo.color];
  let accsHtml = '';
  if (combo.hat) {
    const a = SLOT_ANCHORS.hat;
    accsHtml += `<use href="#${combo.hat}" x="${a.x}" y="${a.y}"/>`;
  }
  if (combo.glasses) {
    const a = SLOT_ANCHORS.glasses;
    accsHtml += `<use href="#${combo.glasses}" x="${a.x}" y="${a.y}"/>`;
  }

  // We use a CSS filter to tint the character. Since SVG <use> references
  // shared symbols whose fills we can't change per-instance, we apply
  // a background circle in the tier color behind the character as a badge.
  return `
    <div class="tier-card-character">
      <div class="tier-card-character-bg" style="background:${color.body}"></div>
      <svg viewBox="-15 -10 150 140" width="52" height="48">
        <use href="#face-${combo.expression}"/>
        ${accsHtml}
      </svg>
    </div>
  `;
}

async function showAllPlans() {
  const container = document.getElementById('tier-cards');
  if (!container) return;

  const title = document.querySelector('.tier-overlay-title');
  if (title) title.textContent = 'Pick your verdict';

  const currentTier = await JestyPremium.getTier();
  const tierOrder = ['free', 'premium', 'pro'];
  const currentIdx = tierOrder.indexOf(currentTier);
  const nextTier = currentIdx < tierOrder.length - 1 ? tierOrder[currentIdx + 1] : null;

  container.innerHTML = '';

  // Render all 3 tier cards
  for (const tier of TIER_DATA) {
    const combo = TIER_COMBOS[tier.key];
    const card = document.createElement('div');
    card.className = 'tier-card';
    if (tier.key === nextTier) card.classList.add('highlighted');

    const characterHtml = combo ? buildTierCharacterSvg(combo) : '';
    const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');
    let ctaHtml = '';
    if (tier.cta) {
      ctaHtml = `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}">${tier.cta.label}</button>`;
    }

    card.innerHTML = `
      <div class="tier-card-top">
        ${characterHtml}
        <div class="tier-card-top-info">
          <div class="tier-card-header">
            <span class="tier-card-name">${tier.name}</span>
            <span class="tier-card-badge badge-${tier.key}">${tier.tagline}</span>
          </div>
          <div class="tier-card-price">${tier.price} <span>${tier.priceSub}</span></div>
        </div>
      </div>
      <ul class="tier-card-features">${featuresHtml}</ul>
      ${ctaHtml}
    `;

    const ctaBtn = card.querySelector('.tier-card-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        hideTierOverlay();
        openPremiumCheckout();
      });
    }

    container.appendChild(card);
  }
}

function showSlotMachine() {
  const container = document.getElementById('tier-cards');
  if (!container) return;

  const title = document.querySelector('.tier-overlay-title');
  if (title) title.textContent = 'Your verdict';

  container.innerHTML = `
    <div class="slot-stage">
      <svg class="slot-character" viewBox="-15 -10 150 140" width="160" height="150">
        <use href="#face-smug"/>
      </svg>
    </div>
    <div class="slot-result" id="slot-result"></div>
    <button class="slot-plans-link" id="slot-plans-link">See all plans</button>
    <button class="slot-tertiary-btn" id="slot-spin-btn" title="Spin again">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
    </button>
  `;

  slotSpinning = false;

  document.getElementById('slot-spin-btn').addEventListener('click', startSlotShuffle);
  document.getElementById('slot-plans-link').addEventListener('click', showAllPlans);
}

async function showTierOverlay() {
  const overlay = document.getElementById('tier-overlay');
  if (!overlay) return;

  showSlotMachine();
  overlay.classList.remove('hidden');

  // Auto-spin after a brief moment for the overlay animation to land
  setTimeout(() => startSlotShuffle(), 350);
}

async function showTierOverlayPlans() {
  const overlay = document.getElementById('tier-overlay');
  if (!overlay) return;

  await showAllPlans();
  overlay.classList.remove('hidden');
}

function hideTierOverlay() {
  const overlay = document.getElementById('tier-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function initTierOverlay() {
  document.querySelectorAll('.stat-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      showTierOverlayPlans();
    });
  });

  const backdrop = document.getElementById('tier-overlay-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', hideTierOverlay);
  }

  const closeBtn = document.getElementById('tier-overlay-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideTierOverlay);
  }
}

async function unlockChatIfCapReset() {
  const isPremium = await JestyPremium.isPremium();
  if (isPremium) return;

  const cap = await JestyStorage.checkDailyCap();
  if (cap.allowed) {
    // Remove lock message if present
    const lock = document.querySelector('.premium-lock');
    if (lock) lock.remove();

    // Re-enable input
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    if (input) {
      input.disabled = false;
      input.placeholder = 'Talk back to Jesty...';
    }
    if (sendBtn) sendBtn.disabled = !input?.value?.trim();
  }
}

function showChatLock() {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) return;

  const lockDiv = document.createElement('div');
  lockDiv.className = 'premium-lock';
  lockDiv.innerHTML = `
    <div class="empty-character">
      <svg viewBox="-15 -10 150 140" width="58" height="54"><use href="#face-disappointed"/></svg>
    </div>
    <p class="premium-title">I have so much more to say.</p>
    <p class="premium-text">You've used all your daily roasts. Come back tomorrow or plead Guilty for $5 for unlimited.</p>
    <button class="premium-btn" id="chat-premium-btn">Plead Guilty — $5</button>
  `;
  chatContainer.appendChild(lockDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const btn = lockDiv.querySelector('#chat-premium-btn');
  if (btn) {
    btn.addEventListener('click', openPremiumCheckout);
  }

  // Disable input
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
}

async function openPremiumCheckout() {
  // For now, open the proxy checkout endpoint
  // In production, this would call the proxy to create a Stripe session
  try {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    const userId = jesty_data ? jesty_data.profile.user_id : '';
    // TODO: Replace with actual proxy URL when deployed
    chrome.tabs.create({ url: `https://jesty-proxy.your-domain.workers.dev/api/checkout?user_id=${userId}` });
  } catch (e) {
    console.error('Error opening checkout:', e);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ──────────────────────────────────────────────
   TAB CLOSE XP — Micro animation
   ────────────────────────────────────────────── */

async function checkPendingTabCloseXP() {
  try {
    const { pendingXPGain } = await chrome.storage.local.get(['pendingXPGain']);
    if (pendingXPGain) {
      handleTabCloseXP(pendingXPGain);
    }
  } catch (e) {
  }
}

async function handleTabCloseXP(xpGain) {
  await chrome.storage.local.remove(['pendingXPGain']);

  // Award XP
  await awardXP(xpGain.xp);

  // Record action followed for stats
  await JestyStorage.recordActionFollowed(xpGain.domain);

  // Show casino-style XP banner
  showXPToast(xpGain.xp);

  // Flash happy expression briefly
  if (JestyAnimator) JestyAnimator.setExpression('happy', 3000);

  // Refresh stats
  await loadStats();
}

function showXPToast(amount) {
  const win = document.getElementById('xp-win');
  if (!win) return;

  // Set amount
  const amountEl = document.getElementById('xp-win-amount');
  if (amountEl) amountEl.textContent = `+${amount} XP`;

  // Apply XP yellow background (matches levels progress bar)
  const content = win.querySelector('.xp-win-content');
  if (content) content.style.background = '#EAB308';

  // Spawn sparkle particles
  const particleContainer = document.getElementById('xp-win-particles');
  if (particleContainer) {
    particleContainer.innerHTML = '';
    const colors = ['#EAB308', '#FDE047', '#FFFFFF', '#CA8A04', '#18181B'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'xp-win-particle';
      p.style.left = `${10 + Math.random() * 80}%`;
      p.style.top = `${Math.random() * 100}%`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.setProperty('--px', `${(Math.random() - 0.5) * 120}px`);
      p.style.setProperty('--py', `${20 + Math.random() * 60}px`);
      p.style.animationDelay = `${0.1 + Math.random() * 0.4}s`;
      p.style.width = `${4 + Math.random() * 4}px`;
      p.style.height = p.style.width;
      particleContainer.appendChild(p);
    }
  }

  // Show + re-trigger animation
  win.classList.remove('hidden');
  const contentEl = win.querySelector('.xp-win-content');
  if (contentEl) {
    contentEl.style.animation = 'none';
    contentEl.offsetHeight;
    contentEl.style.animation = '';
  }

  // Hide after animation completes
  setTimeout(() => {
    win.classList.add('hidden');
  }, 2800);
}
