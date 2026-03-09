/**
 * Jesty Tab Quiz — Fun Zone Game 2
 * Jesty quizzes you about your own open tabs.
 */
const JestyTabQuiz = (() => {
  'use strict';

  const QUESTIONS_PER_GAME = 8;
  const TIMER_SECONDS = 15;

  // ── Jesty Personality ──

  const INTROS = [
    "Pop quiz. No cheating.",
    "I've been watching. Have you?",
    "I know the answer. Do you?",
    "Quick. Don't overthink this.",
    "This one's easy. For me.",
    "Let's see if you're paying attention.",
    "You'd know this if you paid attention to your own life.",
  ];

  const CORRECT_REACTIONS = [
    "Lucky guess.",
    "You actually know your own habits. Growth.",
    "Fine. You got that one.",
    "Okay, you're paying attention. Suspicious.",
    "Even a broken clock is right twice a day.",
    "Not bad. Don't let it go to your head.",
  ];

  const WRONG_REACTIONS = {
    count: "The answer was {answer}. You have a problem and don't even know the scale.",
    domain: "You don't even know what sites you're on. That's a new level.",
    category: "Your own browsing categories are a mystery to you. Classic.",
    title: "That was literally on your screen. Do you even read your tabs?",
    time: "That tab has been open for ages. It's basically paying rent.",
    default: "The answer was {answer}. I expected nothing and I'm still let down.",
  };

  const STREAK_REACTIONS = [
    "", "", "",
    "Three in a row! Are you cheating?",
    "Four! Okay, I see you.",
    "Five straight. I'm genuinely suspicious.",
    "Six?! You're either a genius or a cheater.",
    "Seven. At this point I'm just impressed.",
    "Perfect streak. Fine. You win. This time.",
  ];

  const RESULT_ROASTS = {
    perfect: [
      "8/8. You know yourself better than I thought. Annoying.",
      "Perfect score. Did you peek? I can't prove it but I'm suspicious.",
      "Flawless. Your self-awareness is almost as impressive as your tab count.",
    ],
    good: [
      "Not bad. You know yourself okay. Room for improvement though.",
      "Decent. But I still know your tabs better than you do.",
      "You passed. Barely. Like most things in your life.",
    ],
    okay: [
      "You barely know what's on your own screen. On brand.",
      "That was rough. Maybe look at your tabs once in a while?",
      "I live in your browser and I'm disappointed.",
    ],
    bad: [
      "You don't know anything about your own browsing. We need to talk.",
      "That score is embarrassing. Even for you.",
      "I expected nothing and I'm still let down.",
    ],
  };

  // ── State ──

  let state = {
    screen: 'start',
    questions: [],
    currentQ: 0,
    score: 0,
    streak: 0,
    answers: [],
    startTime: null,
    questionStart: null,
    timerInterval: null,
    tabData: null,
  };

  let progress = { gamesPlayed: 0, bestScore: 0, totalCorrect: 0, totalQuestions: 0, lastPlayed: null };

  // ── Storage ──

  async function loadProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      if (jestyFunZone && jestyFunZone.tabQuiz) progress = jestyFunZone.tabQuiz;
    } catch (e) {}
  }

  async function saveProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      const data = jestyFunZone || {};
      data.tabQuiz = progress;
      await chrome.storage.local.set({ jestyFunZone: data });
    } catch (e) {}
  }

  // ── Init ──

  async function init() {
    await loadProgress();
    const closeBtn = document.getElementById('tabquiz-overlay-close');
    const backdrop = document.getElementById('tabquiz-overlay-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (backdrop) backdrop.addEventListener('click', hide);
  }

  // ── Show / Hide ──

  function show() {
    const overlay = document.getElementById('tabquiz-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      showStartScreen();
    }
  }

  function hide() {
    clearTimer();
    const overlay = document.getElementById('tabquiz-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── Tab Data Gathering ──

  function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  function parseUrlContext(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (host.includes('google.com') && u.pathname === '/search') return { type: 'search', query: u.searchParams.get('q') };
      if (host.includes('youtube.com') && u.pathname === '/watch') return { type: 'youtube_watch', title: null };
      if (host.includes('youtube.com') && u.pathname.startsWith('/shorts')) return { type: 'youtube_shorts' };
      if (host.includes('reddit.com')) { const m = u.pathname.match(/\/r\/([^/]+)/); if (m) return { type: 'subreddit', name: m[1] }; }
      if (host.includes('amazon.com') && u.searchParams.get('k')) return { type: 'amazon_search', query: u.searchParams.get('k') };
      return null;
    } catch { return null; }
  }

  async function gatherTabData() {
    const tabs = await chrome.tabs.query({});
    const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);
    const trackedMap = {};
    Object.values(openTabs).forEach(t => { if (t.tabId) trackedMap[t.tabId] = t; });

    const enriched = tabs.filter(t => t.url && !t.url.startsWith('chrome://')).map(t => {
      const tracked = trackedMap[t.id];
      return {
        id: t.id, url: t.url, title: t.title || '',
        domain: extractDomain(t.url),
        category: JestyStorage.categorizeUrl(t.url),
        context: parseUrlContext(t.url),
        pinned: t.pinned, audible: t.audible, active: t.active,
        firstSeen: tracked?.firstSeen || null,
        lastActivated: tracked?.lastActivated || null,
        ageMs: tracked?.firstSeen ? Date.now() - tracked.firstSeen : null,
      };
    });

    const domainCounts = {};
    const categoryCounts = {};
    enriched.forEach(t => {
      domainCounts[t.domain] = (domainCounts[t.domain] || 0) + 1;
      if (t.category !== 'other') categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });

    return { tabs: enriched, domainCounts, categoryCounts, total: enriched.length };
  }

  // ── Question Generation ──

  const QUESTION_TYPES = [
    // EASY
    {
      id: 'total_count', difficulty: 1, group: 'count',
      canGen: d => d.total >= 2,
      gen: d => {
        const c = d.total;
        return { text: 'How many tabs do you have open right now?', correct: String(c), options: numericOptions(c), reaction: `count` };
      }
    },
    {
      id: 'pinned_count', difficulty: 1, group: 'count',
      canGen: d => d.tabs.some(t => t.pinned),
      gen: d => {
        const c = d.tabs.filter(t => t.pinned).length;
        return { text: 'How many pinned tabs do you have?', correct: String(c), options: numericOptions(c, 0, 8), reaction: 'count' };
      }
    },
    {
      id: 'has_domain', difficulty: 1, group: 'domain',
      canGen: d => Object.keys(d.domainCounts).length >= 3,
      gen: d => {
        const realDomains = Object.keys(d.domainCounts);
        const allFakes = ['spotify.com','linkedin.com','twitch.tv','notion.so','github.com','figma.com','pinterest.com','tiktok.com','medium.com','stackoverflow.com'];
        const fakes = allFakes.filter(f => !realDomains.includes(f));
        const fake = fakes[Math.floor(Math.random() * fakes.length)] || 'example.com';
        return { text: `Which of these sites do you NOT have open?`, correct: fake, options: shuffle([fake, ...pickRandom(realDomains, 3)]), reaction: 'domain' };
      }
    },
    // MEDIUM
    {
      id: 'most_tabs_domain', difficulty: 2, group: 'domain',
      canGen: d => Object.keys(d.domainCounts).length >= 4,
      gen: d => {
        const sorted = Object.entries(d.domainCounts).sort((a, b) => b[1] - a[1]);
        const top = sorted[0][0];
        const others = sorted.slice(1).map(e => e[0]);
        return { text: 'Which site do you have the most tabs on?', correct: top, options: shuffle([top, ...pickRandom(others, 3)]), reaction: 'domain' };
      }
    },
    {
      id: 'most_tabs_category', difficulty: 2, group: 'category',
      canGen: d => Object.keys(d.categoryCounts).length >= 3,
      gen: d => {
        const sorted = Object.entries(d.categoryCounts).sort((a, b) => b[1] - a[1]);
        const top = sorted[0][0];
        const allCats = ['social_media','streaming','shopping','work','productivity','news','finance','learning','gaming','ai','dating','food_delivery','travel'];
        const others = allCats.filter(c => c !== top);
        return { text: 'Which browsing category has the most tabs?', correct: formatCat(top), options: shuffle([formatCat(top), ...pickRandom(others.map(formatCat), 3)]), reaction: 'category' };
      }
    },
    {
      id: 'real_title', difficulty: 2, group: 'title',
      canGen: d => d.tabs.filter(t => t.title.length > 10).length >= 1,
      gen: d => {
        const goodTabs = d.tabs.filter(t => t.title.length > 10 && t.title.length < 80);
        const real = goodTabs[Math.floor(Math.random() * goodTabs.length)];
        const title = real.title.length > 50 ? real.title.slice(0, 47) + '...' : real.title;
        const fakes = generateFakeTitles(real.domain, 3);
        return { text: 'Which of these is an actual tab title?', correct: title, options: shuffle([title, ...fakes]), reaction: 'title' };
      }
    },
    {
      id: 'google_search', difficulty: 2, group: 'title',
      canGen: d => d.tabs.some(t => t.context?.type === 'search' && t.context.query),
      gen: d => {
        const searchTabs = d.tabs.filter(t => t.context?.type === 'search' && t.context.query);
        const tab = searchTabs[Math.floor(Math.random() * searchTabs.length)];
        const q = tab.context.query;
        const fakes = ['how to be productive', 'best restaurants near me', 'weather tomorrow', 'convert pdf to word', 'flights to hawaii', 'is it normal to have 50 tabs'];
        const picked = fakes.filter(f => f !== q).slice(0, 3);
        return { text: 'What did you just Google?', correct: q, options: shuffle([q, ...picked]), reaction: 'title' };
      }
    },
    {
      id: 'subreddit', difficulty: 2, group: 'domain',
      canGen: d => d.tabs.some(t => t.context?.type === 'subreddit'),
      gen: d => {
        const rTabs = d.tabs.filter(t => t.context?.type === 'subreddit');
        const tab = rTabs[Math.floor(Math.random() * rTabs.length)];
        const real = 'r/' + tab.context.name;
        const fakes = ['r/AskReddit', 'r/todayilearned', 'r/memes', 'r/technology', 'r/gaming', 'r/worldnews', 'r/funny'];
        const picked = fakes.filter(f => f !== real).slice(0, 3);
        return { text: 'Which subreddit are you browsing?', correct: real, options: shuffle([real, ...picked]), reaction: 'domain' };
      }
    },
    // HARD
    {
      id: 'category_count', difficulty: 3, group: 'count',
      canGen: d => Object.keys(d.categoryCounts).length >= 2,
      gen: d => {
        const entries = Object.entries(d.categoryCounts);
        const [cat, count] = entries[Math.floor(Math.random() * entries.length)];
        return { text: `How many ${formatCat(cat)} tabs do you have?`, correct: String(count), options: numericOptions(count, 0, 20), reaction: 'count' };
      }
    },
    {
      id: 'oldest_tab', difficulty: 3, group: 'time',
      canGen: d => d.tabs.filter(t => t.ageMs && t.ageMs > 60000).length >= 4,
      gen: d => {
        const withAge = d.tabs.filter(t => t.ageMs).sort((a, b) => b.ageMs - a.ageMs);
        const oldest = withAge[0];
        const others = withAge.slice(1).filter(t => t.domain !== oldest.domain);
        const picks = pickRandom(others, 3).map(t => t.domain);
        return { text: 'Which tab has been open the longest?', correct: oldest.domain, options: shuffle([oldest.domain, ...picks]), reaction: 'time' };
      }
    },
    {
      id: 'zombie_count', difficulty: 3, group: 'count',
      canGen: d => d.tabs.some(t => t.ageMs && t.ageMs > 2 * 3600000),
      gen: d => {
        const zombies = d.tabs.filter(t => t.ageMs && t.ageMs > 2 * 3600000).length;
        return { text: 'How many zombie tabs (2hr+ open) do you have?', correct: String(zombies), options: numericOptions(zombies, 0, 30), reaction: 'time' };
      }
    },
    {
      id: 'tab_count_category_exact', difficulty: 3, group: 'count',
      canGen: d => {
        const sorted = Object.entries(d.domainCounts).sort((a, b) => b[1] - a[1]);
        return sorted.length >= 2 && sorted[0][1] >= 3;
      },
      gen: d => {
        const sorted = Object.entries(d.domainCounts).sort((a, b) => b[1] - a[1]);
        const [domain, count] = sorted[0];
        return { text: `Exactly how many ${domain} tabs do you have?`, correct: String(count), options: numericOptions(count, 1, 15), reaction: 'count' };
      }
    },
  ];

  function generateQuestionPool(tabData) {
    const pool = [];
    const usedGroups = new Set();

    // Shuffle types so we get variety
    const shuffled = shuffle([...QUESTION_TYPES]);

    for (const type of shuffled) {
      if (type.canGen(tabData)) {
        const q = type.gen(tabData);
        if (q && q.options.length >= 2) {
          pool.push({ ...q, id: type.id, difficulty: type.difficulty, group: type.group });
        }
      }
    }
    return pool;
  }

  function selectQuestions(pool) {
    const easy = pool.filter(q => q.difficulty === 1);
    const medium = pool.filter(q => q.difficulty === 2);
    const hard = pool.filter(q => q.difficulty === 3);

    const selected = [];
    // 2 easy, 3 medium, 3 hard (or whatever's available)
    selected.push(...pickRandom(easy, 2));
    selected.push(...pickRandom(medium, 3));
    selected.push(...pickRandom(hard, 3));

    // If not enough, fill from remaining pool
    const ids = new Set(selected.map(q => q.id));
    const remaining = pool.filter(q => !ids.has(q.id));
    while (selected.length < QUESTIONS_PER_GAME && remaining.length > 0) {
      selected.push(remaining.shift());
    }

    return selected.slice(0, QUESTIONS_PER_GAME);
  }

  // ── Helpers ──

  function numericOptions(correct, min = 0, maxRange = 50) {
    const c = parseInt(correct);
    const offsets = [
      Math.max(min, Math.round(c * 0.5)),
      Math.max(min, c + Math.floor(Math.random() * 8) + 3),
      Math.max(min, Math.abs(c - Math.floor(Math.random() * 6) - 2)),
    ];
    const opts = new Set([String(c)]);
    offsets.forEach(o => { if (o !== c) opts.add(String(o)); });
    // Ensure 4 options
    let fill = c + 1;
    while (opts.size < 4) { if (!opts.has(String(fill))) opts.add(String(fill)); fill++; }
    return shuffle([...opts]);
  }

  function generateFakeTitles(domain, count) {
    const fakes = {
      'youtube.com': ['10 Things You Won\'t Believe Are Real', 'Lofi beats to study to', 'How to Build a PC in 2024', 'Day in My Life - NYC'],
      'reddit.com': ['TIL about an amazing discovery', 'AITA for telling my friend...', 'What\'s the weirdest thing you own?', 'This dog learned to open doors'],
      'default': ['Getting Started Guide - Documentation', 'Your Account Settings', 'Search Results - Page 1', 'Welcome to our platform'],
    };
    const pool = fakes[domain] || fakes['default'];
    return pickRandom(pool, count);
  }

  function formatCat(cat) { return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickRandom(arr, n) { return shuffle(arr).slice(0, n); }
  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Screens ──

  function showStartScreen() {
    state.screen = 'start';
    const container = document.getElementById('tabquiz-content');
    if (!container) return;

    setCharacter('suspicious');
    setTitle('Tab Quiz');

    const statsHtml = progress.gamesPlayed > 0
      ? `<div class="quiz-start-stats"><span>Best: ${progress.bestScore}/${QUESTIONS_PER_GAME}</span><span>Played: ${progress.gamesPlayed}</span></div>`
      : '';

    container.innerHTML = `
      <div class="quiz-start">
        <div class="game-start-hero" id="tabquiz-start-hero">
          <svg viewBox="-15 -10 150 140" width="100" height="93"><use href="#face-suspicious"/></svg>
        </div>
        <p class="quiz-start-desc">I've been watching your tabs. Let's see if you've been paying attention to yourself.</p>
        <span class="game-start-xp">Earn 20–130 XP per game</span>
        ${statsHtml}
        <button class="quiz-start-btn" id="tabquiz-start-btn">Start Quiz</button>
      </div>
    `;

    document.getElementById('tabquiz-start-btn').addEventListener('click', startGame);

    // Upgrade card for free users
    if (typeof renderGameUpgradeCard === 'function') {
      const startDiv = container.querySelector('.quiz-start');
      if (startDiv) renderGameUpgradeCard(startDiv);
    }
  }

  async function startGame() {
    const tabData = await gatherTabData();
    state.tabData = tabData;

    const pool = generateQuestionPool(tabData);
    if (pool.length < 3) {
      const container = document.getElementById('tabquiz-content');
      container.innerHTML = `<div class="quiz-start"><p class="quiz-start-desc">I need more to work with. Open some tabs and come back.</p><button class="quiz-start-btn" onclick="JestyTabQuiz.hide()">Got it</button></div>`;
      setCharacter('disappointed');
      return;
    }

    state.questions = selectQuestions(pool);
    state.currentQ = 0;
    state.score = 0;
    state.streak = 0;
    state.answers = [];
    state.startTime = Date.now();

    showQuestion(0);
  }

  function showQuestion(index) {
    state.currentQ = index;
    state.questionStart = Date.now();
    state.screen = 'question';

    const q = state.questions[index];
    const container = document.getElementById('tabquiz-content');
    if (!container) return;

    setCharacter('thinking');
    setTitle(`${index + 1} / ${state.questions.length}`);

    const intro = randomFrom(INTROS);
    const optionsHtml = q.options.map((opt, i) =>
      `<button class="quiz-option" data-index="${i}">${escapeHtml(opt)}</button>`
    ).join('');

    container.innerHTML = `
      <div class="quiz-question">
        <div class="quiz-timer-bar"><div class="quiz-timer-fill" id="tabquiz-timer-fill"></div></div>
        <p class="quiz-jesty-intro">${intro}</p>
        <h1 class="quiz-question-text">${escapeHtml(q.text)}</h1>
        <div class="quiz-options" id="tabquiz-options">${optionsHtml}</div>
        <p class="quiz-reaction hidden" id="tabquiz-reaction"></p>
      </div>
    `;

    // Wire option clicks
    container.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn, q));
    });

    // Start timer
    startTimer();
  }

  function handleAnswer(btn, question) {
    clearTimer();
    const selected = btn.textContent;
    const isCorrect = selected === question.correct;
    const elapsed = (Date.now() - state.questionStart) / 1000;

    // Mark options
    const options = document.querySelectorAll('#tabquiz-options .quiz-option');
    options.forEach(o => {
      o.style.pointerEvents = 'none';
      if (o.textContent === question.correct) o.classList.add('correct');
      if (o === btn && !isCorrect) o.classList.add('wrong');
    });

    // Score
    if (isCorrect) {
      state.score++;
      state.streak++;
      let xp = 10;
      if (elapsed < 3) xp += 10;
      else if (elapsed < 5) xp += 5;
      state.answers.push({ correct: true, xp });

      const mood = state.streak >= 3 ? 'suspicious' : (Math.random() > 0.5 ? 'happy' : 'impressed');
      setCharacter(mood);
    } else {
      state.streak = 0;
      state.answers.push({ correct: false, xp: 0 });
      setCharacter(Math.random() > 0.5 ? 'disappointed' : 'eyeroll');
    }

    // Reaction text
    const reactionEl = document.getElementById('tabquiz-reaction');
    if (reactionEl) {
      let text;
      if (isCorrect) {
        text = state.streak >= 3 && STREAK_REACTIONS[state.streak] ? STREAK_REACTIONS[state.streak] : randomFrom(CORRECT_REACTIONS);
      } else {
        const template = WRONG_REACTIONS[question.reaction] || WRONG_REACTIONS.default;
        text = template.replace('{answer}', question.correct);
      }
      reactionEl.textContent = text;
      reactionEl.classList.remove('hidden');
    }

    // Auto-advance
    setTimeout(() => {
      if (state.currentQ + 1 < state.questions.length) {
        showQuestion(state.currentQ + 1);
      } else {
        showResults();
      }
    }, 2000);
  }

  function handleTimeout() {
    state.streak = 0;
    state.answers.push({ correct: false, xp: 0 });
    setCharacter('eyeroll');

    const q = state.questions[state.currentQ];
    const options = document.querySelectorAll('#tabquiz-options .quiz-option');
    options.forEach(o => {
      o.style.pointerEvents = 'none';
      if (o.textContent === q.correct) o.classList.add('correct');
    });

    const reactionEl = document.getElementById('tabquiz-reaction');
    if (reactionEl) {
      reactionEl.textContent = "Time's up. The answer was " + q.correct + ".";
      reactionEl.classList.remove('hidden');
    }

    setTimeout(() => {
      if (state.currentQ + 1 < state.questions.length) {
        showQuestion(state.currentQ + 1);
      } else {
        showResults();
      }
    }, 2000);
  }

  async function showResults() {
    state.screen = 'results';
    clearTimer();

    const total = state.questions.length;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);

    // Stars
    let stars = 0;
    if (state.score >= 7) stars = 3;
    else if (state.score >= 5) stars = 2;
    else if (state.score >= 3) stars = 1;

    // XP
    let xp = 20; // completion
    state.answers.forEach(a => { xp += a.xp; });
    if (state.score === total) xp += 30;
    else if (state.score >= 6) xp += 15;

    // Save
    progress.gamesPlayed++;
    progress.bestScore = Math.max(progress.bestScore, state.score);
    progress.totalCorrect += state.score;
    progress.totalQuestions += total;
    progress.lastPlayed = new Date().toISOString();
    await saveProgress();

    if (typeof awardXP === 'function') {
      await awardXP(xp);
      if (typeof showXPToast === 'function') showXPToast(xp);
    }

    // Roast
    const cat = state.score === total ? 'perfect' : state.score >= 5 ? 'good' : state.score >= 3 ? 'okay' : 'bad';
    const roast = randomFrom(RESULT_ROASTS[cat]);

    const mood = stars >= 3 ? 'happy' : stars >= 2 ? 'impressed' : stars >= 1 ? 'smug' : 'dead';
    setCharacter(mood);
    setTitle('Results');

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

    let starsHtml = '';
    for (let i = 0; i < 3; i++) {
      starsHtml += `<span class="quiz-result-star ${i < stars ? 'earned' : ''}" style="animation-delay:${i * 0.15}s">${i < stars ? '★' : '☆'}</span>`;
    }

    const container = document.getElementById('tabquiz-content');
    container.innerHTML = `
      <div class="quiz-results">
        <p class="quiz-results-score">${state.score}/${total}</p>
        <div class="quiz-results-stars">${starsHtml}</div>
        <p class="quiz-results-roast">${escapeHtml(roast)}</p>
        <div class="quiz-results-stats">
          <div class="quiz-stat-item"><span class="quiz-stat-val">${state.score}</span><span class="quiz-stat-lbl">correct</span></div>
          <div class="quiz-stat-item"><span class="quiz-stat-val">${timeStr}</span><span class="quiz-stat-lbl">time</span></div>
          <div class="quiz-stat-item"><span class="quiz-stat-val">+${xp}</span><span class="quiz-stat-lbl">XP</span></div>
        </div>
        <button class="quiz-start-btn" id="tabquiz-replay-btn">Play Again</button>
      </div>
    `;

    document.getElementById('tabquiz-replay-btn').addEventListener('click', startGame);
  }

  // ── Timer ──

  function startTimer() {
    clearTimer();
    const fill = document.getElementById('tabquiz-timer-fill');
    if (fill) {
      fill.classList.remove('low');
      fill.style.transition = 'none';
      fill.style.width = '100%';
      requestAnimationFrame(() => {
        fill.style.transition = `width ${TIMER_SECONDS}s linear`;
        fill.style.width = '0%';
      });
    }
    state.timerLow = setTimeout(() => { if (fill) fill.classList.add('low'); }, (TIMER_SECONDS - 5) * 1000);
    state.timerInterval = setTimeout(() => handleTimeout(), TIMER_SECONDS * 1000);
  }

  function clearTimer() {
    if (state.timerInterval) { clearTimeout(state.timerInterval); state.timerInterval = null; }
    if (state.timerLow) { clearTimeout(state.timerLow); state.timerLow = null; }
  }

  // ── UI Helpers ──

  function setTitle(text) { const el = document.getElementById('tabquiz-title'); if (el) el.textContent = text; }
  function setCharacter(mood) { const el = document.getElementById('tabquiz-character'); if (el) el.innerHTML = `<svg viewBox="-15 -10 150 140" width="36" height="34"><use href="#face-${mood}"/></svg>`; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init, show, hide };
})();
