/**
 * Jesty Character Animator — GSAP Layered Animation System
 * Builds a decomposed SVG from EXPRESSION_DATA and drives all motion with GSAP timelines.
 * Walking with leg/arm counter-swing, idle breathing, eye-only blink,
 * squash-settle expression transitions, and reactive animations.
 *
 * Public API (backward compatible):
 *   JestyAnimator.init(stage, wrapper, svg)
 *   JestyAnimator.stop()
 *   JestyAnimator.setExpression(mood, duration)
 *   JestyAnimator.getExpression()
 *   JestyAnimator.react(type)          // NEW: 'roast', 'scared', 'celebrate', 'error'
 */
const JestyAnimator = (() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // DOM refs
  let stage = null;
  let characterWrapper = null;
  let characterSvg = null;

  // Layer groups (built on init)
  let layers = {};

  // Position & movement
  let x = 0;
  let direction = 1;
  const CHARACTER_WIDTH = 200;

  // State
  let currentExpression = 'smug';
  let expressionTimeout = null;
  let isLayered = false;

  // GSAP timelines
  let idleTl = null;
  let blinkTl = null;
  let strollTimer = null;
  let moodShuffleTimer = null;
  let _transitionTl = null; // current expression transition timeline
  let _armSwayTweens = [];  // track arm sway tweens for cleanup

  // Movement state
  let isStrolling = false;

  // Idle mood shuffle
  // Moods that cycle in the sidepanel hero
  const SHUFFLE_MOODS = [
    'smug', 'suspicious', 'eyeroll', 'melting', 'dead',
    'thinking', 'impressed', 'petty', 'chaotic', 'dramatic', 'tender'
  ];

  // Floor ellipse width per mood (px) — narrower for compact poses, wider for spread ones
  const FLOOR_WIDTHS = {
    smug: 120, suspicious: 115, yikes: 125, eyeroll: 118,
    disappointed: 120, melting: 130, dead: 95,
    thinking: 110, happy: 125, impressed: 125, manic: 130,
    petty: 110, chaotic: 130, dramatic: 135, tender: 120
  };
  // Subset that can trigger a subtle lateral sway (no walking)
  const SWAY_MOODS = ['melting', 'eyeroll', 'suspicious', 'dead'];
  let moodShuffleActive = false;
  let pinnedMood = null; // set externally via setExpression with duration


  // ─── SVG DOM Builder ───

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildLayeredSVG(svgEl) {
    // Clear existing content
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    // Defs for clip path
    const defs = el('defs', null, svgEl);
    const clipPath = el('clipPath', { id: 'anim-clip' }, defs);
    layers.clipPath = el('path', { id: 'anim-clip-path' }, clipPath);

    // Layer groups in render order
    layers.body = el('g', { id: 'layer-body' }, svgEl);
    layers.bodyPath = el('path', null, layers.body);
    layers.bodyClipGroup = el('g', { 'clip-path': 'url(#anim-clip)' }, layers.body);
    layers.shadow = el('ellipse', null, layers.bodyClipGroup);
    layers.highlight = el('ellipse', null, layers.bodyClipGroup);
    layers.bodyExtras = el('g', { id: 'layer-body-extras' }, layers.body);

    layers.leftLeg = el('g', { id: 'layer-left-leg' }, svgEl);
    layers.leftLegPath = el('path', { stroke: '#C8D132', 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' }, layers.leftLeg);
    layers.leftFoot = el('ellipse', { fill: '#C8D132' }, layers.leftLeg);

    layers.rightLeg = el('g', { id: 'layer-right-leg' }, svgEl);
    layers.rightLegPath = el('path', { stroke: '#C8D132', 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' }, layers.rightLeg);
    layers.rightFoot = el('ellipse', { fill: '#C8D132' }, layers.rightLeg);

    layers.leftArm = el('g', { id: 'layer-left-arm' }, svgEl);
    layers.leftArmPath = el('path', { stroke: '#C8D132', 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' }, layers.leftArm);
    layers.leftHand = el('ellipse', { fill: '#C8D132' }, layers.leftArm);

    layers.rightArm = el('g', { id: 'layer-right-arm' }, svgEl);
    layers.rightArmPath = el('path', { stroke: '#C8D132', 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' }, layers.rightArm);
    layers.rightHand = el('ellipse', { fill: '#C8D132' }, layers.rightArm);

    layers.face = el('g', { id: 'layer-face' }, svgEl);
    layers.extras = el('g', { id: 'layer-extras' }, svgEl);
    layers.accessories = el('g', { id: 'layer-accessories' }, svgEl);

    // Content wrapper for body tilt (chaotic/dramatic)
    layers.contentWrap = el('g', { id: 'layer-content-wrap' }, null);
    // Move body, legs, arms, face into the content wrap
    // We need to restructure: content-wrap contains body+legs+arms+face
    // extras + accessories stay outside for particles to not rotate
    svgEl.innerHTML = '';
    svgEl.appendChild(defs);
    svgEl.appendChild(layers.contentWrap);
    layers.contentWrap.appendChild(layers.body);
    layers.contentWrap.appendChild(layers.leftLeg);
    layers.contentWrap.appendChild(layers.rightLeg);
    layers.contentWrap.appendChild(layers.face);
    layers.contentWrap.appendChild(layers.bodyExtras);
    layers.contentWrap.appendChild(layers.leftArm);
    layers.contentWrap.appendChild(layers.rightArm);
    svgEl.appendChild(layers.accessories);
    svgEl.appendChild(layers.extras);

    isLayered = true;
  }

  function applyExpressionData(mood) {
    const data = JestyCharacters.getExpressionData(mood);
    if (!data || !isLayered) return;

    // Body
    layers.bodyPath.setAttribute('d', data.body.path);
    layers.bodyPath.setAttribute('fill', '#EBF34F');
    if (data.body.transform) {
      layers.bodyPath.setAttribute('transform', data.body.transform);
      layers.bodyClipGroup.setAttribute('transform', data.body.transform);
    } else {
      layers.bodyPath.removeAttribute('transform');
      layers.bodyClipGroup.removeAttribute('transform');
    }
    layers.clipPath.setAttribute('d', data.body.clip);

    // Shadow & highlight
    setEllipseAttrs(layers.shadow, data.shadow, '#8A9618');
    setEllipseAttrs(layers.highlight, data.highlight, '#F8FBCE');

    // Content wrap transform (chaotic tilt, dramatic lean)
    if (data.wrapTransform) {
      layers.contentWrap.setAttribute('transform', data.wrapTransform);
    } else {
      layers.contentWrap.removeAttribute('transform');
    }

    // Arms
    setLimbPath(layers.leftArmPath, data.leftArm.path);
    setHandFoot(layers.leftHand, data.leftArm.hand);
    setLimbPath(layers.rightArmPath, data.rightArm.path);
    setHandFoot(layers.rightHand, data.rightArm.hand);

    // Legs
    setLimbPath(layers.leftLegPath, data.leftLeg.path);
    setHandFoot(layers.leftFoot, data.leftLeg.foot);
    setLimbPath(layers.rightLegPath, data.rightLeg.path);
    setHandFoot(layers.rightFoot, data.rightLeg.foot);

    // Face (innerHTML swap)
    layers.face.innerHTML = data.face;

    // Extras (sparkles, tears, etc)
    layers.extras.innerHTML = data.extras || '';

    // Animate tender hearts: float up and fade out
    if (mood === 'tender' && typeof gsap !== 'undefined') {
      const hearts = layers.extras.querySelectorAll('path');
      hearts.forEach((heart, i) => {
        gsap.fromTo(heart,
          { y: 0, opacity: 0.4, scale: 1, transformOrigin: '50% 50%' },
          { y: -30, opacity: 0, scale: 0.6, duration: 2.5, delay: 0.3 + i * 0.4,
            ease: 'power1.out' }
        );
        // Gentle sway while floating
        gsap.to(heart, {
          x: i === 0 ? -6 : 6, duration: 1.2, ease: 'sine.inOut',
          yoyo: true, repeat: 1
        });
      });
    }

    // Animate thinking bubbles: pop in staggered, float up and fade out
    if (mood === 'thinking' && typeof gsap !== 'undefined') {
      const bubbles = layers.extras.querySelectorAll('circle');
      // Bubbles go smallest (last) to largest (first) — reverse for pop-in order
      const ordered = Array.from(bubbles).reverse();
      ordered.forEach((bubble, i) => {
        gsap.fromTo(bubble,
          { scale: 0, opacity: 0, transformOrigin: '50% 50%' },
          { scale: 1, opacity: 1, duration: 0.3, delay: 0.2 + i * 0.25, ease: 'back.out(2)' }
        );
        gsap.to(bubble, {
          y: -12, opacity: 0, duration: 1.8, delay: 1.2 + i * 0.15,
          ease: 'power1.out'
        });
      });
    }

    // Body extras (melting drips, tender hands)
    layers.bodyExtras.innerHTML = data.bodyExtras || '';

    // Update floor ellipse width
    const floor = characterWrapper && characterWrapper.querySelector('.character-floor');
    if (floor) {
      const w = FLOOR_WIDTHS[mood] || 120;
      floor.style.width = w + 'px';
    }
  }

  function setEllipseAttrs(el, data, fill) {
    if (!data) { el.setAttribute('opacity', '0'); return; }
    el.setAttribute('cx', data.cx);
    el.setAttribute('cy', data.cy);
    el.setAttribute('rx', data.rx);
    el.setAttribute('ry', data.ry);
    el.setAttribute('opacity', data.opacity);
    el.setAttribute('fill', fill);
    if (data.transform) el.setAttribute('transform', data.transform);
    else el.removeAttribute('transform');
  }

  function setLimbPath(pathEl, d) {
    if (!d) {
      pathEl.setAttribute('d', 'M0 0');
      pathEl.setAttribute('opacity', '0');
    } else {
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('opacity', '1');
    }
  }

  function setHandFoot(ellipseEl, data) {
    if (!data) {
      ellipseEl.setAttribute('opacity', '0');
      return;
    }
    ellipseEl.setAttribute('cx', data.cx);
    ellipseEl.setAttribute('cy', data.cy);
    ellipseEl.setAttribute('rx', data.rx);
    ellipseEl.setAttribute('ry', data.ry);
    ellipseEl.setAttribute('opacity', '1');
    if (data.rotate) {
      ellipseEl.setAttribute('transform', `rotate(${data.rotate}, ${data.cx}, ${data.cy})`);
    } else {
      ellipseEl.removeAttribute('transform');
    }
  }

  // ─── Color System Integration ───

  function recolorLayers(color) {
    if (!isLayered || !layers.bodyPath) return;
    layers.bodyPath.setAttribute('fill', color.body);
    // Arms + legs stroke
    [layers.leftArmPath, layers.rightArmPath, layers.leftLegPath, layers.rightLegPath].forEach(p => {
      p.setAttribute('stroke', color.limb);
    });
    // Hands + feet fill
    [layers.leftHand, layers.rightHand, layers.leftFoot, layers.rightFoot].forEach(e => {
      e.setAttribute('fill', color.limb);
    });
    // Shadow + highlight
    layers.shadow.setAttribute('fill', color.shadow);
    layers.highlight.setAttribute('fill', color.highlight);
    // Body extras: recolor any elements with lime source colors
    recolorGroup(layers.bodyExtras, color);
    // Face: recolor eyelids that use body color (suspicious half-lids)
    recolorFaceLids(color);
  }

  function recolorGroup(group, color) {
    if (!group) return;
    const map = {
      '#EBF34F': color.body, '#ebf34f': color.body,
      '#C8D132': color.limb, '#c8d132': color.limb,
      '#8A9618': color.shadow, '#8a9618': color.shadow,
      '#F8FBCE': color.highlight, '#f8fbce': color.highlight
    };
    group.querySelectorAll('*').forEach(el => {
      ['fill', 'stroke'].forEach(attr => {
        const v = el.getAttribute(attr);
        if (v && map[v]) el.setAttribute(attr, map[v]);
      });
    });
  }

  function recolorFaceLids(color) {
    if (!layers.face) return;
    layers.face.querySelectorAll('*').forEach(el => {
      const fill = el.getAttribute('fill');
      if (fill && (fill.toUpperCase() === '#EBF34F')) {
        el.setAttribute('fill', color.body);
      }
    });
  }

  // ─── GSAP Animations ───

  function startIdleAnimations() {
    if (typeof gsap === 'undefined') return;

    // Breathing: subtle scaleY pulse on content wrap
    idleTl = gsap.timeline({ repeat: -1, yoyo: true });
    idleTl.to(layers.contentWrap, {
      scaleY: 1.015,
      transformOrigin: '50% 100%',
      duration: 2,
      ease: 'sine.inOut'
    });

    // Arm sway: subtle rotation (tracked for cleanup during transitions)
    _armSwayTweens = [
      gsap.to(layers.leftArm, {
        rotation: 2,
        transformOrigin: '50% 0%',
        duration: 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      }),
      gsap.to(layers.rightArm, {
        rotation: -2,
        transformOrigin: '50% 0%',
        duration: 3,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      })
    ];

    // Blink: eyes only, random interval
    scheduleBlink();

    // Start idle mood shuffle
    startMoodShuffle();
  }

  function scheduleBlink() {
    const delay = 2.5 + Math.random() * 4;
    blinkTl = gsap.delayedCall(delay, doBlink);
  }

  function doBlink() {
    if (!isLayered || !layers.face) { scheduleBlink(); return; }
    const eyes = layers.face.querySelectorAll('.anim-eye');
    if (eyes.length === 0) { scheduleBlink(); return; }

    const tl = gsap.timeline({ onComplete: scheduleBlink });
    tl.to(eyes, {
      scaleY: 0.1,
      transformOrigin: '50% 50%',
      duration: 0.08,
      ease: 'power2.in'
    });
    tl.to(eyes, {
      scaleY: 1,
      duration: 0.1,
      ease: 'power2.out'
    });
  }

  // ─── Idle Mood Shuffle ───

  function startMoodShuffle() {
    moodShuffleActive = true;
    scheduleMoodChange();
  }

  function stopMoodShuffle() {
    moodShuffleActive = false;
    if (moodShuffleTimer) { moodShuffleTimer.kill(); moodShuffleTimer = null; }
  }

  function scheduleMoodChange() {
    if (!moodShuffleActive || typeof gsap === 'undefined') return;
    const delay = 3 + Math.random() * 4; // 3-7s between mood changes
    moodShuffleTimer = gsap.delayedCall(delay, doMoodChange);
  }

  function doMoodChange() {
    if (!moodShuffleActive || !isLayered || pinnedMood || _isTransitioning) {
      scheduleMoodChange();
      return;
    }

    // Pick a different mood from the curated set
    let next;
    do {
      next = SHUFFLE_MOODS[Math.floor(Math.random() * SHUFFLE_MOODS.length)];
    } while (next === currentExpression);

    // Transition with squash-settle — accessories render after face swap (120ms)
    currentExpression = next;
    transitionExpression(next, () => {
      if (characterSvg && typeof JestyAccessories !== 'undefined') {
        JestyAccessories.renderAccessories(next, characterSvg);
      }
      if (_currentColor) recolorLayers(_currentColor);
    });

    scheduleMoodChange();
  }

  // ─── Positioning: Always centered ───

  function getCenterX() {
    if (!stage) return 0;
    return (stage.clientWidth - CHARACTER_WIDTH) / 2;
  }

  function snapToCenter() {
    if (!stage || !characterWrapper) return;
    x = getCenterX();
    direction = 1;
    characterWrapper.style.transform = `translateX(${x}px) scaleX(1)`;
    isStrolling = false;
  }

  function bounceIn() {
    if (!stage || !characterWrapper || typeof gsap === 'undefined') { snapToCenter(); return; }
    const center = getCenterX();
    // Start off-screen to the left
    x = -CHARACTER_WIDTH;
    direction = 1;
    applyPosition();
    isStrolling = true;

    // Lean + stretch while sliding in (speed feel) — apply to SVG so accessories follow
    gsap.fromTo(characterSvg,
      { scaleX: 1.12, scaleY: 0.9, rotation: -8, transformOrigin: '50% 100%' },
      { scaleX: 1, scaleY: 1, rotation: 0, duration: 0.6, delay: 0.25, ease: 'elastic.out(1, 0.6)' }
    );

    gsap.to({ val: x }, {
      val: center,
      duration: 0.6,
      ease: 'back.out(1.8)',
      onUpdate: function () { x = this.targets()[0].val; applyPosition(); },
      onComplete: () => {
        isStrolling = false;
        // Kick first mood change shortly after landing
        if (moodShuffleActive) {
          if (moodShuffleTimer) moodShuffleTimer.kill();
          moodShuffleTimer = gsap.delayedCall(2, () => {
            _isTransitioning = false; // safety reset
            doMoodChange();
          });
        }
      }
    });
  }

  function applyPosition() {
    const scaleX = direction === -1 ? -1 : 1;
    characterWrapper.style.transform = `translateX(${x}px) scaleX(${scaleX})`;
  }

  // Subtle lateral sway — only for specific moods, very small range, no walking
  let swayTl = null;

  function scheduleSwayCheck() {
    if (typeof gsap === 'undefined') return;
    const delay = 15 + Math.random() * 15; // 15-30s between checks
    strollTimer = gsap.delayedCall(delay, doSwayCheck);
  }

  function doSwayCheck() {
    if (!stage || !characterWrapper || isStrolling || _isTransitioning) { scheduleSwayCheck(); return; }
    // Only sway in specific moods — 30% chance to actually do it
    if (!SWAY_MOODS.includes(currentExpression) || Math.random() > 0.3) { scheduleSwayCheck(); return; }

    isStrolling = true;
    const center = getCenterX();
    const maxSway = 15; // tiny: ±15px max
    const offset = (Math.random() - 0.5) * 2 * maxSway;
    const target = center + offset;

    swayTl = gsap.timeline({
      onComplete: () => {
        // Drift back to center
        gsap.to({ val: x }, {
          val: center,
          duration: 1.5,
          ease: 'sine.inOut',
          onUpdate: function () { x = this.targets()[0].val; applyPosition(); },
          onComplete: () => { isStrolling = false; scheduleSwayCheck(); }
        });
      }
    });
    swayTl.to({ val: x }, {
      val: target,
      duration: 1.2,
      ease: 'sine.inOut',
      onUpdate: function () { x = this.targets()[0].val; applyPosition(); }
    });
  }


  // ─── Expression Transitions ───

  // Guard: true while a squash-settle is in flight — blocks mood changes
  let _isTransitioning = false;

  function transitionExpression(mood, onSwap) {
    if (!isLayered || typeof gsap === 'undefined') {
      // Fallback: instant swap
      applyExpressionData(mood);
      if (onSwap) onSwap();
      return;
    }

    // Kill any in-flight transition to prevent overlap
    if (_transitionTl) { _transitionTl.kill(); _transitionTl = null; _isTransitioning = false; }

    _isTransitioning = true;

    // Pause breathing — it also animates scaleY on contentWrap and would conflict
    if (idleTl) idleTl.pause();

    // Kill arm sway — limb SVG paths change during the swap, stale tweens break them
    _armSwayTweens.forEach(tw => tw.kill());
    _armSwayTweens = [];
    // Reset arm rotation to 0 so the new expression starts clean
    gsap.set([layers.leftArm, layers.rightArm], { rotation: 0 });

    // Match the accessories-page 4-phase squash-settle (0.52s total)
    const tl = gsap.timeline({
      onComplete: () => {
        _isTransitioning = false;
        _transitionTl = null;

        // Resume breathing
        if (idleTl) {
          gsap.set(layers.contentWrap, { scaleY: 1, scaleX: 1, transformOrigin: '50% 100%' });
          idleTl.restart();
        }

        // Restart arm sway with the new limb geometry
        _armSwayTweens = [
          gsap.to(layers.leftArm, {
            rotation: 2, transformOrigin: '50% 0%',
            duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true
          }),
          gsap.to(layers.rightArm, {
            rotation: -2, transformOrigin: '50% 0%',
            duration: 3, ease: 'sine.inOut', repeat: -1, yoyo: true
          })
        ];
      }
    });
    _transitionTl = tl;

    // 1. Squash anticipation (0% → 23% of 520ms ≈ 120ms)
    tl.to(layers.contentWrap, {
      scaleY: 0.92,
      scaleX: 1.04,
      transformOrigin: '50% 100%',
      duration: 0.12,
      ease: 'power2.in',
      onComplete: () => {
        // Swap layers at peak squash
        applyExpressionData(mood);
        if (_currentColor) recolorLayers(_currentColor);
        if (onSwap) onSwap();
      }
    });

    // 2. Overshoot (23% → 50% ≈ 140ms)
    tl.to(layers.contentWrap, {
      scaleY: 1.08,
      scaleX: 0.97,
      transformOrigin: '50% 100%',
      duration: 0.14,
      ease: 'power2.out'
    });

    // 3. Settle (50% → 72% ≈ 115ms)
    tl.to(layers.contentWrap, {
      scaleY: 0.97,
      scaleX: 1.01,
      transformOrigin: '50% 100%',
      duration: 0.115,
      ease: 'sine.inOut'
    });

    // 4. Rest (72% → 100% ≈ 145ms)
    tl.to(layers.contentWrap, {
      scaleY: 1,
      scaleX: 1,
      transformOrigin: '50% 100%',
      duration: 0.145,
      ease: 'sine.out'
    });

    // Accessories jiggle overlaps the settle/rest phases
    tl.to(layers.accessories, {
      rotation: 3,
      transformOrigin: '50% 100%',
      duration: 0.1,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1
    }, '-=0.3');
  }

  // ─── Reactive Animations ───

  function react(type) {
    if (!isLayered || typeof gsap === 'undefined' || _isTransitioning) return;

    const wrap = layers.contentWrap;

    switch (type) {
      case 'roast':
        // Bounce
        gsap.timeline()
          .to(wrap, { y: -8, duration: 0.15, ease: 'power2.out' })
          .to(wrap, { y: 0, duration: 0.3, ease: 'bounce.out' });
        break;

      case 'scared':
        // Shrink + shake
        gsap.timeline()
          .to(wrap, { scaleX: 0.9, scaleY: 0.9, transformOrigin: '50% 100%', duration: 0.1 })
          .to(wrap, { x: -3, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' })
          .to(wrap, { scaleX: 1, scaleY: 1, x: 0, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
        break;

      case 'celebrate':
        // Jump + wobble
        gsap.timeline()
          .to(wrap, { y: -15, scaleY: 1.05, transformOrigin: '50% 100%', duration: 0.2, ease: 'power2.out' })
          .to(wrap, { y: 0, scaleY: 1, duration: 0.4, ease: 'bounce.out' })
          .to(wrap, { rotation: 3, duration: 0.1, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '-=0.3')
          .to(wrap, { rotation: 0, duration: 0.15 });
        break;

      case 'error':
        // Quick shake
        gsap.timeline()
          .to(wrap, { x: -4, duration: 0.04, repeat: 3, yoyo: true, ease: 'none' })
          .to(wrap, { x: 0, duration: 0.1 });
        break;
    }
  }

  // ─── Color tracking ───
  let _currentColor = null;

  function setColor(color) {
    _currentColor = color;
    if (isLayered) recolorLayers(color);
  }

  // ─── Public API ───

  function init(stageEl, wrapperEl, svgEl) {
    stage = stageEl;
    characterWrapper = wrapperEl;
    characterSvg = svgEl;

    x = (stage.clientWidth - CHARACTER_WIDTH) / 2;

    // Check if GSAP and expression data are available
    if (typeof gsap !== 'undefined' && typeof JestyCharacters !== 'undefined' && JestyCharacters.getExpressionData) {
      buildLayeredSVG(svgEl);
      applyExpressionData('smug');
      if (_currentColor) recolorLayers(_currentColor);
      bounceIn();
      startIdleAnimations();
      scheduleSwayCheck();
    } else {
      // Fallback: use old rAF approach for non-GSAP contexts
      isLayered = false;
      _fallbackInit();
    }
  }

  function stop() {
    if (typeof gsap !== 'undefined') {
      if (idleTl) idleTl.kill();
      if (blinkTl) blinkTl.kill();
      if (swayTl) swayTl.kill();
      if (strollTimer) strollTimer.kill();
      if (moodShuffleTimer) moodShuffleTimer.kill();
      if (_transitionTl) _transitionTl.kill();
      _armSwayTweens.forEach(tw => tw.kill());
      _armSwayTweens = [];
      gsap.killTweensOf([layers.contentWrap, layers.leftArm, layers.rightArm,
        layers.leftLeg, layers.rightLeg, layers.accessories]);
    }
    if (_fallbackAnimId) {
      cancelAnimationFrame(_fallbackAnimId);
      _fallbackAnimId = null;
    }
    if (expressionTimeout) {
      clearTimeout(expressionTimeout);
      expressionTimeout = null;
    }
    idleTl = null;
    blinkTl = null;
    swayTl = null;
    strollTimer = null;
    moodShuffleTimer = null;
    _transitionTl = null;
    moodShuffleActive = false;
    pinnedMood = null;
    isStrolling = false;
    _isTransitioning = false;
  }

  function setExpression(mood, duration) {
    currentExpression = mood;

    if (isLayered) {
      transitionExpression(mood);
    } else {
      // Fallback: old <use> swap
      const useEl = characterSvg && characterSvg.querySelector('use');
      if (useEl) useEl.setAttribute('href', `#face-${mood}`);
    }

    if (expressionTimeout) {
      clearTimeout(expressionTimeout);
      expressionTimeout = null;
    }

    if (duration && duration > 0) {
      // Pin this mood: pause shuffle while the expression is held
      pinnedMood = mood;
      expressionTimeout = setTimeout(() => {
        pinnedMood = null;
        // Resume shuffle — don't snap back to smug, let shuffle take over
      }, duration);
    }
  }

  function getExpression() {
    return currentExpression;
  }

  // ─── Fallback rAF (no GSAP) ───
  let _fallbackAnimId = null;
  let _fbBobPhase = 0;
  let _fbBlinkTimer = 0;
  let _fbNextBlink = 3;
  let _fbLastTs = 0;

  function _fallbackInit() {
    _fbLastTs = 0;
    // Center the character
    x = getCenterX();
    characterWrapper.style.transform = `translateX(${x}px) scaleX(1)`;
    _fallbackAnimId = requestAnimationFrame(_fallbackTick);
  }

  function _fallbackTick(timestamp) {
    if (!_fbLastTs) _fbLastTs = timestamp;
    const dt = (timestamp - _fbLastTs) / 1000;
    _fbLastTs = timestamp;

    if (!stage || !characterWrapper) {
      _fallbackAnimId = requestAnimationFrame(_fallbackTick);
      return;
    }

    // Stay centered — only subtle breathing bob
    x = getCenterX();
    _fbBobPhase += dt * Math.PI * 0.5;
    const bobY = Math.sin(_fbBobPhase) * 2;
    characterWrapper.style.transform = `translate(${x}px, ${bobY}px) scaleX(1)`;

    _fbBlinkTimer += dt;
    if (_fbBlinkTimer >= _fbNextBlink) {
      if (characterSvg) {
        characterSvg.style.transition = 'transform 0.08s ease-in';
        characterSvg.style.transform = 'scaleY(0.9)';
        setTimeout(() => { characterSvg.style.transition = 'transform 0.1s ease-out'; characterSvg.style.transform = 'scaleY(1)'; }, 80);
        setTimeout(() => { characterSvg.style.transition = ''; }, 200);
      }
      _fbBlinkTimer = 0;
      _fbNextBlink = 2.5 + Math.random() * 4;
    }

    _fallbackAnimId = requestAnimationFrame(_fallbackTick);
  }

  function tapMoodChange() {
    if (pinnedMood) return;

    // Kill any in-flight transition so tap always responds
    if (_isTransitioning) {
      if (_transitionTl) { _transitionTl.kill(); _transitionTl = null; }
      _isTransitioning = false;
      if (isLayered && layers.contentWrap && typeof gsap !== 'undefined') {
        gsap.set(layers.contentWrap, { scaleY: 1, scaleX: 1, transformOrigin: '50% 100%' });
        if (idleTl) { idleTl.restart(); }
      }
    }

    // Reset auto shuffle timer so they don't collide
    if (moodShuffleTimer) { moodShuffleTimer.kill(); moodShuffleTimer = null; }

    let next;
    do {
      next = SHUFFLE_MOODS[Math.floor(Math.random() * SHUFFLE_MOODS.length)];
    } while (next === currentExpression);

    currentExpression = next;

    if (isLayered) {
      transitionExpression(next, () => {
        if (characterSvg && typeof JestyAccessories !== 'undefined') {
          JestyAccessories.renderAccessories(next, characterSvg);
        }
        if (_currentColor) recolorLayers(_currentColor);
      });
    } else {
      // Fallback: instant swap
      const useEl = characterSvg && characterSvg.querySelector('use');
      if (useEl) useEl.setAttribute('href', `#face-${next}`);
    }

    // Reschedule auto shuffle
    if (moodShuffleActive) scheduleMoodChange();
  }

  return { init, stop, setExpression, getExpression, react, setColor, recolorLayers, snapToCenter, tapMoodChange, isLayered: () => isLayered, getLayers: () => layers };
})();

if (typeof window !== 'undefined') {
  window.JestyAnimator = JestyAnimator;
}
