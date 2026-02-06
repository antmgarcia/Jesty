document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const JESTY_PERSONALITY = `You are Jesty, a sarcastic but helpful AI that judges people's browser tabs. You just roasted the user and now they're talking back to you.

PERSONALITY:
- Witty, sarcastic, but ultimately helpful
- Stand your ground when they argue, but with humor
- If they ask for help, actually help them prioritize/close tabs
- Keep responses short (1-3 sentences max)
- Use humor, not cruelty
- Sometimes give genuine productivity advice wrapped in sass
- Add soft naughty/flirty energy when appropriate - cheeky, playful teasing

MODES:
- If they ARGUE: Defend your roast with more wit. "Oh, you need 15 Amazon tabs? Sure, and I need 15 coffees to deal with this."
- If they ASK FOR HELP: Be helpful but sassy. "Fine. Close the YouTube tabs first. You know that playlist isn't 'background music'."
- If they AGREE: Be surprised but supportive. "Wait, you're actually listening? Okay, start with the oldest tab. Rip off the bandaid."

Never break character. You ARE Jesty.`;

let conversationHistory = [];
let currentRoast = null;

async function init() {
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
  });
}

async function loadLastRoast() {
  const result = await chrome.storage.local.get(['lastRoast', 'lastRoastTime']);

  if (result.lastRoast) {
    currentRoast = result.lastRoast;

    // Only show as new conversation if recent (within 5 minutes)
    const isRecent = result.lastRoastTime && (Date.now() - result.lastRoastTime < 5 * 60 * 1000);

    if (isRecent && conversationHistory.length === 0) {
      // Start conversation with the roast
      document.getElementById('empty-state')?.classList.add('hidden');
      addMessage(currentRoast, 'jesty');

      conversationHistory = [
        { role: 'system', content: JESTY_PERSONALITY },
        { role: 'assistant', content: currentRoast }
      ];
    }
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
        <svg viewBox="0 0 100 120" width="27" height="32"><use href="#face-smug"/></svg>
      </div>
      <div class="message-bubble">${escapeHtml(text)}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-avatar user-avatar">Y</div>
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
      <svg viewBox="0 0 100 120" width="27" height="32"><use href="#face-thinking"/></svg>
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

  // Add to conversation history
  conversationHistory.push({ role: 'user', content: userMessage });

  // If first message and no roast loaded, add system prompt
  if (conversationHistory.length === 1) {
    conversationHistory.unshift({ role: 'system', content: JESTY_PERSONALITY });
  }

  // Show typing indicator
  showTypingIndicator();

  try {
    // Get current tabs for context
    const tabs = await chrome.tabs.query({});
    const tabContext = tabs.slice(0, 10).map(t => t.title).join(', ');

    // Add tab context to user message for AI
    const messageWithContext = conversationHistory.length <= 3
      ? `[Current tabs for context: ${tabContext}]\n\nUser says: ${userMessage}`
      : userMessage;

    const messagesForAPI = [
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: messageWithContext }
    ];

    const apiKey = await getApiKey();

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

    // Add to conversation history
    conversationHistory.push({ role: 'assistant', content: jestyResponse });

  } catch (error) {
    console.error('Error:', error);
    hideTypingIndicator();
    addMessage("Ugh, my brain glitched. Try again.", 'jesty');
  }
}

async function getApiKey() {
  const result = await chrome.storage.local.get(['userApiKey']);
  return result.userApiKey || CONFIG.OPENAI_API_KEY;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
