document.addEventListener('DOMContentLoaded', init);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You judge people's browser tabs. Max 12 words total, must fit in 2 lines.

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
- ALWAYS end with a varied closing (see ENDING TYPES below). Mix it up!
- Never mention tab counts or "tabs".
- NEVER start with dashes, quotes, or punctuation. Just the sentence.
- Pick a DIFFERENT tab each time. You're seeing a random sample - roast what you see.

ENDING TYPES (vary these - don't overuse any single type):
- COMMAND (use sparingly): "Close it." "Just do it." "Walk away."
- QUESTION: "Who hurt you?" "Really though?" "Happy now?" "And then what?"
- CHALLENGE: "Prove me wrong." "I dare you." "Let's see how this plays out."
- OBSERVATION: "Just saying." "Interesting." "Bold." "Noted." "Classic you."
- PREDICTION: "This won't end well." "We both know how this goes." "Called it."
- ENCOURAGEMENT: "You got this, champ." "Living your truth." "Main character energy."
- PLAYFUL: "I'm watching." "Don't test me." "Brave." "Iconic, honestly."
- DISMISSAL: "Whatever helps you sleep." "Sure, Jan." "Good luck with that."
- ACCEPTANCE: "Fair enough." "Respect." "No judgment. Okay, some judgment."

EXAMPLES (notice how short they are):
- "Reddit and a deadline. Bold move."
- "Gucci and a budget spreadsheet. The math ain't mathing."
- "Self-help and your ex's Instagram. Healing nicely."
- "Wikipedia at 3am. Sleep is for quitters, I guess."
- "Seven pizza tabs. Just pick one, coward."
- "LinkedIn and Netflix. Pick a struggle."
- "Gym site and Doordash. We know who's winning."
- "Dating app all day? Optimistic."
- "Incognito mode? Naughty. Respect though."
- "Shopping at midnight? Treat yourself."
- "Learning a language? Actually impressed."
- "Finally using your calendar? Growth."
- "Booking that trip? You deserve it."
- "Meal planning? Who are you? Iconic."
- "Job app half-finished. It's judging you too."
- "Cart full for a week. Getting cold in there."

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
  // Initialize storage
  await JestyStorage.initializeStorage();

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

  // Refresh button - track refresh before generating new roast
  refreshBtn.addEventListener('click', async () => {
    await JestyStorage.markRoastRefreshed();
    generateRoast();
  });

  // Talk back button - opens side panel
  talkbackBtn.addEventListener('click', openSidePanel);

  // Share button
  const shareBtn = document.getElementById('share-btn');
  shareBtn.addEventListener('click', shareRoast);

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

  // Fit text to 2 lines without truncation
  const fittedText = fitTextToTwoLines(jokeText, text);
  jokeText.textContent = fittedText;
  jokeText.classList.remove('hidden');
  loadingText.classList.add('hidden');
  jestyActions.classList.remove('hidden');

  // Re-trigger animation
  jokeText.style.animation = 'none';
  jokeText.offsetHeight;
  jokeText.style.animation = 'fadeInUp 0.4s ease-out';

  setExpression(mood);
}

