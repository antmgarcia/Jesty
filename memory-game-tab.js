/**
 * Memory Match — Full-tab game page logic.
 * Loaded by memory-game.html (external script required by MV3 CSP).
 */
(function () {
  'use strict';

  // ── Inject SVG symbols ──
  JestyCharacters.init();
  if (typeof JestyTheme !== 'undefined') JestyTheme.init();

  // ── Constants ──
  const EXPRESSIONS = [
    'smug','suspicious','yikes','eyeroll','disappointed',
    'melting','dead','thinking','happy','impressed',
    'manic','petty','chaotic','dramatic','tender'
  ];
  const COLORS = {
    lime:{body:'#EBF34F',limb:'#C8D132',shadow:'#8A9618',highlight:'#F8FBCE'},
    pink:{body:'#FF8FA3',limb:'#E0637A',shadow:'#B84D60',highlight:'#FFD4DC'},
    sky:{body:'#87CEEB',limb:'#5BAED4',shadow:'#3A8CB5',highlight:'#C8E8F5'},
    purple:{body:'#A78BFA',limb:'#7C5FD6',shadow:'#5B3FB5',highlight:'#D4C8FD'},
    mint:{body:'#34D399',limb:'#1EB57F',shadow:'#15875F',highlight:'#A7F0D4'},
    peach:{body:'#FDBA74',limb:'#E09550',shadow:'#B87638',highlight:'#FEE0C0'},
  };
  const COLOR_KEYS = Object.keys(COLORS);
  const ACCESSORIES = [
    {id:'party-hat',symbolId:'acc-party-hat',slot:'hat'},
    {id:'sunglasses',symbolId:'acc-sunglasses',slot:'glasses'},
    {id:'beanie',symbolId:'acc-beanie',slot:'hat'},
    {id:'monocle',symbolId:'acc-monocle',slot:'glasses'},
    {id:'crown',symbolId:'acc-crown',slot:'hat'},
    {id:'detective-hat',symbolId:'acc-detective-hat',slot:'hat'},
    {id:'top-hat',symbolId:'acc-top-hat',slot:'hat'},
    {id:'halo',symbolId:'acc-halo',slot:'hat'},
  ];
  const ANCHORS = {hat:{x:38,y:-2},glasses:{x:32,y:42}};
  const LEVELS = [
    {rows:2,cols:2,pairs:2,useColor:false,useAccessory:true,par:8,peek:1500},
    {rows:2,cols:3,pairs:3,useColor:false,useAccessory:true,par:12,peek:1500},
    {rows:3,cols:4,pairs:6,useColor:true,useAccessory:true,par:24,peek:1500},
    {rows:4,cols:4,pairs:8,useColor:true,useAccessory:true,par:32,peek:2500},
    {rows:4,cols:5,pairs:10,useColor:true,useAccessory:true,par:40,peek:2500},
    {rows:4,cols:5,pairs:10,useColor:true,useAccessory:true,par:40,peek:2500},
    {rows:5,cols:6,pairs:15,useColor:true,useAccessory:true,par:60,peek:2500},
    {rows:6,cols:6,pairs:18,useColor:true,useAccessory:true,par:72,peek:2500},
  ];
  const COMPLETION_ROASTS = {
    perfect:["Flawless. Your memory is better than your browsing habits.","Zero mistakes. If only your tab management was this clean.","Perfect score? Did you cheat? I'm impressed and suspicious."],
    good:["Not bad. Your brain works better than your browser.","Almost perfect. I'll allow it.","Decent memory. Now use it to remember to close your tabs."],
    okay:["Took you long enough. At least you finished.","That was... an attempt. Very on-brand for you.","You got there eventually. Like closing a tab you opened 3 days ago."]
  };

  // Source color = lime (matches raw SVG symbols in characters.js)
  const SRC = {body:'#EBF34F',limb:'#C8D132',shadow:'#8A9618',highlight:'#F8FBCE'};

  let state = {currentLevel:0,cards:[],flippedIndices:[],matchedPairs:0,totalPairs:0,moves:0,mistakes:0,streak:0,startTime:null,timerInterval:null,isLocked:false};
  let progress = {highestLevel:1,levels:{}};
  var _userColor = null; // cached after first load

  // ── Render a recolored face SVG into a container ──
  function renderColoredFace(el, expression, w, h) {
    if (!el) return;
    var uc = _userColor || {body:'#A78BFA',limb:'#7C5FD6',shadow:'#5B3FB5',highlight:'#D4C8FD'};
    var sym = document.getElementById('face-' + expression);
    if (!sym) { el.innerHTML = ''; return; }
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','-15 -10 150 140');
    if (w) svg.setAttribute('width', w);
    if (h) svg.setAttribute('height', h);
    var uid = Math.random().toString(36).slice(2,8);
    var c = sym.innerHTML.replace(/id="clip-([^"]+)"/g,'id="clip-$1-c'+uid+'"').replace(/url\(#clip-([^)]+)\)/g,'url(#clip-$1-c'+uid+')');
    svg.innerHTML = c;
    var reps = {};
    ['body','limb','shadow','highlight'].forEach(function(k){ reps[SRC[k].toUpperCase()] = uc[k]||SRC[k]; });
    svg.querySelectorAll('*').forEach(function(e) {
      ['fill','stroke'].forEach(function(a){ var v=e.getAttribute(a); if(v&&reps[v.toUpperCase()])e.setAttribute(a,reps[v.toUpperCase()]); });
    });
    el.innerHTML = '';
    el.appendChild(svg);
  }

  // ── Render Jesty icon in user color ──
  function renderIcon() {
    chrome.storage.local.get(['jestyColor'], function (result) {
      _userColor = result.jestyColor || {body:'#A78BFA',limb:'#7C5FD6',shadow:'#5B3FB5',highlight:'#D4C8FD'};
      renderColoredFace(document.getElementById('jesty-icon'), 'smug');
    });
  }

  // ── Storage ──
  async function loadProgress() {
    var r = await chrome.storage.local.get(['jestyFunZone']);
    if (r.jestyFunZone && r.jestyFunZone.memoryGame) progress = r.jestyFunZone.memoryGame;
  }
  async function saveProgress() {
    var r = await chrome.storage.local.get(['jestyFunZone']);
    var d = r.jestyFunZone || {};
    d.memoryGame = progress;
    await chrome.storage.local.set({jestyFunZone:d});
  }

  // ── Card Generation ──
  function generateCards(li) {
    var lv = LEVELS[li], pairs = [], used = new Set();
    for (var i = 0; i < lv.pairs; i++) {
      var combo, att = 0;
      do {
        var ex = EXPRESSIONS[Math.floor(Math.random()*EXPRESSIONS.length)];
        var ck = COLOR_KEYS[Math.floor(Math.random()*COLOR_KEYS.length)];
        var ac = lv.useAccessory && Math.random() > 0.1 ? ACCESSORIES[Math.floor(Math.random()*ACCESSORIES.length)] : null;
        combo = ex+'|'+ck+'|'+(ac?ac.id:'none'); att++; if(att>200)break;
      } while(used.has(combo));
      used.add(combo);
      var parts = combo.split('|');
      pairs.push({expression:parts[0],colorKey:parts[1],accessory:parts[2]!=='none'?ACCESSORIES.find(function(a){return a.id===parts[2];}):null,pairId:i});
    }
    if (!lv.useColor) { var sc = COLOR_KEYS[Math.floor(Math.random()*COLOR_KEYS.length)]; pairs.forEach(function(p){ p.colorKey = sc; }); }
    var cards = [];
    pairs.forEach(function(p){ cards.push(Object.assign({},p)); cards.push(Object.assign({},p)); });
    for (var j = cards.length - 1; j > 0; j--) { var k = Math.floor(Math.random()*(j+1)); var tmp = cards[j]; cards[j] = cards[k]; cards[k] = tmp; }
    return cards;
  }

  // ── Start Level ──
  function startLevel(li) {
    if (li >= LEVELS.length) li = LEVELS.length - 1;
    var lv = LEVELS[li];
    state = {currentLevel:li,cards:generateCards(li),flippedIndices:[],matchedPairs:0,totalPairs:lv.pairs,moves:0,mistakes:0,streak:0,startTime:null,timerInterval:null,isLocked:true};
    document.getElementById('game-title').textContent = 'Level ' + (li+1);
    document.getElementById('stats-bar').style.display = '';
    document.getElementById('grid-wrapper').style.display = '';
    document.getElementById('complete-screen').classList.remove('visible');
    updateStats();
    renderBoard(li);
    var els = document.querySelectorAll('#game-grid .tab-card');
    els.forEach(function(c){ c.classList.add('flipped'); });
    setTimeout(function(){ els.forEach(function(c){ c.classList.remove('flipped'); }); state.isLocked = false; }, lv.peek);
  }

  // ── Render Board ──
  function renderBoard(li) {
    var lv = LEVELS[li];
    var grid = document.getElementById('game-grid');
    grid.style.setProperty('--mem-cols', lv.cols);
    grid.innerHTML = '';
    state.cards.forEach(function(card, i) {
      var el = document.createElement('div');
      el.className = 'tab-card';
      el.innerHTML = '<div class="tab-card-inner"><div class="tab-card-back"><span class="tab-card-q">?</span></div><div class="tab-card-front"></div></div>';
      renderFace(el.querySelector('.tab-card-front'), card, i);
      el.addEventListener('click', function(){ onCardClick(i); });
      grid.appendChild(el);
    });
  }

  function renderFace(container, card, idx) {
    var sym = document.getElementById('face-' + card.expression);
    if (!sym) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','-15 -10 150 140');
    svg.setAttribute('width','100%');
    svg.setAttribute('height','100%');
    var c = sym.innerHTML.replace(/id="clip-([^"]+)"/g,'id="clip-$1-t'+idx+'"').replace(/url\(#clip-([^)]+)\)/g,'url(#clip-$1-t'+idx+')');
    var accH = '';
    if (card.accessory) {
      var as = document.getElementById(card.accessory.symbolId);
      if (as) { var an = ANCHORS[card.accessory.slot]; accH = '<g transform="translate('+an.x+','+an.y+')">'+as.innerHTML+'</g>'; }
    }
    svg.innerHTML = c + accH;
    var tc = COLORS[card.colorKey];
    if (tc) {
      var reps = {};
      ['body','limb','shadow','highlight'].forEach(function(k){ reps[SRC[k].toUpperCase()] = tc[k]; });
      svg.querySelectorAll('*').forEach(function(el){
        ['fill','stroke'].forEach(function(a){ var v=el.getAttribute(a); if(v&&reps[v.toUpperCase()])el.setAttribute(a,reps[v.toUpperCase()]); });
      });
    }
    container.appendChild(svg);
  }

  // ── Game Logic ──
  function onCardClick(i) {
    if (state.isLocked) return;
    var els = document.querySelectorAll('#game-grid .tab-card');
    var el = els[i];
    if (!el || el.classList.contains('flipped') || el.classList.contains('matched')) return;
    el.classList.add('flipped');
    state.flippedIndices.push(i);
    if (!state.startTime) { state.startTime = Date.now(); state.timerInterval = setInterval(updateTimer, 1000); }
    if (state.flippedIndices.length === 2) {
      state.moves++;
      updateStats();
      var f = state.flippedIndices[0], s = state.flippedIndices[1];
      if (state.cards[f].pairId === state.cards[s].pairId) handleMatch(f, s, els);
      else handleMismatch(f, s, els);
    }
  }

  function handleMatch(a, b, els) {
    state.streak++;
    state.flippedIndices = [];
    setTimeout(function() {
      els[a].classList.add('matched');
      els[b].classList.add('matched');
      state.matchedPairs++;
      updateStats();
      if (state.matchedPairs === state.totalPairs) setTimeout(handleComplete, 1200);
    }, 300);
  }

  function handleMismatch(a, b, els) {
    state.isLocked = true;
    state.streak = 0;
    state.mistakes++;
    setTimeout(function() {
      els[a].classList.remove('flipped');
      els[b].classList.remove('flipped');
      state.flippedIndices = [];
      state.isLocked = false;
    }, 800);
  }

  // ── Level Complete ──
  async function handleComplete() {
    clearInterval(state.timerInterval);
    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    var lv = LEVELS[state.currentLevel], pm = lv.pairs;
    var stars = 1;
    if (state.moves <= Math.ceil(pm * 1.5)) stars = 3;
    else if (state.moves <= Math.ceil(pm * 2.5)) stars = 2;
    var xp = (state.currentLevel + 1) * 15;
    if (elapsed <= lv.par) xp = Math.floor(xp * 1.5);
    if (state.mistakes === 0) xp = Math.floor(xp * 2);
    var lk = state.currentLevel + 1, prev = progress.levels[lk];
    progress.levels[lk] = {
      bestMoves: Math.min(state.moves, prev ? prev.bestMoves : Infinity),
      bestTime: Math.min(elapsed, prev ? prev.bestTime : Infinity),
      stars: Math.max(stars, prev ? prev.stars : 0)
    };
    if (lk >= progress.highestLevel && lk < LEVELS.length) progress.highestLevel = lk + 1;
    try { await saveProgress(); } catch(e) {}
    try {
      var r = await chrome.storage.local.get(['jesty_data']);
      if (r.jesty_data && r.jesty_data.progression) {
        var THRESHOLDS = [100,250,500,800,1200,1700,2300,3000,4000,5000,6500,8000,10000,12500,15000,18000,21000,25000,30000,35000];
        r.jesty_data.progression.xp = (r.jesty_data.progression.xp || 0) + xp;
        r.jesty_data.progression.total_xp = (r.jesty_data.progression.total_xp || 0) + xp;
        while (r.jesty_data.progression.xp >= r.jesty_data.progression.xp_to_next) {
          r.jesty_data.progression.xp -= r.jesty_data.progression.xp_to_next;
          r.jesty_data.progression.level++;
          r.jesty_data.progression.xp_to_next = THRESHOLDS[Math.min(r.jesty_data.progression.level - 1, THRESHOLDS.length - 1)];
        }
        await chrome.storage.local.set({jesty_data: r.jesty_data});
      }
      // Signal sidepanel to show XP toast when tab closes
      await chrome.storage.local.set({ memoryGameXP: { xp: xp, timestamp: Date.now() } });
    } catch(e) {}
    var cat = state.mistakes === 0 ? 'perfect' : stars >= 2 ? 'good' : 'okay';
    var roast = COMPLETION_ROASTS[cat][Math.floor(Math.random() * COMPLETION_ROASTS[cat].length)];
    showComplete(stars, state.moves, elapsed, xp, roast);
  }

  function showComplete(stars, moves, time, xp, roast) {
    document.getElementById('stats-bar').style.display = 'none';
    document.getElementById('grid-wrapper').style.display = 'none';
    document.getElementById('complete-screen').classList.add('visible');
    var mood = stars === 3 ? 'happy' : stars === 2 ? 'impressed' : 'smug';
    renderColoredFace(document.getElementById('complete-character'), mood);
    document.getElementById('complete-title').textContent = stars === 3 ? 'Perfect!' : stars === 2 ? 'Nice!' : 'Done!';
    document.getElementById('complete-roast').textContent = roast;
    var se = document.getElementById('complete-stars');
    se.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var s = document.createElement('span');
      s.className = 'tab-star ' + (i < stars ? 'earned' : '');
      s.textContent = i < stars ? '\u2605' : '\u2606';
      s.style.animationDelay = (i * 0.15) + 's';
      se.appendChild(s);
    }
    var m = Math.floor(time / 60), sec = time % 60;
    var ts = m > 0 ? m + ':' + String(sec).padStart(2, '0') : sec + 's';
    document.getElementById('complete-stats').innerHTML =
      '<div class="tab-complete-stat"><span class="tab-complete-stat-val">' + moves + '</span><span class="tab-complete-stat-lbl">moves</span></div>' +
      '<div class="tab-complete-stat"><span class="tab-complete-stat-val">' + ts + '</span><span class="tab-complete-stat-lbl">time</span></div>' +
      '<div class="tab-complete-stat"><span class="tab-complete-stat-val">+' + xp + '</span><span class="tab-complete-stat-lbl">XP</span></div>';
    document.getElementById('btn-next').classList.toggle('hidden', state.currentLevel + 1 >= LEVELS.length);
    document.getElementById('btn-next').onclick = function() { startLevel(state.currentLevel + 1); };
    document.getElementById('btn-replay').onclick = function() { startLevel(state.currentLevel); };
  }

  // ── Helpers ──
  function updateStats() {
    document.getElementById('stat-moves').textContent = state.moves;
    document.getElementById('stat-pairs').textContent = state.matchedPairs + '/' + state.totalPairs;
  }
  function updateTimer() {
    if (!state.startTime) return;
    var e = Math.floor((Date.now() - state.startTime) / 1000);
    document.getElementById('stat-timer').textContent = Math.floor(e / 60) + ':' + String(e % 60).padStart(2, '0');
  }
  function stopTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }

  // ── Resume from Transfer ──
  function resumeFromTransfer(t) {
    state = {currentLevel:t.currentLevel,cards:t.cards,flippedIndices:[],matchedPairs:t.matchedPairs,totalPairs:t.totalPairs,moves:t.moves,mistakes:t.mistakes,streak:t.streak,startTime:t.startTime,timerInterval:null,isLocked:false};
    document.getElementById('game-title').textContent = 'Level ' + (t.currentLevel + 1);
    document.getElementById('stats-bar').style.display = '';
    document.getElementById('grid-wrapper').style.display = '';
    document.getElementById('complete-screen').classList.remove('visible');
    updateStats();
    renderBoard(t.currentLevel);
    var els = document.querySelectorAll('#game-grid .tab-card');
    t.matchedIndices.forEach(function(i) { if (els[i]) els[i].classList.add('flipped', 'matched'); });
    if (state.startTime) { state.timerInterval = setInterval(updateTimer, 1000); updateTimer(); }
  }

  // ══════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  var resumeMode = params.get('resume') === 'true';
  var levelParam = parseInt(params.get('level') || '0');

  // Wire restart button
  document.getElementById('restart-btn').addEventListener('click', function() {
    stopTimer();
    startLevel(state.currentLevel);
  });

  // Close button — go to new tab (triggers a fresh roast)
  document.getElementById('close-btn').addEventListener('click', function() {
    window.location.href = chrome.runtime.getURL('newtab.html');
  });

  // Always render a level immediately (fallback for resume mode too)
  startLevel(levelParam);

  // Async setup (icon, storage, resume override)
  (async function() {
    try {
      renderIcon();
      await loadProgress();

      if (resumeMode) {
        var r = await chrome.storage.local.get(['memoryGameTransfer']);
        if (r.memoryGameTransfer) {
          resumeFromTransfer(r.memoryGameTransfer);
          await chrome.storage.local.remove('memoryGameTransfer');
        }
        chrome.storage.local.set({memoryGameTab:{active:true,level:levelParam,timestamp:Date.now()}});
      } else {
        chrome.storage.local.set({memoryGameTab:{active:true,level:levelParam,timestamp:Date.now()}});
      }
    } catch(e) { console.error('[MemoryTab] async init error:', e); }
  })();

  // Close signal
  window.addEventListener('beforeunload', function() {
    try { chrome.storage.local.set({memoryGameTab:{active:false}}); } catch(e) {}
  });

  // Handover listener (sidepanel wants the game back)
  chrome.storage.onChanged.addListener(function(changes) {
    if (changes.memoryGameTab) {
      var v = changes.memoryGameTab.newValue;
      if (v && !v.active && v.handover) {
        var mi = [];
        document.querySelectorAll('#game-grid .tab-card').forEach(function(el, i) {
          if (el.classList.contains('matched')) mi.push(i);
        });
        chrome.storage.local.set({memoryGameTransfer:{
          currentLevel:state.currentLevel,cards:state.cards,moves:state.moves,
          mistakes:state.mistakes,streak:state.streak,matchedPairs:state.matchedPairs,
          totalPairs:state.totalPairs,startTime:state.startTime,matchedIndices:mi,timestamp:Date.now()
        }});
        stopTimer();
        window.location.href = chrome.runtime.getURL('newtab.html');
      }
    }
  });

})();
