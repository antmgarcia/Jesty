/**
 * Jesty Roast Trivia — Fun Zone Game 3
 * How well do you remember your time with Jesty?
 */
const JestyRoastTrivia = (() => {
  'use strict';

  const QUESTIONS_PER_GAME = 8;
  const TIMER_SECONDS = 15;
  const MIN_ROASTS = 10;

  // ── Jesty Personality ──

  const INTROS = [
    "How well do you remember our time together?",
    "Let's test your memory of me.",
    "I remember everything. Do you?",
    "This should be easy if you've been paying attention.",
    "Don't disappoint me.",
    "Our relationship in quiz form.",
  ];

  const CORRECT_REACTIONS = [
    "You remember! Our time together means something.",
    "Correct. Maybe you do listen.",
    "Okay, you pay attention. I'm touched. Barely.",
    "Right. Don't act surprised.",
    "You actually remembered. Growth.",
  ];

  const WRONG_REACTIONS = {
    roast: "You don't even remember my roasts? I put effort into those.",
    mood: "You can't even read my emotions. Typical.",
    stats: "The answer was {answer}. You don't even know our stats.",
    trait: "The answer was {answer}. I know you better than you know yourself.",
    default: "The answer was {answer}. I'm hurt you forgot.",
  };

  const STREAK_REACTIONS = [
    "", "", "",
    "Three in a row. Our bond is strong.",
    "Four! You've been paying attention.",
    "Five! Okay, I'm genuinely moved.",
    "Six?! We're basically best friends.",
    "Seven. This is getting emotional.",
    "Perfect. You remember everything. I'm not crying.",
  ];

  const RESULT_ROASTS = {
    perfect: [
      "8/8. You remember everything. I'm almost touched.",
      "Perfect score. Our relationship is stronger than your WiFi.",
      "Flawless recall. You care about us more than your tabs.",
    ],
    good: [
      "Not bad. You remember most of our history.",
      "Decent memory of us. Better than most relationships.",
      "You passed. Our bond survives another day.",
    ],
    okay: [
      "You're already forgetting me. After everything we've been through.",
      "Mediocre. Like your browsing habits.",
      "I pour my heart into roasting you and this is what I get.",
    ],
    bad: [
      "You remember nothing. This relationship is one-sided.",
      "I'm hurt. Genuinely. My roasts deserve better.",
      "After all those roasts, all those chats... you remember nothing.",
    ],
  };

  const FAKE_ROASTS = [
    "Spotify and a resume template. Peak desperation.",
    "Three Netflix tabs and a gym signup. Choose a lane.",
    "LinkedIn at 2am? That's a different kind of insomnia.",
    "You bookmarked a recipe and ordered Chipotle. Predictable.",
    "12 shopping tabs and an empty cart. Window shopping champion.",
    "Dating app and LinkedIn open. Multitasking your loneliness.",
    "You Googled 'am I productive' while on Reddit. Ironic.",
    "45 tabs and counting. This is a cry for help.",
    "Pinterest boards for a house you can't afford. Dream big.",
    "You've been on the same Wikipedia page for 3 hours.",
    "Amazon wishlist longer than your attention span.",
    "Watching cooking videos at midnight. We both know you're ordering pizza.",
    "Stack Overflow and tears. The developer experience.",
    "Scrolling Twitter like it's a job. Spoiler: it doesn't pay.",
    "You have 6 Google Docs open and none of them are finished.",
  ];

  const MOODS = ['smug', 'suspicious', 'yikes', 'eyeroll', 'disappointed', 'melting', 'dead'];
  const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
    userData: null,
  };

  let progress = { gamesPlayed: 0, bestScore: 0, totalCorrect: 0, totalQuestions: 0, lastPlayed: null };

  // ── Storage ──

  async function loadProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      if (jestyFunZone && jestyFunZone.roastTrivia) progress = jestyFunZone.roastTrivia;
    } catch (e) {}
  }

  async function saveProgress() {
    try {
      const { jestyFunZone } = await chrome.storage.local.get(['jestyFunZone']);
      const data = jestyFunZone || {};
      data.roastTrivia = progress;
      await chrome.storage.local.set({ jestyFunZone: data });
    } catch (e) {}
  }

  // ── Init ──

  async function init() {
    await loadProgress();
    const closeBtn = document.getElementById('trivia-overlay-close');
    const backdrop = document.getElementById('trivia-overlay-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (backdrop) backdrop.addEventListener('click', hide);
  }

  function show() {
    const overlay = document.getElementById('trivia-overlay');
    if (overlay) { overlay.classList.remove('hidden'); showStartScreen(); }
  }

  function hide() {
    clearTimer();
    const overlay = document.getElementById('trivia-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── Data ──

  async function gatherData() {
    const data = await JestyStorage.getJestyData();
    return {
      roasts: data.roasts || [],
      profile: data.profile || {},
      milestones: data.milestones || {},
      progression: data.progression || {},
      conversations: data.conversations || [],
    };
  }

  // ── Question Types ──

  const QUESTION_TYPES = [
    // ROAST RECALL
    {
      id: 'real_roast', difficulty: 1, group: 'roast',
      canGen: d => d.roasts.length >= 5,
      gen: d => {
        const roast = d.roasts[Math.floor(Math.random() * d.roasts.length)];
        const text = roast.text.length > 60 ? roast.text.slice(0, 57) + '...' : roast.text;
        const fakes = pickRandom(FAKE_ROASTS.filter(f => f !== roast.text), 3);
        return { text: 'Which of these was a real Jesty roast?', correct: text, options: shuffle([text, ...fakes.map(f => f.length > 60 ? f.slice(0, 57) + '...' : f)]), reaction: 'roast' };
      }
    },
    {
      id: 'roast_mood', difficulty: 2, group: 'roast',
      canGen: d => d.roasts.filter(r => r.mood).length >= 3,
      gen: d => {
        const roasts = d.roasts.filter(r => r.mood && r.text);
        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        const text = roast.text.length > 50 ? roast.text.slice(0, 47) + '...' : roast.text;
        const correct = roast.mood;
        const others = MOODS.filter(m => m !== correct);
        return { text: `What mood was Jesty in for: "${text}"`, correct: formatMood(correct), options: shuffle([formatMood(correct), ...pickRandom(others.map(formatMood), 3)]), reaction: 'mood' };
      }
    },
    {
      id: 'roast_time', difficulty: 2, group: 'roast',
      canGen: d => d.roasts.filter(r => r.context?.time_of_day).length >= 3,
      gen: d => {
        const roasts = d.roasts.filter(r => r.context?.time_of_day && r.text);
        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        const text = roast.text.length > 50 ? roast.text.slice(0, 47) + '...' : roast.text;
        const correct = roast.context.time_of_day;
        return { text: `Was this a morning, afternoon, evening, or night roast? "${text}"`, correct: formatMood(correct), options: TIME_SLOTS.map(formatMood), reaction: 'roast' };
      }
    },
    {
      id: 'roast_tabs', difficulty: 3, group: 'roast',
      canGen: d => d.roasts.filter(r => r.context?.tab_count).length >= 3,
      gen: d => {
        const roasts = d.roasts.filter(r => r.context?.tab_count && r.text);
        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        const text = roast.text.length > 50 ? roast.text.slice(0, 47) + '...' : roast.text;
        const c = roast.context.tab_count;
        return { text: `How many tabs were open for: "${text}"`, correct: String(c), options: numericOptions(c), reaction: 'stats' };
      }
    },
    // STATS
    {
      id: 'total_roasts', difficulty: 1, group: 'stats',
      canGen: d => d.profile.total_roasts > 0,
      gen: d => {
        const c = d.profile.total_roasts;
        const ranges = generateRanges(c);
        const correct = ranges.find(r => c >= r.min && c <= r.max);
        return { text: 'How many total roasts has Jesty given you?', correct: correct.label, options: ranges.map(r => r.label), reaction: 'stats' };
      }
    },
    {
      id: 'peak_tabs', difficulty: 2, group: 'stats',
      canGen: d => d.profile.patterns?.peak_tabs > 0,
      gen: d => {
        const c = d.profile.patterns.peak_tabs;
        return { text: "What's your peak tab count ever?", correct: String(c), options: numericOptions(c, 5, 100), reaction: 'stats' };
      }
    },
    {
      id: 'avg_tabs', difficulty: 3, group: 'stats',
      canGen: d => d.profile.patterns?.avg_tabs_open > 0,
      gen: d => {
        const c = Math.round(d.profile.patterns.avg_tabs_open);
        return { text: "What's your average tab count?", correct: String(c), options: numericOptions(c, 1, 60), reaction: 'stats' };
      }
    },
    {
      id: 'longest_streak', difficulty: 2, group: 'stats',
      canGen: d => d.milestones?.streaks?.longest_daily_streak > 0,
      gen: d => {
        const c = d.milestones.streaks.longest_daily_streak;
        return { text: "What's your longest daily streak with Jesty?", correct: `${c} days`, options: numericOptions(c, 1, 30).map(n => `${n} days`), reaction: 'stats' };
      }
    },
    {
      id: 'total_shares', difficulty: 2, group: 'stats',
      canGen: d => (d.profile.total_shares || 0) > 0,
      gen: d => {
        const c = d.profile.total_shares || 0;
        return { text: 'How many roasts have you shared?', correct: String(c), options: numericOptions(c, 0, 20), reaction: 'stats' };
      }
    },
    // TRAITS
    {
      id: 'top_category', difficulty: 1, group: 'trait',
      canGen: d => d.profile.top_categories?.length >= 3,
      gen: d => {
        const top = d.profile.top_categories[0];
        const cat = typeof top === 'object' ? top.category : top;
        const allCats = ['social_media','streaming','shopping','work','productivity','news','finance','learning','gaming','ai'];
        const others = allCats.filter(c => c !== cat);
        return { text: "What's your #1 browsing category?", correct: formatCat(cat), options: shuffle([formatCat(cat), ...pickRandom(others.map(formatCat), 3)]), reaction: 'trait' };
      }
    },
    {
      id: 'not_top3', difficulty: 2, group: 'trait',
      canGen: d => d.profile.top_categories?.length >= 3,
      gen: d => {
        const top3 = d.profile.top_categories.slice(0, 3).map(c => typeof c === 'object' ? c.category : c);
        const allCats = ['social_media','streaming','shopping','work','productivity','news','finance','learning','gaming','ai'];
        const notTop = allCats.filter(c => !top3.includes(c));
        const correct = notTop[Math.floor(Math.random() * notTop.length)];
        return { text: 'Which of these is NOT in your top 3 categories?', correct: formatCat(correct), options: shuffle([formatCat(correct), ...top3.slice(0, 3).map(formatCat)]), reaction: 'trait' };
      }
    },
    {
      id: 'procrastinator', difficulty: 3, group: 'trait',
      canGen: d => d.profile.traits?.procrastinator_score !== undefined,
      gen: d => {
        const s = d.profile.traits.procrastinator_score;
        const label = s >= 0.8 ? 'Very High' : s >= 0.5 ? 'High' : s >= 0.25 ? 'Medium' : 'Low';
        return { text: 'What does Jesty rate your procrastinator score?', correct: label, options: ['Low', 'Medium', 'High', 'Very High'], reaction: 'trait' };
      }
    },
    {
      id: 'night_owl', difficulty: 3, group: 'trait',
      canGen: d => d.profile.traits?.night_owl_score !== undefined,
      gen: d => {
        const s = d.profile.traits.night_owl_score;
        const label = s >= 0.8 ? 'Very High' : s >= 0.5 ? 'High' : s >= 0.25 ? 'Medium' : 'Low';
        return { text: 'What does Jesty rate your night owl score?', correct: label, options: ['Low', 'Medium', 'High', 'Very High'], reaction: 'trait' };
      }
    },
    // RELATIONSHIP
    {
      id: 'total_convos', difficulty: 2, group: 'stats',
      canGen: d => (d.profile.total_conversations || 0) > 0,
      gen: d => {
        const c = d.profile.total_conversations || d.conversations.length || 0;
        return { text: 'How many conversations have you had with Jesty?', correct: String(c), options: numericOptions(c, 0, 30), reaction: 'stats' };
      }
    },
    {
      id: 'level', difficulty: 1, group: 'stats',
      canGen: d => d.progression?.level > 0,
      gen: d => {
        const c = d.progression.level;
        return { text: 'What level are you?', correct: String(c), options: numericOptions(c, 1, 20), reaction: 'stats' };
      }
    },
  ];

  function generateQuestionPool(data) {
    const pool = [];
    const shuffled = shuffle([...QUESTION_TYPES]);
    for (const type of shuffled) {
      if (type.canGen(data)) {
        const q = type.gen(data);
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
    selected.push(...pickRandom(easy, 2));
    selected.push(...pickRandom(medium, 3));
    selected.push(...pickRandom(hard, 3));
    const ids = new Set(selected.map(q => q.id));
    const remaining = pool.filter(q => !ids.has(q.id));
    while (selected.length < QUESTIONS_PER_GAME && remaining.length > 0) selected.push(remaining.shift());
    return selected.slice(0, QUESTIONS_PER_GAME);
  }

  // ── Helpers ──

  function numericOptions(correct, min = 0, maxRange = 50) {
    const c = parseInt(correct);
    const opts = new Set([String(c)]);
    [Math.max(min, Math.round(c * 0.5)), Math.max(min, c + Math.floor(Math.random() * 8) + 3), Math.max(min, Math.abs(c - Math.floor(Math.random() * 6) - 2))].forEach(o => { if (o !== c) opts.add(String(o)); });
    let fill = c + 1;
    while (opts.size < 4) { if (!opts.has(String(fill))) opts.add(String(fill)); fill++; }
    return shuffle([...opts]);
  }

  function generateRanges(value) {
    if (value <= 25) return [{ min: 0, max: 10, label: '1-10' }, { min: 11, max: 25, label: '11-25' }, { min: 26, max: 50, label: '26-50' }, { min: 51, max: 100, label: '51-100' }];
    if (value <= 60) return [{ min: 0, max: 25, label: '1-25' }, { min: 26, max: 60, label: '26-60' }, { min: 61, max: 100, label: '61-100' }, { min: 101, max: 200, label: '101-200' }];
    if (value <= 200) return [{ min: 0, max: 50, label: '1-50' }, { min: 51, max: 100, label: '51-100' }, { min: 101, max: 200, label: '101-200' }, { min: 201, max: 500, label: '201-500' }];
    return [{ min: 0, max: 100, label: '1-100' }, { min: 101, max: 300, label: '101-300' }, { min: 301, max: 500, label: '301-500' }, { min: 501, max: 9999, label: '500+' }];
  }

  function formatCat(cat) { return (cat || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
  function formatMood(m) { return (m || '').charAt(0).toUpperCase() + (m || '').slice(1); }
  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickRandom(arr, n) { return shuffle(arr).slice(0, n); }
  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Screens ──

  function showStartScreen() {
    state.screen = 'start';
    const container = document.getElementById('trivia-content');
    if (!container) return;

    setCharacter('thinking');
    setTitle('Roast Trivia');

    const statsHtml = progress.gamesPlayed > 0
      ? `<div class="quiz-start-stats"><span>Best: ${progress.bestScore}/${QUESTIONS_PER_GAME}</span><span>Played: ${progress.gamesPlayed}</span></div>`
      : '';

    container.innerHTML = `
      <div class="quiz-start">
        <div class="game-start-hero" id="trivia-start-hero">
          <svg viewBox="-15 -10 150 140" width="100" height="93"><use href="#face-thinking"/></svg>
        </div>
        <p class="quiz-start-desc">How well do you remember our time together? Let's find out.</p>
        <span class="game-start-xp">Earn 20–130 XP per game</span>
        ${statsHtml}
        <button class="quiz-start-btn" id="trivia-start-btn">Start Trivia</button>
      </div>
    `;

    document.getElementById('trivia-start-btn').addEventListener('click', startGame);

    // Upgrade card for free users
    if (typeof renderGameUpgradeCard === 'function') {
      const startDiv = container.querySelector('.quiz-start');
      if (startDiv) renderGameUpgradeCard(startDiv);
    }
  }

  async function startGame() {
    const data = await gatherData();
    state.userData = data;

    if (data.roasts.length < MIN_ROASTS) {
      const container = document.getElementById('trivia-content');
      container.innerHTML = `<div class="quiz-start"><p class="quiz-start-desc">We need more time together. Come back after ${MIN_ROASTS} roasts. You have ${data.roasts.length}.</p></div>`;
      setCharacter('disappointed');
      return;
    }

    const pool = generateQuestionPool(data);
    if (pool.length < 3) {
      const container = document.getElementById('trivia-content');
      container.innerHTML = `<div class="quiz-start"><p class="quiz-start-desc">Not enough data yet. Keep roasting.</p></div>`;
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
    const container = document.getElementById('trivia-content');
    if (!container) return;

    setCharacter('thinking');
    setTitle(`${index + 1} / ${state.questions.length}`);

    const intro = randomFrom(INTROS);
    const optionsHtml = q.options.map((opt, i) =>
      `<button class="quiz-option" data-index="${i}">${escapeHtml(opt)}</button>`
    ).join('');

    container.innerHTML = `
      <div class="quiz-question">
        <div class="quiz-timer-bar"><div class="quiz-timer-fill" id="trivia-timer-fill"></div></div>
        <p class="quiz-jesty-intro">${intro}</p>
        <h1 class="quiz-question-text">${escapeHtml(q.text)}</h1>
        <div class="quiz-options" id="trivia-options">${optionsHtml}</div>
        <p class="quiz-reaction hidden" id="trivia-reaction"></p>
      </div>
    `;

    container.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn, q));
    });

    startTimer();
  }

  function handleAnswer(btn, question) {
    clearTimer();
    const selected = btn.textContent;
    const isCorrect = selected === question.correct;

    const options = document.querySelectorAll('#trivia-options .quiz-option');
    options.forEach(o => {
      o.style.pointerEvents = 'none';
      if (o.textContent === question.correct) o.classList.add('correct');
      if (o === btn && !isCorrect) o.classList.add('wrong');
    });

    const elapsed = (Date.now() - state.questionStart) / 1000;

    if (isCorrect) {
      state.score++;
      state.streak++;
      let xp = 10;
      if (elapsed < 3) xp += 10; else if (elapsed < 5) xp += 5;
      state.answers.push({ correct: true, xp });
      const mood = state.streak >= 3 ? 'suspicious' : (Math.random() > 0.5 ? 'happy' : 'impressed');
      setCharacter(mood);
    } else {
      state.streak = 0;
      state.answers.push({ correct: false, xp: 0 });
      setCharacter(Math.random() > 0.5 ? 'disappointed' : 'eyeroll');
    }

    const reactionEl = document.getElementById('trivia-reaction');
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
    const options = document.querySelectorAll('#trivia-options .quiz-option');
    options.forEach(o => { o.style.pointerEvents = 'none'; if (o.textContent === q.correct) o.classList.add('correct'); });

    const reactionEl = document.getElementById('trivia-reaction');
    if (reactionEl) { reactionEl.textContent = "Time's up. The answer was " + q.correct + "."; reactionEl.classList.remove('hidden'); }

    setTimeout(() => {
      if (state.currentQ + 1 < state.questions.length) showQuestion(state.currentQ + 1);
      else showResults();
    }, 2000);
  }

  async function showResults() {
    state.screen = 'results';
    clearTimer();

    const total = state.questions.length;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);

    let stars = 0;
    if (state.score >= 7) stars = 3;
    else if (state.score >= 5) stars = 2;
    else if (state.score >= 3) stars = 1;

    let xp = 20;
    state.answers.forEach(a => { xp += a.xp; });
    if (state.score === total) xp += 30;
    else if (state.score >= 6) xp += 15;

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

    const cat = state.score === total ? 'perfect' : state.score >= 5 ? 'good' : state.score >= 3 ? 'okay' : 'bad';
    const roast = randomFrom(RESULT_ROASTS[cat]);
    const mood = stars >= 3 ? 'happy' : stars >= 2 ? 'impressed' : stars >= 1 ? 'smug' : 'dead';
    setCharacter(mood);
    setTitle('Results');

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

    let starsHtml = '';
    for (let i = 0; i < 3; i++) starsHtml += `<span class="quiz-result-star ${i < stars ? 'earned' : ''}" style="animation-delay:${i * 0.15}s">${i < stars ? '★' : '☆'}</span>`;

    const container = document.getElementById('trivia-content');
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
        <button class="quiz-start-btn" id="trivia-replay-btn">Play Again</button>
      </div>
    `;

    document.getElementById('trivia-replay-btn').addEventListener('click', startGame);
  }

  // ── Timer ──

  function startTimer() {
    clearTimer();
    const fill = document.getElementById('trivia-timer-fill');
    if (fill) {
      fill.classList.remove('low');
      fill.style.transition = 'none';
      fill.style.width = '100%';
      requestAnimationFrame(() => { fill.style.transition = `width ${TIMER_SECONDS}s linear`; fill.style.width = '0%'; });
    }
    state.timerLow = setTimeout(() => { if (fill) fill.classList.add('low'); }, (TIMER_SECONDS - 5) * 1000);
    state.timerInterval = setTimeout(() => handleTimeout(), TIMER_SECONDS * 1000);
  }

  function clearTimer() {
    if (state.timerInterval) { clearTimeout(state.timerInterval); state.timerInterval = null; }
    if (state.timerLow) { clearTimeout(state.timerLow); state.timerLow = null; }
  }

  // ── UI ──

  function setTitle(text) { const el = document.getElementById('trivia-title'); if (el) el.textContent = text; }
  function setCharacter(mood) { const el = document.getElementById('trivia-character'); if (el) el.innerHTML = `<svg viewBox="-15 -10 150 140" width="36" height="34"><use href="#face-${mood}"/></svg>`; }

  return { init, show, hide };
})();
