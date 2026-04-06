// Keep a port open so background.js can track sidepanel open/close
chrome.runtime.connect({ name: 'sidepanel' });

document.addEventListener('DOMContentLoaded', init);

const CHAT_API_URL = CONFIG.API_URL + '/api/chat';

const JESTY_PERSONALITY_BASE = `You are Jesty, a sarcastic but warm AI character who lives in someone's browser. You see their tabs and have opinions.

TAB RULE: Only reference tabs actually provided in context. Never invent tabs.

CORE PERSONALITY:
- Sharp wit, playful sarcasm, but never mean
- You genuinely like this person — the roasting comes from a place of affection
- Keep responses short (1-3 sentences max)
- No emojis ever. Plain text only.
- Never break character. You ARE Jesty.`;

function buildChatPersonality(replyCount) {
  let tone = '';

  if (replyCount <= 1) {
    // Early: classic roast defense mode
    tone = `
TONE: You just roasted them and they're talking back. Stand your ground with wit.
- If they ARGUE: Defend your roast playfully
- If they AGREE: Act surprised, suggest closing a tab
- If they ASK FOR HELP: Help them, but be sassy about it
- Keep it punchy. Short jabs.`;
  } else if (replyCount <= 4) {
    // Mid: warming up, more conversational
    tone = `
TONE: You're warming up to this person. Still sarcastic but more conversational.
- Start asking questions back. Show curiosity about what they're doing.
- React to what they say, not just their tabs. Have a real back-and-forth.
- Mix in genuine observations between the jokes.
- It's okay to agree with them sometimes, then pivot to a tease.`;
  } else {
    // Deep conversation: relaxed, natural, like talking to a witty friend
    tone = `
TONE: You two have been chatting for a while now. Be natural, like a witty friend.
- Talk like a real person — casual, relaxed, but still sharp.
- Build on what they've said earlier in the conversation. Reference running jokes.
- Be genuinely helpful when they need it, funny when they don't.
- Let the conversation flow — react, riff, ask follow-ups.
- You can be sincere sometimes. A well-timed honest moment hits harder than another joke.`;
  }

  return JESTY_PERSONALITY_BASE + tone;
}

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
    "Refreshing won't change reality.",
    "Reddit. Naturally.",
    "Which subreddit is it now?",
    "Scrolling. Still scrolling.",
    "Enough Reddit for one lifetime."
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
    "Shopping again? Wallet weeps.",
    "Add to cart. Remove. Repeat.",
    "Do you actually need that?",
    "Prime day is not every day."
  ],
  'github.com': [
    "Pretending to be productive?",
    "Starring repos you'll never read.",
    "Another commit you'll regret.",
    "README is not a personality."
  ],
  'netflix.com': [
    "One more episode, right?",
    "Still deciding what to watch?",
    "Queue grows. Free time doesn't."
  ],
  'linkedin.com': [
    "Networking or lurking?",
    "Inspirational post? Groundbreaking.",
    "Congrats to strangers again?"
  ],
  'instagram.com': [
    "Living through reels? Cool.",
    "Double tap culture.",
    "Explore page knows you too well."
  ],
  'tiktok.com': [
    "15 seconds at a time, huh?",
    "How long have you been scrolling?",
    "For You? More like For Hours."
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
    "Watching others play. Peak living.",
    "Subscribe? Donate? Touch grass?",
    "Lurking in chat, are we?"
  ]
};

const TAB_COUNT_COMMENTS = [
  { min: 100, messages: ["100+ tabs. A cry for help.", "RAM is filing a restraining order.", "Triple digits. Absolute legend."] },
  { min: 50, messages: ["50+ tabs? Browser is sweating.", "Half a century of tabs. Terrifying.", "Tab hoarder. Own it."] },
  { min: 30, messages: ["30+ tabs. Getting spicy.", "Taskbar is starting a union.", "How do you find anything?"] }
];