function fitTextToTwoLines(element, text) {
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
  const maxHeight = lineHeight * 2.1; // 2 lines with small buffer

  // Try full text first
  element.textContent = text;
  if (element.scrollHeight <= maxHeight) {
    return text;
  }

  // Try trimming at sentence boundaries (. ? !)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let trimmed = '';

  for (const sentence of sentences) {
    const test = trimmed + sentence;
    element.textContent = test;
    if (element.scrollHeight <= maxHeight) {
      trimmed = test;
    } else {
      break;
    }
  }

  if (trimmed) {
    return trimmed.trim();
  }

  // Last resort: trim word by word
  const words = text.split(' ');
  trimmed = '';

  for (const word of words) {
    const test = trimmed ? trimmed + ' ' + word : word;
    element.textContent = test;
    if (element.scrollHeight <= maxHeight) {
      trimmed = test;
    } else {
      break;
    }
  }

  return trimmed || text;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function parseUrlContext(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname;
    const params = u.searchParams;

    // Google search
    if (host.includes('google.') && params.get('q')) {
      return `searching "${params.get('q')}"`;
    }

    // YouTube
    if (host.includes('youtube.com')) {
      if (params.get('search_query')) return `searching "${params.get('search_query')}"`;
      if (path.includes('/watch')) return 'watching video';
      if (path.includes('/shorts')) return 'watching shorts';
      if (path.includes('/playlist')) return 'browsing playlist';
    }

    // Amazon
    if (host.includes('amazon.')) {
      if (params.get('k')) return `shopping for "${params.get('k')}"`;
      if (path.includes('/dp/') || path.includes('/gp/product')) return 'looking at product';
      if (path.includes('/cart')) return 'cart has items';
      if (path.includes('/wishlist')) return 'browsing wishlist';
    }

    // Reddit
    if (host.includes('reddit.com')) {
      const subreddit = path.match(/\/r\/([^\/]+)/);
      if (subreddit) return `browsing r/${subreddit[1]}`;
    }

    // Twitter/X
    if (host.includes('twitter.com') || host.includes('x.com')) {
      const user = path.match(/^\/([^\/]+)/);
      if (user && !['home', 'explore', 'search', 'notifications'].includes(user[1])) {
        return `viewing @${user[1]}`;
      }
    }

    // LinkedIn
    if (host.includes('linkedin.com')) {
      if (path.includes('/jobs')) return 'job hunting';
      if (path.includes('/in/')) return 'stalking profile';
      if (path.includes('/feed')) return 'scrolling feed';
    }

    // Netflix
    if (host.includes('netflix.com')) {
      if (path.includes('/watch')) return 'watching something';
      if (path.includes('/browse')) return 'browsing what to watch';
    }

    // Spotify
    if (host.includes('spotify.com') || host.includes('open.spotify')) {
      if (path.includes('/playlist')) return 'listening to playlist';
      if (path.includes('/album')) return 'listening to album';
      if (path.includes('/artist')) return 'checking artist';
    }

    // Shopping sites
    if (host.includes('ebay.')) {
      if (params.get('_nkw')) return `shopping for "${params.get('_nkw')}"`;
    }
    if (host.includes('etsy.com') && params.get('q')) {
      return `shopping for "${params.get('q')}"`;
    }

    // Dating apps
    if (host.includes('tinder.com') || host.includes('bumble.com') || host.includes('hinge.co')) {
      return 'looking for love';
    }

    // Travel
    if (host.includes('airbnb.') || host.includes('booking.com') || host.includes('expedia.')) {
      return 'planning travel';
    }

    // Food delivery
    if (host.includes('doordash.com') || host.includes('ubereats.com') || host.includes('grubhub.com')) {
      return 'ordering food';
    }

    // General search param fallback
    const searchTerms = params.get('q') || params.get('query') || params.get('search');
    if (searchTerms) return `searching "${searchTerms}"`;

    return null;
  } catch {
    return null;
  }
}

