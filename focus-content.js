/**
 * Jesty Focus Island — Content Script
 * Injects a floating island iframe on every page during an active focus session.
 * Always visible while focus is active.
 * Communicates via chrome.storage.local + onChanged.
 */
(() => {
  const ISLAND_URL = chrome.runtime.getURL('focus-island.html');
  let iframe = null;

  function createIsland() {
    if (iframe) return;
    if (document.getElementById('jesty-focus-island')) return;
    if (!document.body) return;

    iframe = document.createElement('iframe');
    iframe.src = ISLAND_URL;
    iframe.id = 'jesty-focus-island';
    iframe.allow = 'transparency';
    iframe.style.cssText = [
      'position: fixed !important',
      'bottom: 0 !important',
      'left: 0 !important',
      'width: 320px !important',
      'height: 220px !important',
      'border: none !important',
      'z-index: 2147483647 !important',
      'background: transparent !important',
      'background-color: transparent !important',
      'pointer-events: auto !important',
      'overflow: visible !important',
      'color-scheme: only light',
      'opacity: 0',
      'transition: opacity 0.3s ease'
    ].join('; ');

    document.body.appendChild(iframe);

    setTimeout(() => {
      if (iframe) iframe.style.opacity = '1';
    }, 100);
  }

  function removeIsland() {
    const existing = document.getElementById('jesty-focus-island');
    if (!iframe && existing) {
      existing.style.opacity = '0';
      setTimeout(() => { try { existing.remove(); } catch (e) {} }, 300);
      return;
    }
    if (!iframe) return;
    iframe.style.opacity = '0';
    const el = iframe;
    iframe = null;
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 300);
  }

  // Check on load
  chrome.storage.local.get(['focusSession'], (result) => {
    if (result.focusSession && result.focusSession.active) {
      if (document.body) {
        createIsland();
      } else {
        document.addEventListener('DOMContentLoaded', () => createIsland());
      }
    }
  });

  // Listen for session changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusSession) {
      const session = changes.focusSession.newValue;
      if (session && session.active) {
        createIsland();
      } else {
        removeIsland();
      }
    }
  });

  // Listen for direct messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'focus-island-show') {
      createIsland();
    } else if (msg.type === 'focus-island-hide') {
      removeIsland();
    }
  });
})();