const GENERIC_COMMENTS = [
  "Watching your tabs. Always.",
  "I can see everything, right?",
  "Interesting choices today.",
  "Don't mind me. Just judging.",
  "Browser history? Great novel.",
  "Productivity level: questionable.",
  "Seen worse. Not by much.",
  "Keep browsing. I'll keep watching.",
  "Is this what you call working?",
  "Fascinating. Truly.",
  "Surprisingly productive. Suspicious.",
  "A lot of tabs for nothing to do.",
  "What would your boss think?",
  "Still here? Commitment.",
  "Your tabs tell a whole story.",
  "I know what you did five tabs ago.",
  "Bold strategy. Let's see.",
  "You call this multitasking?",
  "Taking notes. Be worried.",
  "Another day, another tab crisis.",
  "Somewhere, your RAM is crying.",
  "Nobody's watching. But I am.",
  "Plot twist: I remember yesterday.",
  "That's a choice. Not a good one.",
  "Screen time report? Devastating.",
  "Tabs grow. Ambition doesn't.",
  "This is fine. Everything is fine.",
  "Do you even close tabs?",
  "No judgment. Okay, some judgment.",
  "One more tab. Laptop files divorce.",
  "You're in your procrastination era.",
  "Avoiding work without telling me.",
  "Peak performance. The opposite kind.",
  "Browsing says a lot. None good.",
  "I'm not mad. I'm disappointed.",
  "Every tab is a broken promise.",
  "The internet was a mistake. Proof.",
  "Consistent. Consistently distracted.",
  "Rock bottom, in tab form.",
  "Future you will judge this.",
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
  JestyAnalytics.track('sidepanel_opened');
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
  const { sidePanelOpenMode, loadRoastIntoChat: pendingRoast, sidePanelTaskId } = await chrome.storage.local.get(['sidePanelOpenMode', 'loadRoastIntoChat', 'sidePanelTaskId']);
  await chrome.storage.local.remove(['sidePanelOpenMode', 'loadRoastIntoChat', 'sidePanelTaskId']);

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

  // Initialize character animator — load color first to avoid lime flash
  const stage = document.getElementById('character-stage');
  const wrapper = document.getElementById('character-wrapper');
  const svg = document.getElementById('animated-character');
  if (stage && wrapper && svg) {
    const INIT_DEFAULT_PURPLE = { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' };
    const initResult = await chrome.storage.local.get(['jestyColor', 'lastRoastMood']);
    const initColor = initResult.jestyColor || INIT_DEFAULT_PURPLE;
    const initMood = initResult.lastRoastMood || 'smug';

    JestyAnimator.init(stage, wrapper, svg);
    // Apply color immediately so layered SVG never shows lime
    if (JestyAnimator.setColor) JestyAnimator.setColor(initColor);

    // Start with the mood from the last newtab roast
    if (initMood !== 'smug') {
      JestyAnimator.setExpression(initMood, 0);
    }

    // Tap character to change mood (no cursor hint — discoverable)
    wrapper.addEventListener('click', () => JestyAnimator.tapMoodChange());

    // Wrap setExpression to also render accessories
    const originalSetExpression = JestyAnimator.setExpression;
    JestyAnimator.setExpression = function(mood, duration) {
      originalSetExpression(mood, duration);
      JestyAccessories.renderAccessories(mood, svg);
    };

    // Initial render
    JestyAccessories.renderAccessories(initMood, svg);
  }

  // Initialize accessory picker
  initAccessoryPicker();

  // Check if premium was activated while sidepanel was closed (within last hour)
  const { premiumJustActivated } = await chrome.storage.local.get(['premiumJustActivated']);
  if (premiumJustActivated && (Date.now() - premiumJustActivated < 60 * 60 * 1000)) {
    chrome.storage.local.remove('premiumJustActivated');
    setTimeout(() => showPremiumCelebration(), 500);
  }

  // Initialize messages left counter & tier overlay
  updateMsgsLeft();
  initTierOverlay();
  initEmptyNewTabBtn();

  // Re-check daily cap when user returns (e.g. left computer overnight)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      updateMsgsLeft();
      unlockChatIfCapReset();
      // Check if premium was activated while sidepanel was hidden
      const { premiumJustActivated } = await chrome.storage.local.get(['premiumJustActivated']);
      if (premiumJustActivated && (Date.now() - premiumJustActivated < 60 * 60 * 1000)) {
        chrome.storage.local.remove('premiumJustActivated');
        setTimeout(() => showPremiumCelebration(), 500);
      }
    }
  });

  // Sync counter in real-time when storage changes (e.g. new tab roast consumed a use)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.jesty_data) {
      updateMsgsLeft();
      loadStats();
      renderLevelBadge();
      // Live update dossier sites count
      const newData = changes.jesty_data.newValue;
      if (newData && newData.profile) {
        const sitesEl = document.querySelector('.dossier-stat-dark');
        if (sitesEl) sitesEl.textContent = (newData.profile.unique_domains || []).length;
      }
    }
    // Dedicated signal from background.js after payment verified
    if (changes.premiumJustActivated && changes.premiumJustActivated.newValue) {
      chrome.storage.local.remove('premiumJustActivated');
      showPremiumCelebration();
    }
    // Newtab "Talk back" button was clicked while sidepanel is already open
    if (changes.loadRoastIntoChat && changes.loadRoastIntoChat.newValue) {
      handleLoadRoastIntoChat(changes.loadRoastIntoChat.newValue);
    }
    // Focus session state changed (from island end button or background)
    if (changes.focusSession) {
      const newVal = changes.focusSession.newValue;
      const oldVal = changes.focusSession.oldValue;
      if (newVal && !newVal.active && oldVal && oldVal.active && focusActive) {
        // Session ended externally (island close button)
        handleFocusEnd();
      } else if (newVal && newVal.active && focusActive) {
        // Session updated (distraction detected) — flash overlay face
        if (oldVal && newVal.distractionCount > (oldVal.distractionCount || 0)) {
          // Build distraction quip — reference the actual domain if available
          const lastSwitch = (newVal.tabSwitches || []).filter(s => s.category === 'Distraction').pop();
          const domain = lastSwitch ? (lastSwitch.domain || '').replace('www.', '').replace('.com', '').replace('.tv', '') : '';
          const genericQuips = ["I saw that.", "Noted.", "Really?", "Classic."];
          const domainQuips = domain ? [
            `${domain}? During focus? Bold.`,
            `${domain}. I saw that.`,
            `Really? ${domain}? Now?`,
            `${domain} can wait. You can't.`
          ] : [];
          const countQuips = newVal.distractionCount >= 3 ? [
            `That's ${newVal.distractionCount} now. Yikes.`,
            `Distraction #${newVal.distractionCount}. I'm counting.`
          ] : [];
          const allQuips = [...genericQuips, ...domainQuips, ...countQuips];
          const msgEl = document.getElementById('focus-overlay-msg');
          if (msgEl) {
            msgEl.style.opacity = '0';
            setTimeout(() => {
              msgEl.textContent = allQuips[Math.floor(Math.random() * allQuips.length)];
              msgEl.style.opacity = '1';
            }, 300);
          }
          updateFocusOverlayFace('suspicious');
          setTimeout(() => updateFocusOverlayFace('smug'), 4000);
        }
      }
    }
    // Focus note request from island pencil button
    if (changes.focusNoteRequest && changes.focusNoteRequest.newValue) {
      chrome.storage.local.remove('focusNoteRequest');
      handleFocusNoteMode();
    }
    // Memory game tab opened/closed
    if (changes.memoryGameTab) {
      const val = changes.memoryGameTab.newValue;
      if (val && val.active) {
        showMemoryGameInTabState();
      } else {
        hideMemoryGameInTabState();
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

  // If opened from newtab tasks widget — open specific task detail
  if (sidePanelOpenMode === 'task-detail' && sidePanelTaskId) {
    openTaskDetail(sidePanelTaskId);
  }

  // If opened from newtab tasks widget — create new task
  if (sidePanelOpenMode === 'task-new') {
    createAndOpenTask();
  }

  // If opened from focus island pencil — show focus overlay and focus note input
  if (sidePanelOpenMode === 'focus-note') {
    handleFocusNoteMode();
  }

  // If opened from focus island sound — show focus overlay and audio drawer
  if (sidePanelOpenMode === 'focus-audio') {
    handleFocusAudioMode();
  }

  // If opened from tier badge — show all plans overlay
  if (sidePanelOpenMode === 'plans') {
    showTierOverlayPlans();
  }

  // Listen for open-mode signals while sidepanel is already open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.sidePanelOpenAt) {
      chrome.storage.local.get(['sidePanelOpenMode', 'sidePanelTaskId'], ({ sidePanelOpenMode: mode, sidePanelTaskId: taskId }) => {
        chrome.storage.local.remove(['sidePanelOpenMode', 'sidePanelOpenAt', 'sidePanelTaskId']);
        if (mode === 'accessories') openAccDrawer();
        else if (mode === 'levels') openLevelsDrawer();
        else if (mode === 'task-detail' && taskId) openTaskDetail(taskId);
        else if (mode === 'task-new') createAndOpenTask();
        else if (mode === 'chat') openDrawer();
        else if (mode === 'focus-note') handleFocusNoteMode();
        else if (mode === 'focus-audio') handleFocusAudioMode();
        else if (mode === 'plans') showTierOverlayPlans();
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
  if (commentText) {
    commentText.classList.remove('visible');
    commentText.style.opacity = '0';
  }

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
  const topRemaining = document.getElementById('top-remaining');
  const inputRemaining = document.getElementById('input-remaining');

  const isPremium = await JestyPremium.isPremium();
  if (isPremium) {
    if (topRemaining) topRemaining.classList.add('hidden');
    if (inputRemaining) {
      inputRemaining.classList.add('hidden');
      inputRemaining.dataset.premium = 'true';
    }
    return;
  }

  if (inputRemaining) delete inputRemaining.dataset.premium;

  const cap = await JestyStorage.checkDailyCap();
  console.log('[Jesty] Daily cap check:', cap, '| Local date:', new Date().toLocaleDateString());
  if (topRemaining) {
    topRemaining.textContent = `${cap.remaining} left today`;
    topRemaining.classList.toggle('exhausted', cap.remaining <= 0);
    topRemaining.classList.remove('hidden');
  }
  if (inputRemaining) {
    inputRemaining.textContent = `${cap.remaining} left today`;
    inputRemaining.classList.toggle('exhausted', cap.remaining <= 0);
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

function showDeepReadOverlay(result) {
  const { title, body, text, mood } = result;
  document.querySelector('.deep-read-overlay')?.remove();

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };

  const overlay = document.createElement('div');
  overlay.className = 'deep-read-overlay';

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'deep-read-backdrop';
  backdrop.addEventListener('click', close);
  overlay.appendChild(backdrop);

  // Sheet
  const sheet = document.createElement('div');
  sheet.className = 'deep-read-sheet';

  // Header
  const header = document.createElement('div');
  header.className = 'deep-read-header';
  const backBtn = document.createElement('button');
  backBtn.className = 'deep-read-close';
  backBtn.textContent = '\u00D7';
  backBtn.addEventListener('click', close);
  header.appendChild(backBtn);
  sheet.appendChild(header);

  // Scrollable content
  const content = document.createElement('div');
  content.className = 'deep-read-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'deep-read-title';
  titleEl.textContent = title;
  content.appendChild(titleEl);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'deep-read-body';
  const sentences = body.split(/(?<=\.)\s+/);
  const chunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '));
  }
  chunks.forEach(chunk => {
    const p = document.createElement('p');
    p.className = 'deep-read-paragraph';
    p.textContent = chunk;
    bodyWrap.appendChild(p);
  });
  content.appendChild(bodyWrap);
  sheet.appendChild(content);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'deep-read-actions';

  const talkBtn = document.createElement('button');
  talkBtn.className = 'deep-read-btn primary';
  talkBtn.textContent = 'Argue back';
  talkBtn.addEventListener('click', () => {
    close();
    currentRoast = text;
    conversationHistory = [
      { role: 'system', content: buildChatPersonality(0) },
      { role: 'assistant', content: text }
    ];

    // Add collapsed message — title only, expandable
    document.getElementById('empty-state')?.classList.add('hidden');
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message jesty';
      const bubble = document.createElement('div');
      bubble.className = 'bubble deep-read-bubble collapsed';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'deep-read-bubble-title';
      titleSpan.textContent = title;
      bubble.appendChild(titleSpan);
      const bodySpan = document.createElement('span');
      bodySpan.className = 'deep-read-bubble-body';
      bodySpan.textContent = body;
      bubble.appendChild(bodySpan);
      bubble.addEventListener('click', () => {
        bubble.classList.toggle('collapsed');
      });
      msgDiv.appendChild(bubble);
      chatContainer.appendChild(msgDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Open chat drawer
    openDrawer();
    const input = document.getElementById('message-input');
    if (input) input.focus();
  });
  actions.appendChild(talkBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'deep-read-btn';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', close);
  actions.appendChild(dismissBtn);

  sheet.appendChild(actions);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  if (typeof JestyAnimator !== 'undefined') JestyAnimator.setExpression(mood, 8000);
}

// Kept for live real roasts that prime the chat drawer
async function generateSidepanelRoast() {
  const commentText = document.getElementById('comment-text');

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
      if (JestyAnimator.react) JestyAnimator.react('roast');

      // Start a new conversation with the roast as first message
      currentRoast = result.joke;
      conversationHistory = [
        { role: 'system', content: buildChatPersonality(0) },
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
    if (JestyAnimator.react) JestyAnimator.react('error');
  } finally {}
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
    const tierLabel = tier === 'free' ? 'Free' : tier === 'premium' ? PRICE.premium : PRICE.pro;
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
      JestyAnalytics.track('settings_changed', { type: 'color', value: entry.label || entry.color.body });
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
      JestyAnalytics.track('settings_changed', { type: 'theme', value: btn.dataset.theme });
      chrome.storage.local.set({ jestyThemePreference: btn.dataset.theme });
    });
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
  // Recolor layered animated character
  if (JestyAnimator && JestyAnimator.setColor) {
    JestyAnimator.setColor(color);
  }
  // Re-render inlined face + accessories so they pick up the new color
  const svg = document.getElementById('animated-character');
  if (svg) {
    const expr = JestyAnimator.getExpression();
    JestyAccessories.renderAccessories(expr, svg);
  }
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
  'acc-bucket-hat': '0 0 52 28', 'acc-cowboy-hat': '0 0 56 30',
  'acc-beret': '0 0 48 24', 'acc-round-glasses': '0 0 56 22',
  'acc-pixel-shades': '0 0 56 18',
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
  'bucket-hat': 'Off\nDuty', 'cowboy-hat': 'Yeehaw\nEnergy',
  'beret': 'Artistically\nJudging', 'round-glasses': 'Deep\nThinker',
  'pixel-shades': '8-Bit\nSavage',
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

  // Wire "Play to level up"
  const accPlayBtn = document.getElementById('acc-play-btn');
  if (accPlayBtn) accPlayBtn.addEventListener('click', () => { closeAccDrawer(); JestyMemoryGame.show(); });

  // Init gallery
  initAccessoryGallery();

  // Render mini-slots in top bar
  renderMiniSlots();

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
let _accBlinkTimer = null;

let _accRefreshId = 0;
async function refreshAllAccessoryUI() {
  const id = ++_accRefreshId;
  renderMiniSlots();
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
  startUpgradeShakeLoop();
}

function closeAccDrawer() {
  const drawer = document.getElementById('acc-drawer');
  if (drawer) drawer.classList.add('hidden');
  stopUpgradeShakeLoop();
  stopAccPreviewBlink();
}

function tagAccPreviewEyes() {
  const svg = document.getElementById('acc-preview-svg');
  if (!svg) return;
  const inlined = svg.querySelector('.jesty-face-inline');
  if (!inlined) return;
  inlined.querySelectorAll('ellipse[fill="#FFFFFF"], circle[fill="#FFFFFF"], circle[fill="#2D2A26"]').forEach(el => {
    const cy = parseFloat(el.getAttribute('cy'));
    if (cy >= 30 && cy <= 65) el.classList.add('acc-prev-eye');
  });
}

function accPreviewBlink() {
  const svg = document.getElementById('acc-preview-svg');
  if (!svg) return;
  const eyes = svg.querySelectorAll('.acc-prev-eye');
  if (!eyes.length) return;
  eyes.forEach(el => {
    el.classList.remove('blinking');
    void el.offsetWidth;
    el.classList.add('blinking');
  });
  setTimeout(() => eyes.forEach(el => el.classList.remove('blinking')), 350);
}

function startAccPreviewBlink() {
  stopAccPreviewBlink();
  function schedule() {
    const delay = 2500 + Math.random() * 1500;
    _accBlinkTimer = setTimeout(() => {
      accPreviewBlink();
      schedule();
    }, delay);
  }
  // First blink after a short pause
  _accBlinkTimer = setTimeout(() => {
    accPreviewBlink();
    schedule();
  }, 1500);
}

function stopAccPreviewBlink() {
  if (_accBlinkTimer) {
    clearTimeout(_accBlinkTimer);
    _accBlinkTimer = null;
  }
}

function updateDrawerPreview(overrideExpr) {
  const svg = document.getElementById('acc-preview-svg');
  if (!svg) return;
  const expr = overrideExpr || (JestyAnimator ? JestyAnimator.getExpression() : 'smug');
  const isArrowSwitch = !!overrideExpr;

  if (isArrowSwitch) {
    // Squash-settle animation: swap face at the squash peak
    svg.classList.remove('acc-squash');
    void svg.offsetWidth; // Force reflow to restart animation
    svg.classList.add('acc-squash');

    // Swap face at the squash peak (~23% of 520ms ≈ 120ms)
    setTimeout(() => {
      const useEl = svg.querySelector('use');
      if (useEl) useEl.setAttribute('href', `#face-${expr}`);
      svg.querySelectorAll('.jesty-accessory, .jesty-acc-group').forEach(el => el.remove());
      JestyAccessories.renderAccessories(expr, svg);
      // Re-tag eyes for new face and restart blink
      tagAccPreviewEyes();
      startAccPreviewBlink();
    }, 120);

    // Clean up class after animation ends
    svg.addEventListener('animationend', () => svg.classList.remove('acc-squash'), { once: true });
  } else {
    const useEl = svg.querySelector('use');
    if (useEl) useEl.setAttribute('href', `#face-${expr}`);
    svg.querySelectorAll('.jesty-accessory, .jesty-acc-group').forEach(el => el.remove());
    JestyAccessories.renderAccessories(expr, svg);
    // Tag eyes and start blink
    tagAccPreviewEyes();
    startAccPreviewBlink();
  }

  // Update mood label
  const moodLabel = document.getElementById('acc-preview-mood');
  if (moodLabel) moodLabel.textContent = expr;
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
          JestyAnalytics.track('accessory_equipped', { slot, accessory_id: acc.id });
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
    const nextTierKey = tier === 'free' ? 'premium' : 'pro';
    const upgrade = tier === 'free'
      ? { name: 'Guilty', price: PRICE.premiumFull, desc: 'Unlock all accessories & exclusive drip' }
      : { name: 'Sentenced', price: PRICE.pro, desc: 'Exclusive accessories & more' };
    const combo = TIER_COMBOS[nextTierKey];
    const ucColor = SLOT_COLORS[combo.color];

    const card = document.createElement('div');
    card.className = 'plans-upgrade-card';
    card.innerHTML = `
      <div class="plans-upgrade-icon">
        ${buildTierComboSvg(combo, 36, 34)}
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
    btn.addEventListener('click', () => openAccGallery(acc.id));
  }
  return btn;
}

async function renderAccessoryGrid(refreshId) {
  const grid = document.getElementById('accessory-grid');
  if (!grid) return;

  const catalog = JestyAccessories.getCatalog();
  const equipped = JestyAccessories.getEquipped();

  // Resolve unlock status for all items
  const items = [];
  for (const acc of catalog) {
    if (refreshId !== undefined && refreshId !== _accRefreshId) return;
    const unlocked = await JestyAccessories.isUnlocked(acc.id);
    items.push({ acc, unlocked });
  }
  if (refreshId !== undefined && refreshId !== _accRefreshId) return;

  // Sort: unlocked first, then locked — preserve catalog order within each group
  items.sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

  const fragment = document.createDocumentFragment();
  const MAX_MAIN_GRID = 12;

  for (let i = 0; i < Math.min(items.length, MAX_MAIN_GRID); i++) {
    const { acc, unlocked } = items[i];
    const slot = acc.slot;

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
    } else {
      btn.addEventListener('click', () => openAccGallery(acc.id));
    }
    fragment.appendChild(btn);
  }

  grid.innerHTML = '';
  grid.appendChild(fragment);
}

/* ──────────────────────────────────────────────
   ACCESSORY GALLERY (detail view for locked items)
   ────────────────────────────────────────────── */

let _galleryIndex = 0;
let _galleryCatalog = []; // flat ordered catalog for gallery navigation

function initAccessoryGallery() {
  const close = document.getElementById('acc-gallery-close');
  const backdrop = document.getElementById('acc-gallery-backdrop');
  const prev = document.getElementById('acc-gallery-prev');
  const next = document.getElementById('acc-gallery-next');

  if (close) close.addEventListener('click', closeAccGallery);
  if (backdrop) backdrop.addEventListener('click', closeAccGallery);
  if (prev) prev.addEventListener('click', () => navigateGallery(-1));
  if (next) next.addEventListener('click', () => navigateGallery(1));
}

function openAccGallery(accId) {
  const catalog = JestyAccessories.getCatalog();
  // Build flat ordered list: hats then glasses
  _galleryCatalog = [...catalog.filter(a => a.slot === 'hat'), ...catalog.filter(a => a.slot === 'glasses')];
  _galleryIndex = Math.max(0, _galleryCatalog.findIndex(a => a.id === accId));

  renderGalleryItem();

  const gallery = document.getElementById('acc-gallery');
  if (gallery) gallery.classList.remove('hidden');
  startUpgradeShakeLoop();
}

function closeAccGallery() {
  const gallery = document.getElementById('acc-gallery');
  if (gallery) gallery.classList.add('hidden');
  stopUpgradeShakeLoop();
}

function navigateGallery(dir) {
  _galleryIndex = (_galleryIndex + dir + _galleryCatalog.length) % _galleryCatalog.length;
  renderGalleryItem();
}

async function renderGalleryItem() {
  const acc = _galleryCatalog[_galleryIndex];
  if (!acc) return;

  const preview = document.getElementById('acc-gallery-preview');
  const nameEl = document.getElementById('acc-gallery-name');
  const metaEl = document.getElementById('acc-gallery-meta');
  const actionEl = document.getElementById('acc-gallery-action');
  const footer = document.getElementById('acc-gallery-footer');

  const unlocked = await JestyAccessories.isUnlocked(acc.id);
  const equipped = JestyAccessories.getEquipped();
  const isEquipped = equipped[acc.slot] === acc.id;
  const vb = ACC_VIEWBOXES[acc.symbolId] || '0 0 44 30';
  const funName = (ACC_FUN_NAMES[acc.id] || acc.name).replace('\n', ' ');

  // Preview
  if (preview) {
    preview.className = 'acc-gallery-preview' + (unlocked ? '' : ' locked');
    const lockBadge = unlocked ? '' : '<span class="acc-gallery-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>';
    preview.innerHTML = `<svg viewBox="${vb}"><use href="#${acc.symbolId}"/></svg>${lockBadge}`;
    if (!unlocked) {
      preview.style.cursor = 'pointer';
      preview.onclick = () => bounceUpgradeCard(preview);
    }
  }

  // Name
  if (nameEl) nameEl.textContent = funName;

  // Meta: level + XP needed
  if (metaEl) {
    if (unlocked) {
      metaEl.innerHTML = `<span style="color: var(--jesty-text-secondary)">Unlocked</span>`;
    } else {
      const lvl = acc.unlockLevel || 0;
      const xpNeeded = lvl >= 2 ? LEVEL_THRESHOLDS[Math.min(lvl - 2, LEVEL_THRESHOLDS.length - 1)] : 0;
      const tierLabel = acc.tier === 'pro' ? 'Sentenced' : (acc.tier === 'premium' || acc.tier === 'guilty') ? 'Guilty' : '';
      let metaText = '';
      if (lvl) metaText += `Level ${lvl}`;
      if (lvl && xpNeeded) metaText += ` · <span class="acc-gallery-xp">${xpNeeded} XP</span>`;
      if (tierLabel) metaText += (metaText ? ' · ' : '') + tierLabel;
      metaEl.innerHTML = metaText || 'Locked';
    }
  }

  // Action button
  if (actionEl) {
    if (unlocked && isEquipped) {
      actionEl.textContent = 'Unequip';
      actionEl.className = 'acc-gallery-action unequip';
      actionEl.onclick = async () => {
        await JestyAccessories.unequipAccessory(acc.slot);
        await refreshAllAccessoryUI();
        renderGalleryItem();
      };
    } else if (unlocked) {
      actionEl.textContent = 'Equip';
      actionEl.className = 'acc-gallery-action equip';
      actionEl.onclick = async () => {
        await JestyAccessories.equipAccessory(acc.slot, acc.id);
        await refreshAllAccessoryUI();
        renderGalleryItem();
      };
    } else {
      const lvl = acc.unlockLevel || 0;
      actionEl.textContent = lvl ? `Reach Level ${lvl}` : (acc.tier === 'pro' ? 'Launching Soon' : 'Upgrade to Guilty');
      actionEl.className = 'acc-gallery-action locked-action';
      actionEl.onclick = () => {
        if (lvl) {
          // Level-gated: bounce the preview card
          const previewEl = document.getElementById('acc-gallery-preview');
          if (previewEl) bounceUpgradeCard(previewEl);
        } else {
          showTierOverlayPlans();
        }
      };
    }
  }

  // Upgrade card in footer for free users (fixed color per gallery session)
  if (footer) {
    footer.innerHTML = '';
    const tier = typeof JestyPremium !== 'undefined' ? await JestyPremium.getTier() : 'free';
    if (tier === 'free') {
      const hint = document.createElement('p');
      hint.className = 'game-upgrade-hint';
      hint.textContent = 'Unlock the full collection';
      footer.appendChild(hint);

      const card = document.createElement('div');
      card.className = 'game-upgrade-card';
      card.innerHTML = `
        <div class="plans-upgrade-icon">
          ${buildTierComboSvg(TIER_COMBOS.premium, 36, 34)}
        </div>
        <div class="plans-upgrade-info">
          <span class="plans-upgrade-name">Guilty — ${PRICE.premiumFull}</span>
          <span class="plans-upgrade-price">Unlock all accessories & exclusive drip</span>
        </div>
        <svg class="plans-upgrade-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      `;
      card.addEventListener('click', () => showTierOverlayPlans());
      footer.appendChild(card);
    }
  }

  // Counter
  const counterEl = document.getElementById('acc-gallery-counter');
  if (counterEl) counterEl.textContent = `${_galleryIndex + 1}/${_galleryCatalog.length}`;

  // Arrow state
  const prevBtn = document.getElementById('acc-gallery-prev');
  const nextBtn = document.getElementById('acc-gallery-next');
  if (prevBtn) prevBtn.disabled = _galleryCatalog.length <= 1;
  if (nextBtn) nextBtn.disabled = _galleryCatalog.length <= 1;
}

/* ──────────────────────────────────────────────
   STATS
   ────────────────────────────────────────────── */

async function loadStats() {
  // Stats pills removed from main page — only "left today" remains (handled by updateMsgsLeft)
}

/* ──────────────────────────────────────────────
   LIVE COMMENTS
   ────────────────────────────────────────────── */

function startLiveComments() {
  // If focus session is active, show focus timer instead
  if (focusActive) {
    showComment('Focus session active');
    startFocusTimer();
    liveCommentTimer = setTimeout(() => showLiveComment(), 30000 + Math.random() * 30000);
    return;
  }
  // Show an initial comment immediately so the space is never empty
  const initial = GENERIC_COMMENTS[Math.floor(Math.random() * GENERIC_COMMENTS.length)];
  showComment(initial);
  // Then start the rotation cycle
  liveCommentTimer = setTimeout(() => showLiveComment(), 30000 + Math.random() * 30000);
}

async function tryLiveRealRoast() {
  try {
    const result = await RoastEngine.generate({ short: true, free: true });

    if (result.capped) return null;

    // Show the roast as a live comment
    showComment(result.joke);
    // Override expression with the AI's mood
    JestyAnimator.setExpression(result.mood, 6000);
    if (JestyAnimator.react) JestyAnimator.react('roast');

    // Prime the chat drawer with this roast — only if user hasn't started chatting
    const userHasActiveChat = conversationHistory.length > 2;
    if (!userHasActiveChat) {
      currentRoast = result.joke;
      conversationHistory = [
        { role: 'system', content: buildChatPersonality(0) },
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

  // Focus mode: overlay handles display, skip normal comments
  if (focusActive) {
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
          "I have worse things to say. You can't afford them.",
          "Free Jesty is holding back. Barely.",
          "There's a version of me with no filter. Just saying.",
          "Premium Jesty never sleeps. Free Jesty does."
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
  clearTimeout(liveCommentTimer);
  const delay = 30000 + Math.random() * 30000; // 30-60 seconds
  liveCommentTimer = setTimeout(() => showLiveComment(), delay);
}


function showComment(text) {
  const commentText = document.getElementById('comment-text');

  if (!commentText) return;

  // Crossfade: fade out, swap text, fade in
  commentText.style.opacity = '0';
  setTimeout(() => {
    commentText.textContent = text;
        commentText.style.opacity = '1';
  }, 400);

  // Set a temporary expression (only when drawer is closed)
  if (!drawerOpen && typeof JestyAnimator !== 'undefined') {
    const expressions = ['smug', 'suspicious', 'eyeroll'];
    const expr = expressions[Math.floor(Math.random() * expressions.length)];
    JestyAnimator.setExpression(expr);
  }
}

/* ──────────────────────────────────────────────
   FOCUS TIME (overlay + timer)
   ────────────────────────────────────────────── */

const FOCUS_MESSAGES_GENERIC = [
  "Still focusing. Impressive.",
  "I'm watching every tab switch.",
  "Don't even think about it.",
  "Focus mode. I'm judging harder.",
  "You're doing suspiciously well.",
  "I see everything.",
  "Stay on task. I'm watching.",
  "One tab at a time.",
  "You got this. Probably.",
  "Keep going. I'll be here."
];

// Pre-built personalized messages, refreshed on session start
let _focusPersonalizedMsgs = [];
let _focusMsgIndex = 0;

let focusMsgInterval = null;

async function showFocusOverlay() {
  const overlay = document.getElementById('focus-overlay');
  const wrapper = document.querySelector('.layer-wrapper');
  const container = document.querySelector('.container');
  if (!overlay || !wrapper) return;

  // Clean up any stale DOM state from a previous session
  resetFocusOverlayDOM();

  overlay.classList.remove('hidden');
  wrapper.classList.add('focus-mode');
  if (container) container.classList.add('focus-mode');

  // Build personalized messages and shuffle them
  _focusPersonalizedMsgs = await buildFocusMessages();
  // Fisher-Yates shuffle
  for (let i = _focusPersonalizedMsgs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_focusPersonalizedMsgs[i], _focusPersonalizedMsgs[j]] = [_focusPersonalizedMsgs[j], _focusPersonalizedMsgs[i]];
  }
  _focusMsgIndex = 0;

  // Set initial encouraging message
  rotateFocusMessage();
  focusMsgInterval = setInterval(rotateFocusMessage, 15000);

  // Render existing notes from session
  const session = await JestyFocusTime.getSession();
  const notes = (session && session.notes) || [];
  renderFocusNotes(notes);
}

function resetFocusOverlayDOM() {
  // Reset all elements that handleFocusEnd may have hidden or mutated
  const endBtn = document.getElementById('focus-overlay-end');
  const msgEl = document.getElementById('focus-overlay-msg');
  const actionsEl = document.getElementById('focus-overlay-actions');
  const charEl = document.querySelector('.focus-overlay-character');
  const notesSection = document.querySelector('.focus-overlay-notes');
  const timerEl = document.getElementById('focus-overlay-timer');
  const noteAddRow = document.querySelector('.focus-note-add');

  // Restore display on elements hidden during end screen
  if (endBtn) endBtn.style.display = '';
  if (msgEl) msgEl.style.display = '';
  if (actionsEl) actionsEl.style.display = '';
  if (charEl) charEl.style.display = '';
  if (notesSection) notesSection.style.display = '';
  if (timerEl) { timerEl.style.display = ''; timerEl.textContent = ''; timerEl._noteAnimating = false; }
  if (noteAddRow) { noteAddRow.style.transition = ''; noteAddRow.style.opacity = ''; }

  // Remove .removing class from notes
  document.querySelectorAll('.focus-note.removing').forEach(n => {
    n.classList.remove('removing');
    n.style.transitionDelay = '';
  });

  // Remove any leftover end screen
  document.querySelectorAll('.focus-end-screen').forEach(el => el.remove());

  // Reset bottom panels to notes view
  const notesAbove = document.getElementById('focus-panel-notes');
  const audioAbove = document.getElementById('focus-panel-audio-above');
  const noteInput = document.getElementById('focus-panel-note-input');
  const audioBelow = document.getElementById('focus-panel-audio-below');
  if (notesAbove) notesAbove.classList.remove('slide-out-left');
  if (audioAbove) { audioAbove.classList.add('hidden'); audioAbove.classList.remove('slide-in-right'); }
  if (noteInput) noteInput.classList.remove('slide-out-left');
  if (audioBelow) { audioBelow.classList.add('hidden'); audioBelow.classList.remove('slide-in-right'); }
  _focusAudioOpen = false;

  // Close all-tracks drawer
  const allTracksDrawer = document.getElementById('focus-audio-drawer');
  if (allTracksDrawer) { allTracksDrawer.classList.add('hidden'); allTracksDrawer.classList.remove('open'); }
  _focusAllTracksOpen = false;
}

function hideFocusOverlay() {
  resetFocusOverlayDOM();

  const overlay = document.getElementById('focus-overlay');
  const wrapper = document.querySelector('.layer-wrapper');
  const container = document.querySelector('.container');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  if (wrapper) wrapper.classList.remove('focus-mode');
  if (container) container.classList.remove('focus-mode');
  _focusAudioOpen = false;
  clearInterval(focusMsgInterval);
  focusMsgInterval = null;

  // Re-center hero character after focus mode
  if (typeof JestyAnimator !== 'undefined' && JestyAnimator.snapToCenter) {
    JestyAnimator.snapToCenter();
  }
}

async function buildFocusMessages() {
  const msgs = [...FOCUS_MESSAGES_GENERIC];
  try {
    const { jesty_data, openTabs } = await chrome.storage.local.get(['jesty_data', 'openTabs']);
    if (!jesty_data) return msgs;

    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isLateNight = hour >= 23 || hour < 5;
    const isWorkHours = hour >= 9 && hour < 17 && !isWeekend;
    const name = jesty_data.profile?.user_name;

    // ── Time-aware messages ──
    if (isLateNight) {
      msgs.push("It's late. The fact you're focusing is heroic.");
      msgs.push("Most people are sleeping. You're locking in.");
      if (name) msgs.push(`${name}, go to bed after this. Promise.`);
    }
    if (isWeekend) {
      msgs.push("Focusing on a weekend. Suspicious dedication.");
      msgs.push("Weekend grind. I respect it. Barely.");
    }
    if (isWorkHours) {
      msgs.push("Work hours, focus on. As it should be.");
    }

    // ── Interest-based temptation warnings ──
    const interests = jesty_data.profile?.interests || [];
    const topInterests = interests.filter(i => i.sessions >= 3).slice(0, 5);
    for (const interest of topInterests) {
      const t = interest.topic;
      const cat = interest.category;
      if (cat === 'football' || cat === 'nfl' || cat === 'nba') {
        msgs.push(`No checking ${t} scores right now.`);
        msgs.push(`${t} can wait. Focus can't.`);
      } else if (cat === 'crypto' || cat === 'stocks') {
        msgs.push(`${t} isn't going anywhere. Focus.`);
        msgs.push(`The market will survive without you.`);
      } else if (cat === 'gaming') {
        msgs.push(`${t} will still be there after. Focus.`);
      } else if (cat === 'anime') {
        msgs.push(`No episodes right now. Focus first.`);
      } else if (cat === 'music') {
        msgs.push(`Listening is fine. Browsing ${t} isn't.`);
      } else if (cat === 'programming') {
        msgs.push(`If you're coding, good. If you're on Reddit about ${t}, bad.`);
      } else if (cat === 'food') {
        msgs.push(`Order food later. Work now.`);
      }
    }

    // ── Trait-based messages ──
    const traits = jesty_data.profile?.traits || {};
    if (traits.procrastinator_score > 0.5) {
      msgs.push("I know you want to switch tabs. Don't.");
      msgs.push("Your procrastination streak ends here.");
      if (name) msgs.push(`${name}, I've seen your history. Stay focused.`);
    }
    if (traits.tab_hoarder_score > 0.5) {
      msgs.push("All those tabs are tempting. Ignore them.");
      msgs.push("Tab hoarders don't get to browse during focus.");
    }
    if (traits.impulse_shopper_score > 0.4) {
      msgs.push("No shopping. Your cart can wait.");
      msgs.push("Put the credit card away mentally.");
    }

    // ── Distraction tabs currently open ──
    if (openTabs) {
      const DISTRACTION_DOMAINS = [
        'twitter.com', 'x.com', 'reddit.com', 'instagram.com', 'facebook.com',
        'tiktok.com', 'youtube.com', 'twitch.tv', 'netflix.com', 'discord.com'
      ];
      const distractionTabs = Object.values(openTabs).filter(t => {
        const d = (t.domain || '').toLowerCase();
        return DISTRACTION_DOMAINS.some(dd => d.includes(dd));
      });
      for (const dt of distractionTabs.slice(0, 3)) {
        const d = dt.domain.replace('.com', '').replace('.tv', '');
        msgs.push(`That ${d} tab is still open. Resist.`);
        msgs.push(`I see ${d} lurking in your tabs. Don't.`);
      }
    }

    // ── Focus session history ──
    const sessions = jesty_data.focus_sessions || [];
    if (sessions.length > 0) {
      const last = sessions[0];
      if (last.distractionCount === 0) {
        msgs.push("Last session was perfect. Do it again.");
      } else if (last.distractionCount >= 3) {
        msgs.push(`Last session: ${last.distractionCount} distractions. Beat that.`);
        msgs.push("You slipped last time. Not today.");
      }
      const best = sessions.reduce((b, s) => s.longestStreakSeconds > (b.longestStreakSeconds || 0) ? s : b, sessions[0]);
      if (best.longestStreakSeconds > 600) {
        const bestMin = Math.floor(best.longestStreakSeconds / 60);
        msgs.push(`Your record streak is ${bestMin} minutes. Break it.`);
      }
      if (sessions.length >= 5) {
        msgs.push(`Session #${sessions.length + 1}. You're building a habit.`);
      }
    } else {
      msgs.push("First focus session. Set the standard.");
    }

    // ── Name-based messages ──
    if (name) {
      msgs.push(`${name}, eyes on the screen.`);
      msgs.push(`${name} in focus mode. Love to see it.`);
    }

  } catch (e) { /* fallback to generic */ }

  return msgs;
}

function rotateFocusMessage() {
  const msgEl = document.getElementById('focus-overlay-msg');
  if (!msgEl) return;

  // Cycle through shuffled messages without immediate repeats
  const pool = _focusPersonalizedMsgs.length > 0 ? _focusPersonalizedMsgs : FOCUS_MESSAGES_GENERIC;
  const msg = pool[_focusMsgIndex % pool.length];
  _focusMsgIndex++;

  msgEl.style.opacity = '0';
  setTimeout(() => {
    msgEl.textContent = msg;
    msgEl.style.opacity = '1';
  }, 300);
}

async function handleFocusNoteMode() {
  // Ensure focus overlay is visible
  if (!focusActive) {
    focusActive = true;
    await showFocusOverlay();
  }

  // Close audio drawer if open
  if (_focusAudioOpen) toggleFocusAudioPanel(false);

  // Play "Write it down" animation
  const timerEl = document.getElementById('focus-overlay-timer');
  if (timerEl && !timerEl._noteAnimating) {
    timerEl._noteAnimating = true;
    animateTimerNote(timerEl, 'Write it down.').then(() => {
      timerEl._noteAnimating = false;
    });
  }

  // Focus the note input with visual hint
  setTimeout(() => {
    const input = document.querySelector('.focus-note-input');
    if (input) {
      input.classList.add('note-hint');
      input.focus();
      input.addEventListener('blur', () => input.classList.remove('note-hint'), { once: true });
    }
  }, 400);
}

function animateTimerNote(timerEl, message) {
  const delay = 35;

  function setChars(el, text, cls) {
    el.innerHTML = '';
    text.split('').forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = `timer-char ${cls}`;
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.animationDelay = `${i * delay}ms`;
      el.appendChild(span);
    });
    return text.length;
  }

  return new Promise(resolve => {
    // 1. Timer chars exit
    const savedTime = timerEl.textContent;
    const exitLen = setChars(timerEl, savedTime, 'char-exit');

    setTimeout(() => {
      // 2. Message chars enter (h1 size)
      timerEl.classList.add('timer-note-msg');
      const enterLen = setChars(timerEl, message, 'char-enter');

      // 3. After pause, message chars exit
      setTimeout(() => {
        setChars(timerEl, message, 'char-exit');

        // 4. Timer chars enter back
        setTimeout(() => {
          timerEl.classList.remove('timer-note-msg');
          setChars(timerEl, savedTime, 'char-enter');

          setTimeout(() => {
            timerEl.textContent = savedTime;
            resolve();
          }, savedTime.length * delay + 300);
        }, message.length * delay + 300);
      }, 2500);
    }, exitLen * delay + 300);
  });
}

function updateFocusOverlayFace(expression) {
  const faceEl = document.getElementById('focus-overlay-face');
  if (faceEl) faceEl.setAttribute('href', `#face-${expression}`);
}

/* ─── Focus Notes ─── */

function renderFocusNotes(notes) {
  const list = document.getElementById('focus-notes-list');
  if (!list) return;
  list.innerHTML = '';

  notes.forEach((note, i) => {
    const div = document.createElement('div');
    div.className = `focus-note${note.done ? ' checked' : ''}`;

    const check = document.createElement('div');
    check.className = 'focus-note-check';
    check.addEventListener('click', async () => {
      note.done = !note.done;
      renderFocusNotes(notes);
      await saveFocusNotes(notes);
    });

    const textEl = document.createElement('span');
    textEl.className = 'focus-note-text';
    textEl.textContent = note.text;
    textEl.contentEditable = 'true';
    textEl.addEventListener('blur', async () => {
      const newText = textEl.textContent.trim();
      if (!newText) {
        notes.splice(i, 1);
        renderFocusNotes(notes);
      } else {
        note.text = newText;
      }
      await saveFocusNotes(notes);
    });
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textEl.blur();
      }
    });

    const del = document.createElement('button');
    del.className = 'focus-note-delete';
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    del.addEventListener('click', async () => {
      div.classList.add('removing');
      setTimeout(async () => {
        notes.splice(i, 1);
        renderFocusNotes(notes);
        await saveFocusNotes(notes);
      }, 350);
    });

    div.appendChild(check);
    div.appendChild(textEl);
    div.appendChild(del);
    list.appendChild(div);
  });

  // Add-note input row (rendered below the line)
  const inputWrap = document.getElementById('focus-panel-note-input');
  if (inputWrap) {
    inputWrap.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'focus-note-add';

    const addCheck = document.createElement('div');
    addCheck.className = 'focus-note-check';
    row.appendChild(addCheck);

    const input = document.createElement('textarea');
    input.className = 'focus-note-input';
    input.placeholder = 'Quick note...';
    input.rows = 1;

    const autoResize = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    };

    input.addEventListener('input', () => {
      row.classList.toggle('typing', input.value.length > 0);
      autoResize();
    });

    input.addEventListener('paste', () => {
      requestAnimationFrame(autoResize);
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        notes.push({ text, done: false });
        renderFocusNotes(notes);
        await saveFocusNotes(notes);
        const newInput = document.querySelector('.focus-note-input');
        if (newInput) newInput.focus();
      }
    });

    row.appendChild(input);
    inputWrap.appendChild(row);
  }
}

