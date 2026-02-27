/**
 * Jesty Character Animator
 * Drives requestAnimationFrame-based character movement and idle animations.
 * Walking, bobbing, blinking, expression switching.
 */
const JestyAnimator = (() => {
  let stage = null;
  let characterWrapper = null;
  let characterSvg = null;
  let animationId = null;
  let lastTimestamp = 0;

  // Position & movement
  let x = 0;
  let direction = 1;
  let speed = 25; // pixels per second
  const CHARACTER_WIDTH = 140;

  // Idle animation phases
  let bobPhase = 0;
  let blinkTimer = 0;
  let nextBlinkAt = 3;

  // Pause state (character stops walking sometimes)
  let pauseTimer = 0;
  let nextPauseAt = 4 + Math.random() * 6;
  let pauseDuration = 0;
  let isPaused = false;

  // Expression state
  let currentExpression = 'smug';
  let expressionTimeout = null;

  function tick(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (!stage || !characterWrapper) {
      animationId = requestAnimationFrame(tick);
      return;
    }

    const stageWidth = stage.clientWidth;

    // Pause logic: occasionally stop walking
    if (!isPaused) {
      pauseTimer += dt;
      if (pauseTimer >= nextPauseAt) {
        isPaused = true;
        pauseDuration = 1.5 + Math.random() * 2.5;
        pauseTimer = 0;
        nextPauseAt = 5 + Math.random() * 8;
      }
    }

    if (isPaused) {
      pauseDuration -= dt;
      if (pauseDuration <= 0) {
        isPaused = false;
        // Occasionally flip direction after a pause
        if (Math.random() < 0.3) direction *= -1;
      }
    }

    // Walking
    if (!isPaused) {
      x += speed * direction * dt;

      if (x + CHARACTER_WIDTH > stageWidth) {
        x = stageWidth - CHARACTER_WIDTH;
        direction = -1;
      } else if (x < 0) {
        x = 0;
        direction = 1;
      }
    }

    // Body bob (sine wave, ~3px amplitude, ~2s period)
    bobPhase += dt * Math.PI;
    const bobY = Math.sin(bobPhase) * 3;

    // Apply transforms to wrapper
    const scaleX = direction === -1 ? -1 : 1;
    characterWrapper.style.transform =
      `translate(${x}px, ${bobY}px) scaleX(${scaleX})`;

    // Eye blink
    blinkTimer += dt;
    if (blinkTimer >= nextBlinkAt) {
      doBlink();
      blinkTimer = 0;
      nextBlinkAt = 2.5 + Math.random() * 4;
    }

    animationId = requestAnimationFrame(tick);
  }

  function doBlink() {
    if (!characterSvg) return;
    characterSvg.style.transition = 'transform 0.08s ease-in';
    characterSvg.style.transform = 'scaleY(0.9)';
    setTimeout(() => {
      characterSvg.style.transition = 'transform 0.1s ease-out';
      characterSvg.style.transform = 'scaleY(1)';
    }, 80);
    setTimeout(() => {
      characterSvg.style.transition = '';
    }, 200);
  }

  function setExpression(mood, duration) {
    if (!characterSvg) return;
    currentExpression = mood;

    const useEl = characterSvg.querySelector('use');
    if (useEl) {
      useEl.setAttribute('href', `#face-${mood}`);
    }

    if (expressionTimeout) {
      clearTimeout(expressionTimeout);
      expressionTimeout = null;
    }

    if (duration && duration > 0) {
      expressionTimeout = setTimeout(() => {
        setExpression('smug', 0);
      }, duration);
    }
  }

  function getExpression() {
    return currentExpression;
  }

  function init(stageEl, wrapperEl, svgEl) {
    stage = stageEl;
    characterWrapper = wrapperEl;
    characterSvg = svgEl;

    x = (stage.clientWidth - CHARACTER_WIDTH) / 2;
    nextBlinkAt = 2 + Math.random() * 3;
    lastTimestamp = 0;

    animationId = requestAnimationFrame(tick);
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (expressionTimeout) {
      clearTimeout(expressionTimeout);
      expressionTimeout = null;
    }
  }

  return { init, stop, setExpression, getExpression };
})();

if (typeof window !== 'undefined') {
  window.JestyAnimator = JestyAnimator;
}
