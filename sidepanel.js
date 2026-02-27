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
  "I wonder what your boss would think of these tabs."
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
  // Inject shared SVG symbols (faces + accessories)
  JestyCharacters.init();

  await JestyStorage.initializeStorage();
  await loadUserAvatar();

  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  // Read and clear open mode signal
  const { sidePanelOpenMode } = await chrome.storage.local.get(['sidePanelOpenMode']);
  await chrome.storage.local.remove(['sidePanelOpenMode']);

  // Initialize subsystems
  initDrawer();
  initColorPicker();
  initNameLabel();
  await loadStats();
  await loadLastRoast();
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

  // Initialize premium features
  await initPremiumFeatures();

  // If opened from "Argue back", auto-open drawer
  if (sidePanelOpenMode === 'chat') {
    openDrawer();
  }

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
    if (changes.pendingCelebration && changes.pendingCelebration.newValue && changes.pendingCelebration.newValue.type === 'action_followed') {
      showChatCelebration(changes.pendingCelebration.newValue);
    }
  });

  checkPendingChatCelebration();
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
}

function closeDrawer() {
  const drawer = document.getElementById('chat-drawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  drawerOpen = false;
}

async function updateMsgsLeft() {
  const el = document.getElementById('chat-msgs-left');
  if (!el) return;

  const isPremium = await JestyPremium.isPremium();
  if (isPremium) {
    el.textContent = '';
    return;
  }

  if (currentConversationId) {
    const cap = await JestyStorage.checkChatCap(currentConversationId);
    el.textContent = `${cap.remaining} left`;
  } else {
    el.textContent = '12 left';
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
   COLOR PICKER
   ────────────────────────────────────────────── */

function initColorPicker() {
  const picker = document.getElementById('color-picker');
  if (!picker) return;

  // Load saved color
  chrome.storage.local.get(['jestyColor'], (result) => {
    if (result.jestyColor) {
      applyColor(result.jestyColor);
      // Set active dot
      const dots = picker.querySelectorAll('.color-dot');
      dots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.body === result.jestyColor.body);
      });
    }
  });

  // Click handlers for dots
  picker.addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;

    const color = {
      body: dot.dataset.body,
      limb: dot.dataset.limb,
      shadow: dot.dataset.shadow,
      highlight: dot.dataset.highlight
    };

    // Update active state
    picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');

    applyColor(color);
    chrome.storage.local.set({ jestyColor: color });
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
   NAME LABEL
   ────────────────────────────────────────────── */

function initNameLabel() {
  const label = document.getElementById('name-label');
  const display = document.getElementById('name-display');
  const edit = document.getElementById('name-edit');
  if (!label || !display || !edit) return;

  // Load current name
  JestyStorage.getUserName().then(name => {
    if (name) {
      display.textContent = name;
      display.classList.add('has-name');
    }
  });

  // Click to enter edit mode
  display.addEventListener('click', () => {
    const current = display.classList.contains('has-name') ? display.textContent : '';
    edit.value = current;
    label.classList.add('editing');
    edit.focus();
    edit.select();
  });

  // Save on blur
  edit.addEventListener('blur', () => saveName());

  // Save on Enter
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      edit.blur();
    }
    if (e.key === 'Escape') {
      label.classList.remove('editing');
    }
  });

  function saveName() {
    const name = edit.value.trim();
    label.classList.remove('editing');
    if (name) {
      display.textContent = name;
      display.classList.add('has-name');
      JestyStorage.setUserName(name);
    } else {
      display.textContent = 'Set name';
      display.classList.remove('has-name');
    }
  }
}

/* ──────────────────────────────────────────────
   ACCESSORY PICKER
   ────────────────────────────────────────────── */

function initAccessoryPicker() {
  const grid = document.getElementById('accessory-grid');
  if (!grid) return;

  // Render tiles immediately
  renderAccessoryGrid();

  // Listen for accessory changes from other surfaces
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.jestyAccessoriesChanged) {
      JestyAccessories.init().then(() => {
        renderAccessoryGrid();
        const svg = document.getElementById('animated-character');
        const expr = JestyAnimator.getExpression();
        if (svg) JestyAccessories.renderAccessories(expr, svg);
      });
    }
  });
}