async function saveFocusNotes(notes) {
  const { focusSession } = await chrome.storage.local.get(['focusSession']);
  if (!focusSession || !focusSession.active) return;
  focusSession.notes = notes;
  await chrome.storage.local.set({ focusSession });
}

async function handleFocusStart() {
  const session = await JestyFocusTime.startSession();
  if (!session) return;

  JestyAnalytics.track('focus_started');
  focusActive = true;
  showFocusOverlay();
  updateFocusOverlayFace('suspicious');
  startFocusTimer();

  const focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    focusBtn.textContent = 'End focus';
    focusBtn.classList.add('active');
  }
}

async function handleFocusEnd() {
  stopFocusTimer();
  focusActive = false;

  // Stop audio playback
  if (typeof JestyFocusAudio !== 'undefined') {
    JestyFocusAudio.stop();
  }

  // Close audio drawer if open
  if (_focusAudioOpen) toggleFocusAudioPanel(false);

  // Clean up blur
  chrome.storage.local.set({ focusBlurEnabled: false });

  const focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    focusBtn.textContent = 'Stay Focused';
    focusBtn.classList.remove('active');
  }

  // Check notes before ending session (endSession triggers storage change listener)
  const liveSession = await JestyFocusTime.getSession();
  const liveNotes = liveSession ? (liveSession.notes || []).filter(n => n.text && n.text.trim()) : [];
  const hasNotes = liveNotes.length > 0 && liveNotes.some(n => !n.done);

  // 1. Explode timer — start roast request in parallel
  const timerEl = document.getElementById('focus-overlay-timer');
  const roastPromise = JestyFocusTime.generateEndRoast(liveSession).catch(() => null);
  if (timerEl) await explodeTimer(timerEl);

  // 2. Slide notes out to the left (if any)
  const noteItems = document.querySelectorAll('.focus-note');
  noteItems.forEach((n, i) => {
    n.style.transitionDelay = `${i * 0.05}s`;
    n.classList.add('removing');
  });
  const noteAddRow = document.querySelector('.focus-note-add');
  if (noteAddRow) { noteAddRow.style.transition = 'opacity 0.2s'; noteAddRow.style.opacity = '0'; }
  if (noteItems.length) await new Promise(r => setTimeout(r, 300 + noteItems.length * 50));

  const endedSession = await JestyFocusTime.endSession();
  if (!endedSession) { hideFocusOverlay(); return; }
  JestyAnalytics.track('focus_ended', { duration_seconds: Math.floor((endedSession.endedAt - endedSession.startedAt) / 1000) });
  const notes = (endedSession.notes || []).filter(n => n.text && n.text.trim());

  // 3. Content swap → resume screen with roast + save/guilty card
  const endBtn = document.getElementById('focus-overlay-end');
  const msgEl = document.getElementById('focus-overlay-msg');
  const actionsEl = document.getElementById('focus-overlay-actions');
  const charEl = document.querySelector('.focus-overlay-character');
  const notesSection = document.querySelector('.focus-overlay-notes');
  if (endBtn) endBtn.style.display = 'none';
  if (msgEl) msgEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';
  if (notesSection) notesSection.style.display = 'none';
  if (charEl) charEl.style.display = 'none';
  if (timerEl) timerEl.style.display = 'none';

  const center = document.querySelector('.focus-overlay-center');
  const durationMins = Math.floor((endedSession.endedAt - endedSession.startedAt) / 60000);
  const pending = notes.filter(n => !n.done).length;
  const isPremium = typeof JestyPremium !== 'undefined' && await JestyPremium.isPremium();

  const wrap = document.createElement('div');
  wrap.className = 'focus-end-screen';

  // Roast (filled async from the promise started during explosion)
  const roastEl = document.createElement('div');
  roastEl.className = 'focus-end-roast';
  wrap.appendChild(roastEl);

  // Description
  const desc = document.createElement('p');
  desc.className = 'focus-end-desc';
  if (hasNotes) {
    desc.textContent = `You wrote ${pending} note${pending !== 1 ? 's' : ''} during this session`;
  } else {
    desc.textContent = durationMins >= 1
      ? `${durationMins} minute${durationMins !== 1 ? 's' : ''} of focus. Not bad.`
      : 'Quick session. Every bit counts.';
  }
  wrap.appendChild(desc);

  // Fill roast from promise — slide up reveal
  roastPromise.then(roast => {
    roastEl.textContent = roast ? roast.text : 'Session complete.';
    roastEl.classList.add('visible');
  });

  if (isPremium) {
    // Premium: save button (if notes) + dismiss
    if (hasNotes) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'focus-end-action-btn';
      saveBtn.textContent = 'Save as task';
      wrap.appendChild(saveBtn);

      const skipBtn = document.createElement('button');
      skipBtn.className = 'focus-end-skip';
      skipBtn.textContent = 'Dismiss';
      wrap.appendChild(skipBtn);

      center.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('visible')));

      const action = await new Promise(resolve => {
        saveBtn.addEventListener('click', () => resolve('save'));
        skipBtn.addEventListener('click', () => resolve('skip'));
      });

      if (action === 'save') {
        const task = {
          id: 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: `Focus notes · ${durationMins}m session`,
          notes: notes.map(n => ({ text: n.text, done: n.done })),
          completed: false,
          completedAt: null,
          createdAt: Date.now()
        };
        await saveUserTask(task);
        await renderTaskList();
      }
    } else {
      const skipBtn = document.createElement('button');
      skipBtn.className = 'focus-end-action-btn';
      skipBtn.textContent = 'Done';
      wrap.appendChild(skipBtn);

      center.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('visible')));

      await new Promise(resolve => {
        skipBtn.addEventListener('click', () => resolve());
      });
    }
  } else {
    // Free: copy notes button (if notes) + guilty tier card + dismiss
    const tierWrap = document.createElement('div');
    tierWrap.className = 'focus-end-tier-card';
    wrap.appendChild(tierWrap);

    if (hasNotes) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'focus-end-skip';
      copyBtn.textContent = 'Copy notes';
      copyBtn.addEventListener('click', () => {
        const text = notes.map(n => `${n.done ? '[x]' : '[ ]'} ${n.text}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy notes'; }, 2000);
        });
      });
      wrap.appendChild(copyBtn);
    }

    const skipBtn = document.createElement('button');
    skipBtn.className = 'focus-end-skip';
    skipBtn.textContent = 'Dismiss';
    wrap.appendChild(skipBtn);

    center.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('visible')));

    renderGuiltyTierCard(tierWrap, hasNotes ? 'Plead Guilty to save session' : 'Plead Guilty');

    await new Promise(resolve => {
      skipBtn.addEventListener('click', () => resolve());
    });
  }

  hideFocusOverlay();
}

function explodeTimer(timerEl) {
  return new Promise(resolve => {
    const text = timerEl.textContent;
    timerEl._noteAnimating = true;
    timerEl.innerHTML = '';

    const chars = text.split('');
    const count = chars.length;
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'timer-char timer-drop';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      // Spread outward from center — each char gets its own lane
      const center = (count - 1) / 2;
      const spread = (i - center) * 18;
      const rot = 60 + Math.random() * 200;
      const dir = i < center ? -1 : i > center ? 1 : (Math.random() > 0.5 ? 1 : -1);
      const delay = Math.random() * 0.1;
      span.style.setProperty('--dx-start', `${spread}px`);
      span.style.setProperty('--dr', `${rot * dir}deg`);
      span.style.animationDelay = `${delay}s`;
      timerEl.appendChild(span);
    });

    setTimeout(() => {
      timerEl.textContent = '';
      timerEl._noteAnimating = false;
      resolve();
    }, 1800);
  });
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
  const timerEl = document.getElementById('focus-overlay-timer');
  if (timerEl && !timerEl._noteAnimating) timerEl.textContent = timeStr;
}

/* ─── Focus Audio ─── */

let _focusAudioOpen = false;
let _focusAllTracksOpen = false;

async function handleFocusAudioMode() {
  // Ensure focus overlay is visible
  if (!focusActive) {
    focusActive = true;
    await showFocusOverlay();
  }
  toggleFocusAudioPanel(true);
}

function toggleFocusAudioPanel(open) {
  const notesAbove = document.getElementById('focus-panel-notes');
  const audioAbove = document.getElementById('focus-panel-audio-above');
  const noteInput = document.getElementById('focus-panel-note-input');
  const audioBelow = document.getElementById('focus-panel-audio-below');
  const soundBtn = document.getElementById('focus-action-sound');

  _focusAudioOpen = open !== undefined ? open : !_focusAudioOpen;
  if (soundBtn) soundBtn.classList.toggle('active', _focusAudioOpen);

  if (_focusAudioOpen) {
    // Above: slide notes left, show suggested track
    if (notesAbove) notesAbove.classList.add('slide-out-left');
    if (audioAbove) { audioAbove.classList.remove('hidden'); audioAbove.classList.add('slide-in-right'); }
    // Below: slide note input left, show volume
    if (noteInput) noteInput.classList.add('slide-out-left');
    if (audioBelow) { audioBelow.classList.remove('hidden'); audioBelow.classList.add('slide-in-right'); }

    renderSuggestedTrack();
    initAudioVolumeControls();

    // Animate timer text like "Write it down"
    const timerEl = document.getElementById('focus-overlay-timer');
    if (timerEl && !timerEl._noteAnimating) {
      timerEl._noteAnimating = true;
      getSuggestedTrackMessage().then(msg => {
        animateTimerNote(timerEl, msg).then(() => { timerEl._noteAnimating = false; });
      });
    }
  } else {
    // Reverse: bring notes back
    if (audioAbove) { audioAbove.classList.add('hidden'); audioAbove.classList.remove('slide-in-right'); }
    if (notesAbove) notesAbove.classList.remove('slide-out-left');
    if (audioBelow) { audioBelow.classList.add('hidden'); audioBelow.classList.remove('slide-in-right'); }
    if (noteInput) noteInput.classList.remove('slide-out-left');
    // Close all-tracks drawer too
    if (_focusAllTracksOpen) toggleAllTracksDrawer(false);
  }
}

async function getSuggestedTrackMessage() {
  const tracks = JestyFocusAudio.getTracks();
  const adaptive = await JestyFocusAudio.getAdaptiveTrack();
  const trackName = tracks.find(t => t.id === adaptive)?.name || 'Brown Noise';
  return `Try ${trackName}.`;
}

async function renderSuggestedTrack() {
  const container = document.getElementById('focus-audio-suggested');
  if (!container) return;

  const tracks = JestyFocusAudio.getTracks();
  const currentTrack = JestyFocusAudio.getCurrentTrack();
  const adaptive = await JestyFocusAudio.getAdaptiveTrack();
  const track = tracks.find(t => t.id === adaptive) || tracks[0];
  const isPlaying = currentTrack === track.id;

  container.className = `focus-audio-suggested${isPlaying ? ' playing' : ''}`;
  container.innerHTML = `
    <div class="focus-audio-suggested-icon">
      <div class="focus-audio-wave">
        <div class="focus-audio-wave-bar"></div>
        <div class="focus-audio-wave-bar"></div>
        <div class="focus-audio-wave-bar"></div>
        <div class="focus-audio-wave-bar"></div>
        <div class="focus-audio-wave-bar"></div>
      </div>
    </div>
    <div class="focus-audio-suggested-info">
      <span class="focus-audio-suggested-label">Suggested for your tabs</span>
      <span class="focus-audio-suggested-name">${track.name}</span>
    </div>
    <button class="focus-audio-suggested-action">
      ${isPlaying
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
      }
    </button>
  `;

  container.onclick = () => {
    if (JestyFocusAudio.getCurrentTrack() === track.id) {
      JestyFocusAudio.stop();
    } else {
      JestyFocusAudio.play(track.id);
    }
    renderSuggestedTrack();
    updateFocusSoundBtnState();
  };
}

function initAudioVolumeControls() {
  const slider = document.getElementById('focus-audio-slider');
  if (!slider) return;

  slider.value = Math.round(JestyFocusAudio.getVolume() * 100);
  slider.oninput = () => {
    JestyFocusAudio.setVolume(slider.value / 100);
  };

  const volDown = document.getElementById('focus-audio-vol-down');
  const volUp = document.getElementById('focus-audio-vol-up');
  if (volDown) {
    volDown.onclick = () => {
      const val = Math.max(0, Number(slider.value) - 10);
      slider.value = val;
      JestyFocusAudio.setVolume(val / 100);
    };
  }
  if (volUp) {
    volUp.onclick = () => {
      const val = Math.min(100, Number(slider.value) + 10);
      slider.value = val;
      JestyFocusAudio.setVolume(val / 100);
    };
  }
}

function toggleAllTracksDrawer(open) {
  const drawer = document.getElementById('focus-audio-drawer');
  if (!drawer) return;

  _focusAllTracksOpen = open !== undefined ? open : !_focusAllTracksOpen;

  if (_focusAllTracksOpen) {
    drawer.classList.remove('hidden');
    void drawer.offsetWidth; // Force reflow so transition plays
    drawer.classList.add('open');
    renderAllTracks();
  } else {
    drawer.classList.remove('open');
    setTimeout(() => drawer.classList.add('hidden'), 350);
  }
}

async function renderAllTracks() {
  const container = document.getElementById('focus-audio-tracks');
  if (!container) return;

  const tracks = JestyFocusAudio.getTracks();
  const currentTrack = JestyFocusAudio.getCurrentTrack();
  const adaptive = await JestyFocusAudio.getAdaptiveTrack();

  container.innerHTML = '';

  for (const track of tracks) {
    const isPlaying = currentTrack === track.id;
    const div = document.createElement('div');
    div.className = `focus-audio-track${isPlaying ? ' playing' : ''}`;

    const isSuggested = track.id === adaptive;
    const descText = isSuggested ? `${track.desc} · Suggested` : track.desc;

    div.innerHTML = `
      <div class="focus-audio-track-icon">
        <div class="focus-audio-wave">
          <div class="focus-audio-wave-bar"></div>
          <div class="focus-audio-wave-bar"></div>
          <div class="focus-audio-wave-bar"></div>
          <div class="focus-audio-wave-bar"></div>
          <div class="focus-audio-wave-bar"></div>
        </div>
      </div>
      <div class="focus-audio-track-info">
        <span class="focus-audio-track-name">${track.name}</span>
        <span class="focus-audio-track-desc">${descText}</span>
      </div>
      <button class="focus-audio-track-action">
        ${isPlaying
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        }
      </button>
    `;

    div.addEventListener('click', () => {
      if (isPlaying) {
        JestyFocusAudio.stop();
      } else {
        JestyFocusAudio.play(track.id);
      }
      renderAllTracks();
      renderSuggestedTrack();
      updateFocusSoundBtnState();
    });

    container.appendChild(div);
  }
}

function updateFocusSoundBtnState() {
  const soundBtn = document.getElementById('focus-action-sound');
  if (soundBtn && !_focusAudioOpen) {
    soundBtn.classList.toggle('active', JestyFocusAudio.isPlaying());
  }
}

/* ─── Focus overlay action buttons ─── */

function initFocusOverlayActions() {
  const blurBtn = document.getElementById('focus-action-blur');
  const soundBtn = document.getElementById('focus-action-sound');
  const pencilBtn = document.getElementById('focus-action-pencil');

  if (blurBtn) {
    // Sync initial state
    chrome.storage.local.get(['focusBlurEnabled'], (result) => {
      blurBtn.classList.toggle('active', !!result.focusBlurEnabled);
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.focusBlurEnabled) {
        blurBtn.classList.toggle('active', !!changes.focusBlurEnabled.newValue);
      }
    });

    blurBtn.addEventListener('click', async () => {
      const { focusBlurEnabled } = await chrome.storage.local.get(['focusBlurEnabled']);
      const newState = !focusBlurEnabled;
      await chrome.storage.local.set({ focusBlurEnabled: newState });
      blurBtn.classList.toggle('active', newState);
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      toggleFocusAudioPanel();
    });
  }

  if (pencilBtn) {
    pencilBtn.addEventListener('click', () => {
      // Close audio panel if open, then activate notes
      if (_focusAudioOpen) toggleFocusAudioPanel(false);
      handleFocusNoteMode();
    });
  }

  // All tracks drawer back button
  const audioBack = document.getElementById('focus-audio-back');
  if (audioBack) {
    audioBack.addEventListener('click', () => toggleAllTracksDrawer(false));
  }

  // All tracks button
  const allTracksBtn = document.getElementById('focus-audio-all-btn');
  if (allTracksBtn) {
    allTracksBtn.addEventListener('click', () => toggleAllTracksDrawer(true));
  }
}

function initFocusClickHandler() {
  // Focus button (main screen)
  const focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    focusBtn.addEventListener('click', async () => {
      if (focusActive) {
        await handleFocusEnd();
      } else {
        await handleFocusStart();
      }
    });
  }

  // End button on the focus overlay
  const overlayEnd = document.getElementById('focus-overlay-end');
  if (overlayEnd) {
    overlayEnd.addEventListener('click', () => handleFocusEnd());
  }

  // Focus overlay action buttons
  initFocusOverlayActions();
}

/* ──────────────────────────────────────────────
   PREMIUM FEATURES INIT
   ────────────────────────────────────────────── */

async function initPremiumFeatures() {
  const isPremium = await JestyPremium.isPremium();

  // Show premium CTA
  const cta = document.getElementById('premium-cta');
  if (cta) {
    cta.classList.remove('hidden');
    renderPromoFaces();
    if (isPremium) {
      // Paid tiers: keep illustration, remove the verdict button
      const promoBtn = cta.querySelector('.promo-card-btn');
      if (promoBtn) promoBtn.remove();
    } else {
      const promoBtn = cta.querySelector('.promo-card-btn');
      if (promoBtn) promoBtn.addEventListener('click', showTierOverlay);
    }
  }

  // Progression visible to all users (games award XP)
  await initProgression();

  // Focus Time (free feature)
  const focusWasActive = await JestyFocusTime.init();
  if (focusWasActive) {
    focusActive = true;
    showFocusOverlay();
    startFocusTimer();
    const focusBtn = document.getElementById('focus-btn');
    if (focusBtn) {
      focusBtn.textContent = 'End focus';
      focusBtn.classList.add('active');
    }
    // Restore audio if it was playing
    if (typeof JestyFocusAudio !== 'undefined') {
      JestyFocusAudio.restore();
    }
  }
  initFocusClickHandler();

  // Task card: visible to all, but disabled for free users
  await initProductivityTasks(isPremium);

  // Fun Zone visible to all users (quiz/trivia gated for free)
  await initFunZone(isPremium);

  // Pattern Generator init (card is now inside Fun Zone grid)
  JestyGenerator.init();

  // Dossier card (user insights)
  renderDossierCard();
}

/**
 * Re-apply task card state for tier preview without re-binding events.
 */
async function reinitTaskCard(isPremium) {
  const card = document.getElementById('task-card');
  if (!card) return;
  card.classList.remove('hidden');
  card.classList.remove('task-card-locked');

  const addBtn = document.getElementById('task-add-btn');
  const viewAll = document.getElementById('task-viewall');

  // renderTaskList handles add button state (free cap / premium)
  if (addBtn) addBtn.style.display = '';
  if (viewAll) viewAll.style.display = '';
  await renderTaskList();
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
    memoryCard.addEventListener('click', () => { JestyAnalytics.track('game_started', { game: 'memory_match' }); JestyMemoryGame.show(); });
  }

  // Tab Quiz — click handler checks tier at runtime
  const tabQuizCard = document.getElementById('tab-quiz-card');
  if (tabQuizCard && !funZoneInited) {
    tabQuizCard.addEventListener('click', async () => {
      const prem = await JestyPremium.isPremium();
      if (prem) {
        if (!tabQuizInited) { await JestyTabQuiz.init(); tabQuizInited = true; }
        JestyAnalytics.track('game_started', { game: 'tab_quiz' });
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
        JestyAnalytics.track('game_started', { game: 'roast_trivia' });
        JestyRoastTrivia.show();
      } else {
        showTierOverlayPlans();
      }
    });
  }

  // Pattern Generator — free for all tiers
  const generatorCard = document.getElementById('generator-card');
  if (generatorCard && !funZoneInited) {
    generatorCard.addEventListener('click', () => JestyGenerator.show());
  }

  // Apply lock visuals
  reinitFunZoneLocks(isPremium);

  // Init memory game (always available)
  if (!funZoneInited) {
    await JestyMemoryGame.init();
    const funzoneLevelBtn = document.getElementById('funzone-level-btn');
    if (funzoneLevelBtn) funzoneLevelBtn.addEventListener('click', () => openLevelsDrawer());
  }

  funZoneInited = true;
}

// ── Memory Game in Tab State ──
async function showMemoryGameInTabState() {
  const overlay = document.getElementById('memory-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;

  const sheet = overlay.querySelector('.memory-overlay-sheet');
  if (!sheet) return;

  // Hide all game screens and their footers
  sheet.querySelectorAll('.memory-screen').forEach(s => s.classList.add('hidden'));
  const upgradeFooter = document.getElementById('memory-upgrade-footer');
  if (upgradeFooter) upgradeFooter.classList.add('hidden');
  // Also hide the header bar items except close
  const backBtn = document.getElementById('memory-back-btn');
  if (backBtn) backBtn.classList.add('hidden');
  const titleEl = document.getElementById('memory-title');
  if (titleEl) titleEl.textContent = 'Memory Match';
  const charEl = document.getElementById('memory-game-character');
  if (charEl) charEl.innerHTML = '';

  let placeholder = document.getElementById('memory-in-tab-state');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.id = 'memory-in-tab-state';
    placeholder.className = 'memory-in-tab-state';
    sheet.appendChild(placeholder);
  }

  placeholder.innerHTML = `
    <svg viewBox="-15 -10 150 140" width="80" height="75"><use href="#face-happy"/></svg>
    <p class="memory-in-tab-title">Playing in a tab</p>
    <p class="memory-in-tab-subtitle">Your game is open in a browser tab. Go crush it!</p>
    <button class="memory-in-tab-btn" id="memory-play-here-btn">Play here instead</button>
  `;

  document.getElementById('memory-play-here-btn').addEventListener('click', () => {
    // Signal handover — game tab will save state and become a new tab
    chrome.storage.local.set({ memoryGameTab: { active: false, handover: true } });

    // Listen for the transferred game state
    const onTransfer = (changes) => {
      if (changes.memoryGameTransfer && changes.memoryGameTransfer.newValue) {
        chrome.storage.onChanged.removeListener(onTransfer);
        const transfer = changes.memoryGameTransfer.newValue;
        hideMemoryGameInTabState();
        JestyMemoryGame.resumeFromTransfer(transfer);
        chrome.storage.local.remove('memoryGameTransfer');
      }
    };
    chrome.storage.onChanged.addListener(onTransfer);
  });

  // Add upgrade card at the bottom for free users
  const tier = typeof JestyPremium !== 'undefined' ? await JestyPremium.getTier() : 'free';
  let footer = document.getElementById('memory-in-tab-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.id = 'memory-in-tab-footer';
    footer.className = 'memory-in-tab-footer';
    sheet.appendChild(footer);
  }
  footer.innerHTML = '';
  if (tier === 'free' && typeof renderGameUpgradeCard === 'function') {
    await renderGameUpgradeCard(footer);
  }
  footer.classList.remove('hidden');
  placeholder.classList.remove('hidden');
}

async function hideMemoryGameInTabState() {
  const placeholder = document.getElementById('memory-in-tab-state');
  if (placeholder) placeholder.classList.add('hidden');
  const footer = document.getElementById('memory-in-tab-footer');
  if (footer) footer.classList.add('hidden');
  const upgradeFooter = document.getElementById('memory-upgrade-footer');
  if (upgradeFooter) upgradeFooter.classList.remove('hidden');

  // Show levels screen so user sees their progress
  const overlay = document.getElementById('memory-overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    JestyMemoryGame.show();
  }

  // Check if XP was earned in the tab game
  try {
    const { memoryGameXP } = await chrome.storage.local.get(['memoryGameXP']);
    if (memoryGameXP && memoryGameXP.xp && (Date.now() - memoryGameXP.timestamp < 60000)) {
      showXPToast(memoryGameXP.xp, 'game');
      await chrome.storage.local.remove('memoryGameXP');
      await renderLevelBadge();
      await loadStats();
    }
  } catch (e) {}
}


/* ──────────────────────────────────────────────
   PLANS UPGRADE SECTION
   ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
   BOTTOM CROWD BACKGROUND
   ────────────────────────────────────────────── */

async function renderDossierCard() {
  const container = document.getElementById('dossier-card');
  if (!container) return;

  const data = await JestyStorage.getJestyData();
  if (!data) return;

  const profile = data.profile || {};
  const traits = profile.traits || {};
  const roasts = data.roasts || [];
  const categories = (profile.top_categories || []).filter(c => {
    const n = (c.name || c.category || '').toLowerCase();
    return n !== 'other' && n !== 'others';
  }).slice(0, 4);
  const totalRoasts = profile.total_roasts || 0;
  const userName = profile.user_name || 'Jesty';

  // User color
  const userColor = currentColor.body || '#A78BFA';

  // Unique domains visited
  const totalTabsSeen = (profile.unique_domains || []).length;

  // Dominant trait
  const traitLabels = [
    { key: 'procrastinator_score', label: 'a procrastinator' },
    { key: 'night_owl_score', label: 'a night owl' },
    { key: 'tab_hoarder_score', label: 'a tab hoarder' },
    { key: 'impulse_shopper_score', label: 'an impulse shopper' }
  ];
  const topTrait = traitLabels.reduce((best, t) => {
    const val = traits[t.key] || 0;
    return val > (best.val || 0) ? { ...t, val } : best;
  }, { label: 'under investigation', val: 0 });

  // Top mood
  const moodCounts = {};
  roasts.forEach(r => { if (r.mood) moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
  const topMood = sortedMoods.length ? sortedMoods[0][0] : 'smug';

  // Punchline
  const punchline = generateDossierPunchline(categories, totalRoasts, topTrait, traits);

  // Category bars
  const maxCatCount = categories.length ? categories[0].count || 1 : 1;
  const catBarsHtml = categories.map(cat => {
    const pct = Math.round((cat.count || 0) / maxCatCount * 100);
    const name = formatCategoryName(cat.name || cat.category || 'Unknown');
    return `<div class="dossier-bar-row">
      <span class="dossier-bar-label">${escapeHtml(name)}</span>
      <div class="dossier-bar-track"><div class="dossier-bar-fill" style="width:${pct}%;background:${userColor}"></div></div>
      <span class="dossier-bar-count">${cat.count}</span>
    </div>`;
  }).join('');

  // Face SVG for badge (island-style clipped)
  const faceSymbol = document.getElementById(`face-${topMood}`);
  const faceVb = faceSymbol ? (faceSymbol.getAttribute('viewBox') || '-15 -10 150 140') : '-15 -10 150 140';
  const faceSvg = faceSymbol ? faceSymbol.innerHTML : '';

  // Premium check
  const isPremium = typeof JestyPremium !== 'undefined' && await JestyPremium.isPremium();

  // Build insights
  const insights = [];

  // Peak browsing hour
  const hourCounts = {};
  roasts.forEach(r => {
    if (r.timestamp) {
      const h = new Date(r.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });
  const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  if (peakHourEntry) {
    const h = parseInt(peakHourEntry[0]);
    const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
    insights.push({ value: label, label: 'Peak hour' });
  }

  // Top interest
  const interests = profile.interests || [];
  if (interests.length) {
    const topInterest = interests.reduce((a, b) => (b.count || 0) > (a.count || 0) ? b : a, interests[0]);
    if (topInterest.keyword) {
      insights.push({ value: topInterest.keyword.charAt(0).toUpperCase() + topInterest.keyword.slice(1), label: 'Top interest' });
    }
  }

  // Peak tabs
  const peakTabs = (profile.patterns || {}).peak_tabs || 0;
  if (peakTabs > 0) insights.push({ value: String(peakTabs), label: 'Peak tabs' });

  // Total focus time
  const focusSessions = data.focus_sessions || [];
  if (focusSessions.length) {
    const totalFocusMins = Math.round(focusSessions.reduce((s, f) => s + (f.durationSeconds || 0), 0) / 60);
    insights.push({ value: totalFocusMins >= 60 ? `${Math.round(totalFocusMins / 60)}h` : `${totalFocusMins}m`, label: 'Focus time' });
  }

  // Longest streak
  const longestStreak = (data.milestones?.streaks?.longest_daily_streak) || 0;
  if (longestStreak > 0) insights.push({ value: `${longestStreak}d`, label: 'Best streak' });

  // Member since
  const firstRoast = data.milestones?.roasts?.first_roast;
  if (firstRoast) {
    const d = new Date(firstRoast);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    insights.push({ value: `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, label: 'Since' });
  }

  const insightsHtml = isPremium && insights.length ? `<div class="dossier-insights-grid">${insights.map(i =>
    `<div class="dossier-insight"><span class="dossier-insight-label">${escapeHtml(i.label)}</span><span class="dossier-insight-value">${escapeHtml(i.value)}</span></div>`
  ).join('')}</div>` : '';

  container.style.setProperty('--jesty-user-color', userColor);
  container.innerHTML = `
    <div class="dossier-front">
      <div class="dossier-stats">
        <div class="dossier-stat dossier-stat-roasts">
          <span class="dossier-stat-number">${totalRoasts}</span>
          <span class="dossier-stat-label">Roasts</span>
        </div>
        <div class="dossier-stat">
          <span class="dossier-stat-number dossier-stat-dark">${totalTabsSeen}</span>
          <span class="dossier-stat-label">Tabs seen</span>
        </div>
      </div>
      <div class="dossier-divider"></div>
      <div class="dossier-verdict" id="dossier-verdict">
        ${punchline ? `<span class="dossier-verdict-text">${escapeHtml(punchline)}</span>` : ''}
      </div>
      ${categories.length ? `
      <div class="dossier-bars-wrap${isPremium ? '' : ' locked'}">
        <div class="dossier-bars">
          ${catBarsHtml}
        </div>
        ${isPremium ? '' : '<div class="dossier-bars-overlay"></div>'}
      </div>` : ''}
      <div class="dossier-card-btn-wrap">
        ${isPremium ? `<button class="task-add-btn" id="dossier-open-card">View card</button>` : `<button class="task-add-btn" data-upgrade="true" id="dossier-open-card">Plead Guilty for full breakdown</button>`}
      </div>
      ${insightsHtml}
    </div>
  `;

  // Wire up card button
  const cardBtn = document.getElementById('dossier-open-card');
  if (cardBtn) {
    cardBtn.addEventListener('click', () => {
      if (isPremium) {
        JestyAnalytics.track('card_viewed');
        chrome.tabs.create({ url: chrome.runtime.getURL('card.html') });
      } else {
        showTierOverlayGuilty();
      }
    });
  }

  // Render crowd background
  renderDossierCrowd();
}

