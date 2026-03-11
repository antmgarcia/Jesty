/**
 * Jesty Focus Audio — Web Audio API noise generator
 * Generates white, brown, and pink noise synthetically (zero bundle size).
 * Plays from sidepanel (persistent surface) during focus sessions.
 */
const JestyFocusAudio = (() => {
  let audioCtx = null;
  let activeSource = null;
  let gainNode = null;
  let _currentTrack = null;
  let _volume = 0.5;

  const TRACKS = [
    { id: 'brown', name: 'Brown Noise', desc: 'Deep focus', icon: 'wave-brown' },
    { id: 'pink', name: 'Pink Noise', desc: 'Creative flow', icon: 'wave-pink' },
    { id: 'white', name: 'White Noise', desc: 'Full masking', icon: 'wave-white' }
  ];

  /**
   * Domain → noise type mapping for adaptive selection.
   * Categorizes open tabs and picks the best noise.
   */
  const ADAPTIVE_RULES = {
    // Code/dev → brown (deep concentration)
    code: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io',
           'replit.com', 'codesandbox.io', 'leetcode.com', 'hackerrank.com',
           'linear.app', 'jira', 'vercel.com', 'netlify.com'],
    // Writing/creative → pink (verbal/creative flow)
    writing: ['docs.google.com', 'notion.so', 'medium.com', 'substack.com',
              'wordpress.com', 'figma.com', 'canva.com', 'miro.com',
              'evernote.com', 'obsidian.md'],
    // Study/research → white (alertness)
    study: ['wikipedia.org', 'scholar.google.com', 'coursera.org', 'udemy.com',
            'khanacademy.org', 'edx.org', 'duolingo.com', 'arxiv.org']
  };

  function getContext() {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = _volume;
      gainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Create a noise buffer of the given type.
   * All generated at 2 seconds, looped seamlessly.
   */
  function createNoiseBuffer(ctx, type) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5; // Normalize
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    return buffer;
  }

  /**
   * Play a noise track by id ('white', 'brown', 'pink').
   * Fades in over 500ms for a smooth start.
   */
  function play(trackId) {
    stop(); // Stop any existing playback

    const ctx = getContext();
    const buffer = createNoiseBuffer(ctx, trackId);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);

    // Fade in
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(_volume, ctx.currentTime + 0.5);

    source.start();
    activeSource = source;
    _currentTrack = trackId;

    // Persist selection
    chrome.storage.local.set({ focusAudioTrack: trackId, focusAudioVolume: _volume });
  }

  /**
   * Stop playback with a 300ms fade out.
   */
  function stop() {
    if (activeSource && audioCtx) {
      try {
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        const src = activeSource;
        setTimeout(() => { try { src.stop(); } catch (e) {} }, 350);
      } catch (e) {}
    }
    activeSource = null;
    _currentTrack = null;
    chrome.storage.local.remove('focusAudioTrack');
  }

  /**
   * Set volume (0-1). Applies immediately if playing.
   */
  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (gainNode && audioCtx) {
      gainNode.gain.linearRampToValueAtTime(_volume, audioCtx.currentTime + 0.1);
    }
    chrome.storage.local.set({ focusAudioVolume: _volume });
  }

  function getVolume() { return _volume; }
  function getCurrentTrack() { return _currentTrack; }
  function isPlaying() { return !!activeSource; }
  function getTracks() { return [...TRACKS]; }

  /**
   * Pick the best noise type based on open tabs.
   * Falls back to brown noise (universally good).
   */
  async function getAdaptiveTrack() {
    try {
      const { openTabs = {} } = await chrome.storage.local.get(['openTabs']);
      const urls = Object.values(openTabs).map(t => (t.url || '').toLowerCase());

      let codeScore = 0, writeScore = 0, studyScore = 0;
      for (const url of urls) {
        for (const domain of ADAPTIVE_RULES.code) {
          if (url.includes(domain)) { codeScore++; break; }
        }
        for (const domain of ADAPTIVE_RULES.writing) {
          if (url.includes(domain)) { writeScore++; break; }
        }
        for (const domain of ADAPTIVE_RULES.study) {
          if (url.includes(domain)) { studyScore++; break; }
        }
      }

      if (writeScore > codeScore && writeScore > studyScore) return 'pink';
      if (studyScore > codeScore && studyScore > writeScore) return 'white';
      return 'brown'; // Default — code or mixed
    } catch {
      return 'brown';
    }
  }

  /**
   * Restore audio state (e.g., after sidepanel reopen during active focus).
   */
  async function restore() {
    const { focusAudioTrack, focusAudioVolume, focusSession } =
      await chrome.storage.local.get(['focusAudioTrack', 'focusAudioVolume', 'focusSession']);

    if (focusAudioVolume !== undefined) _volume = focusAudioVolume;
    if (focusAudioTrack && focusSession && focusSession.active) {
      play(focusAudioTrack);
    }
  }

  return {
    play, stop, setVolume, getVolume,
    getCurrentTrack, isPlaying, getTracks,
    getAdaptiveTrack, restore
  };
})();

if (typeof window !== 'undefined') {
  window.JestyFocusAudio = JestyFocusAudio;
}