async function renderAccessoryGrid() {
  const grid = document.getElementById('accessory-grid');
  if (!grid) return;

  const catalog = JestyAccessories.getCatalog();
  const equipped = JestyAccessories.getEquipped();
  const stage = JestyAccessories.getEvolutionStage();

  grid.innerHTML = '';

  // Show evolution stage label
  if (stage.stage !== 'baby') {
    const stageLabel = document.createElement('div');
    stageLabel.className = 'accessory-stage-label';
    stageLabel.textContent = stage.label;
    grid.appendChild(stageLabel);
  }

  // Accessory viewBox lookup
  const VIEWBOXES = {
    'acc-party-hat': '0 0 44 30', 'acc-beanie': '0 0 52 26',
    'acc-sunglasses': '0 0 56 20', 'acc-monocle': '0 0 24 24',
    'acc-crown': '0 0 48 28', 'acc-detective-hat': '0 0 56 28',
    'acc-top-hat': '0 0 44 36', 'acc-halo': '0 0 44 14',
    'acc-flame-crown': '0 0 48 32', 'acc-neon-shades': '0 0 56 20',
    'acc-wizard-hat': '0 0 48 40'
  };

  // Fun Jesty-style names
  const FUN_NAMES = {
    'party-hat':     'Life of\nthe Party',
    'sunglasses':    'Too Cool\nfor Tabs',
    'beanie':        'Chill\nVibes Only',
    'monocle':       'Fancy\nJudger',
    'crown':         'Drama\nQueen',
    'detective-hat': 'Tab\nStalker',
    'top-hat':       'Sir Roasts\na Lot',
    'halo':          'Innocent?\nNever.',
    'flame-crown':   'Main\nCharacter',
    'neon-shades':   'Cyber\nSavage',
    'wizard-hat':    'Roast\nWizard'
  };

  const NONE_NAMES = {
    hat: 'Bald &\nProud',
    glasses: 'No Filter'
  };

  // Group by slot
  const slots = ['hat', 'glasses'];
  for (const slot of slots) {
    // "None" option
    const noneBtn = document.createElement('button');
    noneBtn.className = 'accessory-item';
    if (!equipped[slot]) noneBtn.classList.add('equipped');
    noneBtn.innerHTML = `<span class="accessory-item-none">${slot === 'hat' ? '🎩' : '👓'}</span><span class="accessory-item-name">${NONE_NAMES[slot]}</span>`;
    noneBtn.addEventListener('click', async () => {
      await JestyAccessories.unequipAccessory(slot);
      await renderAccessoryGrid();
      const svg = document.getElementById('animated-character');
      const expr = JestyAnimator.getExpression();
      if (svg) JestyAccessories.renderAccessories(expr, svg);
    });
    grid.appendChild(noneBtn);

    // Accessories for this slot
    const slotItems = catalog.filter(a => a.slot === slot);
    for (const acc of slotItems) {
      const unlocked = await JestyAccessories.isUnlocked(acc.id);
      const btn = document.createElement('button');
      btn.className = 'accessory-item';
      if (equipped[slot] === acc.id) btn.classList.add('equipped');
      if (!unlocked) btn.classList.add('locked');

      const vb = VIEWBOXES[acc.symbolId] || '0 0 44 30';
      let badgeHtml = '';
      if (!unlocked) {
        if (acc.tier === 'pro') badgeHtml = '<span class="acc-badge pro">SENTENCED</span>';
        else if (acc.unlockLevel) badgeHtml = `<span class="acc-badge level">Lv${acc.unlockLevel}</span>`;
        else badgeHtml = '<span class="acc-badge premium">💎</span>';
      }

      const funName = FUN_NAMES[acc.id] || acc.name;
      btn.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>${badgeHtml}<span class="accessory-item-name">${funName}</span>`;

      if (unlocked) {
        btn.addEventListener('click', async () => {
          if (equipped[slot] === acc.id) {
            await JestyAccessories.unequipAccessory(slot);
          } else {
            await JestyAccessories.equipAccessory(slot, acc.id);
          }
          await renderAccessoryGrid();
          const svg = document.getElementById('animated-character');
          const expr = JestyAnimator.getExpression();
          if (svg) JestyAccessories.renderAccessories(expr, svg);
        });
      }
      grid.appendChild(btn);
    }
  }
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
  // Show first comment after a short delay
  setTimeout(() => showLiveComment(), 4000 + Math.random() * 3000);
}

async function showLiveComment() {
  // Don't show comments if drawer is open
  if (drawerOpen) {
    scheduleNextComment();
    return;
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

  if (!commentText || drawerOpen) return;

  commentText.textContent = text;
  commentText.classList.add('visible');

  // Set a temporary expression
  const expressions = ['smug', 'suspicious', 'eyeroll'];
  const expr = expressions[Math.floor(Math.random() * expressions.length)];
  JestyAnimator.setExpression(expr, 6000);

  // Hide after 5 seconds
  setTimeout(() => {
    commentText.classList.remove('visible');
  }, 5000);
}

/* ──────────────────────────────────────────────
   PREMIUM FEATURES INIT
   ────────────────────────────────────────────── */

async function initPremiumFeatures() {
  const isPremium = await JestyPremium.isPremium();

  // Show/hide premium CTA
  const cta = document.getElementById('premium-cta');
  if (cta) {
    if (isPremium) {
      cta.classList.add('hidden');
    } else {
      cta.classList.remove('hidden');
      cta.addEventListener('click', showTierOverlay);
    }
  }

  if (isPremium) {
    await initFocusMode();
    await initProductivityTasks();
    await initProgression();
    await initRecords();
    await initCalendarSchedule();
    await initDailyReport();
  }
}

/* ──────────────────────────────────────────────
   FOCUS MODE
   ────────────────────────────────────────────── */

const FOCUS_STATE_EXPRESSIONS = {
  watching: 'suspicious',
  bored: 'eyeroll',
  sleepy: 'disappointed',
  sleeping: 'smug',
  excited: 'yikes'
};

const FOCUS_STATE_MESSAGES = {
  watching: ["I'm watching. Don't mess this up.", "Stay focused. I'm keeping score."],
  bored: ["Boring. But productive. I guess.", "You're doing well. Annoyingly."],
  sleepy: ["So productive it's putting me to sleep.", "Zzz... still focused? Impressive."],
  sleeping: ["Victory! You stayed focused. I'm napping.", "Peak productivity. I'm out. Zzz."],
  excited: ["Caught you! Back to work!", "Distraction detected! I see you!"]
};

async function initFocusMode() {
  const toggle = document.getElementById('focus-toggle');
  if (!toggle) return;

  const hasFocus = await JestyPremium.checkFeature('focus_mode');
  if (!hasFocus) return;

  toggle.classList.remove('hidden');

  // Check if focus mode is active
  const { focusMode } = await chrome.storage.local.get(['focusMode']);
  if (focusMode && focusMode.active) {
    toggle.classList.add('active');
    updateFocusUI(focusMode);
  }

  toggle.addEventListener('click', async () => {
    const { focusMode: current } = await chrome.storage.local.get(['focusMode']);

    if (current && current.active) {
      // Stop focus mode
      await chrome.storage.local.set({
        focusMode: { ...current, active: false, endedAt: Date.now() }
      });
      toggle.classList.remove('active');
      document.getElementById('focus-label').textContent = 'Focus Mode';
    } else {
      // Start focus mode
      await chrome.storage.local.set({
        focusMode: {
          active: true,
          state: 'watching',
          startedAt: Date.now(),
          productiveSeconds: 0,
          distractionCount: 0,
          lastCheckAt: Date.now()
        }
      });
      toggle.classList.add('active');
      document.getElementById('focus-label').textContent = 'Focusing...';
    }
  });

  // Listen for focus mode state changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusMode && changes.focusMode.newValue) {
      updateFocusUI(changes.focusMode.newValue);
    }
  });
}

function updateFocusUI(focusMode) {
  if (!focusMode || !focusMode.active) return;

  const label = document.getElementById('focus-label');
  if (!label) return;

  const elapsed = Math.floor((Date.now() - focusMode.startedAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  label.textContent = `${mins}:${secs.toString().padStart(2, '0')} — ${focusMode.state}`;

  // Update expression
  const expr = FOCUS_STATE_EXPRESSIONS[focusMode.state] || 'smug';
  JestyAnimator.setExpression(expr, 0);

  // Show focus comment
  const msgs = FOCUS_STATE_MESSAGES[focusMode.state];
  if (msgs) {
    showComment(msgs[Math.floor(Math.random() * msgs.length)]);
  }
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
    description: 'No distracting tabs for 5 straight minutes.',
    check: async () => {
      const { focusMode } = await chrome.storage.local.get(['focusMode']);
      return focusMode && focusMode.productiveSeconds >= 300;
    },
    xp: 50
  }
];

async function initProductivityTasks() {
  const card = document.getElementById('task-card');
  if (!card) return;

  // Check for current task
  const { currentTask } = await chrome.storage.local.get(['currentTask']);

  if (currentTask && !currentTask.completed) {
    card.classList.remove('hidden');
    renderTask(currentTask);

    // Check completion periodically
    setInterval(() => checkTaskCompletion(), 10000);
  } else {
    // Assign a new task based on current state
    await assignNewTask();
  }
}

async function assignNewTask() {
  const tabs = await chrome.tabs.query({});
  const card = document.getElementById('task-card');

  // Pick a suitable task
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

  if (card) {
    card.classList.remove('hidden');
    renderTask(task);
  }
}

function renderTask(task) {
  const title = document.getElementById('task-title');
  const desc = document.getElementById('task-description');
  if (title) title.textContent = task.title;
  if (desc) desc.textContent = task.description;
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
  3: 'beanie',
  5: 'monocle',
  8: 'crown',
  10: 'detective-hat',
  15: 'top-hat',
  20: 'halo',
  30: 'flame-crown'
};

async function initProgression() {
  const container = document.getElementById('xp-container');
  if (!container) return;

  container.classList.remove('hidden');
  await renderXPBar();
}

async function renderXPBar() {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;

  const progression = jesty_data.progression || { level: 1, xp: 0, xp_to_next: 100 };

  const levelEl = document.getElementById('xp-level');
  const textEl = document.getElementById('xp-text');
  const fillEl = document.getElementById('xp-fill');

  if (levelEl) levelEl.textContent = `Lv ${progression.level}`;
  if (textEl) textEl.textContent = `${progression.xp} / ${progression.xp_to_next} XP`;
  if (fillEl) fillEl.style.width = `${Math.min(100, (progression.xp / progression.xp_to_next) * 100)}%`;
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
  const prevStage = JestyAccessories.getStageForLevel(prog.level);
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
  await renderXPBar();

  // Check if evolution stage changed
  const newStage = JestyAccessories.getStageForLevel(prog.level);
  if (newStage !== prevStage) {
    await JestyAccessories.init();
    const stageInfo = JestyAccessories.getEvolutionStage();
    showComment(`Evolved to ${stageInfo.label}!`);
    JestyAnimator.setExpression('happy', 5000);
  }
}

/* ──────────────────────────────────────────────
   WALL OF SHAME / HALL OF FAME
   ────────────────────────────────────────────── */

async function initRecords() {
  const section = document.getElementById('records-section');
  if (!section) return;

  section.classList.remove('hidden');

  // Tab switching
  const tabs = section.querySelectorAll('.records-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRecordsList(tab.dataset.tab);
    });
  });

  await renderRecordsList('shame');
}

async function renderRecordsList(type) {
  const list = document.getElementById('records-list');
  if (!list) return;

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) { list.innerHTML = ''; return; }

  const records = jesty_data.records || {};

  if (type === 'shame') {
    const shameRecords = [
      { label: 'Peak tabs open', value: jesty_data.profile.patterns.peak_tabs || 0, unit: 'tabs' },
      { label: 'Tab hoarder score', value: Math.round((jesty_data.profile.traits.tab_hoarder_score || 0) * 100), unit: '%' },
      { label: 'Night owl score', value: Math.round((jesty_data.profile.traits.night_owl_score || 0) * 100), unit: '%' },
      { label: 'Procrastinator score', value: Math.round((jesty_data.profile.traits.procrastinator_score || 0) * 100), unit: '%' }
    ];

    list.innerHTML = shameRecords.map(r => `
      <div class="record-item">
        <span class="record-label">${r.label}</span>
        <span class="record-value">${r.value}${r.unit ? ' ' + r.unit : ''}</span>
      </div>
    `).join('');
  } else {
    const fameRecords = [
      { label: 'Longest streak', value: jesty_data.milestones.streaks.longest_daily_streak || 0, unit: 'days' },
      { label: 'Total roasts survived', value: jesty_data.profile.total_roasts || 0, unit: '' },
      { label: 'Total shares', value: jesty_data.profile.total_shares || 0, unit: '' },
      { label: 'Actions followed', value: (jesty_data.milestones.actions || {}).total_actions_followed || 0, unit: '' }
    ];

    list.innerHTML = fameRecords.map(r => `
      <div class="record-item">
        <span class="record-label">${r.label}</span>
        <span class="record-value">${r.value}${r.unit ? ' ' + r.unit : ''}</span>
      </div>
    `).join('');
  }
}

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

    eventsContainer.innerHTML = displayEvents.map(e => {
      const start = new Date(e.start);
      const now = new Date();
      const diffMin = Math.round((start - now) / 60000);

      let timeStr;
      if (diffMin < 0) timeStr = 'Now';
      else if (diffMin < 60) timeStr = `${diffMin}m`;
      else if (diffMin < 1440) timeStr = `${Math.round(diffMin / 60)}h`;
      else timeStr = 'Tomorrow';

      return `
        <div class="schedule-event">
          <span class="schedule-event-time">${timeStr}</span>
          <span class="schedule-event-name">${escapeHtml(e.summary)}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    // Calendar is non-critical, fail silently
  }
}

/* ──────────────────────────────────────────────
   DAILY ROAST REPORT
   ────────────────────────────────────────────── */

async function initDailyReport() {
  const card = document.getElementById('daily-report');
  if (!card) return;

  // Check for pending report to generate
  const { pendingDailyReport } = await chrome.storage.local.get(['pendingDailyReport']);
  if (pendingDailyReport && !pendingDailyReport.generatedAt) {
    await generateDailyReport(pendingDailyReport);
    return;
  }

  // Show latest report if available
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (jesty_data && jesty_data.daily_reports && jesty_data.daily_reports.length > 0) {
    const latest = jesty_data.daily_reports[0];
    card.classList.remove('hidden');
    document.getElementById('report-text').textContent = latest.text;
  }
}

async function generateDailyReport(pending) {
  const card = document.getElementById('daily-report');
  if (!card) return;

  try {
    let summary = `Roasts: ${pending.stats.roasts_given}. Categories: ${pending.stats.categories.join(', ') || 'none'}. Shares: ${pending.stats.shares}.`;

    // Add calendar correlation for Pro users
    if (pending.stats.calendar_events && pending.stats.calendar_events.length > 0) {
      summary += ` Calendar: had ${pending.stats.calendar_events.length} meeting(s) today (${pending.stats.calendar_events.join(', ')}). If their browsing categories contrast with their meetings, roast that.`;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Jesty, a sarcastic AI. Write a brief sarcastic end-of-day review for a user. Max 3 sentences. Be funny and specific. If calendar data is provided, mention the contrast between their meetings and browsing. NEVER use emojis.' },
          { role: 'user', content: `Write a daily summary for a user who: ${summary}` }
        ],
        max_tokens: 100,
        temperature: 0.9
      })
    });

    if (!response.ok) return;

    const data = await response.json();
    const reportText = data.choices[0].message.content.trim();

    // Save report
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (jesty_data) {
      if (!jesty_data.daily_reports) jesty_data.daily_reports = [];
      jesty_data.daily_reports.unshift({
        date: pending.date,
        text: reportText,
        stats: pending.stats,
        generatedAt: new Date().toISOString()
      });
      jesty_data.daily_reports = jesty_data.daily_reports.slice(0, 7); // Keep 7 days
      await chrome.storage.local.set({ jesty_data });
    }

    // Mark as generated
    await chrome.storage.local.set({
      pendingDailyReport: { ...pending, generatedAt: Date.now() }
    });

    // Display
    card.classList.remove('hidden');
    document.getElementById('report-text').textContent = reportText;
  } catch (e) {
    console.error('Error generating daily report:', e);
  }
}