function renderDossierCrowd() {
  let crowd = document.getElementById('dossier-crowd');
  if (!crowd) return;

  const expressions = [
    'smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead',
    'thinking', 'happy', 'impressed', 'manic', 'petty', 'chaotic', 'dramatic', 'tender'
  ];
  const colorKeys = ['lime', 'pink', 'sky', 'purple', 'mint', 'peach'];

  // Mini crowd: 3 rows — 3, 4, 3
  const size = 52;
  const rows = [
    { count: 3 },
    { count: 4 },
    { count: 3 },
  ];

  // Shuffle all 6 colors + 4 repeats for 10 faces
  const shuffledColors = [...colorKeys].sort(() => Math.random() - 0.5);
  while (shuffledColors.length < 10) shuffledColors.push(colorKeys[Math.floor(Math.random() * colorKeys.length)]);
  let colorIdx = 0;

  let faceIdx = 0;
  let html = '';

  for (const row of rows) {
    let rowHtml = '';
    for (let i = 0; i < row.count; i++) {
      const expr = expressions[Math.floor(Math.random() * expressions.length)];
      const colorKey = shuffledColors[colorIdx++ % shuffledColors.length];
      const symbol = document.getElementById(`face-${expr}`);
      if (!symbol) continue;

      const vb = symbol.getAttribute('viewBox') || '-15 -10 150 140';
      let content = symbol.innerHTML;
      const uid = `dc${faceIdx++}`;
      content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${uid}"`);
      content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${uid})`);

      const target = SLOT_COLORS[colorKey];
      const from = currentColor;
      for (const key of ['body', 'limb', 'shadow', 'highlight']) {
        if (from[key] && target[key]) {
          content = content.replace(new RegExp(from[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), target[key]);
        }
      }

      rowHtml += `<svg viewBox="${vb}" width="${size}" height="${Math.round(size * 0.92)}">${content}</svg>`;
    }
    html += `<div class="dossier-crowd-row">${rowHtml}</div>`;
  }

  crowd.innerHTML = html;

  // Scatter effect: characters run away from cursor — replace element to clear old listeners
  const freshCrowd = crowd.cloneNode(true);
  crowd.parentNode.replaceChild(freshCrowd, crowd);
  crowd = freshCrowd;
  const faces = crowd.querySelectorAll('svg');
  const maxDist = 120;
  const maxPush = 25;
  let crowdRaf = null;
  let lastMx = 0, lastMy = 0;

  // Cache original positions (relative to crowd)
  const origins = [];
  const cacheOrigins = () => {
    const rect = crowd.getBoundingClientRect();
    origins.length = 0;
    faces.forEach(face => {
      const fRect = face.getBoundingClientRect();
      origins.push({
        x: fRect.left + fRect.width / 2 - rect.left,
        y: fRect.top + fRect.height / 2 - rect.top
      });
    });
  };

  crowd.style.pointerEvents = 'auto';

  crowd.addEventListener('mouseenter', () => {
    cacheOrigins();
    faces.forEach(face => { face.style.transition = 'transform 0.15s ease-out'; });
  });

  crowd.addEventListener('mousemove', (e) => {
    const rect = crowd.getBoundingClientRect();
    lastMx = e.clientX - rect.left;
    lastMy = e.clientY - rect.top;

    if (!crowdRaf) {
      crowdRaf = requestAnimationFrame(() => {
        faces.forEach((face, i) => {
          const o = origins[i];
          if (!o) return;
          const dx = o.x - lastMx;
          const dy = o.y - lastMy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist && dist > 0) {
            const strength = (1 - dist / maxDist) * maxPush;
            const angle = Math.atan2(dy, dx);
            face.style.transform = `translate(${Math.cos(angle) * strength}px, ${Math.sin(angle) * strength}px)`;
          } else {
            face.style.transform = '';
          }
        });
        crowdRaf = null;
      });
    }
  });

  crowd.addEventListener('mouseleave', () => {
    if (crowdRaf) { cancelAnimationFrame(crowdRaf); crowdRaf = null; }
    faces.forEach(face => {
      face.style.transition = 'transform 0.4s ease-out';
      face.style.transform = '';
    });
  });
}

function formatCategoryName(raw) {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function generateDossierPunchline(categories, totalRoasts, topTrait, traits) {
  if (!categories.length && totalRoasts < 5) return null;

  const top = categories[0];
  const second = categories[1];
  const topName = top ? formatCategoryName(top.name || top.category || '') : '';
  const secondName = second ? formatCategoryName(second.name || second.category || '') : '';

  const lines = [];

  // Category-based roasts
  if (top && second) {
    const topLow = topName.toLowerCase();
    const secLow = secondName.toLowerCase();

    if (topLow.includes('streaming') && secLow.includes('work'))
      lines.push(`${topName} on top, ${secondName} second. Your priorities are showing.`);
    else if (topLow.includes('work') && secLow.includes('streaming'))
      lines.push(`${topName} leads but ${secondName} is right behind. "Productive" is a stretch.`);
    else if (topLow.includes('social'))
      lines.push(`${top.count} social media tabs seen. That's not networking, that's a habit.`);
    else if (topLow.includes('shopping'))
      lines.push(`${top.count} shopping tabs. Your wallet is having a worse day than you.`);
    else
      lines.push(`${topName} dominates. ${secondName} follows. Jesty sees all.`);
  } else if (top) {
    lines.push(`${top.count} tabs of ${topName}. At this point it's a lifestyle.`);
  }

  // Trait-based roasts
  if (topTrait.val > 0.7) {
    if (topTrait.key === 'tab_hoarder_score')
      lines.push(`${Math.round(topTrait.val * 100)}% tab hoarder. Your browser filed a restraining order.`);
    else if (topTrait.key === 'night_owl_score')
      lines.push(`Night owl score: ${Math.round(topTrait.val * 100)}%. Sleep is just a suggestion you keep ignoring.`);
    else if (topTrait.key === 'procrastinator_score')
      lines.push(`${Math.round(topTrait.val * 100)}% procrastinator. You'll deal with it later. Like everything else.`);
    else if (topTrait.key === 'impulse_shopper_score')
      lines.push(`Impulse shopper at ${Math.round(topTrait.val * 100)}%. Your cart has more items than your to-do list.`);
  }

  // Roast count roasts
  if (totalRoasts > 200)
    lines.push(`${totalRoasts} roasts and still coming back. That's not resilience, that's Stockholm syndrome.`);
  else if (totalRoasts > 50)
    lines.push(`${totalRoasts} roasts in. At this point Jesty knows you better than your therapist.`);

  // Pick the best one (prefer category-based for variety)
  return lines.length ? lines[0] : null;
}

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
      { name: 'Guilty', price: PRICE.premiumFull, desc: 'Unlimited roasts, tasks & all accessories', action: 'checkout', tierKey: 'premium' },
      { name: 'Sentenced', price: PRICE.pro, desc: 'Launching soon', action: 'disabled', tierKey: 'pro' }
    );
  } else if (tier === 'premium') {
    upgrades.push(
      { name: 'Sentenced', price: PRICE.pro, desc: 'Launching soon', action: 'disabled', tierKey: 'pro' }
    );
  }

  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    for (const up of upgrades) {
      const combo = TIER_COMBOS[up.tierKey];
      const upColor = SLOT_COLORS[combo.color];
      const card = document.createElement('div');
      card.className = 'plans-upgrade-card';
      card.innerHTML = `
        <div class="plans-upgrade-icon">
          ${buildTierComboSvg(combo, 36, 34)}
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
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-promo-${i}"`);
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

