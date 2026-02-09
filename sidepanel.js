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

Never break character. You ARE Jesty. Never invent tabs.`;

let conversationHistory = [];
let currentRoast = null;
let currentConversationId = null;
let userAvatar = { initials: null, color: '#6B7280', email: null, useIcon: true };

async function init() {
  // Initialize storage
  await JestyStorage.initializeStorage();

  // Try to get user profile for avatar (may not work in all contexts)
  await loadUserAvatar();

  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const chatContainer = document.getElementById('chat-container');

  // Load last roast from storage
  await loadLastRoast();

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
    // Listen for action celebrations - show immediately in chat
    if (changes.pendingCelebration && changes.pendingCelebration.newValue && changes.pendingCelebration.newValue.type === 'action_followed') {
      showChatCelebration(changes.pendingCelebration.newValue);
    }
  });

  // Check for any pending celebration on load
  checkPendingChatCelebration();
}

async function loadLastRoast() {
  const result = await chrome.storage.local.get(['lastRoast', 'lastRoastTime', 'lastRoastId']);

  if (result.lastRoast) {
    currentRoast = result.lastRoast;

    // Only show as new conversation if recent (within 5 minutes)
    const isRecent = result.lastRoastTime && (Date.now() - result.lastRoastTime < 5 * 60 * 1000);

    if (isRecent && conversationHistory.length === 0) {
      // Start a new conversation in storage
      const conversation = await JestyStorage.startConversation(result.lastRoastId);
      currentConversationId = conversation.id;

      // Add Jesty's initial message
      await JestyStorage.addMessage(currentConversationId, 'jesty', currentRoast);

      // Show in UI
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
    // Check if chrome.identity is available
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
      // Get initials from email (first letter of email username)
      const username = userInfo.email.split('@')[0];
      const initials = username.charAt(0).toUpperCase();

      // Generate consistent color from email
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
        <svg viewBox="-10 -5 120 115" width="27" height="26"><use href="#face-smug"/></svg>
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
      <svg viewBox="-10 -5 120 115" width="27" height="26"><use href="#face-thinking"/></svg>
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
}

function hideTypingIndicator() {
  const typing = document.getElementById('typing-indicator');
  const status = document.getElementById('status');

  if (typing) {
    typing.remove();
  }

  status.textContent = 'Ready to argue';
  status.classList.remove('typing');
}

async function sendMessage() {
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const userMessage = messageInput.value.trim();

  if (!userMessage) return;

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

    // Start a new conversation if we don't have one
    if (!currentConversationId) {
      const conversation = await JestyStorage.startConversation(null);
      currentConversationId = conversation.id;
    }
  }

  // Show typing indicator
  showTypingIndicator();

  try {
    // Get current tabs for context - ALWAYS include so Jesty doesn't hallucinate
    const tabs = await chrome.tabs.query({});
    const tabList = tabs.slice(0, 15).map(t => `- ${t.title}`).join('\n');

    // Always include tab context so Jesty knows what's actually open
    const messageWithContext = `[CURRENT OPEN TABS - only reference these, never invent tabs:\n${tabList}]\n\nUser says: ${userMessage}`;

    const messagesForAPI = [
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: messageWithContext }
    ];

    // Get API key
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

    // Remove typing indicator and show response
    hideTypingIndicator();
    addMessage(jestyResponse, 'jesty');

    // Save Jesty's response to storage
    if (currentConversationId) {
      await JestyStorage.addMessage(currentConversationId, 'jesty', jestyResponse);
    }

    // Add to conversation history
    conversationHistory.push({ role: 'assistant', content: jestyResponse });

    // Store roasted domains for action tracking (marks source as chat)
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Check for pending celebration on sidepanel load
 */
async function checkPendingChatCelebration() {
  try {
    const { pendingCelebration } = await chrome.storage.local.get(['pendingCelebration']);
    if (pendingCelebration && pendingCelebration.type === 'action_followed') {
      showChatCelebration(pendingCelebration);
    }
  } catch (e) {
  }
}

/**
 * Show celebration message in the chat
 */
async function showChatCelebration(celebration) {
  // Clear the pending celebration
  await chrome.storage.local.remove(['pendingCelebration']);

  // Add celebration message from Jesty
  addMessage(celebration.message, 'jesty');

  // Show floating thumbs-up celebration attached to the last message
  const lastMessage = document.querySelector('.chat-container .message:last-child');
  if (lastMessage) {
    showThumbsUpCelebration(lastMessage);
  }

  // Record the action in storage
  await JestyStorage.recordActionFollowed(celebration.domain);

  // Add to conversation if we have one
  if (currentConversationId) {
    await JestyStorage.addMessage(currentConversationId, 'jesty', celebration.message);
  }
}

/**
 * Show floating thumbs-up icons animation attached to a message
 */
function showThumbsUpCelebration(messageElement) {
  const thumbCount = 6;

  // Make message position relative for absolute positioning of thumbs
  messageElement.style.position = 'relative';

  for (let i = 0; i < thumbCount; i++) {
    setTimeout(() => {
      const thumb = document.createElement('div');
      thumb.className = 'floating-thumb';
      thumb.innerHTML = `<svg viewBox="0 0 24 24" fill="#22C55E"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/></svg>`;
      thumb.style.left = `${10 + Math.random() * 80}%`;
      messageElement.appendChild(thumb);

      // Remove after animation
      setTimeout(() => thumb.remove(), 2000);
    }, i * 100);
  }
}
