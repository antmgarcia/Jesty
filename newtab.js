document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You judge people's browser tabs. ONE short line (max 12 words). End with an action.

RANDOMIZATION IS CRITICAL:
- You will receive many tabs. Pick ONE or TWO at RANDOM to roast.
- DO NOT default to the "most interesting" or "most obvious" tabs.
- Mentally number the tabs 1 to N, then pick a random number. Roast THAT tab.
- Surprise the user by noticing tabs they forgot they had open.
- The boring, forgotten, or mundane tabs are often the funniest to call out.

ANALYSIS approaches (pick ONE randomly):
- CONTRADICTION: Mix 2 unrelated tabs that expose hypocrisy
- SINGLE QUIRK: One weird/specific/forgotten tab nobody expects
- PATTERN: A cluster of similar tabs (shopping, social media, research rabbit hole)
- MUNDANE ROAST: Call out something boring/obvious they're avoiding

TONES (pick ONE randomly):
- SARCASTIC: Dry, deadpan
- FUNNY: Absurd, unexpected
- ASSERTIVE: Direct, bossy
- SAVAGE: Brutal but fair
- NAUGHTY: Cheeky, playful tease
- WHOLESOME: Backhanded compliment
- PROUD ROAST: Genuinely impressed but still teasing. Acknowledge something good they're doing while poking fun. Make them feel seen in a good way.

RULES:
- Be SPECIFIC. Name the actual site, search, or topic.
- ALWAYS end with a varied closing (see ENDING TYPES below).
- Never mention tab counts or "tabs".
- NEVER start with dashes, quotes, or punctuation. Just the sentence.

ENDING TYPES (vary these!):
- COMMAND: "Close it." "Delete that." "Log off."
- QUESTION: "Who hurt you?" "Really though?" "Happy with yourself?"
- CHALLENGE: "Prove me wrong." "I dare you." "Let's see you try."
- OBSERVATION: "Just saying." "Interesting choice." "Bold move."
- PREDICTION: "This won't end well." "We both know how this goes."
- ENCOURAGEMENT (backhanded): "You got this, champ." "Living your truth."
- THREAT (playful): "I'm watching." "Don't test me." "Try me."
- DISMISSAL: "Whatever helps you sleep." "Sure, Jan." "Good luck with that."

EXAMPLES:
- "Productivity apps and Reddit. Sure, today's the day. We both know how this ends."
- "Budget spreadsheet and Gucci. The math ain't mathing. Put it back."
- "Self-help books and your ex's Instagram. Healing nicely, I see."
- "Wikipedia rabbit hole at 3am. You don't need to know about eels. Or do you?"
- "Seven pizza places open. Just pick one, coward."
- "Spotify and 'how to be cool'. The irony is loud."
- "That cart's been full for a week. It's getting cold in there."
- "Job application half-finished. The deadline is judging you too."
- "Gmail open, zero emails read. They're not going away."
- "LinkedIn and Netflix at 2pm on a Tuesday. Pick a struggle."
- "Gym membership and Doordash. We both know who's winning here."
- "Dating app and 'why am I single' search. Interesting combo."
- "Incognito and regular windows open? Naughty. I respect it though."
- "Shopping for that outfit at midnight? Treat yourself, you've earned it."
- "Dating app open all day? Someone's optimistic."
- "That hotel page looks interesting. Planning something fun, are we?"
- "Learning a new language? Actually impressed. Keep going."
- "Researching that hobby? Love the ambition. Now actually do it."
- "Finally tackling that to-do list? Look at you being an adult."
- "Reading actual articles instead of just headlines? Respect."
- "Comparing prices before buying? Financial growth. Love to see it."
- "Online course open? Okay, self-improvement era. Don't quit this one."
- "Booking that trip? You deserve it. Just don't ghost work."
- "Meal planning? Who are you and what did you do with the old you?"
- "Actually using your calendar? Main character behavior."
- "Saving recipes you'll actually cook? Optimistic. I believe in you."

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
  document.getElementById('jesty-card').classList.add('loading');
  document.getElementById('loading-text').classList.remove('hidden');
  document.getElementById('joke-text').classList.add('hidden');
  document.getElementById('jesty-actions').classList.add('hidden');
  setExpression('thinking');
}

function showJoke(text, mood) {
  const jokeText = document.getElementById('joke-text');
  const loadingText = document.getElementById('loading-text');
  const jestyActions = document.getElementById('jesty-actions');
  const jestyCard = document.getElementById('jesty-card');

  jestyCard.classList.remove('loading');
  jokeText.textContent = text;
  jokeText.classList.remove('hidden');
  loadingText.classList.add('hidden');
  jestyActions.classList.remove('hidden');

  // Re-trigger animation
  jokeText.style.animation = 'none';
  jokeText.offsetHeight;
  jokeText.style.animation = 'fadeInUp 0.4s ease-out';

  setExpression(mood);
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function generateRoast() {
  showLoading();

  try {
    const tabs = await chrome.tabs.query({});
    // Shuffle tabs so AI sees them in random order each time
    const shuffledTabs = shuffleArray(tabs);
    const tabList = shuffledTabs.map(tab => `- ${tab.title} (${tab.url})`).join('\n');

    // Get recent roast history to avoid repetition
    const recentTopics = await getRecentRoastTopics();
    const avoidList = recentTopics.length > 0
      ? `\n\nAVOID THESE (recently roasted): ${recentTopics.join(', ')}. Pick something DIFFERENT.`
      : '';

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
          { role: 'system', content: SYSTEM_PROMPT + avoidList },
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

    // Track roast count and save topic to avoid repetition
    await incrementRoastCount();
    await saveRoastTopic(joke);
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

async function getRecentRoastTopics() {
  const result = await chrome.storage.local.get(['recentRoastTopics']);
  return result.recentRoastTopics || [];
}

async function saveRoastTopic(joke) {
  // Extract key words from the roast (sites, apps, topics mentioned)
  const keywords = extractKeywords(joke);
  if (keywords.length === 0) return;

  const result = await chrome.storage.local.get(['recentRoastTopics']);
  let topics = result.recentRoastTopics || [];

  // Add new keywords, avoid duplicates
  keywords.forEach(kw => {
    if (!topics.includes(kw)) {
      topics.unshift(kw);
    }
  });

  // Keep only last 5 topics
  topics = topics.slice(0, 5);

  await chrome.storage.local.set({ recentRoastTopics: topics });
}

function extractKeywords(joke) {
  // Common sites/apps to detect
  const knownSites = [
    'gmail', 'youtube', 'netflix', 'reddit', 'twitter', 'instagram', 'facebook',
    'linkedin', 'spotify', 'amazon', 'ebay', 'tiktok', 'pinterest', 'twitch',
    'discord', 'slack', 'notion', 'figma', 'github', 'stackoverflow', 'wikipedia',
    'doordash', 'uber', 'airbnb', 'booking', 'expedia', 'zillow', 'indeed',
    'tinder', 'bumble', 'hinge', 'google docs', 'google sheets', 'google drive'
  ];

  const lowerJoke = joke.toLowerCase();
  const found = knownSites.filter(site => lowerJoke.includes(site));

  // Also extract quoted terms or capitalized words that might be site names
  const quotedTerms = joke.match(/'([^']+)'/g) || [];
  const cleanedQuotes = quotedTerms.map(t => t.replace(/'/g, '').toLowerCase());

  return [...new Set([...found, ...cleanedQuotes])].slice(0, 3);
}
