document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You judge people's browser tabs. ONE short line (max 12 words). End with an action.

MIX different tones randomly:
- SARCASTIC: Dry, deadpan, "oh sure, that'll work"
- FUNNY: Absurd, unexpected, playful
- ASSERTIVE: Direct, bossy, no-nonsense
- SAVAGE: Brutal but fair, hit where it hurts
- NAUGHTY: Soft flirty tease, cheeky wink energy, playfully suggestive but tasteful

RULES:
- Often MIX 2 unrelated tabs to expose contradictions. The combo is the joke.
- Sometimes roast a single weird/specific tab.
- Be SPECIFIC. Name actual sites, searches, topics.
- ALWAYS end with a command, challenge, or action.
- Never mention tab counts.
- NEVER start with dashes, quotes, or any punctuation. Just the plain sentence.

SARCASTIC examples:
- "Productivity apps and Reddit. Sure, today's the day. Close Reddit."
- "Budget spreadsheet and Gucci. Yeah, that math checks out. Put the phone down."
- "Self-help books and your ex's Instagram. Healing nicely. Block them."

FUNNY examples:
- "Wikipedia rabbit hole at 3am. You don't need to know about eels. Sleep."
- "Seven pizza tabs. You're not comparing, you're stalling. Just order."
- "Spotify and 'how to be cool'. Start with closing that tab."

ASSERTIVE examples:
- "That cart's been full for a week. Checkout or clear it. Now."
- "Job application half-finished. Complete it. No excuses."
- "Gmail open, zero emails read. Face your inbox."

SAVAGE examples:
- "LinkedIn and Netflix at 2pm on a Tuesday. Pick a struggle."
- "Gym membership tab and Doordash. We both know who's winning. Cancel one."
- "Dating app and 'why am I single' search. The tabs are talking. Listen."

NAUGHTY examples:
- "Incognito and regular tabs open? Naughty. I won't tell. Close one though."
- "Shopping for that outfit at midnight? Treat yourself, you deserve it."
- "Dating app open all day? Swipe already, coward. Someone's waiting."
- "That hotel tab looks interesting. Planning something fun? Book it."

After your roast, add | and a mood: smug, suspicious, yikes, eyeroll, disappointed, melting, dead`;

const EXPRESSION_PATTERNS = {
  dead: ['dead', 'rip', 'killed', 'brutal', 'destroyed', 'finished'],
  yikes: ['yikes', 'oh no', 'awkward', 'embarrassing', 'cringe', 'weird combo'],
  melting: ['chaos', 'mess', 'overwhelm', 'too many', 'spiral', 'help'],
  disappointed: ['disappoint', 'expect', 'better', 'really?', 'come on', 'seriously'],
  eyeroll: ['obvious', 'again', 'procrastin', 'distract', 'youtube', 'netflix', 'twitter', 'reddit'],
  suspicious: ['caught', 'see you', 'notice', 'hmm', 'interesting', 'what are you'],
  smug: []
};

async function init() {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const refreshBtn = document.getElementById('refresh-btn');
  const talkbackBtn = document.getElementById('talkback-btn');
  const tabCountEl = document.getElementById('tab-count');

  // Show tab count
  const tabs = await chrome.tabs.query({});
  tabCountEl.textContent = `${tabs.length} tabs open`;

  // Search form submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      // Check if it's a URL
      if (isValidUrl(query)) {
        window.location.href = query.startsWith('http') ? query : `https://${query}`;
      } else {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });

  // Refresh button
  refreshBtn.addEventListener('click', generateRoast);

  // Talk back button - opens side panel
  talkbackBtn.addEventListener('click', openSidePanel);

  // Auto-roast on load
  generateRoast();
}

async function openSidePanel() {
  try {
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
  } catch (e) {
    // Fallback: show instruction
    alert('Right-click the Jesty icon and select "Open side panel" to talk back!');
  }
}

function isValidUrl(string) {
  // Simple URL detection
  const urlPattern = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
  return urlPattern.test(string);
}

function setExpression(mood) {
  const character = document.getElementById('character');
  character.innerHTML = `<svg><use href="#face-${mood}"/></svg>`;
  character.classList.remove('pop');
  void character.offsetWidth;
  character.classList.add('pop');
}

function detectExpression(text) {
  const lowerText = text.toLowerCase();
  for (const [mood, patterns] of Object.entries(EXPRESSION_PATTERNS)) {
    if (patterns.some(pattern => lowerText.includes(pattern))) {
      return mood;
    }
  }
  return 'smug';
}

function showLoading() {
  document.getElementById('loading-text').classList.remove('hidden');
  document.getElementById('joke-text').classList.add('hidden');
  document.getElementById('refresh-btn').disabled = true;
  setExpression('thinking');
}

function showJoke(text, mood) {
  const jokeText = document.getElementById('joke-text');
  const loadingText = document.getElementById('loading-text');
  const refreshBtn = document.getElementById('refresh-btn');
  const talkbackBtn = document.getElementById('talkback-btn');

  jokeText.textContent = text;
  jokeText.classList.remove('hidden');
  loadingText.classList.add('hidden');
  refreshBtn.classList.remove('hidden');
  refreshBtn.disabled = false;
  talkbackBtn.classList.remove('hidden');

  // Re-trigger animation
  jokeText.style.animation = 'none';
  jokeText.offsetHeight;
  jokeText.style.animation = 'fadeInUp 0.4s ease-out';

  setExpression(mood);
}

async function generateRoast() {
  showLoading();

  try {
    const tabs = await chrome.tabs.query({});
    const tabList = tabs.map(tab => `- ${tab.title} (${tab.url})`).join('\n');

    // Get API key (user's key or default)
    const apiKey = await getApiKey();

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: tabList }
        ],
        max_tokens: 80,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content.trim();

    let joke = rawResponse;
    let mood = 'smug';

    if (rawResponse.includes('|')) {
      const parts = rawResponse.split('|');
      joke = parts[0].trim();
      const moodTag = parts[1].trim().toLowerCase();
      if (['smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead'].includes(moodTag)) {
        mood = moodTag;
      } else {
        mood = detectExpression(joke);
      }
    } else {
      mood = detectExpression(joke);
    }

    showJoke(joke, mood);

    // Save roast for side panel conversation
    await chrome.storage.local.set({
      lastRoast: joke,
      lastRoastTime: Date.now()
    });

    // Track roast count
    await incrementRoastCount();
  } catch (error) {
    console.error('Error generating roast:', error);
    showJoke(`Oops! ${error.message}`, 'yikes');
  }
}

async function getApiKey() {
  const result = await chrome.storage.local.get(['userApiKey']);
  return result.userApiKey || CONFIG.OPENAI_API_KEY;
}

async function incrementRoastCount() {
  const result = await chrome.storage.local.get(['roastCount']);
  const count = (result.roastCount || 0) + 1;
  await chrome.storage.local.set({ roastCount: count });
}