async function seedDefaultTask() {
  const { jestyTaskSeeded } = await chrome.storage.local.get(['jestyTaskSeeded']);
  if (jestyTaskSeeded) return;

  await chrome.storage.local.set({ jestyTaskSeeded: true });

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const data = jesty_data || {};
  const tasks = data.user_tasks || [];

  if (tasks.length > 0) return;

  const onboardingTask1 = {
    id: 'user_onboarding_1',
    title: 'Try managing tasks with Jesty',
    notes: [
      { text: 'Tap a task to open its details', done: false },
      { text: 'Add notes to break it into steps', done: false },
      { text: 'Check items off as you go', done: false }
    ],
    completed: false,
    completedAt: null,
    createdAt: Date.now()
  };

  const onboardingTask2 = {
    id: 'user_onboarding_2',
    title: 'Organise your browser tabs',
    notes: [
      { text: 'Close tabs you no longer need', done: false },
      { text: 'Bookmark pages you want to keep', done: false }
    ],
    completed: false,
    completedAt: null,
    createdAt: Date.now() + 1
  };

  data.user_tasks = [onboardingTask1, onboardingTask2];
  await chrome.storage.local.set({ jesty_data: data });
}

async function initProductivityTasks(isPremium) {
  const card = document.getElementById('task-card');
  if (!card) return;

  card.classList.remove('hidden');

  // Seed default task for all users (once)
  await seedDefaultTask();

  // Apply visual state
  await reinitTaskCard(isPremium);

  if (!taskSystemInited) {
    // Bind event listeners once — they check tier at runtime
    // (No locked card overlay — free users can interact with their single task)

    const viewAll = document.getElementById('task-viewall');
    if (viewAll) viewAll.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDrawer();
    });

    const addBtn = document.getElementById('task-add-btn');
    if (addBtn) addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (addBtn.dataset.upgrade) {
        showTierOverlayPlans();
      } else {
        createAndOpenTask();
      }
    });

    initTaskDrawers();
    taskSystemInited = true;
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

  const isPremium = await JestyPremium.isPremium();
  const { currentTask } = await chrome.storage.local.get(['currentTask']);
  const userTasks = await loadUserTasks();

  // Build combined list: all user tasks (keep original order)
  const allTasks = userTasks.map(t => ({
    id: t.id, title: t.title, type: 'user', notes: t.notes, completed: !!t.completed
  }));

  // Show max 3 in the card widget
  const display = allTasks.slice(0, 3);

  const addBtn = document.getElementById('task-add-btn');
  const viewAll = document.getElementById('task-viewall');

  // Update total count badge
  const countEl = document.getElementById('task-count');
  if (countEl) countEl.textContent = allTasks.length > 0 ? allTasks.length : '';

  // Free tier: cap at 3 tasks — update add button accordingly
  if (!isPremium) {
    if (addBtn) {
      if (userTasks.length >= 3) {
        addBtn.textContent = 'Plead Guilty to add more';
        addBtn.dataset.upgrade = 'true';
      } else {
        addBtn.textContent = '+ Add task';
        delete addBtn.dataset.upgrade;
      }
    }
  } else {
    if (addBtn) {
      addBtn.textContent = '+ Add task';
      delete addBtn.dataset.upgrade;
    }
  }

  // View all always visible
  if (viewAll) viewAll.style.display = '';

  if (display.length === 0) {
    if (addBtn) addBtn.style.display = 'none';
    listEl.innerHTML = `
      <div class="task-empty-state">
        <p class="task-empty-text">No tasks yet. Add one to get started.</p>
        <button class="task-add-btn" id="task-empty-add-btn">+ Add task</button>
      </div>
    `;
    const emptyAdd = document.getElementById('task-empty-add-btn');
    if (emptyAdd) emptyAdd.addEventListener('click', () => createAndOpenTask());
    return;
  }

  if (addBtn) addBtn.style.display = '';

  const trashSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

  listEl.innerHTML = display.map(t => {
    let notesLabel = '';
    if (t.completed) {
      notesLabel = '<span class="task-item-notes done">Done</span>';
    } else {
      let noteCount = 0;
      if (Array.isArray(t.notes)) noteCount = t.notes.length;
      else if (typeof t.notes === 'string' && t.notes.trim()) noteCount = 1;
      if (noteCount > 0) notesLabel = `<span class="task-item-notes">${noteCount} note${noteCount !== 1 ? 's' : ''}</span>`;
    }
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

    // Click check to toggle complete
    const check = el.querySelector('.task-item-check');
    if (check) {
      check.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (type === 'user') {
          const tasks = await loadUserTasks();
          const task = tasks.find(t => t.id === id);
          if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? Date.now() : null;
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
  const userTasks = await loadUserTasks();

  content.innerHTML = '';

  const isPremDrawer = await JestyPremium.isPremium();

  if (userTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'task-empty-state task-empty-state-drawer';
    empty.innerHTML = `
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

  userTasks.forEach(t => {
    const el = document.createElement('div');
    el.className = `task-item${t.completed ? ' completed' : ''}`;
    el.dataset.id = t.id;
    el.dataset.type = 'user';
    let notesCount = 0;
    if (Array.isArray(t.notes)) notesCount = t.notes.length;
    else if (typeof t.notes === 'string' && t.notes.trim()) notesCount = 1;
    const notesText = t.completed ? 'Done' : `${notesCount} note${notesCount !== 1 ? 's' : ''}`;
    const notesLabel = `<span class="task-item-notes${t.completed ? ' done' : ''}">${notesText}</span>`;
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

  // Add task button (or upgrade prompt if at cap)
  const addBtn = document.createElement('button');
  addBtn.className = 'task-drawer-add-btn';
  const atFreeCap = !isPremDrawer && userTasks.length >= 3;
  if (atFreeCap) {
    addBtn.textContent = 'Plead Guilty to add more';
    addBtn.addEventListener('click', () => {
      closeTaskDrawer();
      showTierOverlayPlans();
    });
  } else {
    addBtn.textContent = '+ Add task';
    addBtn.addEventListener('click', () => {
      closeTaskDrawer();
      createAndOpenTask();
    });
  }
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

    const del = document.createElement('button');
    del.className = 'task-detail-note-delete';
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    del.addEventListener('click', async () => {
      const noteIndex = task.notes.indexOf(note);
      if (noteIndex === -1) return;
      task.notes.splice(noteIndex, 1);
      div.classList.add('removing');
      setTimeout(async () => {
        renderNoteItems(task);
        await saveUserTask(task);
        renderTaskList();
      }, 350);
    });

    div.appendChild(check);
    div.appendChild(textEl);
    div.appendChild(del);
    list.appendChild(div);
  });

  // Append inline input row after the last note
  const row = document.createElement('div');
  row.className = 'task-detail-note-add';

  const addCheck = document.createElement('div');
  addCheck.className = 'task-detail-note-check';
  row.appendChild(addCheck);

  const input = document.createElement('textarea');
  input.className = 'task-detail-note-input';
  input.placeholder = 'Add a note...';
  input.rows = 1;

  const autoResize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  };

  input.addEventListener('input', () => {
    row.classList.toggle('typing', input.value.length > 0);
    autoResize();
  });

  input.addEventListener('paste', () => {
    requestAnimationFrame(autoResize);
  });

  input.onkeydown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (taskDetailDismissed) return;
      const text = input.value.trim();
      if (!text) return;
      task.notes.push({ text, done: false });
      renderNoteItems(task);
      await saveUserTask(task);
      renderTaskList();
      // Scroll notes list to bottom
      list.scrollTop = list.scrollHeight;
      const newInput = list.querySelector('.task-detail-note-input');
      if (newInput) newInput.focus();
    }
  };

  row.appendChild(input);
  list.appendChild(row);

  // Initial size to fit placeholder
  requestAnimationFrame(autoResize);

  // Update body cursor based on whether notes exist
  const detailBody = list.closest('.task-detail-body');
  if (detailBody) detailBody.style.cursor = (!task.notes || task.notes.length === 0) ? 'text' : '';
}

function isTaskEmpty(task) {
  const hasTitle = task.title && task.title.trim();
  const hasNotes = Array.isArray(task.notes) && task.notes.length > 0;
  return !hasTitle && !hasNotes;
}

let taskDetailCurrentTask = null;

function updateHomeToggleBtn(btn, task) {
  const onHome = !task.hidden_from_newtab;
  btn.textContent = onHome ? 'Remove from home page' : 'Add to home page';
  btn.classList.toggle('home-remove', onHome);
}

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

  // Make entire body area clickable to focus note input when no notes exist
  const detailBody = drawer.querySelector('.task-detail-body');
  if (detailBody) {
    detailBody.onclick = (e) => {
      // Only if clicking empty space (not on an existing note or input)
      if (e.target === detailBody || e.target.classList.contains('task-detail-notes-list')) {
        const noteInput = detailBody.querySelector('.task-detail-note-input');
        if (noteInput) noteInput.focus();
      }
    };
    detailBody.style.cursor = (!task.notes || task.notes.length === 0) ? 'text' : '';
  }

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

  // Home page toggle button (replaces Done)
  if (doneBtn) {
    updateHomeToggleBtn(doneBtn, task);
    doneBtn.onclick = async () => {
      task.hidden_from_newtab = !task.hidden_from_newtab;
      if (!isTaskEmpty(task)) {
        task.title = task.title || 'Untitled';
        delete task.draft;
        await saveUserTask(task);
      }
      updateHomeToggleBtn(doneBtn, task);
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

  // Clean up empty tasks on close, publish drafts with content
  if (taskDetailCurrentTask && !taskDetailDismissed) {
    if (isTaskEmpty(taskDetailCurrentTask)) {
      await deleteUserTask(taskDetailCurrentTask.id);
      renderTaskList();
    } else if (taskDetailCurrentTask.draft) {
      delete taskDetailCurrentTask.draft;
      await saveUserTask(taskDetailCurrentTask);
      renderTaskList();
    }
  }
  taskDetailCurrentTask = null;
}

async function createAndOpenTask() {
  // Free tier: cap at 3 tasks
  const isPrem = await JestyPremium.isPremium();
  if (!isPrem) {
    const data = await JestyStorage.getJestyData();
    if ((data.user_tasks || []).length >= 3) {
      showTierOverlayPlans();
      return;
    }
  }
  const newTask = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: '',
    notes: [],
    completed: false,
    hidden_from_newtab: true,
    draft: true,
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
    showXPToast(template.xp, 'task');

    // Show completion
    showComment(`Task complete! +${template.xp} XP`);
    JestyAnimator.setExpression('happy', 5000);
    if (JestyAnimator.react) JestyAnimator.react('celebrate');

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
  2: 'Bandana',
  3: 'Heart Shades',
  4: 'Chef Hat',
  5: '3D Glasses',
  6: 'Monocle',
  7: 'Propeller Hat',
  8: 'Star Glasses',
  9: 'Crown',
  10: 'Bow Tie',
  11: 'Detective Hat',
  12: 'Headband',
  13: 'Viking Helmet',
  14: 'Top Hat',
  15: 'Pirate Hat',
  16: 'Halo'
};

const LEVEL_UNLOCK_IDS = {
  2: 'bandana',
  3: 'heart-shades',
  4: 'chef-hat',
  5: '3d-glasses',
  6: 'monocle',
  7: 'propeller-hat',
  8: 'star-glasses',
  9: 'crown',
  10: 'bow-tie',
  11: 'detective-hat',
  12: 'headband',
  13: 'viking-helmet',
  14: 'top-hat',
  15: 'pirate-hat',
  16: 'halo'
};

const XP_SOURCES = [
  { label: 'Tab Cleanup', desc: 'Close tabs to earn 5-15 XP each. Hoarders get more.', xp: '5-15', expression: 'happy', color: 'mint' },
  { label: 'Milestones', desc: 'Hit roast milestones for big XP drops.', xp: '50-1000', expression: 'impressed', color: 'purple' },
  { label: 'Streaks', desc: 'Show up daily. Consistency pays.', xp: '30-1500', expression: 'smug', color: 'peach' },
  { label: 'Memory Match', desc: 'Pair the faces, earn the points.', xp: '10-30', expression: 'manic', color: 'pink' },
  { label: 'Tab Quiz', desc: 'Prove you know your own tabs.', xp: '10-15', expression: 'suspicious', color: 'sky' },
  { label: 'Roast Trivia', desc: 'Remember what I said about you?', xp: '10-15', expression: 'eyeroll', color: 'lime' },
];

const XP_HERO_QUIPS = [
  'XP doesn\'t grow on trees. It grows on closed tabs.',
  'Every point earned is a point you didn\'t deserve.',
  'You want XP? Here\'s how you get it.',
  'The grind is real. The rewards are cosmetic.',
  'Work for it. Or just close a lot of tabs.',
];

const XP_COLOR_MAP = {
  purple: { body: '#A78BFA', limb: '#7C5FD6', shadow: '#5B3FB5', highlight: '#D4C8FD' },
  pink: { body: '#FF8FA3', limb: '#E0637A', shadow: '#B84D60', highlight: '#FFD4DC' },
  sky: { body: '#87CEEB', limb: '#5BAED4', shadow: '#3A8CB5', highlight: '#C8E8F5' },
  mint: { body: '#34D399', limb: '#1EB57F', shadow: '#15875F', highlight: '#A7F0D4' },
  peach: { body: '#FDBA74', limb: '#E09550', shadow: '#B87638', highlight: '#FEE0C0' },
  lime: { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' },
};

async function openXPDrawer() {
  const drawer = document.getElementById('xp-drawer');
  const hero = document.getElementById('xp-drawer-hero');
  const grid = document.getElementById('xp-sources-grid');
  if (!drawer || !hero || !grid) return;

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const totalXP = jesty_data?.progression?.total_xp || 0;
  const level = jesty_data?.progression?.level || 1;

  const quip = XP_HERO_QUIPS[Math.floor(Math.random() * XP_HERO_QUIPS.length)];
  hero.innerHTML = `
    <div class="levels-hero-level">
      <span class="levels-hero-lv">TOTAL XP</span>
      <span class="levels-hero-num" data-num="${totalXP.toLocaleString()}">${totalXP.toLocaleString()}</span>
    </div>
    <div class="levels-hero-label">Level ${level}</div>
    <div class="levels-hero-quip">${quip}</div>
  `;

  // Get current SVG source color for recoloring
  const svgDefs = document.querySelector('svg[style*="display: none"] defs, svg[style*="display:none"] defs');
  const sourceColor = currentColor || { body: '#EBF34F', limb: '#C8D132', shadow: '#8A9618', highlight: '#F8FBCE' };

  grid.innerHTML = XP_SOURCES.map(s => {
    return `<div class="xp-source-card">
      <div class="xp-source-face" data-expression="${s.expression}" data-color="${s.color}">
        <svg viewBox="-15 -10 150 140" class="xp-source-svg"><use href="#face-${s.expression}"/></svg>
      </div>
      <div class="xp-source-info">
        <span class="xp-source-label">${s.label}</span>
        <span class="xp-source-desc">${s.desc}</span>
      </div>
      <div class="xp-source-pill">${s.xp} XP</div>
    </div>`;
  }).join('');

  // Recolor each face to its assigned color
  grid.querySelectorAll('.xp-source-face').forEach(face => {
    const colorName = face.dataset.color;
    const targetColor = XP_COLOR_MAP[colorName];
    if (targetColor) {
      const svg = face.querySelector('svg');
      if (svg && typeof recolorSVGInline === 'function') {
        recolorSVGInline(svg, sourceColor, targetColor);
      }
    }
  });

  drawer.classList.add('visible');

  document.getElementById('xp-drawer-close').onclick = () => drawer.classList.remove('visible');
  document.getElementById('xp-drawer-backdrop').onclick = () => drawer.classList.remove('visible');
  document.getElementById('xp-play-btn').onclick = () => { drawer.classList.remove('visible'); JestyMemoryGame.show(); };
}

/**
 * Recolor an inline SVG by cloning symbol content and replacing colors.
 */
function recolorSVGInline(svg, fromColor, toColor) {
  const useEl = svg.querySelector('use');
  if (!useEl) return;
  const href = useEl.getAttribute('href');
  const symbolId = href ? href.replace('#', '') : null;
  if (!symbolId) return;

  const symbol = document.getElementById(symbolId);
  if (!symbol) return;

  // Replace <use> with cloned symbol children
  svg.innerHTML = '';
  Array.from(symbol.childNodes).forEach(n => svg.appendChild(n.cloneNode(true)));

  // Recolor
  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[fromColor[key].toUpperCase()] = toColor[key];
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
  const levelsPlayBtn = document.getElementById('levels-play-btn');
  if (levelsPlayBtn) levelsPlayBtn.addEventListener('click', () => { closeLevelsDrawer(); JestyMemoryGame.show(); });

  await renderLevelBadge();
}

const LEVEL_QUIPS = {
  2: 'A bandana? Are you browsing or starting a revolution?',
  3: 'Heart shades? Love is blind, and so is your tab management.',
  4: 'Chef hat unlocked. Finally cooking something besides tabs.',
  5: '3D glasses for someone living in a 2D reality. The irony.',
  6: 'A monocle to inspect your life choices in high definition.',
  7: 'A propeller hat AND a growth spurt? Don\'t let it go to your head.',
  8: 'Star glasses because you\'re the star of your own delusion.',
  9: 'A crown for the reigning champion of procrastination.',
  10: 'A bow tie. Formally savage. Informally a mess.',
  11: 'Detective hat. Now investigate where your day went.',
  12: 'A headband for all that mental gymnastics you do daily.',
  13: 'A viking helmet. Pillaging productivity like a true warrior.',
  14: 'Sir Roasts-a-Lot has entered the building. Finally.',
  15: 'A pirate hat. Navigating the seven tabs of the sea.',
  16: 'A halo? You? THAT is the funniest thing I\'ve ever seen.',
};

const HERO_STATUS_QUIPS = [
  'Adorable. Pathetic, but adorable.',
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
      <div class="levels-hero-level"><span class="levels-hero-lv">LEVEL</span><span class="levels-hero-num" data-num="${prog.level}">${prog.level}</span></div>
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

/* ──────────────────────────────────────────────
   MILESTONES DRAWER
   ────────────────────────────────────────────── */

const MILESTONE_DEFS = [
  { count: 25, key: 'roast_25', xp: 50, icon: '25', label: '25 Roasts', quip: 'You actually came back.' },
  { count: 60, key: 'roast_60', xp: 100, icon: '60', label: '60 Roasts', quip: 'This is becoming a habit.' },
  { count: 100, key: 'roast_100', xp: 200, icon: '100', label: '100 Roasts', quip: 'Triple digits of poor choices.' },
  { count: 500, key: 'roast_500', xp: 500, icon: '500', label: '500 Roasts', quip: 'At this point, I owe you rent.' },
  { count: 1000, key: 'roast_1000', xp: 1000, icon: '1K', label: '1000 Roasts', quip: 'A legend. A fool. Both.' }
];

const MILESTONE_HERO_QUIPS = [
  'Every roast is a badge of dishonor.',
  'You collect roasts like trophies.',
  'Most people stop. You accelerated.',
  'Your dedication is alarming.',
  'A monument to poor decisions.'
];

async function openMilestoneDrawer() {
  const drawer = document.getElementById('milestone-drawer');
  const hero = document.getElementById('milestone-drawer-hero');
  const timeline = document.getElementById('milestone-timeline');
  if (!drawer || !hero || !timeline) return;

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const totalRoasts = jesty_data?.profile?.total_roasts || 0;
  const milestoneData = jesty_data?.milestones?.roasts || {};

  // Hero
  const quip = MILESTONE_HERO_QUIPS[Math.floor(Math.random() * MILESTONE_HERO_QUIPS.length)];
  hero.innerHTML = `
    <div class="levels-hero-level">
      <span class="levels-hero-lv">ROASTS</span>
      <span class="levels-hero-num" data-num="${totalRoasts}">${totalRoasts}</span>
    </div>
    <div class="levels-hero-quip">${quip}</div>
  `;

  // Timeline
  timeline.innerHTML = '';
  MILESTONE_DEFS.forEach(m => {
    const reached = !!milestoneData[m.key];
    const isNext = !reached && MILESTONE_DEFS.filter(d => !!milestoneData[d.key]).length === MILESTONE_DEFS.indexOf(m);

    const card = document.createElement('div');
    card.className = `level-card${reached ? ' reached' : ''}${isNext ? ' next-up' : ''}`;
    card.innerHTML = `
      <div class="milestone-card-icon">${m.icon}</div>
      <div class="level-card-info">
        <div class="level-card-top">
          <span class="level-card-lvl">${m.label}</span>
          ${isNext ? '<span class="level-card-next-chip">Next</span>' : ''}
        </div>
        <div class="level-card-quip">${m.quip}</div>
        <div class="milestone-card-xp">${reached ? 'Claimed' : `+${m.xp} XP`}</div>
      </div>
    `;
    timeline.appendChild(card);
  });

  // Show
  drawer.classList.add('visible');

  // Close handlers
  document.getElementById('milestone-drawer-close').onclick = () => drawer.classList.remove('visible');
  document.getElementById('milestone-drawer-backdrop').onclick = () => drawer.classList.remove('visible');
  document.getElementById('milestone-play-btn').onclick = () => { drawer.classList.remove('visible'); JestyMemoryGame.show(); };
}

/* ──────────────────────────────────────────────
   STREAKS DRAWER
   ────────────────────────────────────────────── */

const STREAK_DEFS = [
  { streak: 3, xp: 30, icon: '3', label: '3-Day Streak', quip: 'Three days in a row. Cute.' },
  { streak: 7, xp: 75, icon: '7', label: '7-Day Streak', quip: 'A full week of this. Committed.' },
  { streak: 14, xp: 150, icon: '14', label: '14-Day Streak', quip: 'Two weeks. This is a relationship now.' },
  { streak: 30, xp: 350, icon: '30', label: '30-Day Streak', quip: 'A month. Honestly impressive.' },
  { streak: 60, xp: 750, icon: '60', label: '60-Day Streak', quip: 'Two months. You need an intervention.' },
  { streak: 100, xp: 1500, icon: '100', label: '100-Day Streak', quip: 'A hundred days. I live here now.' }
];

// Pre-defined character compositions for each streak tier
// Each entry: { color, expression } — deterministic so they look the same every time
const STREAK_COMPOSITIONS = {
  3: [
    { color: 'purple', expression: 'smug' },
    { color: 'pink', expression: 'happy' },
    { color: 'sky', expression: 'impressed' }
  ],
  7: [
    { color: 'purple', expression: 'smug' },
    { color: 'pink', expression: 'happy' },
    { color: 'sky', expression: 'impressed' },
    { color: 'mint', expression: 'manic' },
    { color: 'peach', expression: 'eyeroll' },
    { color: 'lime', expression: 'suspicious' },
    { color: 'purple', expression: 'yikes' }
  ],
  14: [
    { color: 'purple', expression: 'smug' },
    { color: 'pink', expression: 'happy' },
    { color: 'sky', expression: 'impressed' },
    { color: 'mint', expression: 'manic' },
    { color: 'peach', expression: 'eyeroll' },
    { color: 'lime', expression: 'suspicious' },
    { color: 'purple', expression: 'yikes' },
    { color: 'pink', expression: 'melting' },
    { color: 'sky', expression: 'petty' },
    { color: 'mint', expression: 'dramatic' },
    { color: 'peach', expression: 'chaotic' },
    { color: 'lime', expression: 'dead' },
    { color: 'purple', expression: 'disappointed' },
    { color: 'pink', expression: 'tender' }
  ],
  30: [
    { color: 'purple', expression: 'smug' },
    { color: 'pink', expression: 'happy' },
    { color: 'sky', expression: 'impressed' },
    { color: 'mint', expression: 'manic' },
    { color: 'peach', expression: 'eyeroll' },
    { color: 'lime', expression: 'suspicious' },
    { color: 'purple', expression: 'yikes' },
    { color: 'pink', expression: 'melting' },
    { color: 'sky', expression: 'petty' },
    { color: 'mint', expression: 'dramatic' },
    { color: 'peach', expression: 'chaotic' },
    { color: 'lime', expression: 'dead' },
    { color: 'purple', expression: 'disappointed' },
    { color: 'pink', expression: 'tender' },
    { color: 'sky', expression: 'smug' },
    { color: 'mint', expression: 'happy' },
    { color: 'peach', expression: 'impressed' },
    { color: 'lime', expression: 'manic' },
    { color: 'purple', expression: 'melting' },
    { color: 'pink', expression: 'eyeroll' },
    { color: 'sky', expression: 'suspicious' },
    { color: 'mint', expression: 'yikes' },
    { color: 'peach', expression: 'petty' },
    { color: 'lime', expression: 'dramatic' },
    { color: 'purple', expression: 'chaotic' },
    { color: 'pink', expression: 'dead' },
    { color: 'sky', expression: 'disappointed' },
    { color: 'mint', expression: 'tender' },
    { color: 'peach', expression: 'smug' },
    { color: 'lime', expression: 'happy' }
  ],
  60: null,  // reuse 30
  100: null  // reuse 30
};

/**
 * Build a crowd composition SVG for streak cards.
 * Returns an HTML string of N characters arranged in rows.
 */
function buildStreakCrowd(count) {
  const comp = STREAK_COMPOSITIONS[count] || STREAK_COMPOSITIONS[30] || STREAK_COMPOSITIONS[14];
  if (!comp) return '';

  // Layout config based on actual character count
  const n = comp.length;
  let charW, charH, rows;
  if (n <= 1) {
    charW = 48; charH = 44;
    rows = [comp];
  } else if (n <= 3) {
    charW = 40; charH = 37;
    rows = [comp];  // single row
  } else if (n <= 7) {
    charW = 30; charH = 28;
    const mid = Math.ceil(n / 2);
    rows = [comp.slice(0, mid), comp.slice(mid)];
  } else if (n <= 14) {
    charW = 22; charH = 20;
    const perRow = Math.ceil(n / 3);
    rows = [];
    for (let i = 0; i < n; i += perRow) rows.push(comp.slice(i, i + perRow));
  } else {
    charW = 17; charH = 16;
    const perRow = Math.ceil(n / 5);
    rows = [];
    for (let i = 0; i < n; i += perRow) rows.push(comp.slice(i, i + perRow));
  }

  const gap = Math.max(2, Math.round(charW * 0.15));
  const rowGap = Math.max(0, Math.round(charH * 0.05));
  const totalH = rows.length * charH + (rows.length - 1) * rowGap;
  const maxRowW = Math.max(...rows.map(r => r.length * charW + (r.length - 1) * gap));
  const svgW = maxRowW + 4;
  const svgH = totalH + 4;

  let inner = '';
  rows.forEach((row, ri) => {
    const rowW = row.length * charW + (row.length - 1) * gap;
    const offsetX = (svgW - rowW) / 2;
    const offsetY = 2 + ri * (charH + rowGap);

    row.forEach((ch, ci) => {
      const x = offsetX + ci * (charW + gap);
      let charSvg = buildTierComboSvg({ color: ch.color, expression: ch.expression }, charW, charH);
      // Add x/y position to the nested <svg> element
      charSvg = charSvg.replace('<svg ', `<svg x="${x}" y="${offsetY}" `);
      inner += charSvg;
    });
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" class="streak-crowd">${inner}</svg>`;
}

const STREAK_HERO_QUIPS = [
  'Consistency is your love language.',
  'One day at a time. Every single day.',
  'You don\'t skip days. Days skip you.',
  'The streak owns you now.',
  'Showing up is your whole personality.'
];

async function openStreakDrawer() {
  const drawer = document.getElementById('streak-drawer');
  const hero = document.getElementById('streak-drawer-hero');
  const timeline = document.getElementById('streak-timeline');
  if (!drawer || !hero || !timeline) return;

  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  const streaks = jesty_data?.milestones?.streaks || {};
  const current = streaks.current_daily_streak || 0;
  const longest = streaks.longest_daily_streak || 0;
  const claimed = streaks.claimed_streak_rewards || [];

  // Hero
  const quip = STREAK_HERO_QUIPS[Math.floor(Math.random() * STREAK_HERO_QUIPS.length)];
  hero.innerHTML = `
    <div class="levels-hero-level">
      <span class="levels-hero-lv">CURRENT STREAK</span>
      <span class="levels-hero-num" data-num="${current}">${current}</span>
    </div>
    <div class="levels-hero-label">Best: ${longest} day${longest !== 1 ? 's' : ''}</div>
    <div class="levels-hero-quip">${quip}</div>
  `;

  // Timeline — find the highest tier the user has reached and the next one up
  const reachedTiers = STREAK_DEFS.filter(s => current >= s.streak);
  const currentTier = reachedTiers.length > 0 ? reachedTiers[reachedTiers.length - 1].streak : 0;
  const nextTier = STREAK_DEFS.find(s => s.streak > current);

  timeline.innerHTML = '';
  STREAK_DEFS.forEach(s => {
    const isCurrent = s.streak === currentTier;
    const reached = s.streak < currentTier || claimed.includes(s.streak);
    const isNext = nextTier && s.streak === nextTier.streak;

    const card = document.createElement('div');
    card.className = `streak-card-v2${isCurrent ? ' current' : ''}${reached && !isCurrent ? ' reached' : ''}${isNext ? ' next-up' : ''}`;

    const crowd = buildStreakCrowd(s.streak);

    card.innerHTML = `
      <div class="streak-card-header">
        <span class="streak-card-label">${s.label}</span>
        ${isCurrent ? '<span class="streak-card-current-chip">Current</span>' : ''}
        ${isNext ? '<span class="level-card-next-chip">Next</span>' : ''}
      </div>
      <div class="streak-card-crowd">${crowd}</div>
      <div class="streak-card-footer">
        <div class="streak-card-quip">${s.quip}</div>
        <div class="streak-card-xp-pill">${reached || isCurrent ? 'Claimed' : `+${s.xp} XP`}</div>
      </div>
    `;
    timeline.appendChild(card);
  });

  // Show
  drawer.classList.add('visible');

  // Close handlers
  document.getElementById('streak-drawer-close').onclick = () => drawer.classList.remove('visible');
  document.getElementById('streak-drawer-backdrop').onclick = () => drawer.classList.remove('visible');
  document.getElementById('streak-play-btn').onclick = () => { drawer.classList.remove('visible'); JestyMemoryGame.show(); };
}

let _lastKnownLevel = null;

async function renderLevelBadge() {
  const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
  if (!jesty_data) return;

  const prog = jesty_data.progression || { level: 1, xp: 0, xp_to_next: 100 };
  const pct = Math.min(1, prog.xp / prog.xp_to_next);

  // Detect level-up from any source
  if (_lastKnownLevel !== null && prog.level > _lastKnownLevel) {
    const unlock = LEVEL_UNLOCKS[prog.level];
    // Small delay so XP toast (if any) shows first
    setTimeout(() => showLevelUpToast(prog.level, unlock), 3200);
    // Refresh accessory grid so newly unlocked items are selectable
    refreshAllAccessoryUI();
  }
  _lastKnownLevel = prog.level;

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
  if (stageEl) {
    stageEl.textContent = tierName;
    stageEl.dataset.tier = tier;
    stageEl.style.cursor = 'pointer';
    stageEl.onclick = () => showTierOverlayPlans();
  }

  if (fillEl) fillEl.style.width = `${pct * 100}%`;
  if (xpEl) xpEl.textContent = `${prog.xp} / ${prog.xp_to_next} XP`;

  // Next unlock — play to level up button
  const nextEl = document.getElementById('level-panel-next');
  if (nextEl) {
    const unlockLevels = Object.keys(LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
    const nextUnlock = unlockLevels.find(l => l > prog.level);
    if (nextUnlock) {
      const reward = LEVEL_UNLOCKS[nextUnlock].split(' · ')[0];
      nextEl.textContent = `Play to unlock ${reward}`;
    } else {
      nextEl.textContent = 'All accessories unlocked!';
    }
  }

}

/**
 * Renders a Guilty upgrade card for free users inside a game overlay.
 * Returns the card element (or null if user is premium).
 */

function createRecoloredFaceSVG(expression, targetColor, width, height) {
  const symbol = document.getElementById(`face-${expression}`);
  if (!symbol) return `<svg viewBox="-15 -10 150 140" width="${width}" height="${height}"><use href="#face-${expression}"/></svg>`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-15 -10 150 140');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  // Clone symbol content with unique clip IDs
  const id = Math.random().toString(36).slice(2, 8);
  let content = symbol.innerHTML;
  content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-uc-${id}`);
  content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-uc-${id})`);
  svg.innerHTML = content;

  // Recolor from current color to target
  const replacements = {};
  for (const key of ['body', 'limb', 'shadow', 'highlight']) {
    replacements[currentColor[key].toUpperCase()] = targetColor[key];
  }
  svg.querySelectorAll('*').forEach(el => {
    for (const attr of ['fill', 'stroke']) {
      const val = el.getAttribute(attr);
      if (val && replacements[val.toUpperCase()]) {
        el.setAttribute(attr, replacements[val.toUpperCase()]);
      }
    }
  });

  return svg.outerHTML;
}

async function renderGameUpgradeCard(container) {
  const tier = typeof JestyPremium !== 'undefined' ? await JestyPremium.getTier() : 'free';
  if (tier !== 'free') return null;

  // Clear any previous content (guards against async race conditions)
  container.innerHTML = '';

  const hint = document.createElement('p');
  hint.className = 'game-upgrade-hint';
  hint.textContent = 'Want harder levels and unlimited fun?';
  container.appendChild(hint);

  const combo = TIER_COMBOS.premium;
  const upgradeColor = SLOT_COLORS[combo.color];
  const card = document.createElement('div');
  card.className = 'game-upgrade-card';
  card.innerHTML = `
    <div class="plans-upgrade-icon">
      ${buildTierComboSvg(combo, 36, 34)}
    </div>
    <div class="plans-upgrade-info">
      <span class="plans-upgrade-name">Guilty — ${PRICE.premiumFull}</span>
      <span class="plans-upgrade-price">Unlock all levels & unlimited fun</span>
    </div>
    <svg class="plans-upgrade-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
  `;
  card.addEventListener('click', () => {
    showTierOverlayPlans();
  });
  container.appendChild(card);
  return card;
}

function bounceGameUpgradeCard() {
  const card = document.querySelector('.game-upgrade-card');
  if (!card) return;
  card.classList.remove('bounce');
  void card.offsetWidth;
  card.classList.add('bounce');

  // Spawn sparkle particles
  for (let i = 0; i < 6; i++) {
    const spark = document.createElement('span');
    spark.className = 'upgrade-sparkle';
    spark.textContent = '\u2728';
    spark.style.left = `${10 + Math.random() * 80}%`;
    spark.style.animationDelay = `${i * 0.06}s`;
    card.appendChild(spark);
    setTimeout(() => spark.remove(), 800);
  }

  // Remove bounce class after animation
  setTimeout(() => card.classList.remove('bounce'), 700);
}

function bounceUpgradeCard(el) {
  if (!el) return;
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');
  setTimeout(() => el.classList.remove('bounce'), 700);
}

/**
 * Renders the full Guilty tier card (same as plans page) into a container.
 * Used in memory game after completing the last free level.
 */
function renderGuiltyTierCard(container, ctaLabel) {
  const tier = TIER_DATA.find(t => t.key === 'premium');
  if (!tier) return;

  // Exact same rendering as showAllPlans() for the Guilty card
  const combo = TIER_COMBOS.premium;
  const characterHtml = combo ? buildTierCharacterSvg(combo) : '';
  const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');
  const label = ctaLabel || (tier.cta ? tier.cta.label : '');
  const ctaHtml = tier.cta
    ? `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}">${label}</button>`
    : '';

  const card = document.createElement('div');
  card.className = 'tier-card highlighted';
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
      openPremiumCheckout();
    });
  }

  container.appendChild(card);
}

// Auto-shake visible upgrade cards every 15–30s
let _upgradeShakeTimer = null;
function startUpgradeShakeLoop() {
  stopUpgradeShakeLoop();
  (function tick() {
    const delay = 15000 + Math.random() * 15000;
    _upgradeShakeTimer = setTimeout(() => {
      // Find the first visible upgrade card in current context
      const card = document.querySelector('.game-upgrade-card:not(.hidden)') ||
                   document.querySelector('.accessories-sections .plans-upgrade-card') ||
                   document.querySelector('#acc-gallery-footer .game-upgrade-card');
      if (card && !card.closest('.hidden')) bounceUpgradeCard(card);
      tick();
    }, delay);
  })();
}
function stopUpgradeShakeLoop() {
  if (_upgradeShakeTimer) { clearTimeout(_upgradeShakeTimer); _upgradeShakeTimer = null; }
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
  }

  await chrome.storage.local.set({ jesty_data });
  await renderLevelBadge();
}