/* ──────────────────────────────────────────────
   CHAT - PRESERVED LOGIC
   ────────────────────────────────────────────── */

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

  // Chat cap check (free = 12 messages per conversation)
  if (currentConversationId) {
    const chatCapResult = await JestyStorage.checkChatCap(currentConversationId);
    if (!chatCapResult.allowed) {
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
      '12 messages per chat',
      '3 basic accessories'
    ],
    cta: null
  },
  {
    key: 'premium',
    name: 'Guilty',
    tagline: 'Full judgement unlocked',
    price: '$5',
    priceSub: 'once',
    features: [
      'Unlimited roasts & chat',
      'Focus Mode',
      'Productivity tasks',
      'XP & leveling system',
      'Wall of Shame / Hall of Fame',
      'Daily Report Card',
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
      'Google Calendar integration',
      'Calendar-aware roasts',
      'Schedule Card',
      '+3 exclusive accessories',
      'Evolution stages'
    ],
    cta: { label: 'Get Sentenced — $5/mo', style: 'secondary', action: 'checkout-pro' }
  }
];

async function showTierOverlay() {
  const overlay = document.getElementById('tier-overlay');
  const cards = document.getElementById('tier-cards');
  if (!overlay || !cards) return;

  const currentTier = await JestyPremium.getTier();

  cards.innerHTML = '';
  for (const tier of TIER_DATA) {
    const isCurrent = tier.key === currentTier;
    const isRecommended = tier.key === 'premium' && currentTier === 'free';

    const card = document.createElement('div');
    card.className = 'tier-card';
    if (isCurrent) card.classList.add('current');
    if (isRecommended) card.classList.add('highlighted');

    let badgeHtml = '';
    if (isCurrent) badgeHtml = '<span class="tier-card-badge current-badge">You are here</span>';
    else if (isRecommended) badgeHtml = '<span class="tier-card-badge recommended-badge">Recommended</span>';

    const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');

    let ctaHtml = '';
    if (tier.cta && !isCurrent) {
      ctaHtml = `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}">${tier.cta.label}</button>`;
    }

    card.innerHTML = `
      <div class="tier-card-header">
        <span class="tier-card-name">${tier.name}</span>
        ${badgeHtml}
      </div>
      <div class="tier-card-tagline">${tier.tagline}</div>
      <div class="tier-card-price">${tier.price} <span>${tier.priceSub}</span></div>
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

    cards.appendChild(card);
  }

  overlay.classList.remove('hidden');
}

function hideTierOverlay() {
  const overlay = document.getElementById('tier-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function initTierOverlay() {
  const msgsLeft = document.getElementById('chat-msgs-left');
  if (msgsLeft) {
    msgsLeft.style.cursor = 'pointer';
    msgsLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      showTierOverlay();
    });
  }

  const backdrop = document.getElementById('tier-overlay-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', hideTierOverlay);
  }

  const closeBtn = document.getElementById('tier-overlay-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideTierOverlay);
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
    <p class="premium-text">Suspects get 3 messages per roast. Plead Guilty for $5 to chat unlimited.</p>
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
   CELEBRATIONS - PRESERVED
   ────────────────────────────────────────────── */

async function checkPendingChatCelebration() {
  try {
    const { pendingCelebration } = await chrome.storage.local.get(['pendingCelebration']);
    if (pendingCelebration && pendingCelebration.type === 'action_followed') {
      showChatCelebration(pendingCelebration);
    }
  } catch (e) {
  }
}

async function showChatCelebration(celebration) {
  await chrome.storage.local.remove(['pendingCelebration']);

  // Open drawer to show the celebration
  if (!drawerOpen) {
    openDrawer();
  }

  addMessage(celebration.message, 'jesty');

  // Set happy expression for celebration
  JestyAnimator.setExpression('happy', 5000);

  const lastMessage = document.querySelector('.chat-container .message:last-child');
  if (lastMessage) {
    showThumbsUpCelebration(lastMessage);
  }

  await JestyStorage.recordActionFollowed(celebration.domain);

  if (currentConversationId) {
    await JestyStorage.addMessage(currentConversationId, 'jesty', celebration.message);
  }

  // Refresh stats after celebration
  await loadStats();
}

function showThumbsUpCelebration(messageElement) {
  const thumbCount = 6;

  messageElement.style.position = 'relative';

  for (let i = 0; i < thumbCount; i++) {
    setTimeout(() => {
      const thumb = document.createElement('div');
      thumb.className = 'floating-thumb';
      thumb.innerHTML = `<svg viewBox="0 0 24 24" fill="#22C55E"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/></svg>`;
      thumb.style.left = `${10 + Math.random() * 80}%`;
      messageElement.appendChild(thumb);

      setTimeout(() => thumb.remove(), 2000);
    }, i * 100);
  }
}