async function generateRoast() {
  showLoading();

  try {
    const tabs = await chrome.tabs.query({});

    // Update category stats for personalization
    const categories = await JestyStorage.updateCategoryStats(tabs);

    // Shuffle tabs and pick only 12 random ones to force variety
    const shuffledTabs = shuffleArray(tabs).slice(0, 12);
    const tabList = shuffledTabs.map(tab => {
      const extra = parseUrlContext(tab.url);
      return extra
        ? `- ${tab.title} (${tab.url}) [Context: ${extra}]`
        : `- ${tab.title} (${tab.url})`;
    }).join('\n');

    // Get personalized context from user history
    const personalizedContext = await JestyStorage.buildPersonalizedContext();

    // Get API key
    const apiKey = CONFIG.OPENAI_API_KEY;

    // Build full system prompt with personalization
    const fullPrompt = personalizedContext
      ? `${SYSTEM_PROMPT}\n\nUSER CONTEXT:\n${personalizedContext}`
      : SYSTEM_PROMPT;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: tabList }
        ],
        max_tokens: 50,
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

    // Save roast with full context to storage
    const { roast, milestone } = await JestyStorage.saveRoast({
      text: joke,
      mood: mood,
      tabCount: tabs.length,
      categories: categories,
      topics: extractKeywords(joke)
    });

    // Check for milestone achievement - override with celebration message
    if (milestone && milestone.isNew && milestone.message) {
      joke = milestone.message;
      mood = 'happy';
      showJoke(joke, mood);
    }

    // Save to simple storage for side panel compatibility
    await chrome.storage.local.set({
      lastRoast: joke,
      lastRoastTime: Date.now(),
      lastTabCount: tabs.length,
      lastRoastId: roast.id
    });

  } catch (error) {
    console.error('Error generating roast:', error);
    showJoke(`Oops! ${error.message}`, 'yikes');
  }
}

async function shareRoast() {
  const jokeText = document.getElementById('joke-text').textContent;
  const character = document.getElementById('character');

  if (!jokeText) return;

  // Get tab count from when the roast was generated
  const storage = await chrome.storage.local.get(['lastTabCount']);
  const tabCount = storage.lastTabCount || 0;

  try {
    // Create canvas for shareable image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Image dimensions (Instagram story friendly)
    canvas.width = 1080;
    canvas.height = 1350;

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get the actual SVG content from the symbol definition
    const useElement = character.querySelector('use');
    const symbolId = useElement.getAttribute('href').replace('#', '');
    const symbolElement = document.getElementById(symbolId);
    const svgContent = symbolElement ? symbolElement.innerHTML : '';

    // Expanded viewBox to capture full character including arms/hands/feet
    // Characters extend from x=-7 to x=107 and y=0 to y=106
    const svgBlob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -5 120 115" width="360" height="345">${svgContent}</svg>`], {type: 'image/svg+xml'});
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = async () => {
      // Draw character centered
      const charX = (canvas.width - 360) / 2;
      const charY = 280;
      ctx.drawImage(img, charX, charY, 360, 345);

      // Draw quote text
      ctx.fillStyle = '#2D2A26';
      ctx.font = 'bold 52px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Word wrap the text
      const maxWidth = 900;
      const lineHeight = 70;
      const words = jokeText.split(' ');
      let line = '';
      let lines = [];

      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          lines.push(line.trim());
          line = word + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      // Draw lines
      const textY = 700;
      lines.forEach((l, i) => {
        ctx.fillText(l, canvas.width / 2, textY + (i * lineHeight));
      });

      // Draw tab count below quote
      if (tabCount > 0) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 32px "DM Sans", sans-serif';
        const tabCountY = textY + (lines.length * lineHeight) + 60;
        ctx.fillText(`Based on ${tabCount} open tabs`, canvas.width / 2, tabCountY);
      }

      // Draw branding
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '500 28px "DM Sans", sans-serif';
      ctx.fillText('Jesty', canvas.width / 2, 1250);

      // Small decorative line
      ctx.strokeStyle = '#FFB499';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(440, 1230);
      ctx.lineTo(640, 1230);
      ctx.stroke();

      URL.revokeObjectURL(svgUrl);

      // Convert to blob and share
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'jesty-roast.png', { type: 'image/png' });

        // Track the share
        await JestyStorage.markRoastShared();

        // Try native share first
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file]
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadImage(blob);
            }
          }
        } else {
          // Fallback: download image
          downloadImage(blob);
        }
      }, 'image/png');
    };

    img.src = svgUrl;
  } catch (error) {
    console.error('Error sharing:', error);
  }
}

function downloadImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jesty-roast.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