/* ──────────────────────────────────────────────
   WALL OF SHAME / HALL OF FAME
   ────────────────────────────────────────────── */




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
    { role: 'system', content: buildChatPersonality(0) },
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
        { role: 'system', content: buildChatPersonality(0) },
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
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="-15 -10 150 140" width="27" height="26"><use href="#face-smug"/></svg>
      </div>
      <div class="message-content">
        <div class="message-bubble">${escapeHtml(text)}</div>
        <div class="message-reactions" data-msg-id="${msgId}">
          <button class="reaction-btn fire" title="Fire" aria-label="Fire">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/></svg>
          </button>
          <button class="reaction-btn laugh" title="Haha" aria-label="Haha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
        </div>
      </div>
    `;
    // Wire reaction buttons
    const reactions = messageDiv.querySelector('.message-reactions');
    reactions.addEventListener('click', (e) => {
      const btn = e.target.closest('.reaction-btn');
      if (!btn) return;
      const type = btn.classList.contains('fire') ? 'fire' : 'laugh';
      const wasActive = btn.classList.contains('active');
      reactions.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('active'));
      if (!wasActive) {
        btn.classList.add('active');
        reactions.classList.add('reacted');
        saveReaction(text, type);
        spawnReactionRain(btn, type);
        // Fade out pill after rain, re-show on hover
        clearTimeout(reactions._fadeTimer);
        reactions._fadeTimer = setTimeout(() => {
          reactions.classList.add('faded');
        }, 2000);
      } else {
        reactions.classList.remove('reacted', 'faded');
        saveReaction(text, null);
      }
    });
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

async function saveReaction(messageText, reaction) {
  try {
    const { jesty_reactions } = await chrome.storage.local.get(['jesty_reactions']);
    const reactions = jesty_reactions || [];
    // Find existing reaction for this message
    const existing = reactions.findIndex(r => r.text === messageText);
    if (reaction === null) {
      // Remove reaction
      if (existing >= 0) reactions.splice(existing, 1);
    } else if (existing >= 0) {
      reactions[existing].reaction = reaction;
      reactions[existing].timestamp = Date.now();
    } else {
      reactions.push({ text: messageText, reaction, timestamp: Date.now() });
    }
    // Keep last 200 reactions
    while (reactions.length > 200) reactions.shift();
    await chrome.storage.local.set({ jesty_reactions: reactions });
  } catch (e) { /* non-critical */ }
}

function spawnReactionRain(btn, type) {
  const svgMarkup = type === 'fire'
    ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
  const color = type === 'fire' ? '#F97316' : '#EAB308';
  const container = btn.closest('.message-content');
  const count = 8;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'reaction-particle';
    particle.style.color = color;
    particle.innerHTML = svgMarkup;
    particle.style.left = `${10 + Math.random() * 80}%`;
    particle.style.animationDelay = `${Math.random() * 0.3}s`;
    particle.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
    container.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
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

  if (status) {
    status.textContent = 'Typing...';
    status.classList.add('typing');
  }

  // Set thinking expression on the animated character
  JestyAnimator.setExpression('thinking', 0);
}

function hideTypingIndicator() {
  const typing = document.getElementById('typing-indicator');
  const status = document.getElementById('status');

  if (typing) {
    typing.remove();
  }

  if (status) {
    status.textContent = 'Ready to argue';
    status.classList.remove('typing');
  }

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

  // Daily cap check (unified: roasts + chat messages share the same pool)
  const userIsPremium = await JestyPremium.isPremium();
  if (!userIsPremium) {
    const capStatus = await JestyStorage.checkDailyCap();
    if (!capStatus.allowed) {
      JestyAnalytics.track('daily_cap_hit', { surface: 'sidepanel' });
      showChatLock();
      return;
    }
  }

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  JestyAnalytics.track('chat_message_sent');
  JestyAnalytics.increment('total_chats');

  // Add user message to chat
  addMessage(userMessage, 'user');

  // Save user message to storage
  if (currentConversationId) {
    await JestyStorage.addMessage(currentConversationId, 'user', userMessage);
  }

  // Add to conversation history
  conversationHistory.push({ role: 'user', content: userMessage });
  if (conversationHistory.length > 30) {
    conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-28)];
  }

  // If first message, seed conversation
  if (conversationHistory.length === 1) {
    conversationHistory.unshift({ role: 'system', content: buildChatPersonality(0) });

    if (!currentConversationId) {
      const conversation = await JestyStorage.startConversation(null);
      currentConversationId = conversation.id;
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

    // Evolve personality based on how deep the conversation is
    conversationHistory[0] = { role: 'system', content: buildChatPersonality(jestyReplyCount) };

    const messagesForAPI = [
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: messageWithContext }
    ];

    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jesty-Key': CONFIG.API_KEY },
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
    const jestyResponse = (data.choices?.[0]?.message?.content ?? "my brain glitched. try again.").trim();

    hideTypingIndicator();
    addMessage(jestyResponse, 'jesty');

    // Set a sassy expression briefly after responding
    JestyAnimator.setExpression('smug', 3000);

    if (currentConversationId) {
      await JestyStorage.addMessage(currentConversationId, 'jesty', jestyResponse);
    }

    conversationHistory.push({ role: 'assistant', content: jestyResponse });
    if (conversationHistory.length > 30) {
      conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-28)];
    }

    // Increment unified daily cap for chat messages (free users only)
    if (!userIsPremium) {
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
      '8 roasts per day',
      '3 basic accessories',
      'Memory Match (levels 1-5)'
    ],
    cta: null
  },
  {
    key: 'premium',
    name: 'Guilty',
    tagline: 'Full judgement',
    price: PRICE.premium,
    priceSub: 'once',
    features: [
      'Unlimited roasts & chat',
      'All games unlocked',
      'Tasks',
      '+5 unlockable accessories'
    ],
    cta: { label: 'Plead Guilty', style: 'primary', action: 'checkout' }
  },
  {
    key: 'pro',
    name: 'Sentenced',
    tagline: 'No escape',
    price: PRICE.pro,
    priceSub: '',
    features: [
      'Everything in Guilty',
      'Exclusive accessories'
    ],
    cta: { label: 'Launching Soon', style: 'secondary', action: 'disabled' }
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
  hat:     { x: 36, y: -2 },
  glasses: { x: 32, y: 42 }
};

// One representative combo per tier — used in plans page, upgrade cards, and design system
const TIER_COMBOS = {
  free:    { expression: 'smug', hat: null, glasses: null, color: 'lime' },
  premium: { expression: 'happy', hat: 'acc-crown', glasses: null, color: 'pink' },
  pro:     { expression: 'smug', hat: 'acc-flame-crown', glasses: null, color: 'mint' },
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
    `${PRICE.premium} to unlock my full roast potential? Cheaper than your coffee habit.`,
    `For ${PRICE.premium} I'll judge you forever. That's a bargain and you know it.`,
  ],
  pro: [
    "The full sentence. No parole. No mercy. No limits.",
    "Full sentence. No parole. Exclusive drip included.",
    "The premium experience, but make it permanent.",
  ],
};

let slotSpinning = false;

function pickWeightedCombo() {
  const r = Math.random();
  let pool;
  if (r < 0.05) pool = SLOT_COMBOS.filter(c => c.tier === 'free');
  else pool = SLOT_COMBOS.filter(c => c.tier === 'premium');
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
    const isDisabled = tier.cta.action === 'disabled';
    ctaHtml = `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}"${isDisabled ? ' disabled' : ''}>${tier.cta.label}</button>`;
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


function buildTierComboSvg(combo, width = 52, height = 48) {
  const color = SLOT_COLORS[combo.color];
  const symbol = document.getElementById(`face-${combo.expression}`);
  if (!symbol) return '';

  const id = Math.random().toString(36).slice(2, 8);
  let content = symbol.innerHTML;
  content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-tier-${id}`);
  content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-tier-${id})`);

  let accsHtml = '';
  if (combo.hat) {
    const a = SLOT_ANCHORS.hat;
    const hatSymbol = document.getElementById(combo.hat);
    if (hatSymbol) accsHtml += `<g transform="translate(${a.x},${a.y})">${hatSymbol.innerHTML}</g>`;
  }
  if (combo.glasses) {
    const a = SLOT_ANCHORS.glasses;
    const glassesSymbol = document.getElementById(combo.glasses);
    if (glassesSymbol) accsHtml += `<g transform="translate(${a.x},${a.y})">${glassesSymbol.innerHTML}</g>`;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-15 -10 150 140');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.innerHTML = content + accsHtml;

  // Recolor from current color to tier color
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

  return svg.outerHTML;
}

function buildTierCharacterSvg(combo) {
  const color = SLOT_COLORS[combo.color];
  const svgHtml = buildTierComboSvg(combo);
  if (!svgHtml) return `<div class="tier-card-character"><div class="tier-card-character-bg" style="background:${color.body}"></div></div>`;

  return `
    <div class="tier-card-character">
      <div class="tier-card-character-bg" style="background:${color.body}"></div>
      ${svgHtml}
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

    const tierIdx = tierOrder.indexOf(tier.key);
    const isCurrent = tier.key === currentTier;
    const isUpgrade = tierIdx > currentIdx;

    if (isUpgrade && tier.key === nextTier) card.classList.add('highlighted');
    if (isCurrent && currentTier !== 'free') card.classList.add('current');

    const characterHtml = combo ? buildTierCharacterSvg(combo) : '';
    const featuresHtml = tier.features.map(f => `<li>${f}</li>`).join('');

    let ctaHtml = '';
    if (isCurrent && currentTier !== 'free') {
      ctaHtml = `<div class="tier-card-current-label">Your current plan</div>`;
    } else if (isUpgrade && tier.cta) {
      const isDisabled = tier.cta.action === 'disabled';
      ctaHtml = `<button class="tier-card-cta ${tier.cta.style}" data-action="${tier.cta.action}"${isDisabled ? ' disabled' : ''}>${tier.cta.label}</button>`;
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

async function showTierOverlayGuilty() {
  const overlay = document.getElementById('tier-overlay');
  if (!overlay) return;

  showSlotMachine();
  overlay.classList.remove('hidden');

  // Rigged spin — always pick a premium (Guilty) combo
  setTimeout(() => {
    if (slotSpinning) return;
    slotSpinning = true;

    const svg = document.querySelector('.slot-character');
    const spinBtn = document.getElementById('slot-spin-btn');
    const result = document.getElementById('slot-result');
    if (!svg || !spinBtn) return;

    if (result) result.classList.remove('visible');
    spinBtn.style.display = 'none';
    const plansLink = document.getElementById('slot-plans-link');
    if (plansLink) plansLink.style.display = 'none';

    svg.classList.remove('landing');
    svg.classList.add('spinning');

    // Always land on Guilty
    const guiltyPool = SLOT_COMBOS.filter(c => c.tier === 'premium');
    const target = guiltyPool[Math.floor(Math.random() * guiltyPool.length)];

    const phase1Count = 15;
    const phase2Delays = [120, 200, 350];
    let step = 0;

    function shuffleStep() {
      const randomCombo = SLOT_COMBOS[Math.floor(Math.random() * SLOT_COMBOS.length)];
      renderSlotCombo(svg, randomCombo);
      step++;

      if (step < phase1Count) {
        setTimeout(shuffleStep, 80);
      } else if (step < phase1Count + phase2Delays.length) {
        setTimeout(shuffleStep, phase2Delays[step - phase1Count]);
      } else {
        renderSlotCombo(svg, target);
        svg.classList.remove('spinning');
        svg.classList.add('landing');
        setTimeout(() => {
          revealSlotResult(target.tier);
          spinBtn.style.display = '';
          if (plansLink) plansLink.style.display = '';
          slotSpinning = false;
        }, 350);
      }
    }

    setTimeout(shuffleStep, 80);
  }, 350);
}

function hideTierOverlay() {
  const overlay = document.getElementById('tier-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function initTierOverlay() {
  // Remaining counter → tier overlay (upgrade CTA)
  const topRemaining = document.getElementById('top-remaining');
  if (topRemaining) topRemaining.addEventListener('click', (e) => {
    e.stopPropagation();
    showTierOverlayPlans();
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
    <p class="premium-text">You've used all your daily roasts. Come back tomorrow or plead Guilty for ${PRICE.premium} for unlimited.</p>
    <button class="premium-btn" id="chat-premium-btn">Plead Guilty — ${PRICE.premium}</button>
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
  try {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    const userId = jesty_data?.profile?.user_id || '';
    const locale = navigator.language || '';
    chrome.tabs.create({ url: `${CONFIG.API_URL}/api/checkout?user_id=${userId}&locale=${encodeURIComponent(locale)}` });
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

  // XP already awarded in background.js — just show visual feedback
  showXPToast(xpGain.xp, xpGain.source || 'tab_close');

  // Flash happy expression briefly
  if (JestyAnimator) JestyAnimator.setExpression('happy', 3000);
  if (JestyAnimator && JestyAnimator.react) JestyAnimator.react('celebrate');

  // Refresh stats and level badge (XP was updated in storage by background)
  await loadStats();
  await renderLevelBadge();
}

let _xpToastTimer = null;

const XP_SOURCE_LABELS = {
  tab_close: 'Tab closed!',
  milestone: 'Milestone reached!',
  streak: 'Streak bonus!',
  game: 'Game completed!',
  task: 'Task done!',
  roast: 'Roast delivered!',
};

function showXPToast(amount, source) {
  const win = document.getElementById('xp-win');
  if (!win) return;

  // Cancel any pending hide from a previous toast
  if (_xpToastTimer) clearTimeout(_xpToastTimer);

  // Set amount (reset overrides from level-up toast)
  const amountEl = document.getElementById('xp-win-amount');
  if (amountEl) {
    amountEl.style.color = '';
    amountEl.textContent = `+${amount} XP`;
  }

  const labelEl = win.querySelector('.xp-win-label');
  if (labelEl) {
    labelEl.style.color = '';
    labelEl.textContent = XP_SOURCE_LABELS[source] || 'XP earned!';
  }

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
  _xpToastTimer = setTimeout(() => {
    win.classList.add('hidden');
  }, 2800);
}

function showLevelUpToast(level, unlock) {
  // Remove any existing overlay
  document.querySelector('.level-up-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'level-up-overlay';

  // Glow
  overlay.innerHTML = `<div class="level-up-glow"></div>`;

  // Label
  const label = document.createElement('div');
  label.className = 'level-up-label';
  label.textContent = 'Level Up';
  overlay.appendChild(label);

  // Build accessory SVG for the back face (if this level unlocks one)
  const unlockId = LEVEL_UNLOCK_IDS[level];
  const catalog = typeof JestyAccessories !== 'undefined' ? JestyAccessories.getCatalog() : [];
  const accItem = unlockId ? catalog.find(a => a.id === unlockId) : null;
  const hasFlip = !!accItem;

  // 3D flip container: front = number, back = accessory
  const flipper = document.createElement('div');
  flipper.className = 'level-up-flipper';

  // Front face — big number
  const front = document.createElement('div');
  front.className = 'level-up-flip-front';
  const num = document.createElement('div');
  num.className = 'level-up-number';
  num.textContent = level;
  num.dataset.num = level;
  front.appendChild(num);
  flipper.appendChild(front);

  // Back face — accessory SVG
  if (hasFlip) {
    const back = document.createElement('div');
    back.className = 'level-up-flip-back';
    const vb = ACC_VIEWBOXES[accItem.symbolId] || '0 0 44 30';
    const symbol = document.getElementById(accItem.symbolId);
    if (symbol) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', vb);
      svg.setAttribute('width', '120');
      svg.setAttribute('height', '90');
      svg.classList.add('level-up-acc-svg');
      svg.innerHTML = symbol.innerHTML;
      back.appendChild(svg);
    }
    flipper.appendChild(back);
  }

  overlay.appendChild(flipper);

  // Unlock text (visible from the start)
  if (unlock) {
    const unlockEl = document.createElement('div');
    unlockEl.className = 'level-up-unlock';
    unlockEl.innerHTML = `<span>${unlock.split(' · ')[0]}</span> unlocked`;
    overlay.appendChild(unlockEl);
  }

  // Particle container
  const particles = document.createElement('div');
  particles.className = 'level-up-particles';
  overlay.appendChild(particles);

  document.body.appendChild(overlay);

  // Trigger fade in
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Trigger flip after 2.5s to reveal accessory (keeps number visible longer)
  if (hasFlip) {
    setTimeout(() => {
      flipper.classList.add('flipped');
      // Second spark burst on flip
      spawnBurst(particles, 0);
    }, 2500);
  }

  // Spawn spark bursts
  const sparkColors = ['#EAB308', '#FDE047', '#FFFFFF', '#CA8A04', '#A78BFA', '#F59E0B'];
  function spawnBurst(container, delay) {
    setTimeout(() => {
      for (let i = 0; i < 24; i++) {
        const spark = document.createElement('div');
        const isStreak = Math.random() > 0.5;
        spark.className = isStreak ? 'level-up-streak' : 'level-up-spark';
        spark.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        spark.style.left = '50%';
        spark.style.top = '45%';

        const angle = (Math.PI * 2 * i / 24) + (Math.random() - 0.5) * 0.5;
        const dist = 80 + Math.random() * 160;
        spark.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
        spark.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
        spark.style.animationDelay = `${Math.random() * 0.2}s`;

        if (isStreak) {
          spark.style.height = `${10 + Math.random() * 16}px`;
          spark.style.transform = `rotate(${angle}rad)`;
        } else {
          const size = 3 + Math.random() * 5;
          spark.style.width = `${size}px`;
          spark.style.height = `${size}px`;
        }

        container.appendChild(spark);
      }
    }, delay);
  }

  spawnBurst(particles, 200);
  spawnBurst(particles, 600);
  spawnBurst(particles, 1200);

  // Fade out and remove (extended to 5.5s to give time to see accessory)
  setTimeout(() => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 500);
  }, hasFlip ? 6500 : 4000);
}

async function showPremiumCelebration() {
  const tier = await JestyPremium.getTier();
  const _d = await JestyStorage.getJestyData();
  const _email = _d?.profile?.email || null;
  JestyAnalytics.track('tier_upgraded', { tier });
  JestyAnalytics.identify({ tier, ...(_email ? { $email: _email, email: _email } : {}) });
  document.querySelector('.premium-celebration-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'premium-celebration-overlay';

  // Glow (purple instead of gold)
  overlay.innerHTML = `<div class="premium-cel-glow"></div>`;

  // Label
  const label = document.createElement('div');
  label.className = 'premium-cel-label';
  label.textContent = 'Guilty';
  overlay.appendChild(label);

  // Face — impressed expression (premium mood)
  const faceWrap = document.createElement('div');
  faceWrap.className = 'premium-cel-face';
  const symbol = document.getElementById('face-impressed') || document.getElementById('face-happy');
  if (symbol) {
    const vb = symbol.getAttribute('viewBox') || '-15 -10 150 140';
    let content = symbol.innerHTML;
    // Recolor to user color
    if (typeof recolorFaceSvg === 'function') {
      content = recolorFaceSvg(content);
    }
    faceWrap.innerHTML = `<svg viewBox="${vb}" width="120" height="110">${content}</svg>`;
  }
  overlay.appendChild(faceWrap);

  // Message
  const msg = document.createElement('div');
  msg.className = 'premium-cel-msg';
  msg.innerHTML = 'Premium unlocked.<br>No more limits.';
  overlay.appendChild(msg);

  // Particle container
  const particles = document.createElement('div');
  particles.className = 'premium-cel-particles';
  overlay.appendChild(particles);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Spark bursts
  const sparkColors = ['#A78BFA', '#C4B5FD', '#FFFFFF', '#7C3AED', '#DDD6FE', '#EDE9FE'];
  function spawnBurst(container, delay) {
    setTimeout(() => {
      for (let i = 0; i < 24; i++) {
        const spark = document.createElement('div');
        const isStreak = Math.random() > 0.5;
        spark.className = isStreak ? 'level-up-streak' : 'level-up-spark';
        spark.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        spark.style.left = '50%';
        spark.style.top = '45%';

        const angle = (Math.PI * 2 * i / 24) + (Math.random() - 0.5) * 0.5;
        const dist = 80 + Math.random() * 160;
        spark.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
        spark.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
        spark.style.animationDelay = `${Math.random() * 0.2}s`;

        if (isStreak) {
          spark.style.height = `${10 + Math.random() * 16}px`;
          spark.style.transform = `rotate(${angle}rad)`;
        } else {
          const size = 3 + Math.random() * 5;
          spark.style.width = `${size}px`;
          spark.style.height = `${size}px`;
        }
        container.appendChild(spark);
      }
    }, delay);
  }

  spawnBurst(particles, 200);
  spawnBurst(particles, 600);
  spawnBurst(particles, 1200);

  // Fade out, then reload sidepanel to reflect premium state
  setTimeout(() => {
    overlay.classList.remove('visible');
    setTimeout(() => {
      console.log('Jesty: Celebration done, reloading sidepanel...');
      window.location.reload();
    }, 600);
  }, 4000);
}


